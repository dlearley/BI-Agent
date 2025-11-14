import { startTelemetry } from './config/telemetry';

// Initialize telemetry as early as possible
startTelemetry().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start telemetry', error);
});
