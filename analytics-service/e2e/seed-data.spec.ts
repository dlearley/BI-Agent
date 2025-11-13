import { test, expect } from '@playwright/test';
import { db } from '../src/config/database';

test.describe('Seed Data E2E Tests', () => {
  let organizationId: string;

  test.beforeAll(async () => {
    // Get the demo organization
    const org = await db.queryOne<{ id: string }>(
      'SELECT id FROM organizations WHERE slug = $1',
      ['demo-ecommerce']
    );
    
    if (org) {
      organizationId = org.id;
    }
  });

  test.describe('Demo Organization', () => {
    test('should have demo organization accessible', async () => {
      const org = await db.queryOne(
        'SELECT * FROM organizations WHERE slug = $1',
        ['demo-ecommerce']
      );

      expect(org).toBeTruthy();
      expect(org.name).toBe('Demo Ecommerce Inc.');
      expect(org.type).toBe('ecommerce');
    });
  });

  test.describe('Data Connectors', () => {
    test('should have active data connectors', async () => {
      const connectors = await db.query(
        'SELECT * FROM data_connectors WHERE organization_id = $1 AND status = $2',
        [organizationId, 'active']
      );

      expect(connectors.length).toBeGreaterThanOrEqual(3);
    });

    test('should have different connector types', async () => {
      const connectors = await db.query(
        'SELECT DISTINCT type FROM data_connectors WHERE organization_id = $1',
        [organizationId]
      );

      const types = connectors.map((c: any) => c.type);
      expect(types).toContain('postgresql');
    });
  });

  test.describe('Saved Queries', () => {
    test('should have at least 5 saved queries', async () => {
      const queries = await db.query(
        'SELECT * FROM saved_queries WHERE organization_id = $1',
        [organizationId]
      );

      expect(queries.length).toBeGreaterThanOrEqual(5);
    });

    test('should have revenue trend query', async () => {
      const query = await db.queryOne(
        'SELECT * FROM saved_queries WHERE organization_id = $1 AND name LIKE $2',
        [organizationId, '%Revenue%']
      );

      expect(query).toBeTruthy();
      expect(query.query_text).toContain('SELECT');
    });
  });

  test.describe('Dashboards', () => {
    test('should have 3 dashboard templates', async () => {
      const dashboards = await db.query(
        'SELECT * FROM dashboards WHERE organization_id = $1 AND is_template = true',
        [organizationId]
      );

      expect(dashboards.length).toBeGreaterThanOrEqual(3);
    });

    test('should have marketing dashboard', async () => {
      const dashboard = await db.queryOne(
        'SELECT * FROM dashboards WHERE organization_id = $1 AND type = $2',
        [organizationId, 'marketing']
      );

      expect(dashboard).toBeTruthy();
      expect(dashboard.name).toContain('Marketing');
      expect(Array.isArray(dashboard.layout)).toBe(true);
      expect(dashboard.layout.length).toBeGreaterThan(0);
    });

    test('should have sales dashboard', async () => {
      const dashboard = await db.queryOne(
        'SELECT * FROM dashboards WHERE organization_id = $1 AND type = $2',
        [organizationId, 'sales']
      );

      expect(dashboard).toBeTruthy();
      expect(dashboard.name).toContain('Sales');
    });

    test('should have finance dashboard', async () => {
      const dashboard = await db.queryOne(
        'SELECT * FROM dashboards WHERE organization_id = $1 AND type = $2',
        [organizationId, 'finance']
      );

      expect(dashboard).toBeTruthy();
      expect(dashboard.name).toContain('Finance');
    });

    test('dashboards should have valid widget layouts', async () => {
      const dashboards = await db.query(
        'SELECT * FROM dashboards WHERE organization_id = $1',
        [organizationId]
      );

      for (const dashboard of dashboards) {
        expect(dashboard.layout).toBeTruthy();
        expect(Array.isArray(dashboard.layout)).toBe(true);
        
        // Check widget structure
        const widgets = dashboard.layout;
        for (const widget of widgets) {
          expect(widget).toHaveProperty('id');
          expect(widget).toHaveProperty('type');
          expect(widget).toHaveProperty('title');
        }
      }
    });
  });

  test.describe('Alerts', () => {
    test('should have 2 alerts configured', async () => {
      const alerts = await db.query(
        'SELECT * FROM alerts WHERE organization_id = $1',
        [organizationId]
      );

      expect(alerts.length).toBeGreaterThanOrEqual(2);
    });

    test('should have low inventory alert', async () => {
      const alert = await db.queryOne(
        'SELECT * FROM alerts WHERE organization_id = $1 AND name LIKE $2',
        [organizationId, '%Inventory%']
      );

      expect(alert).toBeTruthy();
      expect(alert.is_active).toBe(true);
      expect(alert.schedule_cron).toBeTruthy();
    });

    test('should have revenue drop alert', async () => {
      const alert = await db.queryOne(
        'SELECT * FROM alerts WHERE organization_id = $1 AND name LIKE $2',
        [organizationId, '%Revenue%']
      );

      expect(alert).toBeTruthy();
      expect(alert.is_active).toBe(true);
    });

    test('alerts should have notification channels', async () => {
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

  test.describe('Report Templates', () => {
    test('should have weekly report template', async () => {
      const template = await db.queryOne(
        'SELECT * FROM report_templates WHERE organization_id = $1 AND report_type = $2',
        [organizationId, 'weekly']
      );

      expect(template).toBeTruthy();
      expect(template.name).toContain('Weekly');
      expect(template.is_active).toBe(true);
    });

    test('weekly report should have sections', async () => {
      const template = await db.queryOne(
        'SELECT * FROM report_templates WHERE organization_id = $1 AND report_type = $2',
        [organizationId, 'weekly']
      );

      expect(Array.isArray(template.sections)).toBe(true);
      expect(template.sections.length).toBeGreaterThan(0);
      
      // Check section structure
      const section = template.sections[0];
      expect(section).toHaveProperty('title');
    });

    test('weekly report should have recipients', async () => {
      const template = await db.queryOne(
        'SELECT * FROM report_templates WHERE organization_id = $1 AND report_type = $2',
        [organizationId, 'weekly']
      );

      expect(Array.isArray(template.recipients)).toBe(true);
      expect(template.recipients.length).toBeGreaterThan(0);
    });
  });

  test.describe('Celery Schedules', () => {
    test('should have alert, report, and analytics schedules', async () => {
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

    test('should have valid cron expressions', async () => {
      const schedules = await db.query(
        'SELECT schedule_cron FROM celery_schedules WHERE organization_id = $1',
        [organizationId]
      );

      for (const schedule of schedules) {
        expect(schedule.schedule_cron).toBeTruthy();
        const parts = schedule.schedule_cron.split(' ');
        expect(parts.length).toBeGreaterThanOrEqual(5);
      }
    });

    test('alert schedules should reference alerts', async () => {
      const schedules = await db.query(
        `SELECT cs.*, a.name as alert_name
         FROM celery_schedules cs
         LEFT JOIN alerts a ON cs.task_reference = a.id
         WHERE cs.organization_id = $1 AND cs.task_type = 'alert'`,
        [organizationId]
      );

      expect(schedules.length).toBeGreaterThan(0);
      for (const schedule of schedules) {
        expect(schedule.task_reference).toBeTruthy();
        expect(schedule.alert_name).toBeTruthy();
      }
    });
  });

  test.describe('Ecommerce Data', () => {
    test('should have customer data', async () => {
      const customers = await db.query(
        'SELECT * FROM customers WHERE organization_id = $1',
        [organizationId]
      );

      expect(customers.length).toBeGreaterThanOrEqual(10);
    });

    test('should have product data with inventory', async () => {
      const products = await db.query(
        'SELECT * FROM products WHERE organization_id = $1',
        [organizationId]
      );

      expect(products.length).toBeGreaterThanOrEqual(15);
      
      // Check product has required fields
      const product = products[0];
      expect(product.name).toBeTruthy();
      expect(product.sku).toBeTruthy();
      expect(product.category).toBeTruthy();
      expect(product.price).toBeGreaterThan(0);
      expect(product.inventory_quantity).toBeGreaterThanOrEqual(0);
    });

    test('should have orders with items', async () => {
      const orders = await db.query(
        'SELECT * FROM orders WHERE organization_id = $1',
        [organizationId]
      );

      expect(orders.length).toBeGreaterThanOrEqual(50);

      // Get items for first order
      const orderId = orders[0].id;
      const items = await db.query(
        'SELECT * FROM order_items WHERE order_id = $1',
        [orderId]
      );

      expect(items.length).toBeGreaterThan(0);
    });

    test('should have orders in different statuses', async () => {
      const statuses = await db.query(
        'SELECT DISTINCT status FROM orders WHERE organization_id = $1',
        [organizationId]
      );

      const statusList = statuses.map((s: any) => s.status);
      expect(statusList.length).toBeGreaterThan(1);
    });

    test('should have valid order calculations', async () => {
      const orders = await db.query(
        'SELECT * FROM orders WHERE organization_id = $1 LIMIT 10',
        [organizationId]
      );

      for (const order of orders) {
        // Total should be subtotal + tax + shipping
        const calculatedTotal = Number(order.subtotal) + Number(order.tax) + Number(order.shipping);
        expect(Math.abs(Number(order.total) - calculatedTotal)).toBeLessThan(0.01);
      }
    });

    test('should have products in multiple categories', async () => {
      const categories = await db.query(
        'SELECT DISTINCT category FROM products WHERE organization_id = $1',
        [organizationId]
      );

      expect(categories.length).toBeGreaterThan(1);
    });

    test('customer totals should be calculated', async () => {
      const customersWithOrders = await db.query(
        'SELECT * FROM customers WHERE organization_id = $1 AND order_count > 0',
        [organizationId]
      );

      expect(customersWithOrders.length).toBeGreaterThan(0);
      
      for (const customer of customersWithOrders) {
        expect(customer.total_spent).toBeGreaterThan(0);
        expect(customer.order_count).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Data Integrity', () => {
    test('all orders should have valid customer references', async () => {
      const invalidOrders = await db.query(
        `SELECT o.* FROM orders o
         LEFT JOIN customers c ON o.customer_id = c.id
         WHERE o.organization_id = $1 AND c.id IS NULL`,
        [organizationId]
      );

      expect(invalidOrders.length).toBe(0);
    });

    test('all order items should have valid product references', async () => {
      const invalidItems = await db.query(
        `SELECT oi.* FROM order_items oi
         LEFT JOIN products p ON oi.product_id = p.id
         WHERE p.id IS NULL`
      );

      expect(invalidItems.length).toBe(0);
    });

    test('all order items should have valid order references', async () => {
      const invalidItems = await db.query(
        `SELECT oi.* FROM order_items oi
         LEFT JOIN orders o ON oi.order_id = o.id
         WHERE o.id IS NULL`
      );

      expect(invalidItems.length).toBe(0);
    });
  });

  test.describe('Dashboard Sample Data Rendering', () => {
    test('revenue metrics should be calculable from orders', async () => {
      const result = await db.queryOne(
        `SELECT 
          COUNT(*) as order_count,
          SUM(total) as total_revenue,
          AVG(total) as avg_order_value
         FROM orders
         WHERE organization_id = $1 AND status NOT IN ('cancelled', 'refunded')`,
        [organizationId]
      );

      expect(result.order_count).toBeGreaterThan(0);
      expect(result.total_revenue).toBeGreaterThan(0);
      expect(result.avg_order_value).toBeGreaterThan(0);
    });

    test('product performance data should be available', async () => {
      const result = await db.query(
        `SELECT 
          p.name,
          p.category,
          SUM(oi.total_price) as revenue,
          SUM(oi.quantity) as units_sold
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         JOIN orders o ON oi.order_id = o.id
         WHERE p.organization_id = $1 AND o.status NOT IN ('cancelled', 'refunded')
         GROUP BY p.id, p.name, p.category
         ORDER BY revenue DESC
         LIMIT 5`,
        [organizationId]
      );

      expect(result.length).toBeGreaterThan(0);
      
      const topProduct = result[0];
      expect(topProduct.revenue).toBeGreaterThan(0);
      expect(topProduct.units_sold).toBeGreaterThan(0);
    });

    test('category performance data should be available', async () => {
      const result = await db.query(
        `SELECT 
          p.category,
          COUNT(DISTINCT o.id) as orders,
          SUM(oi.quantity) as units_sold,
          SUM(oi.total_price) as revenue
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         JOIN orders o ON oi.order_id = o.id
         WHERE p.organization_id = $1 AND o.status NOT IN ('cancelled', 'refunded')
         GROUP BY p.category
         ORDER BY revenue DESC`,
        [organizationId]
      );

      expect(result.length).toBeGreaterThan(0);
    });

    test('time-series data should be available for charts', async () => {
      const result = await db.query(
        `SELECT 
          DATE_TRUNC('day', created_at) as date,
          COUNT(*) as order_count,
          SUM(total) as revenue
         FROM orders
         WHERE organization_id = $1 
           AND status NOT IN ('cancelled', 'refunded')
           AND created_at >= CURRENT_DATE - INTERVAL '30 days'
         GROUP BY DATE_TRUNC('day', created_at)
         ORDER BY date DESC`,
        [organizationId]
      );

      expect(result.length).toBeGreaterThan(0);
    });
  });
});
