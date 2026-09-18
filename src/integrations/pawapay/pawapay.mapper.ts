import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';
import { PaymentStatus } from '../../models/payment.model.js';
import { CheckoutStatus } from '../../models/checkout.model.js';
import {
  PawapayDepositRequest,
  PawapayPayoutRequest,
  PawapayRefundRequest,
  PawapayCheckoutRequest,
  PawapayStatus
} from './pawapay.types.js';
import {
  ProviderDepositRequest,
  ProviderPayoutRequest,
  ProviderRefundRequest,
  ProviderCheckoutRequest
} from '../../types/provider.types.js';
import { ValidationError } from '../../utils/errors.js';

export const ISO2_TO_ISO3_COUNTRY: Record<string, string> = {
  TZ: 'TZA',
  ZM: 'ZMB',
  UG: 'UGA',
  GH: 'GHA',
  KE: 'KEN',
  RW: 'RWA',
  NG: 'NGA',
  SN: 'SEN',
  CI: 'CIV',
  CM: 'CMR',
  BF: 'BFA',
  BJ: 'BEN',
  CD: 'COD',
  MW: 'MWI',
  MZ: 'MOZ',
  SL: 'SLE'
};

const ZERO_DECIMAL_CURRENCIES = new Set([
  'TZS', 'UGX', 'RWF', 'BIF', 'GNF', 'XAF', 'XOF', 'KMF', 'DJF', 'JPY', 'KRW', 'VND'
]);

export function formatCurrencyAmount(amount: number, currency: string): string {
  const upper = currency.toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(upper)) {
    return Math.round(amount).toString();
  }
  return amount.toFixed(2);
}


// Supported mobile money providers in Tanzania: Vodacom, Airtel, Yas (formerly Tigo)
export const TANZANIA_PROVIDERS: Record<string, string> = {
  // Vodacom Tanzania
  VODACOM_TZA: 'VODACOM_TZA',
  VODACOM: 'VODACOM_TZA',
  MPESA: 'VODACOM_TZA',

  // Airtel Tanzania
  AIRTEL_TZA: 'AIRTEL_TZA',
  AIRTEL: 'AIRTEL_TZA',

  // Yas Tanzania (formerly Tigo) -> mapped to Pawapay operator code TIGO_TZA
  YAS_TZA: 'TIGO_TZA',
  YAS: 'TIGO_TZA',
  TIGO_TZA: 'TIGO_TZA',
  TIGO: 'TIGO_TZA'
};

export class PawapayMapper {
  /**
   * Validates and returns the 3-letter ISO code for Tanzania (TZA).
   */
  static toAlpha3Country(country: string): string {
    const upper = country.trim().toUpperCase();
    if (upper !== 'TZ' && upper !== 'TZA') {
      throw new ValidationError(
        `Only Tanzania ('TZ') is supported. Received unsupported country: '${country}'`
      );
    }
    return 'TZA';
  }

  /**
   * Normalizes provider name to Pawapay Tanzania operator codes:
   * VODACOM_TZA, AIRTEL_TZA, or TIGO_TZA (for Yas).
   */
  static normalizeProvider(provider: string): string {
    const upper = provider.trim().toUpperCase();
    const mapped = TANZANIA_PROVIDERS[upper];
    if (!mapped) {
      throw new ValidationError(
        `Unsupported provider '${provider}'. Only Vodacom (VODACOM_TZA), Airtel (AIRTEL_TZA), and Yas/Tigo (YAS_TZA / TIGO_TZA) are supported in Tanzania.`
      );
    }
    return mapped;
  }

  /**
   * Normalizes E.164 phone number to MSISDN format (digits only, country code included, no +).
   * e.g. +255700000000 -> 255700000000
   */
  static toMsisdn(phoneNumber: string): string {
    if (!isValidPhoneNumber(phoneNumber)) {
      // Fallback: strip any non-digits
      const digits = phoneNumber.replace(/\D/g, '');
      if (digits.length < 8) {
        throw new ValidationError(`Invalid phone number format: '${phoneNumber}'`);
      }
      return digits;
    }
    const parsed = parsePhoneNumber(phoneNumber);
    // Strip the leading '+'
    return parsed.number.replace('+', '');
  }

  /**
   * Converts internal metadata object to Pawapay array format:
   * e.g. { orderId: "123", customer: "John" } -> [ { orderId: "123" }, { customer: "John" } ]
   */
  static toPawapayMetadata(
    metadata?: Record<string, unknown>
  ): Array<Record<string, string>> | undefined {
    if (!metadata || Object.keys(metadata).length === 0) {
      return undefined;
    }
    return Object.entries(metadata).map(([key, value]) => ({
      [key]: typeof value === 'object' ? JSON.stringify(value) : String(value)
    }));
  }

