import { db } from '../config/database';

interface SeedResult {
  table: string;
  count: number;
}

class SeedService {
  private organizationId: string | null = null;

  async seedOrganization(): Promise<string> {
    console.log('🌱 Seeding organization...');
    
    const result = await db.queryOne<{ id: string }>(
      `INSERT INTO organizations (name, slug, type, settings)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (slug) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [
        'Demo Ecommerce Inc.',
        'demo-ecommerce',
        'ecommerce',
        JSON.stringify({
          industry: 'retail',
          timezone: 'America/New_York',
          currency: 'USD'
        })
      ]
    );

    this.organizationId = result!.id;
    console.log(`✅ Created organization: ${this.organizationId}`);
    return this.organizationId;
  }

  async seedConnectors(): Promise<number> {
    console.log('🌱 Seeding data connectors...');

    if (!this.organizationId) {
      await this.seedOrganization();
    }
    
    const connectors = [
      {
        name: 'Production PostgreSQL',
        type: 'postgresql',
        config: {
          host: 'prod-db.example.com',
          port: 5432,
          database: 'ecommerce_prod',
          ssl: true
        }
      },
      {
        name: 'Analytics Warehouse',
        type: 'snowflake',
        config: {
          account: 'demo-account',
          warehouse: 'ANALYTICS_WH',
          database: 'ANALYTICS_DB'
        }
      },
      {
        name: 'Marketing API',
        type: 'api',
        config: {
          endpoint: 'https://api.marketing-platform.com/v1',
          authType: 'oauth2'
        }
      }
    ];

    let count = 0;
    for (const connector of connectors) {
      await db.query(
        `INSERT INTO data_connectors (organization_id, name, type, config, status, last_sync_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (organization_id, name) DO NOTHING`,
        [
          this.organizationId,
          connector.name,
          connector.type,
          JSON.stringify(connector.config),
          'active',
          new Date()
        ]
      );
      count++;
    }

    console.log(`✅ Created ${count} data connectors`);
    return count;
  }

  async seedSavedQueries(): Promise<string[]> {
    console.log('🌱 Seeding saved queries...');

    if (!this.organizationId) {
      await this.seedOrganization();
    }
    
    const queries = [
      {
        name: 'Monthly Revenue Trend',
        description: 'Track revenue over time by month',
        query_text: `SELECT 
          DATE_TRUNC('month', created_at) as month,
          SUM(total) as revenue,
          COUNT(*) as order_count
        FROM orders
        WHERE status NOT IN ('cancelled', 'refunded')
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY month DESC`,
        query_type: 'kpi',
        parameters: {}
      },
      {
        name: 'Top Products by Revenue',
        description: 'Best selling products ranked by revenue',
        query_text: `SELECT 
          p.name,
          p.category,
          SUM(oi.total_price) as total_revenue,
          SUM(oi.quantity) as units_sold
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        JOIN orders o ON oi.order_id = o.id
        WHERE o.status NOT IN ('cancelled', 'refunded')
        GROUP BY p.id, p.name, p.category
        ORDER BY total_revenue DESC
        LIMIT 10`,
        query_type: 'metric',
        parameters: { limit: 10 }
      },
      {
        name: 'Customer Lifetime Value',
        description: 'Calculate average customer lifetime value',
        query_text: `SELECT 
          AVG(total_spent) as avg_ltv,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_spent) as median_ltv,
          MAX(total_spent) as max_ltv
        FROM customers
        WHERE order_count > 0`,
        query_type: 'kpi',
        parameters: {}
      },
      {
        name: 'Order Fulfillment Metrics',
        description: 'Track order processing and shipping times',
        query_text: `SELECT 
          status,
          COUNT(*) as order_count,
          AVG(EXTRACT(EPOCH FROM (shipped_at - created_at))/86400) as avg_days_to_ship
        FROM orders
        WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY status
        ORDER BY order_count DESC`,
        query_type: 'metric',
        parameters: { days: 30 }
      },
      {
        name: 'Product Category Performance',
        description: 'Revenue and margin analysis by product category',
        query_text: `SELECT 
          p.category,
          COUNT(DISTINCT o.id) as orders,
          SUM(oi.quantity) as units_sold,
          SUM(oi.total_price) as revenue,
          SUM(oi.quantity * p.cost) as cost,
          SUM(oi.total_price) - SUM(oi.quantity * p.cost) as profit
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        JOIN orders o ON oi.order_id = o.id
        WHERE o.status NOT IN ('cancelled', 'refunded')
        GROUP BY p.category
        ORDER BY revenue DESC`,
        query_type: 'custom',
        parameters: {}
      }
    ];

    const queryIds: string[] = [];
    for (const query of queries) {
      const result = await db.queryOne<{ id: string }>(
        `INSERT INTO saved_queries (organization_id, name, description, query_text, query_type, parameters, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (organization_id, name) DO UPDATE
         SET description = EXCLUDED.description,
             query_text = EXCLUDED.query_text,
             query_type = EXCLUDED.query_type,
             parameters = EXCLUDED.parameters,
             updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [
          this.organizationId,
          query.name,
          query.description,
          query.query_text,
          query.query_type,
          JSON.stringify(query.parameters),
          'system'
        ]
      );
      queryIds.push(result!.id);
    }

    console.log(`✅ Created ${queryIds.length} saved queries`);
    return queryIds;
  }

