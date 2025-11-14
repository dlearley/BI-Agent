import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { RedisInstrumentation } from '@opentelemetry/instrumentation-redis-4';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';

const serviceName = process.env.OTEL_SERVICE_NAME || 'analytics-service';
const serviceVersion = process.env.npm_package_version || '1.0.0';
const environment = process.env.NODE_ENV || 'development';

// OTLP endpoint for traces and metrics
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';

// Create trace exporter
const traceExporter = new OTLPTraceExporter({
  url: `${otlpEndpoint}/v1/traces`,
  headers: {},
});

// Create metrics exporter
const metricExporter = new OTLPMetricExporter({
  url: `${otlpEndpoint}/v1/metrics`,
  headers: {},
});

// Create resource with service information
const resource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
  [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
  [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: environment,
});

// Initialize OpenTelemetry SDK
const sdk = new NodeSDK({
  resource,
  traceExporter,
  metricReader: new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 10000, // Export metrics every 10 seconds
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      // Enable specific instrumentations
      '@opentelemetry/instrumentation-fs': {
        enabled: false, // Disable fs to reduce noise
      },
    }),
    new HttpInstrumentation({
      requestHook: (span, request) => {
        span.setAttribute('http.request_id', request.headers['x-request-id'] || 'unknown');
      },
    }),
    new ExpressInstrumentation({
      requestHook: (span, reqInfo) => {
        span.setAttribute('http.route', reqInfo.route || 'unknown');
      },
    }),
    new PgInstrumentation({
      enhancedDatabaseReporting: true,
    }),
    new RedisInstrumentation(),
    new IORedisInstrumentation(),
  ],
});

export async function startTelemetry(): Promise<void> {
  try {
    await sdk.start();
    console.log('📡 OpenTelemetry initialized successfully');
    console.log(`   Service: ${serviceName}`);
    console.log(`   Version: ${serviceVersion}`);
    console.log(`   Environment: ${environment}`);
    console.log(`   OTLP Endpoint: ${otlpEndpoint}`);
  } catch (error) {
    console.error('❌ Error initializing OpenTelemetry:', error);
  }
}

export async function shutdownTelemetry(): Promise<void> {
  try {
    await sdk.shutdown();
    console.log('📡 OpenTelemetry shut down successfully');
  } catch (error) {
    console.error('❌ Error shutting down OpenTelemetry:', error);
  }
}

export { sdk };
