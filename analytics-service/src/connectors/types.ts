export enum ConnectorType {
  POSTGRES = 'postgres',
  CSV = 'csv',
  S3_PARQUET = 's3_parquet',
}

export enum DataType {
  STRING = 'string',
  INTEGER = 'integer',
  FLOAT = 'float',
  BOOLEAN = 'boolean',
  DATE = 'date',
  TIMESTAMP = 'timestamp',
  UNKNOWN = 'unknown',
}

export interface ColumnMetadata {
  name: string;
  type: DataType;
  nullable: boolean;
  sample?: any;
  description?: string;
}

export interface SchemaMetadata {
  table?: string;
  path?: string;
  columns: ColumnMetadata[];
  rowCount?: number;
  sizeBytes?: number;
  createdAt?: Date;
  lastModified?: Date;
}

export interface ColumnProfile {
  name: string;
  type: DataType;
  nullCount: number;
  uniqueCount: number;
  sampleValues: any[];
  minLength?: number;
  maxLength?: number;
  avgLength?: number;
  minValue?: any;
  maxValue?: any;
  mostCommon?: any;
}

export interface DataSourceConfig {
  id?: string;
  name: string;
  type: ConnectorType;
  enabled: boolean;
  config: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  error?: string;
}

export interface SampleFetchResult {
  data: any[];
  count: number;
  totalCount: number;
}

export interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  schema?: string;
}

export interface CSVConfig {
  path: string;
  delimiter?: string;
  hasHeader?: boolean;
  encoding?: string;
  dateFormat?: string;
  s3?: {
    endpoint?: string;
    accessKey: string;
    secretKey: string;
    bucket: string;
    region?: string;
    useSSL?: boolean;
  };
}

export interface S3ParquetConfig {
  bucket: string;
  prefix?: string;
  endpoint?: string;
  accessKey: string;
  secretKey: string;
  region?: string;
  useSSL?: boolean;
}