  async seedDashboards(): Promise<string[]> {
    console.log('🌱 Seeding dashboards...');

    if (!this.organizationId) {
      await this.seedOrganization();
    }
    
    const dashboards = [
      {
        name: 'Marketing Performance',
        description: 'Track marketing campaigns, customer acquisition, and conversion metrics',
        type: 'marketing',
        layout: [
          { id: 'widget-1', type: 'metric', title: 'New Customers', query: 'customer_acquisition' },
          { id: 'widget-2', type: 'chart', title: 'Traffic Sources', chartType: 'pie' },
          { id: 'widget-3', type: 'chart', title: 'Conversion Funnel', chartType: 'funnel' },
          { id: 'widget-4', type: 'table', title: 'Campaign Performance' }
        ],
        filters: { dateRange: '30d' },
        is_template: true
      },
      {
        name: 'Sales Dashboard',
        description: 'Monitor sales performance, revenue trends, and product metrics',
        type: 'sales',
        layout: [
          { id: 'widget-1', type: 'metric', title: 'Total Revenue', format: 'currency' },
          { id: 'widget-2', type: 'metric', title: 'Orders', format: 'number' },
          { id: 'widget-3', type: 'metric', title: 'Average Order Value', format: 'currency' },
          { id: 'widget-4', type: 'chart', title: 'Revenue Trend', chartType: 'line' },
          { id: 'widget-5', type: 'chart', title: 'Top Products', chartType: 'bar' },
          { id: 'widget-6', type: 'table', title: 'Recent Orders' }
        ],
        filters: { dateRange: '90d' },
        is_template: true
      },
      {
        name: 'Finance Overview',
        description: 'Financial metrics, profitability analysis, and cash flow tracking',
        type: 'finance',
        layout: [
          { id: 'widget-1', type: 'metric', title: 'Revenue', format: 'currency' },
          { id: 'widget-2', type: 'metric', title: 'Gross Profit', format: 'currency' },
          { id: 'widget-3', type: 'metric', title: 'Profit Margin', format: 'percentage' },
          { id: 'widget-4', type: 'chart', title: 'Revenue vs Cost', chartType: 'line' },
          { id: 'widget-5', type: 'chart', title: 'Category Profitability', chartType: 'bar' },
          { id: 'widget-6', type: 'table', title: 'P&L Summary' }
        ],
        filters: { dateRange: '12m' },
        is_template: true
      }
    ];

    const dashboardIds: string[] = [];
    for (const dashboard of dashboards) {
      const result = await db.queryOne<{ id: string }>(
        `INSERT INTO dashboards (organization_id, name, description, type, layout, filters, is_template, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (organization_id, name) DO UPDATE
         SET description = EXCLUDED.description,
             type = EXCLUDED.type,
             layout = EXCLUDED.layout,
             filters = EXCLUDED.filters,
             updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [
          this.organizationId,
          dashboard.name,
          dashboard.description,
          dashboard.type,
          JSON.stringify(dashboard.layout),
          JSON.stringify(dashboard.filters),
          dashboard.is_template,
          'system'
        ]
      );
      dashboardIds.push(result!.id);
    }

    console.log(`✅ Created ${dashboardIds.length} dashboards`);
    return dashboardIds;
  }

  async seedAlerts(queryIds: string[]): Promise<string[]> {
    console.log('🌱 Seeding alerts...');

    if (!this.organizationId) {
      await this.seedOrganization();
    }
    
    const alerts = [
      {
        name: 'Low Inventory Alert',
        description: 'Alert when product inventory falls below threshold',
        query_id: null,
        condition: {
          type: 'threshold',
          operator: 'less_than',
          field: 'inventory_quantity'
        },
        threshold_value: 10,
        notification_channels: ['email', 'slack'],
        schedule_cron: '0 */6 * * *', // Every 6 hours
        is_active: true
      },
      {
        name: 'Revenue Drop Alert',
        description: 'Alert when daily revenue drops more than 20% compared to previous week',
        query_id: queryIds[0] || null,
        condition: {
          type: 'percentage_change',
          operator: 'decreases_by',
          comparison_period: '7d'
        },
        threshold_value: -20,
        notification_channels: ['email', 'pagerduty'],
        schedule_cron: '0 8 * * *', // Daily at 8 AM
        is_active: true
      }
    ];

    const alertIds: string[] = [];
    for (const alert of alerts) {
      const result = await db.queryOne<{ id: string }>(
        `INSERT INTO alerts (organization_id, name, description, query_id, condition, threshold_value, notification_channels, schedule_cron, is_active, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (organization_id, name) DO UPDATE
         SET description = EXCLUDED.description,
             query_id = EXCLUDED.query_id,
             condition = EXCLUDED.condition,
             threshold_value = EXCLUDED.threshold_value,
             notification_channels = EXCLUDED.notification_channels,
             schedule_cron = EXCLUDED.schedule_cron,
             is_active = EXCLUDED.is_active,
             updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [
          this.organizationId,
          alert.name,
          alert.description,
          alert.query_id,
          JSON.stringify(alert.condition),
          alert.threshold_value,
          JSON.stringify(alert.notification_channels),
          alert.schedule_cron,
          alert.is_active,
          'system'
        ]
      );
      alertIds.push(result!.id);
    }

    console.log(`✅ Created ${alertIds.length} alerts`);
    return alertIds;
  }

  async seedReportTemplates(): Promise<string[]> {
    console.log('🌱 Seeding report templates...');

    if (!this.organizationId) {
      await this.seedOrganization();
    }
    
    const templates = [
      {
        name: 'Weekly Executive Summary',
        description: 'Comprehensive weekly report with key metrics and insights',
        report_type: 'weekly',
        sections: [
          {
            title: 'Revenue Summary',
            metrics: ['total_revenue', 'order_count', 'avg_order_value'],
            comparison: 'previous_week'
          },
          {
            title: 'Top Performing Products',
            type: 'table',
            limit: 10
          },
          {
            title: 'Customer Insights',
            metrics: ['new_customers', 'repeat_customers', 'customer_ltv']
          },
          {
            title: 'Operational Metrics',
            metrics: ['fulfillment_rate', 'avg_shipping_time', 'return_rate']
          }
        ],
        recipients: ['executive@example.com', 'operations@example.com'],
        schedule_cron: '0 9 * * MON', // Monday at 9 AM
        is_active: true
      }
    ];

    const templateIds: string[] = [];
    for (const template of templates) {
      const result = await db.queryOne<{ id: string }>(
        `INSERT INTO report_templates (organization_id, name, description, report_type, sections, recipients, schedule_cron, is_active, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (organization_id, name) DO UPDATE
         SET description = EXCLUDED.description,
             report_type = EXCLUDED.report_type,
             sections = EXCLUDED.sections,
             recipients = EXCLUDED.recipients,
             schedule_cron = EXCLUDED.schedule_cron,
             is_active = EXCLUDED.is_active,
             updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [
          this.organizationId,
          template.name,
          template.description,
          template.report_type,
          JSON.stringify(template.sections),
          JSON.stringify(template.recipients),
          template.schedule_cron,
          template.is_active,
          'system'
        ]
      );
      templateIds.push(result!.id);
    }

    console.log(`✅ Created ${templateIds.length} report templates`);
    return templateIds;
  }

  async seedEcommerceData(): Promise<void> {
    console.log('🌱 Seeding ecommerce data...');

    if (!this.organizationId) {
      await this.seedOrganization();
    }
    
    // Seed customers
    const customerIds: string[] = [];
    const customerData = [
      { email: 'john.doe@example.com', first_name: 'John', last_name: 'Doe', country: 'USA', city: 'New York' },
      { email: 'jane.smith@example.com', first_name: 'Jane', last_name: 'Smith', country: 'USA', city: 'Los Angeles' },
      { email: 'bob.wilson@example.com', first_name: 'Bob', last_name: 'Wilson', country: 'USA', city: 'Chicago' },
      { email: 'alice.brown@example.com', first_name: 'Alice', last_name: 'Brown', country: 'Canada', city: 'Toronto' },
      { email: 'charlie.davis@example.com', first_name: 'Charlie', last_name: 'Davis', country: 'UK', city: 'London' },
      { email: 'diana.miller@example.com', first_name: 'Diana', last_name: 'Miller', country: 'USA', city: 'Miami' },
      { email: 'evan.garcia@example.com', first_name: 'Evan', last_name: 'Garcia', country: 'Spain', city: 'Madrid' },
      { email: 'fiona.martinez@example.com', first_name: 'Fiona', last_name: 'Martinez', country: 'USA', city: 'Boston' },
      { email: 'george.lopez@example.com', first_name: 'George', last_name: 'Lopez', country: 'Mexico', city: 'Mexico City' },
      { email: 'hannah.lee@example.com', first_name: 'Hannah', last_name: 'Lee', country: 'USA', city: 'San Francisco' }
    ];

    for (const customer of customerData) {
      const result = await db.queryOne<{ id: string }>(
        `INSERT INTO customers (organization_id, email, first_name, last_name, country, city)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (organization_id, email) DO NOTHING
         RETURNING id`,
        [this.organizationId, customer.email, customer.first_name, customer.last_name, customer.country, customer.city]
      );
      if (result) customerIds.push(result.id);
    }
    console.log(`✅ Created ${customerIds.length} customers`);

    // Seed products
    const productIds: string[] = [];
    const productData = [
      { name: 'Wireless Mouse', sku: 'MOUSE-001', category: 'Electronics', price: 29.99, cost: 12.00, inventory_quantity: 150 },
      { name: 'Mechanical Keyboard', sku: 'KB-001', category: 'Electronics', price: 89.99, cost: 35.00, inventory_quantity: 75 },
      { name: 'USB-C Hub', sku: 'HUB-001', category: 'Electronics', price: 49.99, cost: 20.00, inventory_quantity: 200 },
      { name: 'Laptop Stand', sku: 'STAND-001', category: 'Accessories', price: 39.99, cost: 15.00, inventory_quantity: 100 },
      { name: 'Webcam HD', sku: 'CAM-001', category: 'Electronics', price: 69.99, cost: 28.00, inventory_quantity: 50 },
      { name: 'Desk Lamp', sku: 'LAMP-001', category: 'Furniture', price: 34.99, cost: 14.00, inventory_quantity: 120 },
      { name: 'Office Chair', sku: 'CHAIR-001', category: 'Furniture', price: 199.99, cost: 80.00, inventory_quantity: 30 },
      { name: 'Monitor 27"', sku: 'MON-001', category: 'Electronics', price: 299.99, cost: 150.00, inventory_quantity: 45 },
      { name: 'Headphones', sku: 'HEAD-001', category: 'Electronics', price: 79.99, cost: 32.00, inventory_quantity: 90 },
      { name: 'Desk Mat', sku: 'MAT-001', category: 'Accessories', price: 24.99, cost: 10.00, inventory_quantity: 180 },
      { name: 'Portable SSD 1TB', sku: 'SSD-001', category: 'Electronics', price: 149.99, cost: 70.00, inventory_quantity: 60 },
      { name: 'Cable Organizer', sku: 'ORG-001', category: 'Accessories', price: 14.99, cost: 5.00, inventory_quantity: 250 },
      { name: 'Phone Stand', sku: 'PSTAND-001', category: 'Accessories', price: 19.99, cost: 8.00, inventory_quantity: 140 },
      { name: 'Bluetooth Speaker', sku: 'SPEAK-001', category: 'Electronics', price: 59.99, cost: 25.00, inventory_quantity: 70 },
      { name: 'Desk Organizer', sku: 'DORG-001', category: 'Accessories', price: 29.99, cost: 12.00, inventory_quantity: 110 }
    ];

    for (const product of productData) {
      const result = await db.queryOne<{ id: string }>(
        `INSERT INTO products (organization_id, name, sku, category, price, cost, inventory_quantity)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (organization_id, sku) DO NOTHING
         RETURNING id`,
        [this.organizationId, product.name, product.sku, product.category, product.price, product.cost, product.inventory_quantity]
      );
      if (result) productIds.push(result.id);
    }
    console.log(`✅ Created ${productIds.length} products`);

    // Seed orders and order items
    let orderCount = 0;
    let orderItemCount = 0;
    
    // Create orders over the last 90 days
    const now = new Date();
    for (let i = 0; i < 50; i++) {
      const daysAgo = Math.floor(Math.random() * 90);
      const orderDate = new Date(now);
      orderDate.setDate(orderDate.getDate() - daysAgo);
      
      const customerId = customerIds[Math.floor(Math.random() * customerIds.length)];
      const orderNumber = `ORD-${String(1000 + i).padStart(5, '0')}`;
      
      const statuses = ['delivered', 'delivered', 'delivered', 'shipped', 'processing', 'pending'];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      
      let shippedAt = null;
      let deliveredAt = null;
      if (status === 'shipped' || status === 'delivered') {
        shippedAt = new Date(orderDate);
        shippedAt.setDate(shippedAt.getDate() + Math.floor(Math.random() * 3) + 1);
      }
      if (status === 'delivered') {
        deliveredAt = new Date(shippedAt || orderDate);
        deliveredAt.setDate(deliveredAt.getDate() + Math.floor(Math.random() * 5) + 2);
      }

      // Calculate order totals
      const itemCount = Math.floor(Math.random() * 4) + 1;
      let subtotal = 0;
      const items = [];
      
      for (let j = 0; j < itemCount; j++) {
        const productIndex = Math.floor(Math.random() * productIds.length);
        const productId = productIds[productIndex];
        const unitPrice = productData[productIndex].price;
        const quantity = Math.floor(Math.random() * 3) + 1;
        const totalPrice = unitPrice * quantity;
        
        items.push({ productId, quantity, unitPrice, totalPrice });
        subtotal += totalPrice;
      }
      
      const tax = subtotal * 0.08;
      const shipping = subtotal > 100 ? 0 : 9.99;
      const total = subtotal + tax + shipping;

      const orderResult = await db.queryOne<{ id: string }>(
        `INSERT INTO orders (organization_id, customer_id, order_number, status, subtotal, tax, shipping, total, payment_method, created_at, shipped_at, delivered_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (organization_id, order_number) DO NOTHING
         RETURNING id`,
        [this.organizationId, customerId, orderNumber, status, subtotal, tax, shipping, total, 'credit_card', orderDate, shippedAt, deliveredAt]
      );

      if (orderResult) {
        orderCount++;
        const orderId = orderResult.id;
        
        // Insert order items
        for (const item of items) {
          await db.query(
            `INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price)
             VALUES ($1, $2, $3, $4, $5)`,
            [orderId, item.productId, item.quantity, item.unitPrice, item.totalPrice]
          );
          orderItemCount++;
        }
      }
    }
    
    console.log(`✅ Created ${orderCount} orders with ${orderItemCount} order items`);

    // Update customer totals
    await db.query(`
      UPDATE customers c
      SET 
        total_spent = COALESCE((
          SELECT SUM(o.total)
          FROM orders o
          WHERE o.customer_id = c.id AND o.status NOT IN ('cancelled', 'refunded')
        ), 0),
        order_count = COALESCE((
          SELECT COUNT(*)
          FROM orders o
          WHERE o.customer_id = c.id AND o.status NOT IN ('cancelled', 'refunded')
        ), 0),
        updated_at = CURRENT_TIMESTAMP
      WHERE c.organization_id = $1
    `, [this.organizationId]);
    
    console.log('✅ Updated customer totals');
  }

  async seedCelerySchedules(): Promise<number> {
    console.log('🌱 Seeding Celery-style schedules...');

    if (!this.organizationId) {
      await this.seedOrganization();
    }
    
    try {
      // Get all active alerts
      const alerts = await db.query<{
        id: string;
        name: string;
        schedule_cron: string;
        condition?: any;
      }>(
        'SELECT id, name, schedule_cron, condition FROM alerts WHERE is_active = true AND organization_id = $1',
        [this.organizationId]
      );

      // Get all active report templates
      const reports = await db.query<{
        id: string;
        name: string;
        schedule_cron: string;
      }>(
        'SELECT id, name, schedule_cron FROM report_templates WHERE is_active = true AND organization_id = $1',
        [this.organizationId]
      );

      let scheduleCount = 0;

      // Create Celery-style schedules for alerts
      for (const alert of alerts) {
        if (!alert.schedule_cron) {
          continue;
        }

        await db.query(
          `INSERT INTO celery_schedules (organization_id, name, schedule_cron, task_type, task_reference, payload, is_active, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (organization_id, name) DO UPDATE
           SET schedule_cron = EXCLUDED.schedule_cron,
               task_reference = EXCLUDED.task_reference,
               payload = EXCLUDED.payload,
               is_active = EXCLUDED.is_active,
               updated_at = CURRENT_TIMESTAMP`,
          [
            this.organizationId,
            `alert-${alert.name}`,
            alert.schedule_cron,
            'alert',
            alert.id,
            JSON.stringify({ alertId: alert.id, condition: alert.condition }),
            true,
            'system'
          ]
        );
        scheduleCount++;
      }

      // Create Celery-style schedules for reports
      for (const report of reports) {
        if (!report.schedule_cron) {
          continue;
        }

        await db.query(
          `INSERT INTO celery_schedules (organization_id, name, schedule_cron, task_type, task_reference, payload, is_active, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (organization_id, name) DO UPDATE
           SET schedule_cron = EXCLUDED.schedule_cron,
               task_reference = EXCLUDED.task_reference,
               payload = EXCLUDED.payload,
               is_active = EXCLUDED.is_active,
               updated_at = CURRENT_TIMESTAMP`,
          [
            this.organizationId,
            `report-${report.name}`,
            report.schedule_cron,
            'report',
            report.id,
            JSON.stringify({ reportId: report.id }),
            true,
            'system'
          ]
        );
        scheduleCount++;
      }

      // Add analytics refresh schedule
      await db.query(
        `INSERT INTO celery_schedules (organization_id, name, schedule_cron, task_type, payload, is_active, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (organization_id, name) DO UPDATE
         SET schedule_cron = EXCLUDED.schedule_cron,
             payload = EXCLUDED.payload,
             is_active = EXCLUDED.is_active,
             updated_at = CURRENT_TIMESTAMP`,
        [
          this.organizationId,
          'analytics-refresh-hourly',
          '0 * * * *', // Every hour
          'analytics',
          JSON.stringify({ refresh_type: 'all' }),
          true,
          'system'
        ]
      );
      scheduleCount++;

      console.log(`✅ Ensured ${scheduleCount} Celery-style schedules`);
      console.log('   - Alert schedules: ' + alerts.filter(a => a.schedule_cron).length);
      console.log('   - Report schedules: ' + reports.filter(r => r.schedule_cron).length);
      console.log('   - Analytics refresh: 1');

      return scheduleCount;
      
    } catch (error) {
      console.warn('⚠️  Could not seed Celery schedules:', error);
      return 0;
    }
  }

  async verifySeedData(): Promise<SeedResult[]> {
    console.log('🔍 Verifying seed data...');
    
    const tables = [
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

    const results: SeedResult[] = [];
    for (const table of tables) {
      const result = await db.queryOne<{ count: number }>(
        `SELECT COUNT(*) as count FROM ${table}`
      );
      results.push({
        table,
        count: result?.count || 0
      });
    }

    return results;
  }

  async seed(): Promise<void> {
    try {
      console.log('🌱 Starting seed process...\n');

      // Seed in order
      await this.seedOrganization();
      await this.seedConnectors();
      const queryIds = await this.seedSavedQueries();
      await this.seedDashboards();
      await this.seedAlerts(queryIds);
      await this.seedReportTemplates();
      await this.seedEcommerceData();
      const scheduleCount = await this.seedCelerySchedules();

      console.log(`✅ Celery schedules ensured: ${scheduleCount}`);

      // Verify
      const results = await this.verifySeedData();
      
      console.log('\n📊 Seed Summary:');
      console.log('================');
      results.forEach(r => {
        console.log(`  ${r.table.padEnd(25)} ${r.count} records`);
      });

      console.log('\n🎉 Seed completed successfully!');
      console.log(`\n✅ Demo organization: demo-ecommerce`);
      console.log(`✅ Organization ID: ${this.organizationId}`);
      
    } catch (error) {
      console.error('❌ Seed failed:', error);
      throw error;
    }
  }
}

async function main(): Promise<void> {
  const seeder = new SeedService();
  
  try {
    await seeder.seed();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed process failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { SeedService };
