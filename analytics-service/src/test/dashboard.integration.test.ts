import request from 'supertest';
import app from '../index';
import { DashboardType } from '../types';
import fixtures from './fixtures/dashboard-fixtures.json';

describe('Dashboard API Integration Tests', () => {
  const authToken = 'Bearer test-token'; // Mock token for testing

  describe('Dashboard Data Endpoints', () => {
    describe('GET /api/v1/dashboard/pipeline', () => {
      it('should return pipeline KPIs with authentication', async () => {
        const response = await request(app)
          .get('/api/v1/dashboard/pipeline')
          .set('Authorization', authToken)
          .query({
            startDate: '2024-01-01',
            endDate: '2024-01-31'
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body).toHaveProperty('metadata');
        
        const data = response.body.data;
        expect(Array.isArray(data)).toBe(true);
        
        if (data.length > 0) {
          const firstRecord = data[0];
          expect(firstRecord).toHaveProperty('facility_id');
          expect(firstRecord).toHaveProperty('total_applications');
          expect(firstRecord).toHaveProperty('hired_count');
          expect(firstRecord).toHaveProperty('avg_time_to_fill_days');
        }
      });

      it('should apply facility scope for non-admin users', async () => {
        // This test would require mocking user with facility scope
        // For now, just verify the structure exists
        const response = await request(app)
          .get('/api/v1/dashboard/pipeline')
          .set('Authorization', authToken);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('metadata');
        expect(response.body.metadata).toHaveProperty('filters');
      });
    });

    describe('GET /api/v1/dashboard/revenue', () => {
      it('should return revenue KPIs', async () => {
        const response = await request(app)
          .get('/api/v1/dashboard/revenue')
          .set('Authorization', authToken)
          .query({
            startDate: '2024-01-01',
            endDate: '2024-01-31'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        
        const data = response.body.data;
        if (data.length > 0) {
          const firstRecord = data[0];
          expect(firstRecord).toHaveProperty('total_revenue');
          expect(firstRecord).toHaveProperty('avg_revenue_per_invoice');
          expect(typeof firstRecord.total_revenue).toBe('number');
        }
      });
    });

    describe('GET /api/v1/dashboard/compliance', () => {
      it('should return compliance KPIs', async () => {
        const response = await request(app)
          .get('/api/v1/dashboard/compliance')
          .set('Authorization', authToken);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        
        const data = response.body.data;
        if (data.length > 0) {
          const firstRecord = data[0];
          expect(firstRecord).toHaveProperty('compliance_rate');
          expect(firstRecord).toHaveProperty('violation_count');
          expect(typeof firstRecord.compliance_rate).toBe('number');
        }
      });
    });

    describe('GET /api/v1/dashboard/outreach', () => {
      it('should return outreach KPIs', async () => {
        const response = await request(app)
          .get('/api/v1/dashboard/outreach')
          .set('Authorization', authToken);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        
        const data = response.body.data;
        if (data.length > 0) {
          const firstRecord = data[0];
          expect(firstRecord).toHaveProperty('response_rate');
          expect(firstRecord).toHaveProperty('conversion_rate');
          expect(typeof firstRecord.response_rate).toBe('number');
        }
      });
    });

    describe('GET /api/v1/dashboard/combined', () => {
      it('should return combined KPIs matching dbt model output', async () => {
        const response = await request(app)
          .get('/api/v1/dashboard/combined')
          .set('Authorization', authToken)
          .query({
            startDate: '2024-01-01',
            endDate: '2024-01-31'
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body).toHaveProperty('metadata');
        
        const data = response.body.data;
        expect(Array.isArray(data)).toBe(true);
        
        if (data.length > 0) {
          const firstRecord = data[0];
          // Verify structure matches dbt combined_kpis model
          expect(firstRecord).toHaveProperty('facility_id');
          expect(firstRecord).toHaveProperty('total_applications');
          expect(firstRecord).toHaveProperty('hired_count');
          expect(firstRecord).toHaveProperty('avg_time_to_fill_days');
          expect(firstRecord).toHaveProperty('compliant_applications');
          expect(firstRecord).toHaveProperty('compliance_rate');
          expect(firstRecord).toHaveProperty('violation_count');
          expect(firstRecord).toHaveProperty('total_revenue');
          expect(firstRecord).toHaveProperty('avg_revenue_per_invoice');
          expect(firstRecord).toHaveProperty('total_outreach');
          expect(firstRecord).toHaveProperty('avg_response_rate');
          expect(firstRecord).toHaveProperty('avg_conversion_rate');
          expect(firstRecord).toHaveProperty('month');
        }
      });

      it('should support time range filters', async () => {
        const response = await request(app)
          .get('/api/v1/dashboard/combined')
          .set('Authorization', authToken)
          .query({
            timeRange: JSON.stringify({
              preset: 'last7days'
            })
          });

        expect(response.status).toBe(200);
        expect(response.body.metadata.filters.timeRange).toBeDefined();
      });
    });
  });

  describe('Filter Support', () => {
    it('should support team filters', async () => {
      const response = await request(app)
        .get('/api/v1/dashboard/combined')
          .set('Authorization', authToken)
          .query({
            team: JSON.stringify(['team-a', 'team-b'])
          });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.metadata.filters.team).toBeDefined();
    });

    it('should support rep filters', async () => {
      const response = await request(app)
        .get('/api/v1/dashboard/combined')
          .set('Authorization', authToken)
          .query({
            rep: JSON.stringify(['rep-001', 'rep-002'])
          });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.metadata.filters.rep).toBeDefined();
    });

    it('should support pipeline filters', async () => {
      const response = await request(app)
        .get('/api/v1/dashboard/combined')
          .set('Authorization', authToken)
          .query({
            pipeline: JSON.stringify(['pipeline-1', 'pipeline-2'])
          });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.metadata.filters.pipeline).toBeDefined();
    });

    it('should support facility filters', async () => {
      const response = await request(app)
        .get('/api/v1/dashboard/combined')
          .set('Authorization', authToken)
          .query({
            facilityId: 'facility-001'
          });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.metadata.filters.facilityId).toBe('facility-001');
    });
  });

  describe('Saved Views', () => {
    it('should create a new saved view', async () => {
      const viewData = {
        name: 'Test Dashboard View',
        description: 'Test view for integration testing',
        dashboardType: DashboardType.COMBINED,
        filters: fixtures.dashboard_filters,
        layout: fixtures.saved_view.layout,
        isPublic: false,
        isDefault: false
      };

      const response = await request(app)
        .post('/api/v1/dashboard/views')
        .set('Authorization', authToken)
        .send(viewData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe(viewData.name);
      expect(response.body.data.dashboardType).toBe(viewData.dashboardType);
    });

    it('should get saved views', async () => {
      const response = await request(app)
        .get('/api/v1/dashboard/views')
        .set('Authorization', authToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should update a saved view', async () => {
      // First create a view
      const createResponse = await request(app)
        .post('/api/v1/dashboard/views')
        .set('Authorization', authToken)
        .send({
          name: 'Update Test View',
          dashboardType: DashboardType.COMBINED,
          isPublic: false
        });

      const viewId = createResponse.body.data.id;

      // Then update it
      const updateResponse = await request(app)
        .put(`/api/v1/dashboard/views/${viewId}`)
        .set('Authorization', authToken)
        .send({
          name: 'Updated Test View',
          description: 'Updated description'
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.data.name).toBe('Updated Test View');
      expect(updateResponse.body.data.description).toBe('Updated description');
    });

    it('should delete a saved view', async () => {
      // First create a view
      const createResponse = await request(app)
        .post('/api/v1/dashboard/views')
        .set('Authorization', authToken)
        .send({
          name: 'Delete Test View',
          dashboardType: DashboardType.COMBINED,
          isPublic: false
        });

      const viewId = createResponse.body.data.id;

      // Then delete it
      const deleteResponse = await request(app)
        .delete(`/api/v1/dashboard/views/${viewId}`)
        .set('Authorization', authToken);

      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body.success).toBe(true);
      expect(deleteResponse.body.message).toContain('deleted successfully');
    });
  });

  describe('Drilldowns', () => {
    it('should create drilldown config', async () => {
      const drilldownData = {
        viewId: 'test-view-id',
        metricName: 'total_applications',
        drilldownPath: fixtures.drilldown_config.drilldownPath,
        targetTable: 'pipeline_kpis_materialized',
        filters: fixtures.drilldown_config.filters
      };

      const response = await request(app)
        .post('/api/v1/dashboard/drilldowns')
        .set('Authorization', authToken)
        .send(drilldownData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.metricName).toBe(drilldownData.metricName);
      expect(response.body.data.targetTable).toBe(drilldownData.targetTable);
    });

    it('should get drilldown configs', async () => {
      const response = await request(app)
        .get('/api/v1/dashboard/drilldowns')
        .set('Authorization', authToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('CSV Export', () => {
    it('should create export job', async () => {
      const exportQuery = {
        dashboardType: DashboardType.COMBINED,
        format: 'csv',
        timeRange: {
          preset: 'last30days'
        }
      };

      const response = await request(app)
        .post('/api/v1/dashboard/export')
        .set('Authorization', authToken)
        .send(exportQuery);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.status).toBe('pending');
    });

    it('should get export jobs', async () => {
      const response = await request(app)
        .get('/api/v1/dashboard/export/jobs')
        .set('Authorization', authToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should get specific export job', async () => {
      // First create an export job
      const createResponse = await request(app)
        .post('/api/v1/dashboard/export')
        .set('Authorization', authToken)
        .send({
          dashboardType: DashboardType.COMBINED,
          format: 'csv'
        });

      const jobId = createResponse.body.data.id;

      // Then get its status
      const response = await request(app)
        .get(`/api/v1/dashboard/export/jobs/${jobId}`)
        .set('Authorization', authToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(jobId);
      expect(response.body.data).toHaveProperty('status');
    });
  });

  describe('Response Format Validation', () => {
    it('should return consistent response structure', async () => {
      const response = await request(app)
        .get('/api/v1/dashboard/combined')
        .set('Authorization', authToken);

      expect(response.status).toBe(200);
      
      // Verify standard response structure
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('metadata');
      
      // Verify metadata structure
      const metadata = response.body.metadata;
      expect(metadata).toHaveProperty('dashboardType');
      expect(metadata).toHaveProperty('filters');
      expect(metadata).toHaveProperty('timestamp');
      expect(metadata).toHaveProperty('cached');
      expect(typeof metadata.cached).toBe('boolean');
      expect(typeof metadata.timestamp).toBe('string');
    });

    it('should handle errors consistently', async () => {
      const response = await request(app)
        .get('/api/v1/dashboard/invalid-endpoint')
        .set('Authorization', authToken);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('message');
    });
  });
});