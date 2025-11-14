import { db } from '../../config/database';
import { SeedService } from '../../scripts/seed';

describe('Seed Service', () => {
  let seedService: SeedService;
  let organizationId: string;

  beforeAll(() => {
    seedService = new SeedService();
  });

  afterAll(async () => {
    // Cleanup: Remove seeded data
    if (organizationId) {
      await db.query('DELETE FROM organizations WHERE id = $1', [organizationId]);
    }
  });

  describe('seedOrganization', () => {
    it('should create a demo organization', async () => {
      organizationId = await seedService.seedOrganization();

      expect(organizationId).toBeDefined();
      expect(typeof organizationId).toBe('string');

      const org = await db.queryOne<any>(
        'SELECT * FROM organizations WHERE id = $1',
        [organizationId]
      );

      expect(org).toBeDefined();
      expect(org?.name).toBe('Demo Ecommerce Inc.');
      expect(org?.slug).toBe('demo-ecommerce');
      expect(org?.type).toBe('ecommerce');
    });

    it('should handle duplicate organization gracefully', async () => {
      // Seed again - should not throw error
      const secondOrgId = await seedService.seedOrganization();
      expect(secondOrgId).toBeDefined();
    });
  });

  describe('seedConnectors', () => {
    beforeAll(async () => {
      if (!organizationId) {
        organizationId = await seedService.seedOrganization();
      }
    });

    it('should create data connectors', async () => {
      const count = await seedService.seedConnectors();

      expect(count).toBe(3);

      const connectors = await db.query(
        'SELECT * FROM data_connectors WHERE organization_id = $1',
        [organizationId]
      );

      expect(connectors.length).toBeGreaterThanOrEqual(3);
      
      const postgresConnector = connectors.find((c: any) => c.type === 'postgresql');
      expect(postgresConnector).toBeDefined();
      expect(postgresConnector.status).toBe('active');
    });
  });

  describe('seedSavedQueries', () => {
    beforeAll(async () => {
      if (!organizationId) {
        organizationId = await seedService.seedOrganization();
      }
    });

    it('should create 5 saved queries', async () => {
      const queryIds = await seedService.seedSavedQueries();

      expect(queryIds).toHaveLength(5);
      expect(queryIds.every(id => typeof id === 'string')).toBe(true);

      const queries = await db.query(
        'SELECT * FROM saved_queries WHERE organization_id = $1',
        [organizationId]
      );

      expect(queries.length).toBeGreaterThanOrEqual(5);
      
      // Verify query types
      const queryTypes = queries.map((q: any) => q.query_type);
      expect(queryTypes).toContain('kpi');
      expect(queryTypes).toContain('metric');
      expect(queryTypes).toContain('custom');
    });

    it('should create queries with valid SQL', async () => {
      const queries = await db.query(
        'SELECT * FROM saved_queries WHERE organization_id = $1',
        [organizationId]
      );

      for (const query of queries) {
        expect(query.query_text).toBeTruthy();
        expect(query.query_text.length).toBeGreaterThan(10);
      }
    });
  });

  describe('seedDashboards', () => {
    beforeAll(async () => {
      if (!organizationId) {
        organizationId = await seedService.seedOrganization();
      }
    });

    it('should create 3 dashboards', async () => {
      const dashboardIds = await seedService.seedDashboards();

      expect(dashboardIds).toHaveLength(3);

      const dashboards = await db.query(
        'SELECT * FROM dashboards WHERE organization_id = $1',
        [organizationId]
      );

      expect(dashboards.length).toBeGreaterThanOrEqual(3);
    });

    it('should create marketing, sales, and finance dashboards', async () => {
      const dashboards = await db.query(
        'SELECT * FROM dashboards WHERE organization_id = $1',
        [organizationId]
      );

      const types = dashboards.map((d: any) => d.type);
      expect(types).toContain('marketing');
      expect(types).toContain('sales');
      expect(types).toContain('finance');
    });

    it('should mark dashboards as templates', async () => {
      const dashboards = await db.query(
        'SELECT * FROM dashboards WHERE organization_id = $1',
        [organizationId]
      );

      const allTemplates = dashboards.every((d: any) => d.is_template === true);
      expect(allTemplates).toBe(true);
    });

    it('should have valid layout configuration', async () => {
      const dashboards = await db.query(
        'SELECT * FROM dashboards WHERE organization_id = $1',
        [organizationId]
      );

      for (const dashboard of dashboards) {
        expect(Array.isArray(dashboard.layout)).toBe(true);
        expect(dashboard.layout.length).toBeGreaterThan(0);
        
        // Check first widget structure
        const widget = dashboard.layout[0];
        expect(widget).toHaveProperty('id');
        expect(widget).toHaveProperty('type');
        expect(widget).toHaveProperty('title');
      }
    });
  });

  describe('seedAlerts', () => {
    beforeAll(async () => {
      if (!organizationId) {
        organizationId = await seedService.seedOrganization();
      }
    });

    it('should create 2 alerts', async () => {
      const queryIds = await seedService.seedSavedQueries();
      const alertIds = await seedService.seedAlerts(queryIds);

      expect(alertIds).toHaveLength(2);

      const alerts = await db.query(
        'SELECT * FROM alerts WHERE organization_id = $1',
        [organizationId]
      );

      expect(alerts.length).toBeGreaterThanOrEqual(2);
    });

    it('should create alerts with valid schedules', async () => {
      const alerts = await db.query(
        'SELECT * FROM alerts WHERE organization_id = $1',
        [organizationId]
      );

      for (const alert of alerts) {
        expect(alert.schedule_cron).toBeTruthy();
        expect(alert.is_active).toBe(true);
        
        // Validate cron pattern format
        const cronParts = alert.schedule_cron.split(' ');
        expect(cronParts.length).toBeGreaterThanOrEqual(5);
      }
    });

    it('should have notification channels configured', async () => {
      const alerts = await db.query(
        'SELECT * FROM alerts WHERE organization_id = $1',
        [organizationId]
      );

      for (const alert of alerts) {
        expect(Array.isArray(alert.notification_channels)).toBe(true);
        expect(alert.notification_channels.length).toBeGreaterThan(0);
      }
    });
  });

  describe('seedReportTemplates', () => {
    beforeAll(async () => {
      if (!organizationId) {
        organizationId = await seedService.seedOrganization();
      }
    });

    it('should create 1 weekly report template', async () => {
      const templateIds = await seedService.seedReportTemplates();

      expect(templateIds).toHaveLength(1);

      const templates = await db.query(
        'SELECT * FROM report_templates WHERE organization_id = $1',
        [organizationId]
      );

      expect(templates.length).toBeGreaterThanOrEqual(1);
    });

    it('should create weekly report with correct configuration', async () => {
      const templates = await db.query(
        'SELECT * FROM report_templates WHERE organization_id = $1',
        [organizationId]
      );

      const weeklyReport = templates.find((t: any) => t.report_type === 'weekly');
      expect(weeklyReport).toBeDefined();
      expect(weeklyReport.is_active).toBe(true);
      expect(weeklyReport.schedule_cron).toBeTruthy();
      expect(Array.isArray(weeklyReport.sections)).toBe(true);
      expect(weeklyReport.sections.length).toBeGreaterThan(0);
    });

    it('should have recipients configured', async () => {
      const templates = await db.query(
        'SELECT * FROM report_templates WHERE organization_id = $1',
        [organizationId]
      );

      for (const template of templates) {
        expect(Array.isArray(template.recipients)).toBe(true);
        expect(template.recipients.length).toBeGreaterThan(0);
      }
    });
  });

  describe('seedCelerySchedules', () => {
    beforeAll(async () => {
      if (!organizationId) {
        organizationId = await seedService.seedOrganization();
      }
      const queryIds = await seedService.seedSavedQueries();
      await seedService.seedAlerts(queryIds);
      await seedService.seedReportTemplates();
    });

    it('should seed schedules for alerts, reports, and analytics refresh', async () => {
      const count = await seedService.seedCelerySchedules();

      expect(count).toBeGreaterThanOrEqual(3);

      const schedules = await db.query(
        'SELECT * FROM celery_schedules WHERE organization_id = $1',
        [organizationId]
      );

      expect(schedules.length).toBeGreaterThanOrEqual(3);

      const taskTypes = schedules.map((s: any) => s.task_type);
      expect(taskTypes).toContain('alert');
      expect(taskTypes).toContain('report');
      expect(taskTypes).toContain('analytics');
    });

    it('should create schedules with valid cron patterns', async () => {
      const schedules = await db.query(
        'SELECT * FROM celery_schedules WHERE organization_id = $1',
        [organizationId]
      );

      for (const schedule of schedules) {
        expect(schedule.schedule_cron).toBeTruthy();
        const parts = schedule.schedule_cron.split(' ');
        expect(parts.length).toBeGreaterThanOrEqual(5);
      }
    });

    it('should persist schedule payloads for alerts and reports', async () => {
      const schedules = await db.query(
        'SELECT * FROM celery_schedules WHERE organization_id = $1',
        [organizationId]
      );

      const alertSchedule = schedules.find((s: any) => s.task_type === 'alert');
      const reportSchedule = schedules.find((s: any) => s.task_type === 'report');

      expect(alertSchedule).toBeDefined();
      expect(alertSchedule.payload).toBeTruthy();
      expect(reportSchedule).toBeDefined();
      expect(reportSchedule.payload).toBeTruthy();
    });
  });

  describe('seedEcommerceData', () => {
    beforeAll(async () => {
      if (!organizationId) {
        organizationId = await seedService.seedOrganization();
      }
    });

    it('should create customers', async () => {
      await seedService.seedEcommerceData();

      const customers = await db.query(
        'SELECT * FROM customers WHERE organization_id = $1',
        [organizationId]
      );

      expect(customers.length).toBeGreaterThanOrEqual(10);
      
      const firstCustomer = customers[0];
      expect(firstCustomer.email).toBeTruthy();
      expect(firstCustomer.first_name).toBeTruthy();
      expect(firstCustomer.last_name).toBeTruthy();
    });

    it('should create products with categories', async () => {
      const products = await db.query(
        'SELECT * FROM products WHERE organization_id = $1',
        [organizationId]
      );

      expect(products.length).toBeGreaterThanOrEqual(15);
      
      const categories = [...new Set(products.map((p: any) => p.category))];
      expect(categories.length).toBeGreaterThan(1);
      
      for (const product of products) {
        expect(product.name).toBeTruthy();
        expect(product.sku).toBeTruthy();
        expect(product.price).toBeGreaterThan(0);
      }
    });

    it('should create orders with valid data', async () => {
      const orders = await db.query(
        'SELECT * FROM orders WHERE organization_id = $1',
        [organizationId]
      );

      expect(orders.length).toBeGreaterThanOrEqual(50);
      
      for (const order of orders) {
        expect(order.order_number).toBeTruthy();
        expect(order.total).toBeGreaterThan(0);
        expect(order.status).toBeTruthy();
        expect(['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'])
          .toContain(order.status);
      }
    });

    it('should create order items linked to orders and products', async () => {
      const orderItems = await db.query(
        'SELECT * FROM order_items'
      );

      expect(orderItems.length).toBeGreaterThan(0);
      
      for (const item of orderItems) {
        expect(item.order_id).toBeTruthy();
        expect(item.product_id).toBeTruthy();
        expect(item.quantity).toBeGreaterThan(0);
        expect(item.unit_price).toBeGreaterThan(0);
        expect(item.total_price).toBeGreaterThan(0);
      }
    });

    it('should have orders distributed over time', async () => {
      const orders = await db.query(
        'SELECT created_at FROM orders WHERE organization_id = $1 ORDER BY created_at',
        [organizationId]
      );

      const firstDate = new Date(orders[0].created_at);
      const lastDate = new Date(orders[orders.length - 1].created_at);
      
      const daysDiff = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBeGreaterThan(1); // Orders should span multiple days
    });
  });

  describe('verifySeedData', () => {
    beforeAll(async () => {
      if (!organizationId) {
        organizationId = await seedService.seedOrganization();
        await seedService.seedConnectors();
        const queryIds = await seedService.seedSavedQueries();
        await seedService.seedDashboards();
        await seedService.seedAlerts(queryIds);
        await seedService.seedReportTemplates();
        await seedService.seedEcommerceData();
        await seedService.seedCelerySchedules();
      }
    });

    it('should verify all seeded tables have data', async () => {
      const results = await seedService.verifySeedData();

      expect(results.length).toBe(11);
      
      const expectedTables = [
        'organizations',
        'data_connectors',
        'saved_queries',
        'dashboards',
        'alerts',
        'report_templates',
        'celery_schedules',
        'customers',
        'products',
        'orders',
        'order_items'
      ];

      for (const expectedTable of expectedTables) {
        const result = results.find(r => r.table === expectedTable);
        expect(result).toBeDefined();
        expect(result!.count).toBeGreaterThan(0);
      }
    });

    it('should have correct record counts', async () => {
      const results = await seedService.verifySeedData();
      
      const getCount = (table: string) => {
        return results.find(r => r.table === table)?.count || 0;
      };

      expect(getCount('organizations')).toBeGreaterThanOrEqual(1);
      expect(getCount('data_connectors')).toBeGreaterThanOrEqual(3);
      expect(getCount('saved_queries')).toBeGreaterThanOrEqual(5);
      expect(getCount('dashboards')).toBeGreaterThanOrEqual(3);
      expect(getCount('alerts')).toBeGreaterThanOrEqual(2);
      expect(getCount('report_templates')).toBeGreaterThanOrEqual(1);
      expect(getCount('customers')).toBeGreaterThanOrEqual(10);
      expect(getCount('products')).toBeGreaterThanOrEqual(15);
      expect(getCount('orders')).toBeGreaterThanOrEqual(50);
    });
  });

  describe('full seed process', () => {
    it('should complete full seed without errors', async () => {
      const newSeedService = new SeedService();
      
      await expect(newSeedService.seed()).resolves.not.toThrow();
    }, 30000); // 30 second timeout for full seed

    it('should create demo organization accessible via slug', async () => {
      const org = await db.queryOne(
        'SELECT * FROM organizations WHERE slug = $1',
        ['demo-ecommerce']
      );

      expect(org).toBeDefined();
      expect(org?.name).toBe('Demo Ecommerce Inc.');
      expect(org?.type).toBe('ecommerce');
    });
  });
});
