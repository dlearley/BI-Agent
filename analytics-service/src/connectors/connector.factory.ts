import { BaseConnector } from './base.connector';
import { PostgresConnector } from './postgres.connector';
import { CSVConnector } from './csv.connector';
import { S3ParquetConnector } from './s3-parquet.connector';
import { DataSourceConfig, ConnectorType } from './types';

export class ConnectorFactory {
  static createConnector(config: DataSourceConfig): BaseConnector {
    switch (config.type) {
      case ConnectorType.POSTGRES:
        return new PostgresConnector(config);
      case ConnectorType.CSV:
        return new CSVConnector(config);
      case ConnectorType.S3_PARQUET:
        return new S3ParquetConnector(config);
      default:
        throw new Error(`Unsupported connector type: ${config.type}`);
    }
  }
}
