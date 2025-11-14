import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { redis } from '../config/redis';
import {
  DataSource,
  DataSourceType,
  SchemaMetadata,
  ColumnProfile,
  User,
} from '../types';
import {
  ConnectorFactory,
  DataSourceConfig,
  ConnectorType,
  ConnectionTestResult,
} from '../connectors';
import { governanceService } from './governance.service';

export class DataSourceService {
  private readonly cachePrefix = 'datasource:';
  private readonly cacheTTL = 3600; // 1 hour

  async createDataSource(
    dataSource: Omit<DataSource, 'id' | 'createdAt' | 'updatedAt'>,
    user: User
  ): Promise<DataSource> {
    const id = uuidv4();
    const now = new Date();

    const created: DataSource = {
      ...dataSource,
      id,
      createdAt: now,
      updatedAt: now,
      createdBy: user.id,
    };

    // Validate connection before saving
    const testResult = await this.testConnection(created);
    if (!testResult.success) {
      throw new Error(`Connection test failed: ${testResult.message}`);
    }

    // Save to database
    const query = `
      INSERT INTO data_sources 
      (id, name, type, enabled, config, schema, column_profiles, created_by, facility_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const result = await db.queryOne(query, [
      id,
      created.name,
      created.type,
      created.enabled,
      JSON.stringify(created.config),
      created.schema ? JSON.stringify(created.schema) : null,
      created.columnProfiles ? JSON.stringify(created.columnProfiles) : null,
      user.id,
      created.facilityId || null,
      now,
      now,
    ]);

    // Cache the result
    await redis.set(
      `${this.cachePrefix}${id}`,
      JSON.stringify(created),
      this.cacheTTL
    );

    return created;
  }

  async getDataSource(id: string): Promise<DataSource | null> {
    // Try cache first
    const cached = await redis.get(`${this.cachePrefix}${id}`);
    if (cached) {
      return JSON.parse(cached as string) as DataSource;
    }

    const query = `
      SELECT * FROM data_sources WHERE id = $1
    `;

    const result = await db.queryOne(query, [id]);

    if (!result) {
      return null;
    }

    const dataSource: DataSource = {
      id: result.id,
      name: result.name,
      type: result.type as DataSourceType,
      enabled: result.enabled,
      config: JSON.parse(result.config),
      schema: result.schema ? JSON.parse(result.schema) : undefined,
      columnProfiles: result.column_profiles
        ? JSON.parse(result.column_profiles)
        : undefined,
      createdAt: new Date(result.created_at),
      updatedAt: new Date(result.updated_at),
      createdBy: result.created_by,
      facilityId: result.facility_id,
    };

    // Cache the result
    await redis.set(
      `${this.cachePrefix}${id}`,
      JSON.stringify(dataSource),
      this.cacheTTL
    );

    return dataSource;
  }

  async listDataSources(
    user: User,
    facilityId?: string
  ): Promise<DataSource[]> {
    const cacheKey = `${this.cachePrefix}list:${facilityId || 'all'}`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached as string) as DataSource[];
    }

    let query = 'SELECT * FROM data_sources WHERE enabled = true';
    const params: any[] = [];

    if (facilityId) {
      query += ' AND facility_id = $1';
      params.push(facilityId);
    }

    const results = await db.query(query, params);

    const dataSources: DataSource[] = results.map(row => ({
      id: row.id,
      name: row.name,
      type: row.type as DataSourceType,
      enabled: row.enabled,
      config: JSON.parse(row.config),
      schema: row.schema ? JSON.parse(row.schema) : undefined,
      columnProfiles: row.column_profiles
        ? JSON.parse(row.column_profiles)
        : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      createdBy: row.created_by,
      facilityId: row.facility_id,
    }));

    // Cache the result
    await redis.set(cacheKey, JSON.stringify(dataSources), this.cacheTTL);

    return dataSources;
  }

  async updateDataSource(
    id: string,
    updates: Partial<DataSource>,
    user: User
  ): Promise<DataSource> {
    const existing = await this.getDataSource(id);
    if (!existing) {
      throw new Error('Data source not found');
    }

    const updated: DataSource = {
      ...existing,
      ...updates,
      id: existing.id, // Don't allow ID change
      createdAt: existing.createdAt, // Don't allow creation date change
      createdBy: existing.createdBy, // Don't allow creator change
      updatedAt: new Date(),
    };

    // If config changed, test connection
    if (JSON.stringify(updated.config) !== JSON.stringify(existing.config)) {
      const testResult = await this.testConnection(updated);
      if (!testResult.success) {
        throw new Error(`Connection test failed: ${testResult.message}`);
      }
    }

    const query = `
      UPDATE data_sources 
      SET name = $1, type = $2, enabled = $3, config = $4, schema = $5, column_profiles = $6, updated_at = $7
      WHERE id = $8
      RETURNING *
    `;

    await db.queryOne(query, [
      updated.name,
      updated.type,
      updated.enabled,
      JSON.stringify(updated.config),
      updated.schema ? JSON.stringify(updated.schema) : null,
      updated.columnProfiles ? JSON.stringify(updated.columnProfiles) : null,
      updated.updatedAt,
      id,
    ]);

    // Invalidate cache
    await redis.del(`${this.cachePrefix}${id}`);
    await redis.del(`${this.cachePrefix}list:${updated.facilityId || 'all'}`);

    return updated;
  }

  async deleteDataSource(id: string): Promise<void> {
    const dataSource = await this.getDataSource(id);
    if (!dataSource) {
      throw new Error('Data source not found');
    }

    const query = 'DELETE FROM data_sources WHERE id = $1';
    await db.query(query, [id]);

    // Invalidate cache
    await redis.del(`${this.cachePrefix}${id}`);
    await redis.del(
      `${this.cachePrefix}list:${dataSource.facilityId || 'all'}`
    );
  }

  async testConnection(dataSource: DataSource): Promise<ConnectionTestResult> {
    try {
      const connectorConfig: DataSourceConfig = {
        name: dataSource.name,
        type: this.mapDataSourceType(dataSource.type),
        enabled: dataSource.enabled,
        config: dataSource.config,
      };

      const connector = ConnectorFactory.createConnector(connectorConfig);

      try {
        const result = await connector.testConnection();
        return result;
      } finally {
        await connector.close();
      }
    } catch (error) {
      return {
        success: false,
        message: 'Connection test failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async discoverSchema(dataSourceId: string): Promise<SchemaMetadata> {
    const dataSource = await this.getDataSource(dataSourceId);
    if (!dataSource) {
      throw new Error('Data source not found');
    }

    const connectorConfig: DataSourceConfig = {
      name: dataSource.name,
      type: this.mapDataSourceType(dataSource.type),
      enabled: dataSource.enabled,
      config: dataSource.config,
    };

    const connector = ConnectorFactory.createConnector(connectorConfig);

    try {
      const schema = await connector.discoverSchema();

      // Update the data source with the discovered schema
      await this.updateDataSource(
        dataSourceId,
        { schema },
        { id: dataSource.createdBy } as User
      );

      return schema;
    } finally {
      await connector.close();
    }
  }

  async getSamples(
    dataSourceId: string,
    limit: number = 10
  ): Promise<Record<string, any>[]> {
    const dataSource = await this.getDataSource(dataSourceId);
    if (!dataSource) {
      throw new Error('Data source not found');
    }

    const connectorConfig: DataSourceConfig = {
      name: dataSource.name,
      type: this.mapDataSourceType(dataSource.type),
      enabled: dataSource.enabled,
      config: dataSource.config,
    };

    const connector = ConnectorFactory.createConnector(connectorConfig);

    try {
      const result = await connector.getSamples(limit);
      return result.data;
    } finally {
      await connector.close();
    }
  }

  async profileColumns(
    dataSourceId: string,
    sampleSize: number = 1000
  ): Promise<ColumnProfile[]> {
    const dataSource = await this.getDataSource(dataSourceId);
    if (!dataSource) {
      throw new Error('Data source not found');
    }

    const connectorConfig: DataSourceConfig = {
      name: dataSource.name,
      type: this.mapDataSourceType(dataSource.type),
      enabled: dataSource.enabled,
      config: dataSource.config,
    };

    const connector = ConnectorFactory.createConnector(connectorConfig);

    try {
      const profiles = await connector.profileColumns(sampleSize);

      // Update the data source with profiles
      await this.updateDataSource(
        dataSourceId,
        { columnProfiles: profiles },
        { id: dataSource.createdBy } as User
      );

      return profiles;
    } finally {
      await connector.close();
    }
  }

  private mapDataSourceType(type: DataSourceType): ConnectorType {
    switch (type) {
      case DataSourceType.POSTGRES:
        return ConnectorType.POSTGRES;
      case DataSourceType.CSV:
        return ConnectorType.CSV;
      case DataSourceType.S3_PARQUET:
        return ConnectorType.S3_PARQUET;
      default:
        throw new Error(`Unsupported data source type: ${type}`);
    }
  }
}

export const datasourceService = new DataSourceService();
