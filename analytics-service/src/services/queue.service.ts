import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import config from '../config';
import { analyticsService } from './analytics.service';
import { crmIngestionService } from './crm-ingestion.service';
import { JobData, JobResult, IngestionJobData, IngestionResult } from '../types';

interface AnalyticsJob extends Job<JobData> {
  data: JobData;
}

interface CRMIngestionJob extends Job<IngestionJobData> {
  data: IngestionJobData;
}

export class QueueService {
  private connection: Redis;
  private analyticsQueue: Queue;
  private crmIngestionQueue: Queue;
  private worker!: Worker;

  constructor() {
    this.connection = new Redis(config.redis);
    
    this.analyticsQueue = new Queue('analytics-queue', {
      connection: this.connection,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    this.crmIngestionQueue = new Queue('crm-ingestion-queue', {
      connection: this.connection,
      defaultJobOptions: {
        removeOnComplete: 200,
        removeOnFail: 100,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    });

    this.setupWorker();
    this.setupScheduledJobs();
  }

  private setupWorker(): void {
    this.worker = new Worker(
      ['analytics-queue', 'crm-ingestion-queue'],
      async (job: Job<JobData | IngestionJobData>) => {
        if (job.data.type === 'crm_ingestion') {
          return this.processCRMIngestionJob(job as CRMIngestionJob);
        } else {
          return this.processAnalyticsJob(job as AnalyticsJob);
        }
      },
      {
        connection: this.connection,
        concurrency: 3,
      }
    );

    this.worker.on('completed', (job: AnalyticsJob | CRMIngestionJob, result: JobResult | IngestionResult) => {
      console.log(`Job ${job.id} completed:`, result);
    });

    this.worker.on('failed', (job: AnalyticsJob | CRMIngestionJob | undefined, err: Error) => {
      console.error(`Job ${job?.id || 'unknown'} failed:`, err);
    });
  }

  private async processAnalyticsJob(job: AnalyticsJob): Promise<JobResult> {
    const { type, viewName } = job.data;

    try {
      switch (type) {
        case 'refresh_analytics':
          await analyticsService.refreshMaterializedViews(viewName);
          return {
            success: true,
            message: `Successfully refreshed ${viewName || 'all'} analytics views`,
            data: {
              refreshedAt: new Date().toISOString(),
              viewName: viewName || 'all'
            }
          };

        case 'refresh_view':
          if (!viewName) {
            throw new Error('View name is required for refresh_view job');
          }
          await analyticsService.refreshMaterializedViews(viewName);
          return {
            success: true,
            message: `Successfully refreshed view: ${viewName}`,
            data: {
              refreshedAt: new Date().toISOString(),
              viewName
            }
          };

        default:
          throw new Error(`Unknown job type: ${type}`);
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to process analytics job: ${type}`,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async processCRMIngestionJob(job: CRMIngestionJob): Promise<IngestionResult> {
    const startTime = Date.now();
    const { topic, partition, offset } = job.data;

    try {
      // Start the CRM ingestion service if not already running
      await crmIngestionService.start();

      // Get metrics after processing
      const metrics = await crmIngestionService.getIngestionMetrics();

      const processingTime = Date.now() - startTime;

      return {
        success: true,
        message: `CRM ingestion job completed successfully for topic: ${topic}`,
        data: {
          topic,
          partition,
          offset,
          metrics,
        },
        metrics: {
          eventsProcessed: metrics.processed_events || 0,
          eventsSkipped: metrics.skipped_events || 0,
          errors: metrics.failed_events || 0,
          processingTimeMs: processingTime,
        },
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      return {
        success: false,
        message: `Failed to process CRM ingestion job for topic: ${topic}`,
        error: error instanceof Error ? error.message : 'Unknown error',
        metrics: {
          eventsProcessed: 0,
          eventsSkipped: 0,
          errors: 1,
          processingTimeMs: processingTime,
        },
      };
    }
  }

  private setupScheduledJobs(): void {
    // Schedule full analytics refresh every hour
    this.analyticsQueue.add(
      'refresh_analytics',
      { type: 'refresh_analytics' },
      {
        repeat: {
          pattern: '0 * * * *', // Every hour at minute 0
        },
        jobId: 'hourly-analytics-refresh',
      }
    );

    // Schedule quick refresh for pipeline view every 30 minutes
    this.analyticsQueue.add(
      'refresh_view',
      { type: 'refresh_view', viewName: 'pipeline' },
      {
        repeat: {
          pattern: '*/30 * * * *', // Every 30 minutes
        },
        jobId: 'pipeline-refresh',
      }
    );
  }

  async enqueueRefreshJob(viewName?: string, delay?: number): Promise<Job<JobData>> {
    const jobData: JobData = viewName 
      ? { type: 'refresh_view', viewName }
      : { type: 'refresh_analytics' };

    const jobOptions: any = {
      delay: delay || 0,
      removeOnComplete: 100,
      removeOnFail: 50,
    };

    return await this.analyticsQueue.add('refresh_analytics', jobData, jobOptions);
  }

  async enqueueCRMIngestionJob(
    topic: string,
    partition?: number,
    offset?: number,
    delay?: number
  ): Promise<Job<IngestionJobData>> {
    const jobData: IngestionJobData = {
      type: 'crm_ingestion',
      topic,
      partition,
      offset,
    };

    const jobOptions: any = {
      delay: delay || 0,
      removeOnComplete: 200,
      removeOnFail: 100,
    };

    return await this.crmIngestionQueue.add('crm_ingestion', jobData, jobOptions);
  }

  async getJobStatus(jobId: string): Promise<any> {
    const job = await this.analyticsQueue.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    return {
      id: job.id,
      name: job.name,
      data: job.data,
      progress: job.progress,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
      returnvalue: job.returnvalue,
      state: await job.getState(),
    };
  }

  async getQueueStats(): Promise<any> {
    const waiting = await this.analyticsQueue.getWaiting();
    const active = await this.analyticsQueue.getActive();
    const completed = await this.analyticsQueue.getCompleted();
    const failed = await this.analyticsQueue.getFailed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      paused: await this.analyticsQueue.isPaused(),
    };
  }

  async pauseQueue(): Promise<void> {
    await this.analyticsQueue.pause();
  }

  async resumeQueue(): Promise<void> {
    await this.analyticsQueue.resume();
  }

  async clearQueue(): Promise<void> {
    await this.analyticsQueue.clean(0, 0, 'completed');
    await this.analyticsQueue.clean(0, 0, 'failed');
  }

  async close(): Promise<void> {
    await this.worker.close();
    await this.analyticsQueue.close();
    await this.crmIngestionQueue.close();
    await this.connection.quit();
  }
}

export const queueService = new QueueService();