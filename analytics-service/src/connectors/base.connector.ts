import {
  SchemaMetadata,
  ColumnProfile,
  DataSourceConfig,
  ConnectionTestResult,
  SampleFetchResult,
} from './types';

export abstract class BaseConnector {
  protected config: DataSourceConfig;

  constructor(config: DataSourceConfig) {
    this.config = config;
  }

  abstract testConnection(): Promise<ConnectionTestResult>;

  abstract discoverSchema(): Promise<SchemaMetadata>;

  abstract getSamples(limit: number): Promise<SampleFetchResult>;

  abstract profileColumns(sampleSize?: number): Promise<ColumnProfile[]>;

  abstract close(): Promise<void>;

  protected getType(): string {
    return this.config.type;
  }

  protected getConfig<T extends Record<string, any>>(): T {
    return this.config.config as T;
  }
}
