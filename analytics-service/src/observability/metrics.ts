import { Request, Response } from 'express';
import { Registry, Counter, Histogram, Gauge } from 'prom-client';

// Create a new registry
export const register = new Registry();
register.setDefaultLabels({
  service: process.env.OTEL_SERVICE_NAME || 'analytics-service',
  environment: process.env.NODE_ENV || 'development',
});

// Default metrics (process metrics, Node.js metrics, etc.)
import { collectDefaultMetrics } from 'prom-client';
collectDefaultMetrics({ register });

// Custom metrics

// HTTP request counter
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

// HTTP request duration
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

// Database query duration
export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

// Redis operation duration
export const redisOperationDuration = new Histogram({
  name: 'redis_operation_duration_seconds',
  help: 'Redis operation duration in seconds',
  labelNames: ['operation'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

// Cache hit/miss counter
export const cacheHitsTotal = new Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_type'],
  registers: [register],
});

export const cacheMissesTotal = new Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_type'],
  registers: [register],
});

// Queue metrics
export const queueJobsTotal = new Counter({
  name: 'queue_jobs_total',
  help: 'Total number of jobs processed by the queue',
  labelNames: ['queue', 'status'],
  registers: [register],
});

export const queueJobDuration = new Histogram({
  name: 'queue_job_duration_seconds',
  help: 'Queue job processing duration in seconds',
  labelNames: ['queue', 'job_type'],
  buckets: [1, 5, 10, 30, 60, 120, 300],
  registers: [register],
});

export const queueSize = new Gauge({
  name: 'queue_size',
  help: 'Current size of the queue',
  labelNames: ['queue', 'state'],
  registers: [register],
});

// Analytics-specific metrics
export const analyticsRefreshTotal = new Counter({
  name: 'analytics_refresh_total',
  help: 'Total number of analytics refreshes',
  labelNames: ['view', 'status'],
  registers: [register],
});

export const analyticsRefreshDuration = new Histogram({
  name: 'analytics_refresh_duration_seconds',
  help: 'Analytics refresh duration in seconds',
  labelNames: ['view'],
  buckets: [1, 5, 10, 30, 60, 120, 300, 600],
  registers: [register],
});

export const analyticsQueryTotal = new Counter({
  name: 'analytics_query_total',
  help: 'Total number of analytics queries',
  labelNames: ['endpoint', 'status'],
  registers: [register],
});

// HIPAA audit events
export const hipaaAuditEventsTotal = new Counter({
  name: 'hipaa_audit_events_total',
  help: 'Total number of HIPAA audit events',
  labelNames: ['action', 'resource'],
  registers: [register],
});

// Active connections
export const activeConnections = new Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
  labelNames: ['type'],
  registers: [register],
});

// Metrics endpoint handler
export async function metricsHandler(req: Request, res: Response): Promise<void> {
  try {
    res.setHeader('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.send(metrics);
  } catch (error) {
    res.status(500).send('Error generating metrics');
  }
}
