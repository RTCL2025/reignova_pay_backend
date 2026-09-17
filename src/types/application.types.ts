import { ApplicationStatus } from '../models/application.model.js';

export interface CreateApplicationDto {
  name: string;
  slug: string;
  description?: string;
  webhookUrl?: string;
}

export interface UpdateApplicationDto {
  name?: string;
  description?: string;
  webhookUrl?: string;
}

export interface ApplicationResponse {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  apiKeyPrefix: string;
  status: ApplicationStatus;
  webhookUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateApplicationResult {
  application: ApplicationResponse;
  apiKey: string;
  webhookSecret: string;
}

export interface RotateKeyResult {
  applicationId: string;
  apiKey: string;
  apiKeyPrefix: string;
}
