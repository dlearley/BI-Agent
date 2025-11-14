import { db } from '../config/database';
import { MetricVersion, User } from '../types';
import { v4 as uuidv4 } from 'uuid';
import config from '../config';

export class MetricVersioningService {
  private readonly versionTable = 'metric_versions';

  async createVersion(
    metricType: string,
    metricId: string,
    data: any,
    user: User,
    changeDescription?: string,
    complianceFramework?: 'hipaa' | 'gdpr' | 'soc2'
  ): Promise<MetricVersion> {
    if (!config.governance.metricVersioning.enabled) {
      throw new Error('Metric versioning is disabled');
    }

    // Get the latest version number for this metric
    const latestVersion = await this.getLatestVersion(metricType, metricId);
    const newVersionNumber = latestVersion ? latestVersion.version + 1 : 1;

    const version: MetricVersion = {
      id: uuidv4(),
      metricType,
      metricId,
      version: newVersionNumber,
      data: JSON.stringify(data),
      timestamp: new Date(),
      createdBy: user.id,
      changeDescription,
      complianceFramework,
    };

    // Insert the new version
    await db.query(`
      INSERT INTO ${this.versionTable} (
        id, metric_type, metric_id, version, data, timestamp, 
        created_by, change_description, compliance_framework
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      version.id,
      version.metricType,
      version.metricId,
      version.version,
      version.data,
      version.timestamp,
      version.createdBy,
      version.changeDescription,
      version.complianceFramework,
    ]);

    // Clean up old versions if retention limit is exceeded
    await this.cleanupOldVersions(metricType, metricId);

    return version;
  }

  async getVersionHistory(
    metricType: string,
    metricId: string,
    limit?: number
  ): Promise<MetricVersion[]> {
    const limitClause = limit ? `LIMIT ${limit}` : '';
    
    const rows = await db.query(`
      SELECT * FROM ${this.versionTable}
      WHERE metric_type = $1 AND metric_id = $2
      ORDER BY version DESC
      ${limitClause}
    `, [metricType, metricId]);

    return rows.map(row => ({
      ...row,
      data: JSON.parse(row.data),
    }));
  }

  async getVersion(
    metricType: string,
    metricId: string,
    version: number
  ): Promise<MetricVersion | null> {
    const row = await db.queryOne(`
      SELECT * FROM ${this.versionTable}
      WHERE metric_type = $1 AND metric_id = $2 AND version = $3
    `, [metricType, metricId, version]);

    if (!row) {
      return null;
    }

    return {
      ...row,
      data: JSON.parse(row.data),
    };
  }

  async getLatestVersion(
    metricType: string,
    metricId: string
  ): Promise<MetricVersion | null> {
    const row = await db.queryOne(`
      SELECT * FROM ${this.versionTable}
      WHERE metric_type = $1 AND metric_id = $2
      ORDER BY version DESC
      LIMIT 1
    `, [metricType, metricId]);

    if (!row) {
      return null;
    }

    return {
      ...row,
      data: JSON.parse(row.data),
    };
  }

  async compareVersions(
    metricType: string,
    metricId: string,
    version1: number,
    version2: number
  ): Promise<{ version1: MetricVersion; version2: MetricVersion; differences: any }> {
    const [v1, v2] = await Promise.all([
      this.getVersion(metricType, metricId, version1),
      this.getVersion(metricType, metricId, version2),
    ]);

    if (!v1 || !v2) {
      throw new Error('One or both versions not found');
    }

    const differences = this.calculateDifferences(v1.data, v2.data);

    return {
      version1: v1,
      version2: v2,
      differences,
    };
  }

  async restoreVersion(
    metricType: string,
    metricId: string,
    version: number,
    user: User
  ): Promise<MetricVersion> {
    const versionToRestore = await this.getVersion(metricType, metricId, version);
    
    if (!versionToRestore) {
      throw new Error(`Version ${version} not found for metric ${metricType}:${metricId}`);
    }

    // Create a new version with the restored data
    return this.createVersion(
      metricType,
      metricId,
      versionToRestore.data,
      user,
      `Restored from version ${version}`,
      versionToRestore.complianceFramework
    );
  }

  async deleteVersionsOlderThan(date: Date): Promise<number> {
    const result = await db.query(`
      DELETE FROM ${this.versionTable}
      WHERE timestamp < $1
      RETURNING id
    `, [date]);

    return result.length;
  }

  async getMetricsByVersioningStatus(): Promise<any[]> {
    const rows = await db.query(`
      SELECT 
        metric_type,
        metric_id,
        COUNT(*) as version_count,
        MAX(version) as latest_version,
        MIN(timestamp) as first_version,
        MAX(timestamp) as last_version
      FROM ${this.versionTable}
      GROUP BY metric_type, metric_id
      ORDER BY metric_type, metric_id
    `);

    return rows;
  }

  private async cleanupOldVersions(metricType: string, metricId: string): Promise<void> {
    const retentionLimit = config.governance.metricVersioning.retention;
    
    // Get versions that should be kept
    const versionsToKeep = await db.query(`
      SELECT id FROM ${this.versionTable}
      WHERE metric_type = $1 AND metric_id = $2
      ORDER BY version DESC
      LIMIT $3
    `, [metricType, metricId, retentionLimit]);

    const keepIds = versionsToKeep.map(v => v.id);
    
    if (keepIds.length === 0) {
      return;
    }

    // Delete versions that exceed the retention limit
    await db.query(`
      DELETE FROM ${this.versionTable}
      WHERE metric_type = $1 AND metric_id = $2 AND id NOT IN (${keepIds.map((_, i) => `$${i + 3}`).join(',')})
    `, [metricType, metricId, ...keepIds]);
  }

  private calculateDifferences(data1: any, data2: any): any {
    const differences: any = {
      added: {},
      removed: {},
      modified: {},
    };

    // Simple diff implementation - can be enhanced with more sophisticated algorithms
    const keys1 = Object.keys(data1 || {});
    const keys2 = Object.keys(data2 || {});

    // Find added keys
    for (const key of keys2) {
      if (!keys1.includes(key)) {
        differences.added[key] = data2[key];
      }
    }

    // Find removed keys
    for (const key of keys1) {
      if (!keys2.includes(key)) {
        differences.removed[key] = data1[key];
      }
    }

    // Find modified keys
    for (const key of keys1) {
      if (keys2.includes(key) && JSON.stringify(data1[key]) !== JSON.stringify(data2[key])) {
        differences.modified[key] = {
          old: data1[key],
          new: data2[key],
        };
      }
    }

    return differences;
  }

  // Initialize the versioning table if it doesn't exist
  async initializeTable(): Promise<void> {
    await db.query(`
      CREATE TABLE IF NOT EXISTS ${this.versionTable} (
        id UUID PRIMARY KEY,
        metric_type VARCHAR(100) NOT NULL,
        metric_id VARCHAR(100) NOT NULL,
        version INTEGER NOT NULL,
        data JSONB NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
        created_by VARCHAR(100) NOT NULL,
        change_description TEXT,
        compliance_framework VARCHAR(20),
        UNIQUE(metric_type, metric_id, version)
      )
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_metric_versions_lookup 
      ON ${this.versionTable} (metric_type, metric_id)
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_metric_versions_timestamp 
      ON ${this.versionTable} (timestamp)
    `);
  }
}

export const metricVersioningService = new MetricVersioningService();