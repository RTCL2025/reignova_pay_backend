import { Router, Request, Response } from 'express';
import { sequelize } from '../config/database.js';

export const healthRoutes: Router = Router();

healthRoutes.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

healthRoutes.get('/ready', async (_req: Request, res: Response) => {
  try {
    await sequelize.authenticate();
    res.status(200).json({
      status: 'ready',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(503).json({
      status: 'not_ready',
      database: 'disconnected',
      error: err instanceof Error ? err.message : 'Database unavailable',
      timestamp: new Date().toISOString()
    });
  }
});

export default healthRoutes;
