import { shutdownTelemetry } from './config/telemetry';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { db } from './config/database';
import { redis } from './config/redis';
import { queueService } from './services/queue.service';
import analyticsRoutes from './routes/analytics';
import config from './config';
import logger from './utils/logger';
import { requestContextMiddleware } from './observability/request-context';
import { metricsMiddleware, errorLoggingMiddleware } from './middleware/observability';
import { metricsHandler } from './observability/metrics';

const app: express.Application = express();

// Security middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Observability middleware
app.use(requestContextMiddleware);
app.use(metricsMiddleware);

// Metrics endpoint (before auth middleware)
app.get('/metrics', metricsHandler);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const [dbHealth, redisHealth] = await Promise.all([
      db.healthCheck(),
      redis.healthCheck(),
    ]);

    res.json({
      status: dbHealth && redisHealth ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealth ? 'healthy' : 'unhealthy',
        redis: redisHealth ? 'healthy' : 'unhealthy',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Health check failed', {
      error: message,
    });
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: message,
    });
  }
});

// API routes
const apiVersion = config.apiVersion || 'v1';
app.use(`/api/${apiVersion}/analytics`, analyticsRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// Error logging middleware
app.use(errorLoggingMiddleware);

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    url: req.originalUrl,
  });
  
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: config.nodeEnv === 'development' ? err.message : 'Something went wrong',
    ...(config.nodeEnv === 'development' && { stack: err.stack }),
  });
});

async function startServer(): Promise<void> {
  try {
    // Test database connection
    const dbHealthy = await db.healthCheck();
    if (!dbHealthy) {
      throw new Error('Database connection failed');
    }

    // Test Redis connection
    const redisHealthy = await redis.healthCheck();
    if (!redisHealthy) {
      throw new Error('Redis connection failed');
    }

    // Start the server
    const port = config.port || 3000;
    const server = app.listen(port, () => {
      logger.info('🚀 Analytics backend server running', {
        port,
        apiUrl: `http://localhost:${port}/api/${apiVersion}/analytics`,
        metricsUrl: `http://localhost:${port}/metrics`,
        hipaaMode: config.hipaa.enabled ? 'ENABLED' : 'DISABLED',
        refreshInterval: config.analytics.refreshInterval,
      });
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.warn('Received shutdown signal, closing server', { signal });
      
      server.close(async () => {
        logger.info('HTTP server closed');
        
        try {
          await queueService.close();
          logger.info('Queue service closed');
          
          await redis.close();
          logger.info('Redis connection closed');
          
          await db.close();
          logger.info('Database connection closed');

          await shutdownTelemetry();
          logger.info('Telemetry shut down');
          
          logger.info('Graceful shutdown complete');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          process.exit(1);
        }
      });
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('💥 Uncaught Exception:', error);
      gracefulShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('unhandledRejection');
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
if (require.main === module) {
  startServer();
}

export default app;