import { Queue, Worker } from 'bullmq';
import { redis } from '../config/redis';
import { alertsService } from '../services/alerts.service';
import config from '../config';
import logger from '../utils/logger';

const ALERT_EVALUATION_QUEUE = 'alert-evaluation';

// Create queue for alert evaluations
export const alertEvaluationQueue = new Queue(ALERT_EVALUATION_QUEUE, {
  connection: {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
  },
});

// Worker to process alert evaluations
export const alertWorker = new Worker(
  ALERT_EVALUATION_QUEUE,
  async (job) => {
    logger.info('Processing alert evaluation job', { jobId: job.id, data: job.data });

    try {
      const { alertId } = job.data;

      if (!alertId) {
        throw new Error('Alert ID not provided');
      }

      const result = await alertsService.evaluateAlert(alertId);

      logger.info('Alert evaluation completed', {
        alertId,
        triggered: result.triggered,
        currentValue: result.currentValue,
      });

      return result;
    } catch (error) {
      logger.error('Alert evaluation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        jobData: job.data,
      });
      throw error;
    }
  },
  {
    connection: {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
    },
    concurrency: 5,
  }
);

// Handle worker events
alertWorker.on('completed', (job, result) => {
  logger.info('Alert evaluation job completed', {
    jobId: job.id,
    alertId: job.data.alertId,
    triggered: result.triggered,
  });
});

alertWorker.on('failed', (job, error) => {
  logger.error('Alert evaluation job failed', {
    jobId: job?.id,
    alertId: job?.data?.alertId,
    error: error.message,
  });
});

// Schedule alert evaluations
export async function scheduleAlertEvaluations(): Promise<void> {
  try {
    // Get all enabled alerts
    const alerts = await alertsService.listAlerts({ enabled: true });

    logger.info('Scheduling alert evaluations', { count: alerts.length });

    for (const alert of alerts) {
      const jobName = `alert-${alert.id}`;

      // Remove existing repeatable job if any
      try {
        const repeatableJobs = await alertEvaluationQueue.getRepeatableJobs();
        const existingJob = repeatableJobs.find((j) => j.name === jobName);
        if (existingJob) {
          await alertEvaluationQueue.removeRepeatableByKey(existingJob.key);
        }
      } catch (error) {
        logger.warn('Failed to remove existing repeatable job', { jobName, error });
      }

      // Calculate repeat interval based on frequency
      let repeatPattern: any;

      switch (alert.evaluationFrequency) {
        case 'hourly':
          repeatPattern = { pattern: '0 * * * *' }; // Every hour
          break;
        case 'daily':
          repeatPattern = { pattern: '0 0 * * *' }; // Every day at midnight
          break;
        case 'weekly':
          repeatPattern = { pattern: '0 0 * * 0' }; // Every Sunday at midnight
          break;
        default:
          // Use custom schedule if provided
          if (alert.evaluationSchedule) {
            repeatPattern = { pattern: alert.evaluationSchedule };
          } else {
            repeatPattern = { pattern: '0 * * * *' }; // Default to hourly
          }
      }

      // Add repeatable job
      await alertEvaluationQueue.add(
        jobName,
        { alertId: alert.id },
        {
          repeat: repeatPattern,
          removeOnComplete: true,
          removeOnFail: false,
        }
      );

      logger.info('Alert evaluation scheduled', {
        alertId: alert.id,
        frequency: alert.evaluationFrequency,
        pattern: repeatPattern.pattern,
      });
    }
  } catch (error) {
    logger.error('Failed to schedule alert evaluations', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

// Manually trigger alert evaluation
export async function triggerAlertEvaluation(alertId: string): Promise<void> {
  await alertEvaluationQueue.add(
    `alert-${alertId}-manual`,
    { alertId },
    { removeOnComplete: true, removeOnFail: false }
  );

  logger.info('Manual alert evaluation triggered', { alertId });
}

// Initialize alert jobs
export async function initializeAlertJobs(): Promise<void> {
  if (!config.alerts.enabled) {
    logger.info('Alerts are disabled, skipping job initialization');
    return;
  }

  logger.info('Initializing alert jobs');

  // Schedule initial alert evaluations
  await scheduleAlertEvaluations();

  // Re-schedule every 5 minutes to pick up new/updated alerts
  setInterval(
    async () => {
      try {
        await scheduleAlertEvaluations();
      } catch (error) {
        logger.error('Failed to refresh alert schedules', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
    config.alerts.evaluationInterval
  );

  logger.info('Alert jobs initialized');
}
