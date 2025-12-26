import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import * as path from 'path';
import { datasourceService } from '../../services/datasource.service';
import { DataSourceType, UserRole, User } from '../../types';

const mockUser: User = {
  id: 'test-user-123',
  email: 'test@example.com',
  role: UserRole.ADMIN,
  permissions: [],
};

describe('DataSource Integration Tests', () => {
  let csvDataSourceId: string;

  afterAll(async () => {
    // Cleanup
    if (csvDataSourceId) {
      try {
        await datasourceService.deleteDataSource(csvDataSourceId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('CSV DataSource', () => {
    it('should create a CSV data source', async () => {
      const dataSource = await datasourceService.createDataSource(
        {
          name: 'Test CSV Data Source',
          type: DataSourceType.CSV,
          enabled: true,
          config: {
            path: path.join(__dirname, '../data/sample.csv'),
            delimiter: ',',
            hasHeader: true,
          },
          createdBy: mockUser.id,
        },
        mockUser
      );

      csvDataSourceId = dataSource.id;

      expect(dataSource).toBeDefined();
      expect(dataSource.id).toBeDefined();
      expect(dataSource.name).toBe('Test CSV Data Source');
      expect(dataSource.type).toBe(DataSourceType.CSV);
      expect(dataSource.createdBy).toBe(mockUser.id);
    });

    it('should test connection for CSV data source', async () => {
      const dataSource = await datasourceService.getDataSource(csvDataSourceId);

      expect(dataSource).toBeDefined();

      const result = await datasourceService.testConnection(dataSource!);

      expect(result.success).toBe(true);
    });

    it('should discover schema for CSV data source', async () => {
      const schema = await datasourceService.discoverSchema(csvDataSourceId);

      expect(schema).toBeDefined();
      expect(schema.columns).toBeDefined();
      expect(schema.columns.length).toBeGreaterThan(0);

      const columnNames = schema.columns.map(c => c.name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('name');
    });

    it('should get samples from CSV data source', async () => {
      const samples = await datasourceService.getSamples(csvDataSourceId, 5);

      expect(samples).toBeDefined();
      expect(Array.isArray(samples)).toBe(true);
      expect(samples.length).toBeGreaterThan(0);
      expect(samples[0]).toHaveProperty('id');
    });

    it('should profile columns in CSV data source', async () => {
      const profiles = await datasourceService.profileColumns(csvDataSourceId, 100);

      expect(profiles).toBeDefined();
      expect(Array.isArray(profiles)).toBe(true);
      expect(profiles.length).toBeGreaterThan(0);

      const idProfile = profiles.find(p => p.name === 'id');
      expect(idProfile).toBeDefined();
      expect(idProfile?.uniqueCount).toBeGreaterThan(0);
    });

    it('should get CSV data source by ID', async () => {
      const dataSource = await datasourceService.getDataSource(csvDataSourceId);

      expect(dataSource).toBeDefined();
      expect(dataSource?.id).toBe(csvDataSourceId);
      expect(dataSource?.name).toBe('Test CSV Data Source');
    });

    it('should list CSV data source', async () => {
      const dataSources = await datasourceService.listDataSources(mockUser);

      expect(Array.isArray(dataSources)).toBe(true);
      expect(dataSources.length).toBeGreaterThan(0);

      const csvDataSource = dataSources.find(ds => ds.id === csvDataSourceId);
      expect(csvDataSource).toBeDefined();
    });

    it('should update CSV data source', async () => {
      const updated = await datasourceService.updateDataSource(
        csvDataSourceId,
        {
          name: 'Updated CSV Data Source',
        },
        mockUser
      );

      expect(updated.name).toBe('Updated CSV Data Source');
      expect(updated.id).toBe(csvDataSourceId);
    });
  });

  describe('Postgres DataSource', () => {
    it('should handle Postgres connection test gracefully', async () => {
      const result = await datasourceService.testConnection({
        id: 'test',
        name: 'Test Postgres',
        type: DataSourceType.POSTGRES,
        enabled: true,
        config: {
          host: 'non-existent-host',
          port: 5432,
          database: 'test',
          username: 'user',
          password: 'pass',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: mockUser.id,
      });

      expect(result.success).toBe(false);
      expect(result.message).toBeDefined();
    });
  });

  describe('S3 Parquet DataSource', () => {
    it('should validate S3 Parquet configuration', async () => {
      const result = await datasourceService.testConnection({
        id: 'test',
        name: 'Test S3 Parquet',
        type: DataSourceType.S3_PARQUET,
        enabled: true,
        config: {
          bucket: 'test-bucket',
          accessKey: 'test-key',
          secretKey: 'test-secret',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: mockUser.id,
      });

      expect(result.success).toBe(true);
    });
  });
});
