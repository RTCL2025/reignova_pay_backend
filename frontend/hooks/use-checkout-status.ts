'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { getCheckoutStatus } from '@/lib/checkout-api';
import type { CheckoutStatus } from '@/types/checkout';

interface UseCheckoutStatusOptions {
  publicToken: string;
  initialStatus: CheckoutStatus;
  pollIntervalMs?: number;
  maxDurationMs?: number;
  onStatusChange?: (newStatus: CheckoutStatus, failureReason?: string | null) => void;
}

export function useCheckoutStatus({
  publicToken,
  initialStatus,
  pollIntervalMs = 2500,
  maxDurationMs = 180000, // 3 minutes
  onStatusChange,
}: UseCheckoutStatusOptions) {
  const [status, setStatus] = useState<CheckoutStatus>(initialStatus);
  const [failureReason, setFailureReason] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(initialStatus === 'PROCESSING');
  const [error, setError] = useState<string | null>(null);

  const startTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const callbackRef = useRef(onStatusChange);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = onStatusChange;
  }, [onStatusChange]);

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const checkStatus = useCallback(async () => {
    if (!publicToken) return;

    try {
      const res = await getCheckoutStatus(publicToken);
      if (!isMountedRef.current) return;

      const newStatus = res.status;
      const reason = res.failureReason || null;

      if (newStatus !== status) {
        setStatus(newStatus);
        setFailureReason(reason);
        callbackRef.current?.(newStatus, reason);
      }

      // Check terminal states
      const isTerminal = ['COMPLETED', 'FAILED', 'EXPIRED', 'CANCELLED'].includes(newStatus);
      if (isTerminal) {
        stopPolling();
        return;
      }

      // Check timeout
      if (Date.now() - startTimeRef.current >= maxDurationMs) {
        stopPolling();
        setError('Payment verification timed out. Please check your mobile phone SMS or refresh this page.');
        return;
      }

      // Continue polling if still processing
      if (isMountedRef.current && isPolling) {
        timerRef.current = setTimeout(checkStatus, pollIntervalMs);
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      // Network hiccup - don't immediately fail, retry on next cycle unless consecutive errors exceed threshold
      if (isPolling) {
        timerRef.current = setTimeout(checkStatus, pollIntervalMs);
      }
    }
  }, [publicToken, status, isPolling, maxDurationMs, pollIntervalMs, stopPolling]);

  const startPolling = useCallback(() => {
    startTimeRef.current = Date.now();
    setIsPolling(true);
    setError(null);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    if (isPolling) {
      timerRef.current = setTimeout(checkStatus, pollIntervalMs);
    }

    return () => {
      isMountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isPolling, checkStatus, pollIntervalMs]);

  // If status changes externally to PROCESSING, trigger polling
  useEffect(() => {
    if (status === 'PROCESSING' && !isPolling) {
      startPolling();
    }
  }, [status, isPolling, startPolling]);

  return {
    status,
    setStatus,
    failureReason,
    isPolling,
    error,
    startPolling,
    stopPolling,
  };
}
