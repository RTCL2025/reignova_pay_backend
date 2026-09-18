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
} from '../../src/types/provider.types.js';

export class MockPaymentProvider implements PaymentProvider {
  public readonly name = 'mock-provider';

  public shouldFail = false;
  public failureType: 'REJECTED' | 'TIMEOUT' | 'NETWORK_ERROR' = 'REJECTED';
  public customStatus: 'ACCEPTED' | 'REJECTED' | 'DUPLICATE_IGNORED' = 'ACCEPTED';
  public lastRequest: ProviderDepositRequest | null = null;
  public lastPayoutRequest: ProviderPayoutRequest | null = null;
  public lastRefundRequest: ProviderRefundRequest | null = null;
  public lastCheckoutRequest: ProviderCheckoutRequest | null = null;
  public recordedStatusChecks: string[] = [];

  async initiateDeposit(request: ProviderDepositRequest): Promise<ProviderDepositResponse> {
    this.lastRequest = request;

    if (this.shouldFail) {
      if (this.failureType === 'TIMEOUT') {
        throw new Error('Provider request timed out');
      }
      if (this.failureType === 'NETWORK_ERROR') {
        throw new Error('Connection refused by provider host');
      }
      return {
        providerPaymentId: request.paymentId,
        status: 'REJECTED',
        error: {
          code: 'PAYER_NOT_FOUND',
          message: 'Account not found or subscriber inactive'
        }
      };
    }

    return {
      providerPaymentId: request.paymentId,
      status: this.customStatus,
      providerTransactionId: `ptx_${Date.now()}`
    };
  }

  async checkStatus(providerPaymentId: string): Promise<ProviderStatusResponse> {
    this.recordedStatusChecks.push(providerPaymentId);
    return {
      providerPaymentId,
      status: 'COMPLETED',
      providerTransactionId: `ptx_${providerPaymentId}`
    };
  }

  async initiatePayout(request: ProviderPayoutRequest): Promise<ProviderPayoutResponse> {
    this.lastPayoutRequest = request;

    if (this.shouldFail) {
      return {
        providerPaymentId: request.paymentId,
        status: 'REJECTED',
        error: {
          code: 'RECIPIENT_NOT_FOUND',
          message: 'Recipient account inactive or not found'
        }
      };
    }

    return {
      providerPaymentId: request.paymentId,
      status: this.customStatus,
      providerTransactionId: `ptx_payout_${Date.now()}`
    };
  }

  async checkPayoutStatus(providerPaymentId: string): Promise<ProviderStatusResponse> {
    this.recordedStatusChecks.push(providerPaymentId);
    return {
      providerPaymentId,
      status: 'COMPLETED',
      providerTransactionId: `ptx_payout_${providerPaymentId}`
    };
  }

  async initiateRefund(request: ProviderRefundRequest): Promise<ProviderRefundResponse> {
    this.lastRefundRequest = request;

    if (this.shouldFail) {
      return {
        refundId: request.refundId,
        status: 'REJECTED',
        error: {
          code: 'REFUND_FAILED',
          message: 'Deposit cannot be refunded'
        }
      };
    }

    return {
      refundId: request.refundId,
      status: this.customStatus
    };
  }

  async checkRefundStatus(refundId: string): Promise<ProviderStatusResponse> {
    this.recordedStatusChecks.push(refundId);
    return {
      providerPaymentId: refundId,
      status: 'COMPLETED'
    };
  }

  async initiateCheckout(request: ProviderCheckoutRequest): Promise<ProviderCheckoutResponse> {
    this.lastCheckoutRequest = request;

    if (this.shouldFail) {
      return {
        checkoutId: request.checkoutId,
        status: 'FAILED',
        error: {
          code: 'CHECKOUT_REJECTED',
          message: 'Checkout creation failed'
        }
      };
    }

    return {
      checkoutId: request.checkoutId,
      status: 'WAITING_PAYMENT',
      redirectUrl: `https://checkout.sandbox.pawapay.cloud/${request.checkoutId}`,
      checkoutCode: 'CHK123456',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    };
  }

  async checkCheckoutStatus(checkoutId: string): Promise<ProviderCheckoutStatusResponse> {
    return {
      checkoutId,
      status: 'COMPLETED',
      redirectUrl: `https://checkout.sandbox.pawapay.cloud/${checkoutId}`,
      checkoutCode: 'CHK123456'
    };
  }

  async predictProvider(phoneNumber: string): Promise<string | null> {
    if (phoneNumber.includes('25571') || phoneNumber.includes('25565') || phoneNumber.includes('25567')) return 'TIGO_TZA';
    if (phoneNumber.includes('25578') || phoneNumber.includes('25568') || phoneNumber.includes('25569')) return 'AIRTEL_TZA';
    if (phoneNumber.includes('255')) return 'VODACOM_TZA';
    return null;
  }
}

export const mockPaymentProvider = new MockPaymentProvider();
export default mockPaymentProvider;

