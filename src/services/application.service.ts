import { ApplicationRepository, applicationRepository } from '../repositories/application.repository.js';
import { Application, ApplicationStatus } from '../models/application.model.js';
import { AuditLog } from '../models/audit-log.model.js';
import {
  CreateApplicationDto,
  CreateApplicationResult,
  RotateKeyResult,
  ApplicationResponse
} from '../types/application.types.js';
import { generateApiKey, generateWebhookSecret, hashApiKey } from '../utils/crypto.js';
import { ConflictError, NotFoundError } from '../utils/errors.js';
import { logger } from '../config/logger.js';

export class ApplicationService {
  constructor(private readonly repo: ApplicationRepository = applicationRepository) {}

  private mapToResponse(app: Application): ApplicationResponse {
    return {
      id: app.id,
      name: app.name,
      slug: app.slug,
      description: app.description,
      apiKeyPrefix: app.apiKeyPrefix,
      status: app.status,
      webhookUrl: app.webhookUrl,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt
    };
  }

  async createApplication(
    dto: CreateApplicationDto,
    actor = 'admin',
    ipAddress?: string
  ): Promise<CreateApplicationResult> {
    const existing = await this.repo.findBySlug(dto.slug);
    if (existing) {
      throw new ConflictError(`Application with slug '${dto.slug}' already exists`);
    }

    const { apiKey, prefix } = generateApiKey(false);
    const apiKeyHash = hashApiKey(apiKey);
    const webhookSecret = generateWebhookSecret();

    const app = await this.repo.create({
      name: dto.name,
      slug: dto.slug,
      description: dto.description || null,
      apiKeyHash,
      apiKeyPrefix: prefix,
      status: ApplicationStatus.ACTIVE,
      webhookUrl: dto.webhookUrl || null,
      webhookSecret
    });

    await AuditLog.create({
      actor,
      applicationId: app.id,
      resourceType: 'application',
      resourceId: app.id,
      action: 'create',
      metadata: { slug: app.slug, name: app.name },
      ipAddress: ipAddress || null
    });

    logger.info({ applicationId: app.id, slug: app.slug }, 'New application created');

    return {
      application: this.mapToResponse(app),
      apiKey,
      webhookSecret
    };
  }

  async getApplication(id: string): Promise<ApplicationResponse> {
    const app = await this.repo.findById(id);
    if (!app) {
      throw new NotFoundError('Application', id);
    }
    return this.mapToResponse(app);
  }

  async listApplications(
    offset = 0,
    limit = 20
  ): Promise<{ applications: ApplicationResponse[]; total: number }> {
    const { rows, count } = await this.repo.list(offset, limit);
    return {
      applications: rows.map((r) => this.mapToResponse(r)),
      total: count
    };
  }

  async rotateApiKey(
    id: string,
    actor = 'admin',
    ipAddress?: string
  ): Promise<RotateKeyResult> {
    const app = await this.repo.findById(id);
    if (!app) {
      throw new NotFoundError('Application', id);
    }

    const { apiKey, prefix } = generateApiKey(false);
    const apiKeyHash = hashApiKey(apiKey);

    await this.repo.update(id, {
      apiKeyHash,
      apiKeyPrefix: prefix
    });

    await AuditLog.create({
      actor,
      applicationId: app.id,
      resourceType: 'application',
      resourceId: app.id,
      action: 'rotate_api_key',
      metadata: { previousPrefix: app.apiKeyPrefix, newPrefix: prefix },
      ipAddress: ipAddress || null
    });

    logger.info({ applicationId: app.id }, 'API key rotated for application');

    return {
      applicationId: app.id,
      apiKey,
      apiKeyPrefix: prefix
    };
  }

  async suspendApplication(
    id: string,
    actor = 'admin',
    ipAddress?: string
  ): Promise<ApplicationResponse> {
    const app = await this.repo.findById(id);
    if (!app) {
      throw new NotFoundError('Application', id);
    }

    const updated = await this.repo.update(id, {
      status: ApplicationStatus.SUSPENDED
    });

    await AuditLog.create({
      actor,
      applicationId: app.id,
      resourceType: 'application',
      resourceId: app.id,
      action: 'suspend',
      ipAddress: ipAddress || null
    });

    logger.info({ applicationId: app.id }, 'Application suspended');
    return this.mapToResponse(updated!);
  }

  async reactivateApplication(
    id: string,
    actor = 'admin',
    ipAddress?: string
  ): Promise<ApplicationResponse> {
    const app = await this.repo.findById(id);
    if (!app) {
      throw new NotFoundError('Application', id);
    }

    const updated = await this.repo.update(id, {
      status: ApplicationStatus.ACTIVE
    });

    await AuditLog.create({
      actor,
      applicationId: app.id,
      resourceType: 'application',
      resourceId: app.id,
      action: 'reactivate',
      ipAddress: ipAddress || null
    });

    logger.info({ applicationId: app.id }, 'Application reactivated');
    return this.mapToResponse(updated!);
  }
}

export const applicationService = new ApplicationService();
export default applicationService;
