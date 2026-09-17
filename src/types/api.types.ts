import { Request } from 'express';
import { Application } from '../models/application.model.js';

export interface AuthenticatedRequest extends Request {
  application: Application;
  requestId: string;
}

export interface AdminRequest extends Request {
  requestId: string;
}
