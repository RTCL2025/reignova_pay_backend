import { Op, Transaction, WhereOptions } from 'sequelize';
import { Checkout, CheckoutAttributes, CheckoutCreationAttributes, CheckoutStatus } from '../models/checkout.model.js';

export interface CheckoutFilters {
  status?: CheckoutStatus;
  reference?: string;
  checkoutCode?: string;
  startDate?: Date;
  endDate?: Date;
}

export class CheckoutRepository {
  async create(
    data: CheckoutCreationAttributes,
    transaction?: Transaction
  ): Promise<Checkout> {
    return Checkout.create(data, { transaction });
  }

  async findByPk(id: string): Promise<Checkout | null> {
    return Checkout.findByPk(id);
  }

  async findById(id: string, applicationId: string): Promise<Checkout | null> {
    return Checkout.findOne({
      where: {
        id,
        applicationId
      }
    });
  }

  async findByReference(reference: string, applicationId: string): Promise<Checkout | null> {
    return Checkout.findOne({
      where: {
        reference,
        applicationId
      }
    });
  }

  async findByCode(checkoutCode: string, applicationId?: string): Promise<Checkout | null> {
    const where: WhereOptions<CheckoutAttributes> = { checkoutCode };
    if (applicationId) {
      where.applicationId = applicationId;
    }
    return Checkout.findOne({ where });
  }

  async findByPublicToken(publicToken: string, includeApplication = false): Promise<Checkout | null> {
    return Checkout.findOne({
      where: { publicToken },
      include: includeApplication ? ['application'] : undefined
    });
  }

  async findByDepositId(depositId: string): Promise<Checkout | null> {
    return Checkout.findOne({
      where: { depositId }
    });
  }

  async findByProviderCheckoutId(providerCheckoutId: string): Promise<Checkout | null> {
    return Checkout.findOne({
      where: {
        providerCheckoutId
      }
    });
  }

  async list(
    applicationId: string,
    filters: CheckoutFilters,
    offset = 0,
    limit = 20
  ): Promise<{ rows: Checkout[]; count: number }> {
    const where: WhereOptions<CheckoutAttributes> = {
      applicationId
    };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.reference) {
      where.reference = { [Op.iLike]: `%${filters.reference}%` };
    }

    if (filters.checkoutCode) {
      where.checkoutCode = filters.checkoutCode;
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

    return Checkout.findAndCountAll({
      where,
      offset,
      limit,
      order: [['createdAt', 'DESC']]
    });
  }

  async update(
    id: string,
    updates: Partial<CheckoutAttributes>,
    transaction?: Transaction
  ): Promise<Checkout | null> {
    const checkout = await Checkout.findByPk(id, { transaction });
    if (!checkout) return null;
    return checkout.update(updates, { transaction });
  }
}

export const checkoutRepository = new CheckoutRepository();
export default checkoutRepository;
