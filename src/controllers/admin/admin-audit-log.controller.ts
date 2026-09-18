import { Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import { AuditLog } from '../../models/audit-log.model.js';
import { Application } from '../../models/application.model.js';
import { sendSuccess } from '../../utils/response.js';
import { parsePagination, buildPaginationMeta } from '../../utils/pagination.js';
import { NotFoundError } from '../../utils/errors.js';

export class AdminAuditLogController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, offset } = parsePagination(req.query);
      const { action, actor, resourceType, applicationId, search } = req.query;

      const whereClause: any = {};

      if (action && action !== 'ALL') {
        whereClause.action = action;
      }
      if (actor) {
        whereClause.actor = { [Op.iLike]: `%${actor}%` };
      }
      if (resourceType) {
        whereClause.resourceType = resourceType;
      }
      if (applicationId && applicationId !== 'ALL') {
        whereClause.applicationId = applicationId;
      }
      if (search && typeof search === 'string' && search.trim()) {
        const q = `%${search.trim()}%`;
        whereClause[Op.or] = [
          { action: { [Op.iLike]: q } },
          { actor: { [Op.iLike]: q } },
          { resourceId: { [Op.iLike]: q } },
        ];
      }

      const { count, rows } = await AuditLog.findAndCountAll({
        where: whereClause,
        include: [
          { model: Application, as: 'application', attributes: ['id', 'name', 'slug'] },
        ],
        order: [['createdAt', 'DESC']],
        limit,
        offset,
      });

      const formatted = rows.map((l: any) => ({
        id: l.id,
        actor: l.actor,
        applicationId: l.applicationId,
        applicationName: l.application?.name || 'System Platform',
        resourceType: l.resourceType,
        resourceId: l.resourceId,
        action: l.action,
        result: (l.metadata as any)?.result || 'SUCCESS',
        ipAddress: l.ipAddress,
        correlationId: (l.metadata as any)?.correlationId || `req_${l.id.substring(0, 8)}`,
        userAgent: (l.metadata as any)?.userAgent || 'Admin Client',
        beforeState: (l.metadata as any)?.beforeState || null,
        afterState: (l.metadata as any)?.afterState || null,
        metadata: l.metadata,
        createdAt: l.createdAt,
      }));

      const meta = buildPaginationMeta(page, limit, count);
      sendSuccess(res, formatted, 200, meta as unknown as Record<string, unknown>);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const log = await AuditLog.findByPk(req.params.id as string, {
        include: [
          { model: Application, as: 'application', attributes: ['id', 'name', 'slug'] },
        ],
      });

      if (!log) {
        throw new NotFoundError(`Audit log '${req.params.id}' not found`);
      }

      sendSuccess(res, log, 200);
    } catch (err) {
      next(err);
    }
  }
}

export const adminAuditLogController = new AdminAuditLogController();
export default adminAuditLogController;
