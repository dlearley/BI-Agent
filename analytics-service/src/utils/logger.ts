import winston from 'winston';
import { context, trace } from '@opentelemetry/api';
import { getCorrelationId } from '../observability/request-context';

const { combine, timestamp, printf, colorize, json } = winston.format;

// Custom format to include trace context and correlation ID
const traceFormat = printf((info) => {
  const span = trace.getSpan(context.active());
  if (span) {
    const spanContext = span.spanContext();
    info.traceId = spanContext.traceId;
    info.spanId = spanContext.spanId;
    info.traceFlags = spanContext.traceFlags;
  }
  const correlationId = getCorrelationId();
  if (correlationId) {
    info.correlationId = correlationId;
  }
  return `${info.timestamp} ${info.level} ${info.message}`;
});

// Console format for development
const consoleFormat = printf(({ level, message, timestamp, traceId, correlationId, ...metadata }) => {
  const traceStr = typeof traceId === 'string' ? traceId : '';
  const correlationStr = typeof correlationId === 'string' ? correlationId : '';
  const traceInfo = traceStr ? `[trace:${traceStr.substring(0, 8)}]` : '';
  const correlationInfo = correlationStr ? `[corr:${correlationStr.substring(0, 8)}]` : '';
  const metaStr = Object.keys(metadata).length ? JSON.stringify(metadata) : '';
  return `${timestamp} ${level} ${traceInfo}${correlationInfo} ${message} ${metaStr}`;
});

// JSON format for production
const productionFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  traceFormat,
  json()
);

// Console format for development
const developmentFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  colorize(),
  traceFormat,
  consoleFormat
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.NODE_ENV === 'production' ? productionFormat : developmentFormat,
  defaultMeta: {
    service: process.env.OTEL_SERVICE_NAME || 'analytics-service',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [
    new winston.transports.Console(),
  ],
});

// Add file transport in production
if (process.env.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    })
  );
  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    })
  );
}

// Audit logger for HIPAA compliance
export const auditLogger = winston.createLogger({
  level: 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    traceFormat,
    json()
  ),
  defaultMeta: {
    service: process.env.OTEL_SERVICE_NAME || 'analytics-service',
    environment: process.env.NODE_ENV || 'development',
    audit: true,
  },
  transports: [
    new winston.transports.File({
      filename: 'logs/audit.log',
      maxsize: 10485760, // 10MB
      maxFiles: 10, // Keep more audit logs
    }),
  ],
});

// Helper function to log audit events
export function logAuditEvent(
  action: string,
  userId: string,
  resource: string,
  details?: Record<string, unknown>
): void {
  auditLogger.info('Audit event', {
    action,
    userId,
    resource,
    timestamp: new Date().toISOString(),
    ...details,
  });
}

export default logger;
