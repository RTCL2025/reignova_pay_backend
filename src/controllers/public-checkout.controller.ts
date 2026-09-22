import { Request, Response, NextFunction } from 'express';
import { isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js';
import { checkoutRepository } from '../repositories/checkout.repository.js';
import { paymentRepository } from '../repositories/payment.repository.js';
import { checkoutService } from '../services/checkout.service.js';
import { paymentService } from '../services/payment.service.js';
import { receiptService } from '../services/receipt.service.js';
import { CheckoutStatus } from '../models/checkout.model.js';
import { PaymentStatus } from '../models/payment.model.js';
import { Application } from '../models/application.model.js';
import { sendSuccess } from '../utils/response.js';
import { NotFoundError, ValidationError, ConflictError } from '../utils/errors.js';
import { sequelize } from '../config/database.js';

export interface MobileMoneyProviderOption {
  id: string;
  name: string;
  brandColor: string;
  country: string;
}

export const SUPPORTED_PROVIDERS_BY_COUNTRY: Record<string, MobileMoneyProviderOption[]> = {
  TZA: [
    { id: 'VODACOM_TZA', name: 'Vodacom M-Pesa', brandColor: '#E60000', country: 'TZA' },
    { id: 'TIGO_TZA', name: 'Tigo Pesa', brandColor: '#00377B', country: 'TZA' },
    { id: 'AIRTEL_TZA', name: 'Airtel Money', brandColor: '#ED1C24', country: 'TZA' },
    { id: 'HALOTEL_TZA', name: 'Halotel', brandColor: '#F68B1F', country: 'TZA' }
  ],
  TZ: [
    { id: 'VODACOM_TZA', name: 'Vodacom M-Pesa', brandColor: '#E60000', country: 'TZA' },
    { id: 'TIGO_TZA', name: 'Tigo Pesa', brandColor: '#00377B', country: 'TZA' },
    { id: 'AIRTEL_TZA', name: 'Airtel Money', brandColor: '#ED1C24', country: 'TZA' },
    { id: 'HALOTEL_TZA', name: 'Halotel', brandColor: '#F68B1F', country: 'TZA' }
  ]
};

export class PublicCheckoutController {
  async getSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const publicToken = req.params.publicToken as string;
      const checkout = await checkoutRepository.findByPublicToken(publicToken, true);

      if (!checkout) {
        throw new NotFoundError('Checkout session', publicToken);
      }

      // Check if session has expired
      if (
        checkout.expiresAt &&
        checkout.expiresAt.getTime() < Date.now() &&
        (checkout.status === CheckoutStatus.PENDING || checkout.status === CheckoutStatus.WAITING_PAYMENT)
      ) {
        await checkoutService.transitionCheckoutStatus(checkout, CheckoutStatus.EXPIRED);
      }

      const application = (checkout as unknown as { application?: Application }).application;
      const amountItem = checkout.amounts?.[0];
      const country = amountItem?.country || 'TZA';
      const currency = amountItem?.currency || 'TZS';
      const amount = amountItem ? Number(amountItem.amount) : 0;
      const description =
        (checkout.reason as { description?: string } | null)?.description ||
        'Payment';

      const supportedProviders =
        SUPPORTED_PROVIDERS_BY_COUNTRY[country] ||
        SUPPORTED_PROVIDERS_BY_COUNTRY['TZA'];

      const sanitizedResponse = {
        publicToken: checkout.publicToken,
        reference: checkout.reference,
        amount,
        currency,
        country,
        description,
        merchant: {
          name: application?.name || 'Reignova Merchant',
          slug: application?.slug || 'merchant',
          logoUrl: null,
          // The hosted checkout reads the post-payment redirect targets from here
          // (CheckoutSuccess / CheckoutCancelled / CheckoutExpired). They are also
          // emitted at the top level below for any consumer already reading them.
          returnUrl: checkout.returnUrl,
          cancelUrl: checkout.cancelUrl
        },
        customer: {
          name: checkout.customerName || (checkout.payer?.name as string | undefined) || null,
          email: checkout.customerEmail || (checkout.payer?.email as string | undefined) || null,
          phone: checkout.customerPhone || (checkout.payer?.phoneNumber as string | undefined) || null
        },
        status: checkout.status,
        expiresAt: checkout.expiresAt,
        successUrl: checkout.returnUrl,
        cancelUrl: checkout.cancelUrl,
        reason: checkout.reason,
        metadata: checkout.metadata,
        supportedProviders
      };

      sendSuccess(res, sanitizedResponse, 200);
    } catch (err) {
      next(err);
    }
  }

  async initiatePayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const publicToken = req.params.publicToken as string;
      const checkout = await checkoutRepository.findByPublicToken(publicToken);

      if (!checkout) {
        throw new NotFoundError('Checkout session', publicToken);
      }

      // Ensure session is in payable state
      if (
        checkout.status !== CheckoutStatus.PENDING &&
        checkout.status !== CheckoutStatus.WAITING_PAYMENT
      ) {
        throw new ConflictError(
          `Checkout cannot be paid in current status: '${checkout.status}'`
        );
      }

      // Verify expiration
      if (checkout.expiresAt && checkout.expiresAt.getTime() < Date.now()) {
        await checkoutService.transitionCheckoutStatus(checkout, CheckoutStatus.EXPIRED);
        throw new ValidationError('Checkout session has expired');
      }

      const rawPhone = req.body.phoneNumber || req.body.customerPhone || req.body.phone;
      const customerName = req.body.customerName || req.body.name;
      const customerEmail = req.body.customerEmail || req.body.email;
      const { provider } = req.body;

      if (!rawPhone || typeof rawPhone !== 'string' || !rawPhone.trim()) {
        throw new ValidationError('Phone number is required');
      }
      const phoneNumber = rawPhone.trim();

      if (!provider || typeof provider !== 'string') {
        throw new ValidationError('Payment provider is required');
      }

      // Validate phone number format (support TZ national 07XXXXXXXX and international +255XXXXXXXXX)
      let formattedPhone = phoneNumber.trim();
      if (!formattedPhone.startsWith('+')) {
        if (formattedPhone.startsWith('255')) {
          formattedPhone = `+${formattedPhone}`;
        } else if (formattedPhone.startsWith('0') && formattedPhone.length === 10) {
          formattedPhone = `+255${formattedPhone.slice(1)}`;
        } else {
          formattedPhone = `+${formattedPhone}`;
        }
      }

      if (!isValidPhoneNumber(formattedPhone)) {
        throw new ValidationError(
          `Invalid phone number format: '${phoneNumber}'. Expected valid phone number like '+255754123456'.`
        );
      }

      const parsed = parsePhoneNumber(formattedPhone);
      const e164Phone = parsed.format('E.164');

      const amountItem = checkout.amounts?.[0];
      const amount = amountItem ? Number(amountItem.amount) : 0;
      const currency = amountItem ? amountItem.currency : 'TZS';
      const country = amountItem?.country || 'TZA';

      if (amount <= 0) {
        throw new ValidationError('Invalid checkout session amount');
      }

      // Check if payment with checkout.reference already exists for DB unique reference constraint
      const existingPayment = await paymentRepository.findByReference(checkout.reference, checkout.applicationId);
      const paymentReference = existingPayment ? `${checkout.reference}-DEP-${Date.now()}` : checkout.reference;

      // Initiate deposit with backend paymentService
      const depositResult = await paymentService.createDeposit(
        checkout.applicationId,
        {
          reference: paymentReference,
          amount,
          currency,
          country,
          phoneNumber: e164Phone,
          provider,
          description: `Payment for checkout ${checkout.reference}`,
          metadata: {
            checkoutId: checkout.id,
            providerCheckoutId: checkout.providerCheckoutId || checkout.id,
            checkoutReference: checkout.reference,
            reference: checkout.reference,
            ...(checkout.metadata || {})
          }
        }
      );

      // Link deposit to checkout and update state
      const depositId = depositResult.response.id;
      const depositStatus = depositResult.response.status;

      await checkout.update({
        status: CheckoutStatus.PROCESSING,
        depositId,
        depositStatus,
        customerPhone: e164Phone,
        customerName: customerName || checkout.customerName,
        customerEmail: customerEmail || checkout.customerEmail
      });

      sendSuccess(
        res,
        {
          status: CheckoutStatus.PROCESSING,
          depositId,
          message:
            'Payment prompt sent to mobile device. Please enter your PIN on your phone to complete payment.'
        },
        202
      );
    } catch (err) {
      next(err);
    }
  }

  async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const publicToken = req.params.publicToken as string;
      const checkout = await checkoutRepository.findByPublicToken(publicToken);

      if (!checkout) {
        throw new NotFoundError('Checkout session', publicToken);
      }

      sendSuccess(
        res,
        {
          status: checkout.status,
          depositStatus: checkout.depositStatus,
          completedAt: checkout.completedAt,
          failedAt: checkout.failedAt,
          failureReason: checkout.failureReason,
          returnUrl: checkout.returnUrl,
          cancelUrl: checkout.cancelUrl
        },
        200
      );
    } catch (err) {
      next(err);
    }
  }

  async cancelSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const publicToken = req.params.publicToken as string;
      const checkout = await checkoutRepository.findByPublicToken(publicToken);

      if (!checkout) {
        throw new NotFoundError('Checkout session', publicToken);
      }

      if (
        checkout.status === CheckoutStatus.PENDING ||
        checkout.status === CheckoutStatus.WAITING_PAYMENT
      ) {
        await checkoutService.transitionCheckoutStatus(checkout, CheckoutStatus.CANCELLED);
      }

      sendSuccess(
        res,
        {
          status: CheckoutStatus.CANCELLED,
          cancelUrl: checkout.cancelUrl || checkout.returnUrl
        },
        200
      );
    } catch (err) {
      next(err);
    }
  }

  async getReceipt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const publicToken = req.params.publicToken as string;
      const checkout = await checkoutRepository.findByPublicToken(publicToken, true);

      if (!checkout) {
        throw new NotFoundError('Checkout session', publicToken);
      }

      const pdfBuffer = await receiptService.generateReceiptPdf(checkout);
      const isDownload = req.query.download === 'true' || req.query.format === 'download';

      res.setHeader('Content-Type', 'application/pdf');
      if (isDownload) {
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="Receipt-${checkout.reference}.pdf"`
        );
      } else {
        res.setHeader('Content-Disposition', `inline; filename="Receipt-${checkout.reference}.pdf"`);
      }

      res.status(200).send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  }

  async simulateApproval(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const publicToken = req.params.publicToken as string;
      const checkout = await checkoutRepository.findByPublicToken(publicToken);

      if (!checkout) {
        throw new NotFoundError('Checkout session', publicToken);
      }

      const t = await sequelize.transaction();
      try {
        if (checkout.depositId) {
          const payment = await paymentRepository.findByPk(checkout.depositId);
          if (payment) {
            await paymentService.transitionStatus(payment, PaymentStatus.COMPLETED, undefined, `SIM-APPROVED-${Date.now()}`, t);
          }
        }

        await checkoutService.transitionCheckoutStatus(
          checkout,
          CheckoutStatus.COMPLETED,
          undefined,
          { depositStatus: 'COMPLETED' },
          t
        );

        await t.commit();
      } catch (err) {
        await t.rollback();
        throw err;
      }

      sendSuccess(
        res,
        {
          status: CheckoutStatus.COMPLETED,
          message: 'Simulated handset approval succeeded'
        },
        200
      );
    } catch (err) {
      next(err);
    }
  }

  async simulateTimeout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const publicToken = req.params.publicToken as string;
      const checkout = await checkoutRepository.findByPublicToken(publicToken);

      if (!checkout) {
        throw new NotFoundError('Checkout session', publicToken);
      }

      const t = await sequelize.transaction();
      try {
        if (checkout.depositId) {
          const payment = await paymentRepository.findByPk(checkout.depositId);
          if (payment) {
            await paymentService.transitionStatus(payment, PaymentStatus.FAILED, 'Handset authorization timed out', undefined, t);
          }
        }

        await checkoutService.transitionCheckoutStatus(
          checkout,
          CheckoutStatus.FAILED,
          'Handset authorization timed out',
          { depositStatus: 'FAILED' },
          t
        );

        await t.commit();
      } catch (err) {
        await t.rollback();
        throw err;
      }

      sendSuccess(
        res,
        {
          status: CheckoutStatus.FAILED,
          message: 'Simulated handset authorization timed out'
        },
        200
      );
    } catch (err) {
      next(err);
    }
  }
}

export const publicCheckoutController = new PublicCheckoutController();
export default publicCheckoutController;
