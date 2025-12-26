import { Client } from 'pg';
import { BaseConnector } from './base.connector';
import {
  SchemaMetadata,
  ColumnProfile,
  DataSourceConfig,
  ConnectionTestResult,
  SampleFetchResult,
  PostgresConfig,
  DataType,
  ColumnMetadata,
} from './types';

export class PostgresConnector extends BaseConnector {
  private client: Client | null = null;

  constructor(config: DataSourceConfig) {
    super(config);
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      const pgConfig = this.getConfig<PostgresConfig>();
      const client = new Client({
        host: pgConfig.host,
        port: pgConfig.port,
        database: pgConfig.database,
        user: pgConfig.username,
        password: pgConfig.password,
        ssl: pgConfig.ssl,
      });

      await client.connect();
      const result = await client.query('SELECT 1');
      await client.end();

      return {
        success: true,
        message: 'Connection successful',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Connection failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async discoverSchema(): Promise<SchemaMetadata> {
    const pgConfig = this.getConfig<PostgresConfig>();
    const schema = pgConfig.schema || 'public';
    
    await this.ensureConnection();

    // Get table name - for now assume first table or use config
    const tableQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = $1 
      LIMIT 1
    `;
    const tableResult = await this.client!.query(tableQuery, [schema]);
    
    if (tableResult.rows.length === 0) {
      throw new Error(`No tables found in schema '${schema}'`);
    }

    const tableName = tableResult.rows[0].table_name;

    // Get columns info
    const columnsQuery = `
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position
    `;

    const columnsResult = await this.client!.query(columnsQuery, [schema, tableName]);

    const columns: ColumnMetadata[] = columnsResult.rows.map(row => ({
      name: row.column_name,
      type: this.mapPostgresType(row.data_type),
      nullable: row.is_nullable === 'YES',
    }));

    // Get row count
    const countResult = await this.client!.query(`SELECT COUNT(*) as count FROM "${schema}"."${tableName}"`);
    const rowCount = parseInt(countResult.rows[0].count, 10);

    return {
      table: tableName,
      columns,
      rowCount,
    };
  }

  async getSamples(limit: number = 10): Promise<SampleFetchResult> {
    const pgConfig = this.getConfig<PostgresConfig>();
    const schema = pgConfig.schema || 'public';

    await this.ensureConnection();

    // Get first table
    const tableQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = $1 
      LIMIT 1
    `;
    const tableResult = await this.client!.query(tableQuery, [schema]);

    if (tableResult.rows.length === 0) {
      return { data: [], count: 0, totalCount: 0 };
    }

    const tableName = tableResult.rows[0].table_name;

    const countResult = await this.client!.query(`SELECT COUNT(*) as count FROM "${schema}"."${tableName}"`);
    const totalCount = parseInt(countResult.rows[0].count, 10);

    const dataQuery = `SELECT * FROM "${schema}"."${tableName}" LIMIT $1`;
    const dataResult = await this.client!.query(dataQuery, [limit]);

    return {
      data: dataResult.rows,
      count: dataResult.rows.length,
      totalCount,
    };
  }

  async profileColumns(sampleSize: number = 1000): Promise<ColumnProfile[]> {
    const pgConfig = this.getConfig<PostgresConfig>();
    const schema = pgConfig.schema || 'public';

    await this.ensureConnection();

    const tableQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = $1 
      LIMIT 1
    `;
    const tableResult = await this.client!.query(tableQuery, [schema]);

    if (tableResult.rows.length === 0) {
      return [];
    }

    const tableName = tableResult.rows[0].table_name;

    const columnsQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position
    `;

    const columnsResult = await this.client!.query(columnsQuery, [schema, tableName]);

    const profiles: ColumnProfile[] = [];

    for (const col of columnsResult.rows) {
      const columnName = col.column_name;
      const columnType = col.data_type;

      const profileQuery = `
        SELECT
          COUNT(*) as total_count,
          SUM(CASE WHEN "${columnName}" IS NULL THEN 1 ELSE 0 END) as null_count,
          COUNT(DISTINCT "${columnName}") as unique_count,
          MIN(CAST("${columnName}" AS TEXT)) as min_value,
          MAX(CAST("${columnName}" AS TEXT)) as max_value,
          MODE() WITHIN GROUP (ORDER BY "${columnName}") as most_common
        FROM "${schema}"."${tableName}"
        LIMIT $1
      `;

      try {
        const profileResult = await this.client!.query(profileQuery, [sampleSize]);
        const stats = profileResult.rows[0];

        const samplesQuery = `
          SELECT DISTINCT "${columnName}"
          FROM "${schema}"."${tableName}"
          WHERE "${columnName}" IS NOT NULL
          LIMIT 5
        `;
        const samplesResult = await this.client!.query(samplesQuery);
        const samples = samplesResult.rows.map(r => r[columnName]);

        profiles.push({
          name: columnName,
          type: this.mapPostgresType(columnType),
          nullCount: parseInt(stats.null_count || 0, 10),
          uniqueCount: parseInt(stats.unique_count || 0, 10),
          sampleValues: samples,
          minValue: stats.min_value,
          maxValue: stats.max_value,
          mostCommon: stats.most_common,
        });
      } catch (error) {
        // Fallback for columns that don't support MODE() or CAST
        profiles.push({
          name: columnName,
          type: this.mapPostgresType(columnType),
          nullCount: 0,
          uniqueCount: 0,
          sampleValues: [],
        });
      }
    }

    return profiles;
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.end();
      this.client = null;
    }
  }

  private async ensureConnection(): Promise<void> {
    if (!this.client) {
      const pgConfig = this.getConfig<PostgresConfig>();
      this.client = new Client({
        host: pgConfig.host,
        port: pgConfig.port,
        database: pgConfig.database,
        user: pgConfig.username,
        password: pgConfig.password,
        ssl: pgConfig.ssl,
      });

      await this.client.connect();
    }
  }

  private mapPostgresType(pgType: string): DataType {
    const type = pgType.toLowerCase();
    
    if (type.includes('varchar') || type.includes('char') || type === 'text') {
      return DataType.STRING;
    }
    if (type.includes('int')) {
      return DataType.INTEGER;
    }
    if (type.includes('float') || type.includes('numeric') || type.includes('decimal')) {
      return DataType.FLOAT;
    }
    if (type === 'boolean' || type === 'bool') {
      return DataType.BOOLEAN;
    }
    if (type.includes('date') && !type.includes('timestamp')) {
      return DataType.DATE;
    }
    if (type.includes('timestamp') || type.includes('time')) {
      return DataType.TIMESTAMP;
    }
    
    return DataType.UNKNOWN;
  }
}
