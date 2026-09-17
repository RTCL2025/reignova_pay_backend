import { Application, ApplicationAttributes } from '../models/application.model.js';

export class ApplicationRepository {
  async create(
    data: Omit<ApplicationAttributes, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Application> {
    return Application.create(data);
  }

  async findById(id: string): Promise<Application | null> {
    return Application.findByPk(id);
  }

  async findBySlug(slug: string): Promise<Application | null> {
    return Application.findOne({ where: { slug } });
  }

  async findByApiKeyHash(apiKeyHash: string): Promise<Application | null> {
    return Application.findOne({ where: { apiKeyHash } });
  }

  async update(id: string, data: Partial<ApplicationAttributes>): Promise<Application | null> {
    const app = await Application.findByPk(id);
    if (!app) return null;
    return app.update(data);
  }

  async list(offset = 0, limit = 20): Promise<{ rows: Application[]; count: number }> {
    return Application.findAndCountAll({
      offset,
      limit,
      order: [['createdAt', 'DESC']]
    });
  }
}

export const applicationRepository = new ApplicationRepository();
export default applicationRepository;
