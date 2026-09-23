import http from 'node:http';
import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { sequelize, testDatabaseConnection } from './config/database.js';
import { checkoutReconciliationService } from './services/checkout-reconciliation.service.js';
import { notificationRetryService } from './services/notification-retry.service.js';

let server: http.Server;

async function startServer(): Promise<void> {
  try {
    logger.info('Starting Payment Service...');

    // Test database connection
    await testDatabaseConnection();

    // Start HTTP server
    await new Promise<void>((resolve, reject) => {
      server = app.listen(env.PORT, () => {
        logger.info(
          {
            port: env.PORT,
            env: env.NODE_ENV
          },
          `Payment Service running on port ${env.PORT}`
        );
        resolve();
      });

      server.once('error', (err) => {
        reject(err);
      });
    });

    // Inbound safety net — pawaPay to us: polls for callbacks we never received.
    checkoutReconciliationService.start();

    // Outbound safety net — us to the merchant: retries webhooks we never delivered.
    notificationRetryService.start();

    // Handle graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info({ signal }, 'Shutdown signal received. Starting graceful shutdown...');

      checkoutReconciliationService.stop();
      notificationRetryService.stop();

      if (server) {
        server.close(() => {
          logger.info('HTTP server closed');
        });
      }

      try {
        await sequelize.close();
        logger.info('Database connections closed');
        process.exit(0);
      } catch (err) {
        logger.error({ err }, 'Error during database disconnection');
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to start payment service');
    process.exit(1);
  }
}

// Only start the server if executed directly (not when imported in tests)
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export { server, startServer };
