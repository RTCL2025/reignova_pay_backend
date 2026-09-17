import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';
import { PaymentStatus } from '../../models/payment.model.js';
import {
  PawapayDepositRequest,
  PawapayStatus
} from './pawapay.types.js';
import { ProviderDepositRequest } from '../../types/provider.types.js';
import { ValidationError } from '../../utils/errors.js';

// ISO 3166-1 alpha-2 to alpha-3 mapping for African and supported markets
const COUNTRY_MAP: Record<string, string> = {
  TZ: 'TZA', // Tanzania
  ZM: 'ZMB', // Zambia
  RW: 'RWA', // Rwanda
  UG: 'UGA', // Uganda
  KE: 'KEN', // Kenya
  GH: 'GHA', // Ghana
  NG: 'NGA', // Nigeria
  SN: 'SEN', // Senegal
  CI: 'CIV', // Côte d'Ivoire
  CM: 'CMR', // Cameroon
  CD: 'COD', // DR Congo
  BJ: 'BEN', // Benin
  CG: 'COG', // Republic of the Congo
  GA: 'GAB', // Gabon
  MW: 'MWI', // Malawi
  MZ: 'MOZ', // Mozambique
  SL: 'SLE', // Sierra Leone
  TD: 'TCD', // Chad
  ZW: 'ZWE'  // Zimbabwe
};

export class PawapayMapper {
  /**
   * Converts 2-letter ISO country to 3-letter ISO required by Pawapay.
   */
  static toAlpha3Country(country: string): string {
    const upper = country.trim().toUpperCase();
    if (upper.length === 3) return upper;
    const mapped = COUNTRY_MAP[upper];
    if (!mapped) {
      throw new ValidationError(`Unsupported country code: '${country}'`);
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
   */
  static toPawapayDepositRequest(
    request: ProviderDepositRequest,
    provider: string
  ): PawapayDepositRequest {
    const countryAlpha3 = this.toAlpha3Country(request.country);
    const msisdn = this.toMsisdn(request.phoneNumber);

    return {
      depositId: request.paymentId,
      amount: request.amount.toFixed(2),
      currency: request.currency.toUpperCase(),
      country: countryAlpha3,
      payer: {
        type: 'MMO',
        accountDetails: {
          phoneNumber: msisdn,
          provider
        }
      },
      clientReferenceId: request.reference,
      customerMessage: request.description || undefined,
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
        return PaymentStatus.PROCESSING;
      case 'COMPLETED':
        return PaymentStatus.COMPLETED;
      case 'FAILED':
        return PaymentStatus.FAILED;
      default:
        return PaymentStatus.PROCESSING;
    }
  }
}
