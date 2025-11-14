import { Request, Response } from 'express';
import { catalogService } from '../services/catalog.service';
import { queueService } from '../services/queue.service';
import logger from '../utils/logger';
import { PIIType } from '../types';

export class CatalogController {
  async initiateDiscovery(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const organizationId = (req as any).organizationId;

      if (!organizationId) {
        res.status(400).json({ error: 'Organization ID is required' });
        return;
      }

      const { connector_id, schema_names, table_patterns } = req.body;

      if (!connector_id) {
        res.status(400).json({ error: 'Connector ID is required' });
        return;
      }

      const job = await queueService.enqueueCatalogDiscovery(organizationId, {
        connector_id,
        schema_names,
        table_patterns,
      });

      logger.info('Catalog discovery job enqueued', {
        organizationId,
        connectorId: connector_id,
        jobId: job.id,
      });

      res.json({
        message: 'Catalog discovery initiated',
        job_id: job.id,
        status: 'queued',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to initiate discovery', { error: message });
      res.status(500).json({ error: message });
    }
  }

  async getSchemas(req: Request, res: Response): Promise<void> {
    try {
      const organizationId = (req as any).organizationId;

      if (!organizationId) {
        res.status(400).json({ error: 'Organization ID is required' });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;

      const { datasets, total } = await catalogService.getDatasets(organizationId, limit, offset);

      const schemas = datasets.map(ds => ({
        id: ds.id,
        name: ds.name,
        schema: ds.schema_name,
        table_name: ds.table_name,
        row_count: ds.row_count,
        freshness_sla_hours: ds.freshness_sla_hours,
        last_profiled_at: ds.last_profiled_at,
        created_at: ds.created_at,
        column_count: ds.columns?.length || 0,
      }));

      res.json({
        schemas,
        pagination: {
          limit,
          offset,
          total,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get schemas', { error: message });
      res.status(500).json({ error: message });
    }
  }

  async getSchemaDetail(req: Request, res: Response): Promise<void> {
    try {
      const organizationId = (req as any).organizationId;
      const { datasetId } = req.params;

      if (!organizationId) {
        res.status(400).json({ error: 'Organization ID is required' });
        return;
      }

      if (!datasetId) {
        res.status(400).json({ error: 'Dataset ID is required' });
        return;
      }

      const dataset = await catalogService.getDataset(organizationId, datasetId);

      if (!dataset) {
        res.status(404).json({ error: 'Dataset not found' });
        return;
      }

      const freshness = await catalogService.computeFreshness(organizationId);
      const tableInfo = freshness.find(f => f.table_name === dataset.table_name);

      const response = {
        id: dataset.id,
        name: dataset.name,
        schema: dataset.schema_name,
        table_name: dataset.table_name,
        row_count: dataset.row_count,
        freshness_sla_hours: dataset.freshness_sla_hours,
        last_profiled_at: dataset.last_profiled_at,
        created_at: dataset.created_at,
        updated_at: dataset.updated_at,
        freshness: tableInfo ? {
          is_fresh: tableInfo.is_fresh,
          age_hours: tableInfo.age_hours,
          sla_hours: tableInfo.sla_hours,
          last_updated: tableInfo.last_updated,
        } : null,
        columns: dataset.columns?.map(col => ({
          id: col.id,
          name: col.column_name,
          type: col.column_type,
          nullable: col.is_nullable,
          is_pii: col.is_pii,
          pii_type: col.pii_type,
          pii_confidence: col.pii_confidence,
          stats: col.stats_json,
        })) || [],
      };

      res.json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get schema detail', { error: message });
      res.status(500).json({ error: message });
    }
  }

  async requestProfiling(req: Request, res: Response): Promise<void> {
    try {
      const organizationId = (req as any).organizationId;
      const { dataset_ids, include_pii_detection } = req.body;

      if (!organizationId) {
        res.status(400).json({ error: 'Organization ID is required' });
        return;
      }

      if (!dataset_ids || !Array.isArray(dataset_ids) || dataset_ids.length === 0) {
        res.status(400).json({ error: 'dataset_ids array is required' });
        return;
      }

      const job = await queueService.enqueueCatalogProfile(organizationId, {
        dataset_ids,
        include_pii_detection: include_pii_detection ?? true,
      });

      logger.info('Catalog profiling job enqueued', {
        organizationId,
        datasetsCount: dataset_ids.length,
        jobId: job.id,
      });

      res.json({
        message: 'Profiling job initiated',
        job_id: job.id,
        status: 'queued',
        datasets_count: dataset_ids.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to request profiling', { error: message });
      res.status(500).json({ error: message });
    }
  }

  async getColumns(req: Request, res: Response): Promise<void> {
    try {
      const organizationId = (req as any).organizationId;

      if (!organizationId) {
        res.status(400).json({ error: 'Organization ID is required' });
        return;
      }

      const filters: { is_pii?: boolean; pii_type?: PIIType } = {};
      if (req.query.is_pii !== undefined) {
        filters.is_pii = req.query.is_pii === 'true';
      }
      if (req.query.pii_type) {
        filters.pii_type = req.query.pii_type as PIIType;
      }

      const columns = await catalogService.getColumns(organizationId, filters);

      const response = columns.map(col => ({
        id: col.id,
        dataset_id: col.dataset_id,
        name: col.column_name,
        type: col.column_type,
        nullable: col.is_nullable,
        is_pii: col.is_pii,
        pii_type: col.pii_type,
        pii_confidence: col.pii_confidence,
        stats: col.stats_json,
      }));

      res.json({
        columns: response,
        total: response.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get columns', { error: message });
      res.status(500).json({ error: message });
    }
  }

  async getFreshness(req: Request, res: Response): Promise<void> {
    try {
      const organizationId = (req as any).organizationId;

      if (!organizationId) {
        res.status(400).json({ error: 'Organization ID is required' });
        return;
      }

      const freshness = await catalogService.computeFreshness(organizationId);

      const response = freshness.map(f => ({
        table_name: f.table_name,
        sla_hours: f.sla_hours,
        last_updated: f.last_updated,
        age_hours: f.age_hours,
        is_fresh: f.is_fresh,
      }));

      res.json({
        freshness: response,
        total: response.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to compute freshness', { error: message });
      res.status(500).json({ error: message });
    }
  }

  async getLineage(req: Request, res: Response): Promise<void> {
    try {
      const organizationId = (req as any).organizationId;
      const { columnId } = req.params;

      if (!organizationId) {
        res.status(400).json({ error: 'Organization ID is required' });
        return;
      }

      if (!columnId) {
        res.status(400).json({ error: 'Column ID is required' });
        return;
      }

      const lineage = await catalogService.getLineage(organizationId, columnId);

      res.json({
        column_id: columnId,
        upstream: lineage.upstream.map(l => ({
          id: l.id,
          source_column_id: l.source_column_id,
          source_table: l.source_table,
          target_table: l.target_table,
        })),
        downstream: lineage.downstream.map(l => ({
          id: l.id,
          target_column_id: l.target_column_id,
          source_table: l.source_table,
          target_table: l.target_table,
        })),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get lineage', { error: message });
      res.status(500).json({ error: message });
    }
  }
}

export const catalogController = new CatalogController();
