import { Request, Response } from 'express';
import { z } from 'zod';
import { datasourceService } from '../services/datasource.service';
import { AuthenticatedRequest } from '../middleware/auth';
import { DataSourceType } from '../types';

const postgresConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().positive(),
  database: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
  ssl: z.boolean().optional(),
  schema: z.string().optional(),
});

const csvConfigSchema = z.object({
  path: z.string().min(1),
  delimiter: z.string().optional(),
  hasHeader: z.boolean().optional(),
  encoding: z.string().optional(),
  dateFormat: z.string().optional(),
  s3: z
    .object({
      endpoint: z.string().optional(),
      accessKey: z.string().min(1),
      secretKey: z.string().min(1),
      bucket: z.string().min(1),
      region: z.string().optional(),
      useSSL: z.boolean().optional(),
    })
    .optional(),
});

const s3ParquetConfigSchema = z.object({
  bucket: z.string().min(1),
  prefix: z.string().optional(),
  endpoint: z.string().optional(),
  accessKey: z.string().min(1),
  secretKey: z.string().min(1),
  region: z.string().optional(),
  useSSL: z.boolean().optional(),
});

const createDataSourceSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['postgres', 'csv', 's3_parquet']),
  config: z
    .union([postgresConfigSchema, csvConfigSchema, s3ParquetConfigSchema])
    .optional(),
  facilityId: z.string().optional(),
});

export class DataSourceController {
  async createDataSource(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const payload = createDataSourceSchema.parse(req.body);

      const dataSource = await datasourceService.createDataSource(
        {
          name: payload.name,
          type: payload.type as DataSourceType,
          enabled: true,
          config: payload.config || {},
          facilityId: payload.facilityId,
          createdBy: user.id,
        },
        user
      );

      res.status(201).json({
        success: true,
        data: dataSource,
        message: 'Data source created successfully',
      });
    } catch (error) {
      console.error('Error creating data source:', error);
      res.status(400).json({
        success: false,
        error: 'Failed to create data source',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getDataSource(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const dataSource = await datasourceService.getDataSource(id);

      if (!dataSource) {
        res.status(404).json({
          success: false,
          error: 'Data source not found',
        });
        return;
      }

      res.json({
        success: true,
        data: dataSource,
      });
    } catch (error) {
      console.error('Error fetching data source:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch data source',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async listDataSources(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const facilityId = req.query.facilityId as string | undefined;

      const dataSources = await datasourceService.listDataSources(user, facilityId);

      res.json({
        success: true,
        data: dataSources,
        count: dataSources.length,
      });
    } catch (error) {
      console.error('Error listing data sources:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list data sources',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async updateDataSource(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const { id } = req.params;
      const payload = createDataSourceSchema.partial().parse(req.body);

      const dataSource = await datasourceService.updateDataSource(
        id,
        {
          name: payload.name,
          type: payload.type ? (payload.type as DataSourceType) : undefined,
          config: payload.config,
          facilityId: payload.facilityId,
        },
        user
      );

      res.json({
        success: true,
        data: dataSource,
        message: 'Data source updated successfully',
      });
    } catch (error) {
      console.error('Error updating data source:', error);
      res.status(400).json({
        success: false,
        error: 'Failed to update data source',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async deleteDataSource(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      await datasourceService.deleteDataSource(id);

      res.json({
        success: true,
        message: 'Data source deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting data source:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete data source',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async testConnection(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const dataSource = await datasourceService.getDataSource(id);

      if (!dataSource) {
        res.status(404).json({
          success: false,
          error: 'Data source not found',
        });
        return;
      }

      const result = await datasourceService.testConnection(dataSource);

      res.json({
        success: result.success,
        data: result,
      });
    } catch (error) {
      console.error('Error testing connection:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to test connection',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async discoverSchema(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const schema = await datasourceService.discoverSchema(id);

      res.json({
        success: true,
        data: schema,
        message: 'Schema discovered successfully',
      });
    } catch (error) {
      console.error('Error discovering schema:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to discover schema',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getSamples(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);

      const samples = await datasourceService.getSamples(id, limit);

      res.json({
        success: true,
        data: samples,
        count: samples.length,
      });
    } catch (error) {
      console.error('Error fetching samples:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch samples',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async profileColumns(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const sampleSize = Math.min(parseInt(req.query.sampleSize as string) || 1000, 10000);

      const profiles = await datasourceService.profileColumns(id, sampleSize);

      res.json({
        success: true,
        data: profiles,
        count: profiles.length,
      });
    } catch (error) {
      console.error('Error profiling columns:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to profile columns',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const datasourceController = new DataSourceController();
