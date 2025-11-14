import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import * as path from 'path';
import { CSVConnector } from '../../connectors/csv.connector';
import { DataSourceConfig, ConnectorType, DataType } from '../../connectors/types';

describe('CSVConnector', () => {
  let connector: CSVConnector;
  const sampleCsvPath = path.join(__dirname, '../data/sample.csv');

  const config: DataSourceConfig = {
    name: 'Test CSV',
    type: ConnectorType.CSV,
    enabled: true,
    config: {
      path: sampleCsvPath,
      delimiter: ',',
      hasHeader: true,
    },
  };

  beforeAll(() => {
    connector = new CSVConnector(config);
  });

  afterAll(async () => {
    await connector.close();
  });

  describe('testConnection', () => {
    it('should successfully test connection to CSV file', async () => {
      const result = await connector.testConnection();
      expect(result.success).toBe(true);
      expect(result.message).toBe('Connection successful');
    });

    it('should fail on non-existent file', async () => {
      const badConfig: DataSourceConfig = {
        ...config,
        config: {
          path: '/non/existent/path.csv',
        },
      };
      const badConnector = new CSVConnector(badConfig);
      const result = await badConnector.testConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      await badConnector.close();
    });
  });

  describe('discoverSchema', () => {
    it('should discover schema from CSV file', async () => {
      const schema = await connector.discoverSchema();

      expect(schema).toBeDefined();
      expect(schema.columns).toBeDefined();
      expect(schema.columns.length).toBeGreaterThan(0);
      expect(schema.path).toContain('sample.csv');
    });

    it('should infer correct column names', async () => {
      const schema = await connector.discoverSchema();
      const columnNames = schema.columns.map(c => c.name);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('email');
      expect(columnNames).toContain('created_date');
    });

    it('should infer correct data types', async () => {
      const schema = await connector.discoverSchema();
      const columnMap: Record<string, DataType> = {};

      for (const col of schema.columns) {
        columnMap[col.name] = col.type;
      }

      expect(columnMap['id']).toBe(DataType.INTEGER);
      expect(columnMap['name']).toBe(DataType.STRING);
      expect(columnMap['email']).toBe(DataType.STRING);
      expect(columnMap['score']).toBe(DataType.FLOAT);
    });
  });

  describe('getSamples', () => {
    it('should return samples from CSV', async () => {
      const result = await connector.getSamples(5);

      expect(result.data).toBeDefined();
      expect(result.data.length).toBeLessThanOrEqual(5);
      expect(result.count).toBeLessThanOrEqual(5);
      expect(result.totalCount).toBeGreaterThan(0);
    });

    it('should return correct sample data', async () => {
      const result = await connector.getSamples(1);

      expect(result.data.length).toBe(1);
      expect(result.data[0]).toHaveProperty('id');
      expect(result.data[0]).toHaveProperty('name');
      expect(result.data[0]).toHaveProperty('email');
    });
  });

  describe('profileColumns', () => {
    it('should profile columns', async () => {
      const profiles = await connector.profileColumns(10);

      expect(profiles).toBeDefined();
      expect(profiles.length).toBeGreaterThan(0);
    });

    it('should include statistics for each column', async () => {
      const profiles = await connector.profileColumns(10);

      const idProfile = profiles.find(p => p.name === 'id');
      expect(idProfile).toBeDefined();
      expect(idProfile?.type).toBe(DataType.INTEGER);
      expect(idProfile?.nullCount).toBeDefined();
      expect(idProfile?.uniqueCount).toBeDefined();
      expect(idProfile?.sampleValues).toBeDefined();
    });
  });
});
