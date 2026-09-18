import {
  PaymentProvider,
  ProviderDepositRequest,
  ProviderDepositResponse,
  ProviderPayoutRequest,
  ProviderPayoutResponse,
  ProviderRefundRequest,
  ProviderRefundResponse,
  ProviderCheckoutRequest,
  ProviderCheckoutResponse,
  ProviderCheckoutStatusResponse,
  ProviderStatusResponse
} from '../../types/provider.types.js';
import { pawapayClient, PawapayClient } from './pawapay.client.js';
import { PawapayMapper } from './pawapay.mapper.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

export class PawapayService implements PaymentProvider {
  public readonly name = 'pawapay';

  constructor(private readonly client: PawapayClient = pawapayClient) {}

  async predictProvider(phoneNumber: string): Promise<string | null> {
    const res = await this.client.predictProvider(phoneNumber);
    return res?.provider || null;
  }

  async initiateDeposit(request: ProviderDepositRequest): Promise<ProviderDepositResponse> {
    let targetProvider = request.provider;

    // Auto-predict provider if not explicitly provided by client
    if (!targetProvider && env.PAWAPAY_AUTO_PREDICT_PROVIDER) {
      const predicted = await this.predictProvider(request.phoneNumber);
      if (predicted) {
        targetProvider = predicted;
        logger.info(
          { phoneNumber: request.phoneNumber, predictedProvider: targetProvider },
          'Auto-predicted mobile money provider'
        );
      }
    }

    if (!targetProvider) {
      // Default fallback for Tanzania if prediction unavailable
      targetProvider = 'VODACOM_TZA';
    }

    const pawapayPayload = PawapayMapper.toPawapayDepositRequest(request, targetProvider);
    const pawapayResponse = await this.client.createDeposit(pawapayPayload);

    return {
      providerPaymentId: pawapayResponse.depositId,
      status: pawapayResponse.status,
      rawResponse: pawapayResponse,
      error: pawapayResponse.rejectionReason
    };
  }

  async checkStatus(providerPaymentId: string): Promise<ProviderStatusResponse> {
    const res = await this.client.getDepositStatus(providerPaymentId);

    if (res.status === 'NOT_FOUND' || !res.data) {
      return {
        providerPaymentId,
        status: 'UNKNOWN'
      };
    }

    const data = res.data;
    let mappedStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

    switch (data.status) {
      case 'ACCEPTED':
      case 'PROCESSING':
      case 'IN_RECONCILIATION':
      case 'ENQUEUED':
        mappedStatus = 'PROCESSING';
        break;
      case 'COMPLETED':
        mappedStatus = 'COMPLETED';
        break;
      case 'FAILED':
        mappedStatus = 'FAILED';
        break;
      default:
        mappedStatus = 'PROCESSING';
    }

    return {
      providerPaymentId,
      status: mappedStatus,
      providerTransactionId: data.providerTransactionId,
      failureReason: data.failureReason?.failureMessage,
      rawResponse: data
    };
  }

  async initiatePayout(request: ProviderPayoutRequest): Promise<ProviderPayoutResponse> {
    let targetProvider = request.provider;

    if (!targetProvider && env.PAWAPAY_AUTO_PREDICT_PROVIDER) {
      const predicted = await this.predictProvider(request.phoneNumber);
      if (predicted) {
        targetProvider = predicted;
        logger.info(
          { phoneNumber: request.phoneNumber, predictedProvider: targetProvider },
          'Auto-predicted mobile money provider for payout'
        );
      }
    }

    if (!targetProvider) {
      targetProvider = 'VODACOM_TZA';
    }

    const payload = PawapayMapper.toPawapayPayoutRequest(request, targetProvider);
    const pawapayResponse = await this.client.createPayout(payload);

    return {
      providerPaymentId: pawapayResponse.payoutId,
      status: pawapayResponse.status,
      rawResponse: pawapayResponse,
      error: pawapayResponse.rejectionReason
    };
  }

