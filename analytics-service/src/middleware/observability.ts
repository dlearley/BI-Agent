import { Request, Response, NextFunction } from 'express';
import { httpRequestsTotal, httpRequestDuration } from '../observability/metrics';
import logger from '../utils/logger';
import { getCorrelationId } from '../observability/request-context';

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const route = req.route?.path || req.path;

  const recordMetrics = () => {
    const duration = (Date.now() - start) / 1000;
    const status = res.statusCode.toString();

    httpRequestsTotal.labels(req.method, route, status).inc();
    httpRequestDuration.labels(req.method, route, status).observe(duration);

    const correlationId = getCorrelationId();
    logger.info('HTTP request completed', {
      method: req.method,
      url: req.originalUrl,
      route,
      status: res.statusCode,
      duration: duration.toFixed(3),
      correlationId,
      userAgent: req.headers['user-agent'],
    });
  };

  res.once('finish', recordMetrics);
  res.once('close', () => {
    if (!res.writableEnded) {
      recordMetrics();
    }
  });

  next();
}

export function errorLoggingMiddleware(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const correlationId = getCorrelationId();
  
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    correlationId,
  });

  next(err);
}
