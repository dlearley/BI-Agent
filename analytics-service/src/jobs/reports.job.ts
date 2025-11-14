import { Queue, Worker } from 'bullmq';
import { redis } from '../config/redis';
import { reportsService } from '../services/reports.service';
import config from '../config';
import logger from '../utils/logger';

const REPORT_GENERATION_QUEUE = 'report-generation';

// Create queue for report generations
export const reportGenerationQueue = new Queue(REPORT_GENERATION_QUEUE, {
  connection: {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
  },
});

// Worker to process report generations
export const reportWorker = new Worker(
  REPORT_GENERATION_QUEUE,
  async (job) => {
    logger.info('Processing report generation job', { jobId: job.id, data: job.data });

    try {
      const { reportId } = job.data;

      if (!reportId) {
        throw new Error('Report ID not provided');
      }

      const generation = await reportsService.generateReport({ reportId });

      logger.info('Report generation completed', {
        reportId,
        generationId: generation.id,
        status: generation.status,
      });

      return generation;
    } catch (error) {
      logger.error('Report generation failed', {
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
    concurrency: 2, // Limit concurrency for resource-intensive PDF generation
  }
);

// Handle worker events
reportWorker.on('completed', (job, result) => {
  logger.info('Report generation job completed', {
    jobId: job.id,
    reportId: job.data.reportId,
    generationId: result.id,
  });
});

reportWorker.on('failed', (job, error) => {
  logger.error('Report generation job failed', {
    jobId: job?.id,
    reportId: job?.data?.reportId,
    error: error.message,
  });
});

// Schedule report generations
export async function scheduleReportGenerations(): Promise<void> {
  try {
    // Get all enabled reports
    const reports = await reportsService.listReports({ enabled: true });

    logger.info('Scheduling report generations', { count: reports.length });

    for (const report of reports) {
      if (report.schedule === 'manual') {
        logger.info('Skipping manual report', { reportId: report.id });
        continue;
      }

      const jobName = `report-${report.id}`;

      // Remove existing repeatable job if any
      try {
        const repeatableJobs = await reportGenerationQueue.getRepeatableJobs();
        const existingJob = repeatableJobs.find((j) => j.name === jobName);
        if (existingJob) {
          await reportGenerationQueue.removeRepeatableByKey(existingJob.key);
        }
      } catch (error) {
        logger.warn('Failed to remove existing repeatable job', { jobName, error });
      }

      // Calculate repeat interval based on report type
      let repeatPattern: any;

      switch (report.reportType) {
        case 'weekly_briefing':
          repeatPattern = { pattern: '0 9 * * 1' }; // Every Monday at 9 AM
          break;
        case 'monthly_summary':
          repeatPattern = { pattern: '0 9 1 * *' }; // First day of month at 9 AM
          break;
        default:
          // Use custom schedule if provided
          if (report.schedule) {
            repeatPattern = { pattern: report.schedule };
          } else {
            repeatPattern = { pattern: '0 9 * * 1' }; // Default to weekly
          }
      }

      // Add repeatable job
      await reportGenerationQueue.add(
        jobName,
        { reportId: report.id },
        {
          repeat: repeatPattern,
          removeOnComplete: true,
          removeOnFail: false,
        }
      );

      logger.info('Report generation scheduled', {
        reportId: report.id,
        reportType: report.reportType,
        pattern: repeatPattern.pattern,
      });
    }
  } catch (error) {
    logger.error('Failed to schedule report generations', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

// Manually trigger report generation
export async function triggerReportGeneration(reportId: string): Promise<void> {
  await reportGenerationQueue.add(
    `report-${reportId}-manual`,
    { reportId },
    { removeOnComplete: true, removeOnFail: false }
  );

  logger.info('Manual report generation triggered', { reportId });
}

// Initialize report jobs
export async function initializeReportJobs(): Promise<void> {
  if (!config.reports.enabled) {
    logger.info('Reports are disabled, skipping job initialization');
    return;
  }

  logger.info('Initializing report jobs');

  // Schedule initial report generations
  await scheduleReportGenerations();

  // Re-schedule every hour to pick up new/updated reports
  setInterval(
    async () => {
      try {
        await scheduleReportGenerations();
      } catch (error) {
        logger.error('Failed to refresh report schedules', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
    3600000 // 1 hour
  );

  logger.info('Report jobs initialized');
}