  async checkPayoutStatus(providerPaymentId: string): Promise<ProviderStatusResponse> {
    const res = await this.client.getPayoutStatus(providerPaymentId);

    if (res.status === 'NOT_FOUND' || !res.data) {
      return {
        providerPaymentId,
        status: 'UNKNOWN'
      };
    }

    const data = res.data;
    let mappedStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

    switch (data.status) {
      case 'ACCEPTED':
      case 'PROCESSING':
      case 'IN_RECONCILIATION':
      case 'ENQUEUED':
        mappedStatus = 'PROCESSING';
        break;
      case 'COMPLETED':
        mappedStatus = 'COMPLETED';
        break;
      case 'FAILED':
        mappedStatus = 'FAILED';
        break;
      default:
        mappedStatus = 'PROCESSING';
    }

    return {
      providerPaymentId,
      status: mappedStatus,
      providerTransactionId: data.providerTransactionId,
      failureReason:
        data.failureReason?.failureMessage ||
        data.failureReason?.message,
      rawResponse: data
    };
  }

  async initiateRefund(request: ProviderRefundRequest): Promise<ProviderRefundResponse> {
    const payload = PawapayMapper.toPawapayRefundRequest(request);
    const pawapayResponse = await this.client.createRefund(payload);

    return {
      refundId: pawapayResponse.refundId,
      status: pawapayResponse.status,
      rawResponse: pawapayResponse,
      error: pawapayResponse.rejectionReason
    };
  }

  async checkRefundStatus(refundId: string): Promise<ProviderStatusResponse> {
    const res = await this.client.getRefundStatus(refundId);

    if (res.status === 'NOT_FOUND' || !res.data) {
      return {
        providerPaymentId: refundId,
        status: 'UNKNOWN'
      };
    }

    const data = res.data;
    let mappedStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

    switch (data.status) {
      case 'ACCEPTED':
      case 'PROCESSING':
      case 'IN_RECONCILIATION':
      case 'ENQUEUED':
        mappedStatus = 'PROCESSING';
        break;
      case 'COMPLETED':
        mappedStatus = 'COMPLETED';
        break;
      case 'FAILED':
        mappedStatus = 'FAILED';
        break;
      default:
        mappedStatus = 'PROCESSING';
    }

    return {
      providerPaymentId: refundId,
      status: mappedStatus,
      failureReason:
        data.failureReason?.failureMessage ||
        data.failureReason?.message,
      rawResponse: data
    };
  }

  async initiateCheckout(request: ProviderCheckoutRequest): Promise<ProviderCheckoutResponse> {
    const payload = PawapayMapper.toPawapayCheckoutRequest(request);
    const pawapayResponse = await this.client.createCheckout(payload);

    let status: 'WAITING_PAYMENT' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'EXPIRED' | 'CANCELLED';
    if (
      pawapayResponse.status === 'WAITING_PAYMENT' ||
      pawapayResponse.status === 'PROCESSING' ||
      pawapayResponse.status === 'COMPLETED' ||
      pawapayResponse.status === 'FAILED' ||
      pawapayResponse.status === 'EXPIRED' ||
      pawapayResponse.status === 'CANCELLED'
    ) {
      status = pawapayResponse.status;
    } else {
      status = 'WAITING_PAYMENT';
    }

    return {
      checkoutId: pawapayResponse.checkoutId || request.checkoutId,
      status,
      redirectUrl: pawapayResponse.redirectUrl,
      checkoutCode: pawapayResponse.checkoutCode,
      expiresAt: pawapayResponse.expiresAt,
      rawResponse: pawapayResponse,
      error: pawapayResponse.error
    };
  }

  async checkCheckoutStatus(checkoutId: string): Promise<ProviderCheckoutStatusResponse> {
    const res = await this.client.getCheckoutStatus(checkoutId);

    if (res.status === 'NOT_FOUND' || !res.data) {
      return {
        checkoutId,
        status: 'FAILED',
        rawResponse: res
      };
    }

    const data = res.data;
    let status: 'WAITING_PAYMENT' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'EXPIRED' | 'CANCELLED';
    if (
      data.status === 'WAITING_PAYMENT' ||
      data.status === 'PROCESSING' ||
      data.status === 'COMPLETED' ||
      data.status === 'FAILED' ||
      data.status === 'EXPIRED' ||
      data.status === 'CANCELLED'
    ) {
      status = data.status;
    } else {
      status = 'WAITING_PAYMENT';
    }

    return {
      checkoutId: data.checkoutId || checkoutId,
      status,
      redirectUrl: data.redirectUrl,
      checkoutCode: data.checkoutCode,
      expiresAt: data.expiresAt,
      depositId: data.deposit?.depositId,
      depositStatus: data.deposit?.status,
      depositsHistory: data.depositsHistory,
      rawResponse: data
    };
  }
}

export const pawapayService = new PawapayService();
export default pawapayService;

