import { Application } from './application.model.js';
import { Payment } from './payment.model.js';
import { PaymentAttempt } from './payment-attempt.model.js';
import { WebhookEvent } from './webhook-event.model.js';
import { Notification } from './notification.model.js';
import { IdempotencyKey } from './idempotency-key.model.js';
import { AuditLog } from './audit-log.model.js';
import { Checkout } from './checkout.model.js';
import { sequelize } from '../config/database.js';

// Application <-> Payment
Application.hasMany(Payment, { foreignKey: 'application_id', as: 'payments' });
Payment.belongsTo(Application, { foreignKey: 'application_id', as: 'application' });

// Payment self-referencing (Refunds)
Payment.hasMany(Payment, { foreignKey: 'original_payment_id', as: 'refunds' });
Payment.belongsTo(Payment, { foreignKey: 'original_payment_id', as: 'originalPayment' });

// Application <-> Checkout
Application.hasMany(Checkout, { foreignKey: 'application_id', as: 'checkouts' });
Checkout.belongsTo(Application, { foreignKey: 'application_id', as: 'application' });

// Payment <-> PaymentAttempt
Payment.hasMany(PaymentAttempt, { foreignKey: 'payment_id', as: 'attempts' });
PaymentAttempt.belongsTo(Payment, { foreignKey: 'payment_id', as: 'payment' });

// Payment <-> WebhookEvent
Payment.hasMany(WebhookEvent, { foreignKey: 'payment_id', as: 'webhookEvents' });
WebhookEvent.belongsTo(Payment, { foreignKey: 'payment_id', as: 'payment' });

// Payment <-> Notification
Payment.hasMany(Notification, { foreignKey: 'payment_id', as: 'notifications' });
Notification.belongsTo(Payment, { foreignKey: 'payment_id', as: 'payment' });

// Application <-> Notification
Application.hasMany(Notification, { foreignKey: 'application_id', as: 'notifications' });
Notification.belongsTo(Application, { foreignKey: 'application_id', as: 'application' });

// Application <-> IdempotencyKey
Application.hasMany(IdempotencyKey, { foreignKey: 'application_id', as: 'idempotencyKeys' });
IdempotencyKey.belongsTo(Application, { foreignKey: 'application_id', as: 'application' });

// Application <-> AuditLog
Application.hasMany(AuditLog, { foreignKey: 'application_id', as: 'auditLogs' });
AuditLog.belongsTo(Application, { foreignKey: 'application_id', as: 'application' });

export {
  sequelize,
  Application,
  Payment,
  Checkout,
  PaymentAttempt,
  WebhookEvent,
  Notification,
  IdempotencyKey,
  AuditLog
};

export default {
  sequelize,
  Application,
  Payment,
  Checkout,
  PaymentAttempt,
  WebhookEvent,
  Notification,
  IdempotencyKey,
  AuditLog
};

