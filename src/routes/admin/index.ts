import { Router } from 'express';
import { adminAuthRoutes } from './auth.routes.js';
import { adminPaymentRoutes } from './payment.routes.js';
import { adminRefundRoutes } from './refund.routes.js';
import { adminPayoutRoutes } from './payout.routes.js';
import { adminCheckoutRoutes } from './checkout.routes.js';
import { adminAuditLogRoutes } from './audit-log.routes.js';
import { adminStatsRoutes } from './stats.routes.js';
import { applicationRoutes } from '../application.routes.js';

export const adminRoutes: Router = Router();

// Auth routes (includes public login & protected /me)
adminRoutes.use('/auth', adminAuthRoutes);

// Applications / Merchants
adminRoutes.use('/applications', applicationRoutes);
adminRoutes.use('/merchants', applicationRoutes);

// Payments / Deposits monitoring & retries
adminRoutes.use('/payments', adminPaymentRoutes);

// Refunds management & approval workflows
adminRoutes.use('/refunds', adminRefundRoutes);

// Payouts monitoring
adminRoutes.use('/payouts', adminPayoutRoutes);

// Checkout Sessions traceability
adminRoutes.use('/checkout-sessions', adminCheckoutRoutes);

// Audit logs
adminRoutes.use('/audit-logs', adminAuditLogRoutes);

// System overview stats
adminRoutes.use('/stats', adminStatsRoutes);

export default adminRoutes;
