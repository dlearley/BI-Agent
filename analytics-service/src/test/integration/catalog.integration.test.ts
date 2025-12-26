import request from 'supertest';
import app from '../../server';
import { db } from '../../config/database';
import { mockAdminUser } from '../setup';

jest.mock('../../config/database');
jest.mock('../../services/queue.service', () => ({
  queueService: {
    enqueueCatalogDiscovery: jest.fn().mockResolvedValue({
      id: 'job-1',
    }),
    enqueueCatalogProfile: jest.fn().mockResolvedValue({
      id: 'job-2',
    }),
  },
}));

describe('Catalog API Integration Tests', () => {
  const organizationId = 'test-org-1';
  const authToken = 'test-token';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/v1/catalog/schemas', () => {
    it('should return list of schemas', async () => {
      const mockDatasets = [
        {
          id: 'dataset-1',
          name: 'customers',
          schema_name: 'public',
          table_name: 'customers',
          row_count: 1000,
          freshness_sla_hours: 24,
          last_profiled_at: new Date(),
          created_at: new Date(),
          columns: [
            { id: 'col-1', column_name: 'id', column_type: 'uuid' },
            { id: 'col-2', column_name: 'email', column_type: 'varchar' },
          ],
        },
      ];

      (db.queryOne as jest.Mock).mockResolvedValueOnce({ count: 1 });
      (db.query as jest.Mock).mockResolvedValueOnce(mockDatasets);

      const response = await request(app)
        .get('/api/v1/catalog/schemas')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', organizationId)
        .expect(200);

      expect(response.body).toHaveProperty('schemas');
      expect(response.body.schemas).toHaveLength(1);
      expect(response.body.schemas[0].name).toBe('customers');
    });

    it('should support pagination', async () => {
      (db.queryOne as jest.Mock).mockResolvedValueOnce({ count: 50 });
      (db.query as jest.Mock).mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/v1/catalog/schemas?limit=10&offset=0')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', organizationId)
        .expect(200);

      expect(response.body.pagination.limit).toBe(10);
      expect(response.body.pagination.offset).toBe(0);
      expect(response.body.pagination.total).toBe(50);
    });
  });

  describe('GET /api/v1/catalog/schemas/:datasetId', () => {
    it('should return schema detail with freshness and PII flags', async () => {
      const datasetId = 'dataset-1';
      const mockDataset = {
        id: datasetId,
        organization_id: organizationId,
        name: 'customers',
        schema_name: 'public',
        table_name: 'customers',
        row_count: 1000,
        freshness_sla_hours: 24,
        last_profiled_at: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
        created_at: new Date(),
        updated_at: new Date(),
        columns: [
          {
            id: 'col-1',
            column_name: 'id',
            column_type: 'uuid',
            is_nullable: false,
            is_pii: false,
            stats_json: { null_count: 0, distinct_count: 1000, data_type: 'uuid' },
          },
          {
            id: 'col-2',
            column_name: 'email',
            column_type: 'varchar',
            is_nullable: false,
            is_pii: true,
            pii_type: 'email',
            pii_confidence: 0.95,
            stats_json: { null_count: 0, distinct_count: 1000, data_type: 'varchar' },
          },
        ],
      };

      (db.queryOne as jest.Mock)
        .mockResolvedValueOnce(mockDataset)
        .mockResolvedValueOnce(mockDataset);

      (db.query as jest.Mock).mockResolvedValueOnce(mockDataset.columns);

      const response = await request(app)
        .get(`/api/v1/catalog/schemas/${datasetId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', organizationId)
        .expect(200);

      expect(response.body).toHaveProperty('id', datasetId);
      expect(response.body).toHaveProperty('freshness');
      expect(response.body.freshness.is_fresh).toBe(true);
      expect(response.body.freshness.age_hours).toBeLessThan(6);
      expect(response.body.columns).toHaveLength(2);
      expect(response.body.columns[1].is_pii).toBe(true);
      expect(response.body.columns[1].pii_type).toBe('email');
    });

    it('should return 404 for non-existent dataset', async () => {
      (db.queryOne as jest.Mock).mockResolvedValueOnce(null);

      const response = await request(app)
        .get('/api/v1/catalog/schemas/non-existent')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', organizationId)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/v1/catalog/columns', () => {
    it('should return all columns', async () => {
      const mockColumns = [
        {
          id: 'col-1',
          dataset_id: 'dataset-1',
          column_name: 'email',
          column_type: 'varchar',
          is_nullable: false,
          is_pii: true,
          pii_type: 'email',
          pii_confidence: 0.95,
          stats_json: { null_count: 0, distinct_count: 1000 },
        },
      ];

      (db.query as jest.Mock).mockResolvedValueOnce(mockColumns);

      const response = await request(app)
        .get('/api/v1/catalog/columns')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', organizationId)
        .expect(200);

      expect(response.body.columns).toHaveLength(1);
      expect(response.body.columns[0].is_pii).toBe(true);
    });

    it('should filter columns by is_pii flag', async () => {
      const mockColumns = [
        {
          id: 'col-1',
          dataset_id: 'dataset-1',
          column_name: 'email',
          column_type: 'varchar',
          is_nullable: false,
          is_pii: true,
          pii_type: 'email',
        },
      ];

      (db.query as jest.Mock).mockResolvedValueOnce(mockColumns);

      const response = await request(app)
        .get('/api/v1/catalog/columns?is_pii=true')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', organizationId)
        .expect(200);

      expect(response.body.columns).toHaveLength(1);
      expect(response.body.columns[0].is_pii).toBe(true);
    });

    it('should filter columns by pii_type', async () => {
      const mockColumns = [
        {
          id: 'col-1',
          dataset_id: 'dataset-1',
          column_name: 'ssn',
          column_type: 'varchar',
          is_nullable: false,
          is_pii: true,
          pii_type: 'ssn',
        },
      ];

      (db.query as jest.Mock).mockResolvedValueOnce(mockColumns);

      const response = await request(app)
        .get('/api/v1/catalog/columns?pii_type=ssn')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', organizationId)
        .expect(200);

      expect(response.body.columns).toHaveLength(1);
      expect(response.body.columns[0].pii_type).toBe('ssn');
    });
  });

  describe('GET /api/v1/catalog/freshness', () => {
    it('should return freshness info for all datasets', async () => {
      const mockDatasets = [
        {
          id: 'dataset-1',
          table_name: 'customers',
          freshness_sla_hours: 24,
          last_profiled_at: new Date(Date.now() - 10 * 60 * 60 * 1000),
          created_at: new Date(),
        },
        {
          id: 'dataset-2',
          table_name: 'orders',
          freshness_sla_hours: 6,
          last_profiled_at: new Date(Date.now() - 8 * 60 * 60 * 1000),
          created_at: new Date(),
        },
      ];

      (db.query as jest.Mock).mockResolvedValueOnce(mockDatasets);

      const response = await request(app)
        .get('/api/v1/catalog/freshness')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', organizationId)
        .expect(200);

      expect(response.body.freshness).toHaveLength(2);
      expect(response.body.freshness[0].is_fresh).toBe(true);
      expect(response.body.freshness[1].is_fresh).toBe(false);
    });
  });

  describe('POST /api/v1/catalog/discovery', () => {
    it('should initiate schema discovery', async () => {
      const response = await request(app)
        .post('/api/v1/catalog/discovery')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', organizationId)
        .set('Content-Type', 'application/json')
        .send({
          connector_id: 'connector-1',
        })
        .expect(200);

      expect(response.body).toHaveProperty('job_id');
      expect(response.body.status).toBe('queued');
    });

    it('should return 400 when connector_id is missing', async () => {
      const response = await request(app)
        .post('/api/v1/catalog/discovery')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', organizationId)
        .set('Content-Type', 'application/json')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/v1/catalog/profile', () => {
    it('should request profiling for datasets', async () => {
      const response = await request(app)
        .post('/api/v1/catalog/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', organizationId)
        .set('Content-Type', 'application/json')
        .send({
          dataset_ids: ['dataset-1', 'dataset-2'],
          include_pii_detection: true,
        })
        .expect(200);

      expect(response.body).toHaveProperty('job_id');
      expect(response.body.status).toBe('queued');
      expect(response.body.datasets_count).toBe(2);
    });

    it('should return 400 when dataset_ids is empty', async () => {
      const response = await request(app)
        .post('/api/v1/catalog/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', organizationId)
        .set('Content-Type', 'application/json')
        .send({
          dataset_ids: [],
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/v1/catalog/lineage/:columnId', () => {
    it('should return lineage info for a column', async () => {
      const columnId = 'col-1';
      const mockUpstream = [
        {
          id: 'lineage-1',
          source_column_id: 'col-0',
          source_table: 'raw_customers',
          target_table: 'customers',
        },
      ];

      const mockDownstream = [
        {
          id: 'lineage-2',
          target_column_id: 'col-2',
          source_table: 'customers',
          target_table: 'customer_summary',
        },
      ];

      (db.query as jest.Mock)
        .mockResolvedValueOnce(mockUpstream)
        .mockResolvedValueOnce(mockDownstream);

      const response = await request(app)
        .get(`/api/v1/catalog/lineage/${columnId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-organization-id', organizationId)
        .expect(200);

      expect(response.body.column_id).toBe(columnId);
      expect(response.body.upstream).toHaveLength(1);
      expect(response.body.downstream).toHaveLength(1);
    });
  });
});
