import {
  PaymentProvider,
  ProviderDepositRequest,
  ProviderDepositResponse,
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
      // Default fallback if prediction unavailable
      targetProvider = `${request.country.toUpperCase()}_MMO`;
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
}

export const pawapayService = new PawapayService();
export default pawapayService;