  /**
   * Maps an internal deposit request into a Pawapay V2 deposit request payload.
   * Note: Pawapay V2 /v2/deposits strictly forbids the 'country' field at root
   * and requires integer amounts (0 decimals) for zero-decimal currencies like TZS, UGX, RWF.
   */
  static toPawapayDepositRequest(
    request: ProviderDepositRequest,
    provider: string
  ): PawapayDepositRequest {
    this.toAlpha3Country(request.country);
    const msisdn = this.toMsisdn(request.phoneNumber);
    const normalizedProvider = this.normalizeProvider(provider);

    // TZS is zero-decimal
    const formattedAmount = Math.round(request.amount).toString();

    // Pawapay customerMessage: alphanumeric and spaces only, max 22 chars for strict operator limits
    const sanitizedCustomerMessage = request.description
      ? request.description.replace(/[^a-zA-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 22) || undefined
      : undefined;

    return {
      depositId: request.paymentId,
      amount: formattedAmount,
      currency: 'TZS',
      payer: {
        type: 'MMO',
        accountDetails: {
          phoneNumber: msisdn,
          provider: normalizedProvider
        }
      },
      clientReferenceId: request.reference,
      customerMessage: sanitizedCustomerMessage,
      metadata: this.toPawapayMetadata(request.metadata)
    };
  }

  /**
   * Normalizes country code to 3-letter ISO code for general multi-country support.
   */
  static normalizeCountry(country: string): string {
    const upper = country.trim().toUpperCase();
    if (upper.length === 2) {
      const mapped = ISO2_TO_ISO3_COUNTRY[upper];
      if (mapped) return mapped;
    }
    return upper;
  }

  /**
   * Normalizes provider code generally across countries.
   */
  static normalizeProviderGeneral(provider: string, country?: string): string {
    const upper = provider.trim().toUpperCase();
    if (country) {
      const normCountry = this.normalizeCountry(country);
      if (normCountry === 'TZA' && TANZANIA_PROVIDERS[upper]) {
        return TANZANIA_PROVIDERS[upper];
      }
    } else if (TANZANIA_PROVIDERS[upper]) {
      return TANZANIA_PROVIDERS[upper];
    }
    return upper;
  }

  /**
   * Sanitizes customer message for Pawapay requirements (alphanumeric and spaces only, 4-22 chars).
   */
  static sanitizeCustomerMessage(msg?: string, fallback = 'Payout'): string {
    const cleaned = (msg || fallback).replace(/[^a-zA-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    if (cleaned.length < 4) {
      return (cleaned + ' Payout').slice(0, 22);
    }
    return cleaned.slice(0, 22);
  }

  /**
   * Maps an internal payout request into a Pawapay V2 payout request payload.
   */
  static toPawapayPayoutRequest(
    request: ProviderPayoutRequest,
    provider: string
  ): PawapayPayoutRequest {
    const msisdn = this.toMsisdn(request.phoneNumber);
    const normalizedProvider = this.normalizeProviderGeneral(provider, request.country);
    const formattedAmount = formatCurrencyAmount(request.amount, request.currency);
    const customerMessage = this.sanitizeCustomerMessage(
      request.customerMessage || request.description || `Payout ${request.reference}`
    );

    return {
      payoutId: request.paymentId,
      amount: formattedAmount,
      currency: request.currency.toUpperCase(),
      recipient: {
        type: 'MMO',
        accountDetails: {
          phoneNumber: msisdn,
          provider: normalizedProvider
        }
      },
      customerMessage,
      clientReferenceId: request.reference,
      metadata: this.toPawapayMetadata(request.metadata)
    };
  }

  /**
   * Maps an internal refund request into a Pawapay V2 refund request payload.
   */
  static toPawapayRefundRequest(request: ProviderRefundRequest): PawapayRefundRequest {
    return {
      refundId: request.refundId,
      depositId: request.depositId,
      amount: request.amount && request.currency ? formatCurrencyAmount(request.amount, request.currency) : undefined,
      currency: request.currency ? request.currency.toUpperCase() : undefined,
      metadata: this.toPawapayMetadata(request.metadata)
    };
  }

  /**
   * Normalizes returnMethod for Pawapay hosted checkout.
   */
  static normalizeReturnMethod(method?: string): 'INSTANT' | 'COUNTDOWN' | 'CUSTOMER_ACTION' {
    if (!method) return 'INSTANT';
    const upper = method.trim().toUpperCase();
    if (upper === 'COUNTDOWN') return 'COUNTDOWN';
    if (upper === 'CUSTOMER_ACTION') return 'CUSTOMER_ACTION';
    return 'INSTANT';
  }

  /**
   * Maps internal checkout payer format to Pawapay V2 CheckoutPayer schema.
   */
  static toPawapayCheckoutPayer(
    payer?: Record<string, unknown>
  ): PawapayCheckoutRequest['payer'] | undefined {
    if (!payer || Object.keys(payer).length === 0) {
      return undefined;
    }

    // Nested accountDetails provided
    if (typeof payer.accountDetails === 'object' && payer.accountDetails !== null) {
      const details = payer.accountDetails as Record<string, unknown>;
      const rawPhone = details.phoneNumber ? String(details.phoneNumber) : undefined;
      const formattedPhone = rawPhone ? this.toMsisdn(rawPhone) : undefined;
      return {
        type: 'MMO',
        accountDetails: {
          phoneNumber: formattedPhone,
          provider: details.provider ? String(details.provider) : undefined,
          allowCustomerToOverride: details.allowCustomerToOverride !== false
        }
      };
    }

    // Flat format: { phoneNumber, provider, allowCustomerToOverride }
    const rawPhone = payer.phoneNumber ? String(payer.phoneNumber) : undefined;
    if (rawPhone) {
      const formattedPhone = this.toMsisdn(rawPhone);
      return {
        type: 'MMO',
        accountDetails: {
          phoneNumber: formattedPhone,
          provider: payer.provider ? String(payer.provider) : undefined,
          allowCustomerToOverride: payer.allowCustomerToOverride !== false
        }
      };
    }

    return undefined;
  }

  /**
   * Maps checkout reason to Pawapay localized format (e.g. { en: 'Order payment' }).
   */
  static toPawapayCheckoutReason(
    reason?: Record<string, unknown> | string,
    defaultLanguage = 'en'
  ): Record<string, string> | undefined {
    if (!reason) {
      return undefined;
    }

    if (typeof reason === 'string') {
      const sanitized = this.sanitizeCustomerMessage(reason, 'Payment');
      return { [defaultLanguage]: sanitized };
    }

    if (typeof reason === 'object' && Object.keys(reason).length > 0) {
      const result: Record<string, string> = {};
      let hasLanguageKey = false;

      for (const [key, val] of Object.entries(reason)) {
        if (typeof val === 'string' && /^[a-z]{2}(-[A-Z]{2})?$/.test(key)) {
          hasLanguageKey = true;
          result[key] = this.sanitizeCustomerMessage(val, 'Payment');
        }
      }

      if (hasLanguageKey) {
        return result;
      }

      // Generic object keys like { orderId: 'ORD-123' } -> map to sanitized description under defaultLanguage
      const firstVal = Object.values(reason)[0];
      const narration =
        typeof firstVal === 'string' || typeof firstVal === 'number'
          ? String(firstVal)
          : 'Order Payment';
      return { [defaultLanguage]: this.sanitizeCustomerMessage(narration, 'Order Payment') };
    }

    return undefined;
  }

  /**
   * Maps an internal checkout request into a Pawapay V2 checkout request payload.
   */
  static toPawapayCheckoutRequest(request: ProviderCheckoutRequest): PawapayCheckoutRequest {
    const mappedAmounts = request.amounts?.map((a) => ({
      country: this.normalizeCountry(a.country),
      currency: a.currency.toUpperCase(),
      amount: typeof a.amount === 'number' ? formatCurrencyAmount(a.amount, a.currency) : a.amount
    }));

    let mappedCountries: string[] | undefined;
    if (request.countries && request.countries.length > 0) {
      mappedCountries = request.countries.map((c) => this.normalizeCountry(c));
    } else if (mappedAmounts && mappedAmounts.length > 0) {
      mappedCountries = Array.from(new Set(mappedAmounts.map((a) => a.country)));
    }

    return {
      checkoutId: request.checkoutId,
      returnUrl: request.returnUrl,
      returnMethod: this.normalizeReturnMethod(request.returnMethod),
      defaultLanguage: request.defaultLanguage || 'en',
      countries: mappedCountries,
      amounts: mappedAmounts,
      payer: this.toPawapayCheckoutPayer(request.payer),
      reason: this.toPawapayCheckoutReason(request.reason, request.defaultLanguage || 'en'),
      expiresAfter: request.expiresAfter,
      clientReferenceId: request.reference,
      metadata: this.toPawapayMetadata(request.metadata)
    };
  }

  /**
   * Maps Pawapay deposit status to internal PaymentStatus.
   */
  static toPaymentStatus(pawapayStatus: PawapayStatus): PaymentStatus {
    switch (pawapayStatus) {
      case 'ACCEPTED':
      case 'PROCESSING':
      case 'IN_RECONCILIATION':
      case 'ENQUEUED':
        return PaymentStatus.PROCESSING;
      case 'COMPLETED':
        return PaymentStatus.COMPLETED;
      case 'FAILED':
        return PaymentStatus.FAILED;
      default:
        return PaymentStatus.PROCESSING;
    }
  }

  /**
   * Maps Pawapay checkout status to internal CheckoutStatus.
   */
  static toCheckoutStatus(pawapayStatus: string): CheckoutStatus {
    const upper = pawapayStatus.toUpperCase();
    switch (upper) {
      case 'WAITING_PAYMENT':
      case 'ACCEPTED':
        return CheckoutStatus.WAITING_PAYMENT;
      case 'PROCESSING':
        return CheckoutStatus.PROCESSING;
      case 'COMPLETED':
        return CheckoutStatus.COMPLETED;
      case 'FAILED':
        return CheckoutStatus.FAILED;
      case 'EXPIRED':
        return CheckoutStatus.EXPIRED;
      case 'CANCELLED':
        return CheckoutStatus.CANCELLED;
      default:
        return CheckoutStatus.WAITING_PAYMENT;
    }
  }
}
