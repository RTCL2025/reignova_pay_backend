import { Op, Transaction, WhereOptions } from 'sequelize';
import { Payment, PaymentAttributes, PaymentCreationAttributes } from '../models/payment.model.js';
import { PaymentFilters } from '../types/payment.types.js';

export class PaymentRepository {
  async create(
    data: PaymentCreationAttributes,
    transaction?: Transaction
  ): Promise<Payment> {
    return Payment.create(data, { transaction });
  }

  async findByPk(id: string): Promise<Payment | null> {
    return Payment.findByPk(id);
  }

  async findById(id: string, applicationId: string): Promise<Payment | null> {
    return Payment.findOne({
      where: {
        id,
        applicationId
      }
    });
  }

  async findByReference(reference: string, applicationId: string): Promise<Payment | null> {
    return Payment.findOne({
      where: {
        reference,
        applicationId
      }
    });
  }

  async findByProviderPaymentId(providerPaymentId: string): Promise<Payment | null> {
    return Payment.findOne({
      where: {
        providerPaymentId
      }
    });
  }

  async list(
    applicationId: string,
    filters: PaymentFilters,
    offset = 0,
    limit = 20
  ): Promise<{ rows: Payment[]; count: number }> {
    const where: WhereOptions<PaymentAttributes> = {
      applicationId
    };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.reference) {
      where.reference = { [Op.iLike]: `%${filters.reference}%` };
    }

    if (filters.phoneNumber) {
      where.phoneNumber = { [Op.iLike]: `%${filters.phoneNumber}%` };
    }

    if (filters.startDate && filters.endDate) {
      where.createdAt = {
        [Op.between]: [filters.startDate, filters.endDate]
      };
    } else if (filters.startDate) {
      where.createdAt = {
        [Op.gte]: filters.startDate
      };
    } else if (filters.endDate) {
      where.createdAt = {
        [Op.lte]: filters.endDate
      };
    }

    return Payment.findAndCountAll({
      where,
      offset,
      limit,
      order: [['createdAt', 'DESC']]
    });
  }

  async update(
    id: string,
    updates: Partial<PaymentAttributes>,
    transaction?: Transaction
  ): Promise<Payment | null> {
    const payment = await Payment.findByPk(id, { transaction });
    if (!payment) return null;
    return payment.update(updates, { transaction });
  }
}

export const paymentRepository = new PaymentRepository();
export default paymentRepository;
