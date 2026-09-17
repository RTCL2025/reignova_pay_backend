import {
  PaymentProvider,
  ProviderDepositRequest,
  ProviderDepositResponse,
  ProviderStatusResponse
} from '../../src/types/provider.types.js';

export class MockPaymentProvider implements PaymentProvider {
  public readonly name = 'mock-provider';

  public shouldFail = false;
  public failureType: 'REJECTED' | 'TIMEOUT' | 'NETWORK_ERROR' = 'REJECTED';
  public customStatus: 'ACCEPTED' | 'REJECTED' | 'DUPLICATE_IGNORED' = 'ACCEPTED';
  public lastRequest: ProviderDepositRequest | null = null;
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

  async predictProvider(phoneNumber: string): Promise<string | null> {
    if (phoneNumber.includes('255')) return 'VODACOM_MOMO_TZA';
    if (phoneNumber.includes('260')) return 'MTN_MOMO_ZMB';
    return null;
  }
}

export const mockPaymentProvider = new MockPaymentProvider();
export default mockPaymentProvider;
