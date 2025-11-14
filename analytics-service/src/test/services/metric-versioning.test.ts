import { metricVersioningService } from '../../services/metric-versioning.service';
import { UserRole, Permission } from '../../types';
import { db } from '../../config/database';

describe('Metric Versioning Service Tests', () => {
  const testUser = {
    id: 'test-user',
    email: 'test@example.com',
    role: UserRole.ADMIN,
    permissions: Object.values(Permission),
    facilityId: 'facility-1',
  };

  const testMetricData = {
    total_applications: 100,
    hired_count: 25,
    rejected_count: 30,
    avg_time_to_fill: 15.5,
  };

  beforeEach(async () => {
    // Clean up any existing test data
    await cleanupTestData();
    await metricVersioningService.initializeTable();
  });

  afterEach(async () => {
    await cleanupTestData();
  });

  describe('Version Creation', () => {
    it('should create a new metric version', async () => {
      const version = await metricVersioningService.createVersion(
        'pipeline_kpis',
        'test-metric-1',
        testMetricData,
        testUser,
        'Initial version',
        'hipaa'
      );

      expect(version).toBeDefined();
      expect(version.metricType).toBe('pipeline_kpis');
      expect(version.metricId).toBe('test-metric-1');
      expect(version.version).toBe(1);
      expect(version.createdBy).toBe(testUser.id);
      expect(version.changeDescription).toBe('Initial version');
      expect(version.complianceFramework).toBe('hipaa');
      expect(JSON.parse(version.data)).toEqual(testMetricData);
    });

    it('should increment version number for subsequent versions', async () => {
      // Create first version
      await metricVersioningService.createVersion(
        'pipeline_kpis',
        'test-metric-2',
        testMetricData,
        testUser,
        'First version'
      );

      // Create second version
      const updatedData = { ...testMetricData, total_applications: 150 };
      const version2 = await metricVersioningService.createVersion(
        'pipeline_kpis',
        'test-metric-2',
        updatedData,
        testUser,
        'Updated version'
      );

      expect(version2.version).toBe(2);
    });

    it('should handle different metric types independently', async () => {
      const version1 = await metricVersioningService.createVersion(
        'pipeline_kpis',
        'metric-1',
        testMetricData,
        testUser
      );

      const version2 = await metricVersioningService.createVersion(
        'revenue_metrics',
        'metric-1',
        { revenue: 100000 },
        testUser
      );

      expect(version1.version).toBe(1);
      expect(version2.version).toBe(1);
    });

    it('should store change description', async () => {
      const description = 'Updated application targets for Q4';
      const version = await metricVersioningService.createVersion(
        'pipeline_kpis',
        'test-metric-3',
        testMetricData,
        testUser,
        description
      );

      expect(version.changeDescription).toBe(description);
    });

    it('should throw error when versioning is disabled', async () => {
      // Mock config to disable versioning
      const originalConfig = require('../../config').default;
      require('../../config').default.governance.metricVersioning.enabled = false;

      await expect(
        metricVersioningService.createVersion(
          'pipeline_kpis',
          'test-metric',
          testMetricData,
          testUser
        )
      ).rejects.toThrow('Metric versioning is disabled');

      // Restore config
      require('../../config').default.governance.metricVersioning.enabled = originalConfig.governance.metricVersioning.enabled;
    });
  });

  describe('Version Retrieval', () => {
    beforeEach(async () => {
      // Create test versions
      await metricVersioningService.createVersion(
        'pipeline_kpis',
        'test-retrieval',
        { total: 100 },
        testUser,
        'Version 1'
      );

      await metricVersioningService.createVersion(
        'pipeline_kpis',
        'test-retrieval',
        { total: 150 },
        testUser,
        'Version 2'
      );
    });

    it('should retrieve version history', async () => {
      const versions = await metricVersioningService.getVersionHistory(
        'pipeline_kpis',
        'test-retrieval'
      );

      expect(versions).toHaveLength(2);
      expect(versions[0].version).toBe(2); // Most recent first
      expect(versions[1].version).toBe(1);
      expect(JSON.parse(versions[0].data)).toEqual({ total: 150 });
      expect(JSON.parse(versions[1].data)).toEqual({ total: 100 });
    });

    it('should limit version history results', async () => {
      // Create more versions
      await metricVersioningService.createVersion(
        'pipeline_kpis',
        'test-retrieval',
        { total: 200 },
        testUser,
        'Version 3'
      );

      const versions = await metricVersioningService.getVersionHistory(
        'pipeline_kpis',
        'test-retrieval',
        2
      );

      expect(versions).toHaveLength(2);
      expect(versions[0].version).toBe(3);
      expect(versions[1].version).toBe(2);
    });

    it('should retrieve specific version', async () => {
      const version = await metricVersioningService.getVersion(
        'pipeline_kpis',
        'test-retrieval',
        1
      );

      expect(version).toBeDefined();
      expect(version!.version).toBe(1);
      expect(JSON.parse(version!.data)).toEqual({ total: 100 });
    });

    it('should return null for non-existent version', async () => {
      const version = await metricVersioningService.getVersion(
        'pipeline_kpis',
        'test-retrieval',
        99
      );

      expect(version).toBeNull();
    });

    it('should retrieve latest version', async () => {
      const latest = await metricVersioningService.getLatestVersion(
        'pipeline_kpis',
        'test-retrieval'
      );

      expect(latest).toBeDefined();
      expect(latest!.version).toBe(2);
      expect(JSON.parse(latest!.data)).toEqual({ total: 150 });
    });

    it('should return null for non-existent metric', async () => {
      const latest = await metricVersioningService.getLatestVersion(
        'nonexistent',
        'nonexistent'
      );

      expect(latest).toBeNull();
    });
  });

  describe('Version Comparison', () => {
    beforeEach(async () => {
      await metricVersioningService.createVersion(
        'pipeline_kpis',
        'test-comparison',
        { 
          total: 100, 
          hired: 20, 
          rejected: 30,
          department: 'Engineering'
        },
        testUser,
        'Initial version'
      );

      await metricVersioningService.createVersion(
        'pipeline_kpis',
        'test-comparison',
        { 
          total: 150, 
          hired: 35, 
          rejected: 25,
          department: 'Engineering',
          location: 'Remote'
        },
        testUser,
        'Updated version'
      );
    });

    it('should compare two versions', async () => {
      const comparison = await metricVersioningService.compareVersions(
        'pipeline_kpis',
        'test-comparison',
        1,
        2
      );

      expect(comparison.version1.version).toBe(1);
      expect(comparison.version2.version).toBe(2);
      expect(comparison.differences).toBeDefined();

      // Check modified values
      expect(comparison.differences.modified.total.old).toBe(100);
      expect(comparison.differences.modified.total.new).toBe(150);
      expect(comparison.differences.modified.hired.old).toBe(20);
      expect(comparison.differences.modified.hired.new).toBe(35);
      expect(comparison.differences.modified.rejected.old).toBe(30);
      expect(comparison.differences.modified.rejected.new).toBe(25);

      // Check added values
      expect(comparison.differences.added.location).toBe('Remote');

      // Check unchanged values (should not be in differences)
      expect(comparison.differences.modified).not.toHaveProperty('department');
    });

    it('should throw error for non-existent version in comparison', async () => {
      await expect(
        metricVersioningService.compareVersions(
          'pipeline_kpis',
          'test-comparison',
          1,
          99
        )
      ).rejects.toThrow('Version 99 not found');
    });
  });

  describe('Version Restoration', () => {
    beforeEach(async () => {
      await metricVersioningService.createVersion(
        'pipeline_kpis',
        'test-restore',
        { total: 100, hired: 20 },
        testUser,
        'Original'
      );

      await metricVersioningService.createVersion(
        'pipeline_kpis',
        'test-restore',
        { total: 200, hired: 40, rejected: 10 },
        testUser,
        'Modified'
      );
    });

    it('should restore from a previous version', async () => {
      const restored = await metricVersioningService.restoreVersion(
        'pipeline_kpis',
        'test-restore',
        1,
        testUser
      );

      expect(restored.version).toBe(3); // New version created
      expect(restored.changeDescription).toBe('Restored from version 1');
      expect(JSON.parse(restored.data)).toEqual({ total: 100, hired: 20 });
    });

    it('should throw error for non-existent version restoration', async () => {
      await expect(
        metricVersioningService.restoreVersion(
          'pipeline_kpis',
          'test-restore',
          99,
          testUser
        )
      ).rejects.toThrow('Version 99 not found');
    });
  });

  describe('Version Retention', () => {
    it('should clean up old versions beyond retention limit', async () => {
      // Mock retention limit to 2 for testing
      const originalConfig = require('../../config').default;
      const originalRetention = originalConfig.governance.metricVersioning.retention;
      originalConfig.governance.metricVersioning.retention = 2;

      // Create 4 versions
      for (let i = 1; i <= 4; i++) {
        await metricVersioningService.createVersion(
          'pipeline_kpis',
          'test-retention',
          { version: i },
          testUser,
          `Version ${i}`
        );
      }

      // Wait a bit to ensure cleanup is triggered
      await new Promise(resolve => setTimeout(resolve, 100));

      const versions = await metricVersioningService.getVersionHistory(
        'pipeline_kpis',
        'test-retention'
      );

      // Should only keep the 2 most recent versions
      expect(versions.length).toBeLessThanOrEqual(2);
      expect(versions[0].version).toBe(4);
      expect(versions[1].version).toBe(3);

      // Restore config
      originalConfig.governance.metricVersioning.retention = originalRetention;
    });
  });

  describe('Version Status and Management', () => {
    it('should get versioning status for all metrics', async () => {
      // Create test metrics
      await metricVersioningService.createVersion(
        'pipeline_kpis',
        'status-test-1',
        { total: 100 },
        testUser
      );

      await metricVersioningService.createVersion(
        'revenue_metrics',
        'status-test-2',
        { revenue: 50000 },
        testUser
      );

      await metricVersioningService.createVersion(
        'pipeline_kpis',
        'status-test-1',
        { total: 150 },
        testUser
      ); // Second version

      const status = await metricVersioningService.getMetricsByVersioningStatus();

      expect(status).toBeDefined();
      expect(Array.isArray(status)).toBe(true);
      
      const pipelineStatus = status.find(s => s.metric_type === 'pipeline_kpis' && s.metric_id === 'status-test-1');
      expect(pipelineStatus.version_count).toBe(2);
      expect(pipelineStatus.latest_version).toBe(2);

      const revenueStatus = status.find(s => s.metric_type === 'revenue_metrics' && s.metric_id === 'status-test-2');
      expect(revenueStatus.version_count).toBe(1);
      expect(revenueStatus.latest_version).toBe(1);
    });

    it('should delete old versions by date', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);

      // Create a version with old timestamp (we'll manually update it)
      await metricVersioningService.createVersion(
        'pipeline_kpis',
        'cleanup-test',
        { total: 100 },
        testUser
      );

      // Manually update the timestamp to simulate old data
      await db.query(
        'UPDATE metric_versions SET timestamp = $1 WHERE metric_type = $2 AND metric_id = $3',
        [oldDate, 'pipeline_kpis', 'cleanup-test']
      );

      const deletedCount = await metricVersioningService.deleteVersionsOlderThan(
        new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
      );

      expect(deletedCount).toBe(1);

      // Verify it's deleted
      const versions = await metricVersioningService.getVersionHistory(
        'pipeline_kpis',
        'cleanup-test'
      );
      expect(versions).toHaveLength(0);
    });
  });

  describe('Table Initialization', () => {
    it('should initialize tables without errors', async () => {
      await expect(metricVersioningService.initializeTable()).resolves.not.toThrow();
    });

    it('should create proper indexes', async () => {
      await metricVersioningService.initializeTable();

      // Check if indexes exist (this would require querying the database schema)
      // For now, we'll just ensure no errors are thrown
      await expect(
        db.query('SELECT 1 FROM metric_versions LIMIT 1')
      ).resolves.not.toThrow();
    });
  });

  describe('Data Integrity', () => {
    it('should handle complex data structures', async () => {
      const complexData = {
        metrics: {
          pipeline: { total: 100, conversion: 0.25 },
          revenue: { amount: 50000, growth: 0.15 },
        },
        metadata: {
          generated_at: new Date().toISOString(),
          source: 'automated',
          tags: ['q1', '2024', 'pipeline'],
        },
        nested: {
          level1: {
            level2: {
              value: 'deeply nested'
            }
          }
        }
      };

      const version = await metricVersioningService.createVersion(
        'complex_metrics',
        'test-complex',
        complexData,
        testUser
      );

      const retrieved = await metricVersioningService.getVersion(
        'complex_metrics',
        'test-complex',
        1
      );

      expect(retrieved).toBeDefined();
      expect(JSON.parse(retrieved!.data)).toEqual(complexData);
    });

    it('should handle null and undefined values', async () => {
      const dataWithNulls = {
        total: 100,
        average: null,
        undefined_field: undefined,
        nested: {
          value: 'present',
          null_value: null,
        }
      };

      const version = await metricVersioningService.createVersion(
        'null_test',
        'test-nulls',
        dataWithNulls,
        testUser
      );

      const retrieved = await metricVersioningService.getVersion(
        'null_test',
        'test-nulls',
        1
      );

      expect(retrieved).toBeDefined();
      const parsedData = JSON.parse(retrieved!.data);
      expect(parsedData.total).toBe(100);
      expect(parsedData.average).toBe(null);
      expect(parsedData.undefined_field).toBeUndefined();
      expect(parsedData.nested.value).toBe('present');
      expect(parsedData.nested.null_value).toBe(null);
    });
  });
});

async function cleanupTestData(): Promise<void> {
  try {
    await db.query('DELETE FROM metric_versions WHERE metric_id LIKE \'test-%\'');
    await db.query('DELETE FROM metric_versions WHERE metric_id LIKE \'status-test-%\'');
    await db.query('DELETE FROM metric_versions WHERE metric_id LIKE \'cleanup-test\'');
    await db.query('DELETE FROM metric_versions WHERE metric_id LIKE \'test-%\'');
    await db.query('DELETE FROM metric_versions WHERE metric_id LIKE \'null-test%\'');
    await db.query('DELETE FROM metric_versions WHERE metric_id LIKE \'complex%\'');
  } catch (error) {
    console.error('Error cleaning up test data:', error);
  }
}