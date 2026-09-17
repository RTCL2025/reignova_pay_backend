import http from 'node:http';
import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { sequelize, testDatabaseConnection } from './config/database.js';

let server: http.Server;

async function startServer(): Promise<void> {
  try {
    logger.info('Starting Payment Service...');

    // Test database connection
    await testDatabaseConnection();

    // Start HTTP server
    server = app.listen(env.PORT, () => {
      logger.info(
        {
          port: env.PORT,
          env: env.NODE_ENV
        },
        `Payment Service running on port ${env.PORT}`
      );
    });

    // Handle graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info({ signal }, 'Shutdown signal received. Starting graceful shutdown...');

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
