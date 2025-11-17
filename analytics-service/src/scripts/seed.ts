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

  async seedCRMData(): Promise<void> {
    console.log('🌱 Seeding CRM data...');

    if (!this.organizationId) {
      await this.seedOrganization();
    }

    // Get or use demo customers as accounts
    const customers = await db.query<{ id: string; email: string; first_name: string; last_name: string }>(
      'SELECT id, email, first_name, last_name FROM customers WHERE organization_id = $1 LIMIT 5',
      [this.organizationId]
    );

    // Seed Accounts
    const accountsData = [
      { name: 'Acme Corporation', industry: 'Technology', company_size: 'Enterprise', annual_revenue: 50000000, website: 'https://acme.com', phone: '+1-555-0101', account_status: 'customer', account_owner: 'Alice Johnson' },
      { name: 'GlobalTech Solutions', industry: 'Software', company_size: 'Large', annual_revenue: 25000000, website: 'https://globaltech.com', phone: '+1-555-0102', account_status: 'customer', account_owner: 'Bob Smith' },
      { name: 'InnovateCo', industry: 'Technology', company_size: 'Medium', annual_revenue: 5000000, website: 'https://innovateco.com', phone: '+1-555-0103', account_status: 'prospect', account_owner: 'Alice Johnson' },
      { name: 'TechStart Inc', industry: 'Startup', company_size: 'Small', annual_revenue: 500000, website: 'https://techstart.com', phone: '+1-555-0104', account_status: 'prospect', account_owner: 'Charlie Brown' },
      { name: 'Enterprise Solutions Ltd', industry: 'Consulting', company_size: 'Large', annual_revenue: 15000000, website: 'https://entsolutions.com', phone: '+1-555-0105', account_status: 'churned', account_owner: 'Bob Smith' },
    ];

    const accountIds: string[] = [];
    for (const account of accountsData) {
      const result = await db.queryOne<{ id: string }>(
        `INSERT INTO accounts (organization_id, name, industry, company_size, annual_revenue, website, phone, account_status, account_owner)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (organization_id, name) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [this.organizationId, account.name, account.industry, account.company_size, account.annual_revenue, account.website, account.phone, account.account_status, account.account_owner]
      );
      if (result) accountIds.push(result.id);
    }
    console.log(`✅ Created ${accountIds.length} accounts`);

    // Seed Contacts
    const contactsData = [
      { account_idx: 0, first_name: 'John', last_name: 'Doe', email: 'john.doe@acme.com', phone: '+1-555-1001', job_title: 'CEO', department: 'Executive', is_primary: true, contact_status: 'active' },
      { account_idx: 0, first_name: 'Jane', last_name: 'Smith', email: 'jane.smith@acme.com', phone: '+1-555-1002', job_title: 'CTO', department: 'Technology', is_primary: false, contact_status: 'active' },
      { account_idx: 1, first_name: 'Michael', last_name: 'Johnson', email: 'michael.j@globaltech.com', phone: '+1-555-1003', job_title: 'VP Sales', department: 'Sales', is_primary: true, contact_status: 'active' },
      { account_idx: 1, first_name: 'Sarah', last_name: 'Williams', email: 'sarah.w@globaltech.com', phone: '+1-555-1004', job_title: 'Director of Operations', department: 'Operations', is_primary: false, contact_status: 'active' },
      { account_idx: 2, first_name: 'David', last_name: 'Brown', email: 'david.b@innovateco.com', phone: '+1-555-1005', job_title: 'Founder', department: 'Executive', is_primary: true, contact_status: 'active' },
      { account_idx: 3, first_name: 'Emily', last_name: 'Davis', email: 'emily.d@techstart.com', phone: '+1-555-1006', job_title: 'Product Manager', department: 'Product', is_primary: true, contact_status: 'active' },
      { account_idx: 4, first_name: 'Robert', last_name: 'Miller', email: 'robert.m@entsolutions.com', phone: '+1-555-1007', job_title: 'CFO', department: 'Finance', is_primary: true, contact_status: 'inactive' },
    ];

    const contactIds: string[] = [];
    for (const contact of contactsData) {
      const result = await db.queryOne<{ id: string }>(
        `INSERT INTO contacts (organization_id, account_id, first_name, last_name, email, phone, job_title, department, is_primary, contact_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (organization_id, email) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [this.organizationId, accountIds[contact.account_idx], contact.first_name, contact.last_name, contact.email, contact.phone, contact.job_title, contact.department, contact.is_primary, contact.contact_status]
      );
      if (result) contactIds.push(result.id);
    }
    console.log(`✅ Created ${contactIds.length} contacts`);

    // Seed Deals
    const dealsData = [
      { account_idx: 0, contact_idx: 0, name: 'Enterprise License Deal', amount: 150000, stage: 'negotiation', probability: 80, expected_close_date: new Date('2024-01-15'), deal_owner: 'Alice Johnson', lead_source: 'Referral' },
      { account_idx: 0, contact_idx: 1, name: 'Professional Services', amount: 75000, stage: 'proposal', probability: 60, expected_close_date: new Date('2024-01-30'), deal_owner: 'Alice Johnson', lead_source: 'Existing Customer' },
      { account_idx: 1, contact_idx: 2, name: 'Annual Subscription Renewal', amount: 200000, stage: 'closed_won', probability: 100, expected_close_date: new Date('2023-12-01'), actual_close_date: new Date('2023-12-01'), deal_owner: 'Bob Smith', lead_source: 'Renewal' },
      { account_idx: 2, contact_idx: 4, name: 'Pilot Program', amount: 25000, stage: 'qualification', probability: 40, expected_close_date: new Date('2024-02-15'), deal_owner: 'Alice Johnson', lead_source: 'Website' },
      { account_idx: 3, contact_idx: 5, name: 'Startup Package', amount: 15000, stage: 'prospecting', probability: 20, expected_close_date: new Date('2024-03-01'), deal_owner: 'Charlie Brown', lead_source: 'Cold Outreach' },
      { account_idx: 4, contact_idx: 6, name: 'Enterprise Upgrade', amount: 100000, stage: 'closed_lost', probability: 0, expected_close_date: new Date('2023-11-15'), actual_close_date: new Date('2023-11-20'), deal_owner: 'Bob Smith', lead_source: 'Existing Customer' },
    ];

    const dealIds: string[] = [];
    for (const deal of dealsData) {
      const result = await db.queryOne<{ id: string }>(
        `INSERT INTO deals (organization_id, account_id, contact_id, name, amount, stage, probability, expected_close_date, actual_close_date, deal_owner, lead_source)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [this.organizationId, accountIds[deal.account_idx], contactIds[deal.contact_idx], deal.name, deal.amount, deal.stage, deal.probability, deal.expected_close_date, deal.actual_close_date || null, deal.deal_owner, deal.lead_source]
      );
      if (result) dealIds.push(result.id);
    }
    console.log(`✅ Created ${dealIds.length} deals`);

    // Seed Deal Stage History
    const stageHistoryData = [
      { deal_idx: 0, stage: 'prospecting', previous_stage: null, days_in_stage: 0, changed_at: new Date('2023-11-01'), changed_by: 'Alice Johnson' },
      { deal_idx: 0, stage: 'qualification', previous_stage: 'prospecting', days_in_stage: 7, changed_at: new Date('2023-11-08'), changed_by: 'Alice Johnson' },
      { deal_idx: 0, stage: 'proposal', previous_stage: 'qualification', days_in_stage: 14, changed_at: new Date('2023-11-22'), changed_by: 'Alice Johnson' },
      { deal_idx: 0, stage: 'negotiation', previous_stage: 'proposal', days_in_stage: 21, changed_at: new Date('2023-12-13'), changed_by: 'Alice Johnson' },
      { deal_idx: 2, stage: 'prospecting', previous_stage: null, days_in_stage: 0, changed_at: new Date('2023-10-01'), changed_by: 'Bob Smith' },
      { deal_idx: 2, stage: 'qualification', previous_stage: 'prospecting', days_in_stage: 5, changed_at: new Date('2023-10-06'), changed_by: 'Bob Smith' },
      { deal_idx: 2, stage: 'proposal', previous_stage: 'qualification', days_in_stage: 10, changed_at: new Date('2023-10-16'), changed_by: 'Bob Smith' },
      { deal_idx: 2, stage: 'negotiation', previous_stage: 'proposal', days_in_stage: 15, changed_at: new Date('2023-10-31'), changed_by: 'Bob Smith' },
      { deal_idx: 2, stage: 'closed_won', previous_stage: 'negotiation', days_in_stage: 31, changed_at: new Date('2023-12-01'), changed_by: 'Bob Smith' },
    ];

    for (const history of stageHistoryData) {
      await db.query(
        `INSERT INTO deal_stage_history (deal_id, stage, previous_stage, days_in_stage, changed_at, changed_by)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [dealIds[history.deal_idx], history.stage, history.previous_stage, history.days_in_stage, history.changed_at, history.changed_by]
      );
    }
    console.log(`✅ Created ${stageHistoryData.length} deal stage history records`);

    // Seed Activities
    const activitiesData = [
      { account_idx: 0, contact_idx: 0, deal_idx: 0, activity_type: 'call', subject: 'Discovery Call', duration_minutes: 45, outcome: 'Positive - interested in enterprise features', activity_date: new Date('2023-11-02'), assigned_to: 'Alice Johnson', completed: true },
      { account_idx: 0, contact_idx: 0, deal_idx: 0, activity_type: 'meeting', subject: 'Product Demo', duration_minutes: 60, outcome: 'Success - requested proposal', activity_date: new Date('2023-11-15'), assigned_to: 'Alice Johnson', completed: true },
      { account_idx: 0, contact_idx: 1, deal_idx: 0, activity_type: 'email', subject: 'Technical Requirements Follow-up', outcome: 'Positive response', activity_date: new Date('2023-11-20'), assigned_to: 'Alice Johnson', completed: true },
      { account_idx: 1, contact_idx: 2, deal_idx: 2, activity_type: 'call', subject: 'Renewal Discussion', duration_minutes: 30, outcome: 'Agreed to renew', activity_date: new Date('2023-11-25'), assigned_to: 'Bob Smith', completed: true },
      { account_idx: 2, contact_idx: 4, deal_idx: null, activity_type: 'meeting', subject: 'Initial Consultation', duration_minutes: 45, outcome: 'Interested in pilot', activity_date: new Date('2023-12-05'), assigned_to: 'Alice Johnson', completed: true },
      { account_idx: 3, contact_idx: 5, deal_idx: 4, activity_type: 'email', subject: 'Startup Package Information', outcome: 'No response yet', activity_date: new Date('2023-12-10'), assigned_to: 'Charlie Brown', completed: false },
    ];

    for (const activity of activitiesData) {
      await db.query(
        `INSERT INTO activities (organization_id, account_id, contact_id, deal_id, activity_type, subject, duration_minutes, outcome, activity_date, assigned_to, completed)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [this.organizationId, accountIds[activity.account_idx], contactIds[activity.contact_idx], activity.deal_idx !== null ? dealIds[activity.deal_idx] : null, activity.activity_type, activity.subject, activity.duration_minutes, activity.outcome, activity.activity_date, activity.assigned_to, activity.completed]
      );
    }
    console.log(`✅ Created ${activitiesData.length} activities`);

    // Seed Tickets
    const ticketsData = [
      { account_idx: 0, contact_idx: 0, ticket_number: 'TICK-1001', subject: 'Login issues with SSO', priority: 'high', status: 'resolved', category: 'Technical', assigned_to: 'Support Team A', created_at: new Date('2023-12-01'), resolved_at: new Date('2023-12-01T18:30:00') },
      { account_idx: 0, contact_idx: 1, ticket_number: 'TICK-1002', subject: 'Feature request: API rate limit increase', priority: 'medium', status: 'in_progress', category: 'Feature Request', assigned_to: 'Support Team B', created_at: new Date('2023-12-05'), resolved_at: null },
      { account_idx: 1, contact_idx: 2, ticket_number: 'TICK-1003', subject: 'Billing discrepancy', priority: 'urgent', status: 'closed', category: 'Billing', assigned_to: 'Support Team A', created_at: new Date('2023-11-28'), resolved_at: new Date('2023-11-28T16:00:00'), closed_at: new Date('2023-11-29T10:00:00') },
      { account_idx: 1, contact_idx: 3, ticket_number: 'TICK-1004', subject: 'Training resources needed', priority: 'low', status: 'resolved', category: 'Training', assigned_to: 'Support Team C', created_at: new Date('2023-11-20'), resolved_at: new Date('2023-11-25T14:00:00') },
      { account_idx: 2, contact_idx: 4, ticket_number: 'TICK-1005', subject: 'Cannot access dashboard', priority: 'high', status: 'open', category: 'Technical', assigned_to: 'Support Team A', created_at: new Date('2023-12-10'), resolved_at: null },
    ];

    for (const ticket of ticketsData) {
      await db.query(
        `INSERT INTO tickets (organization_id, account_id, contact_id, ticket_number, subject, priority, status, category, assigned_to, created_at, resolved_at, closed_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $10)
         ON CONFLICT (organization_id, ticket_number) DO NOTHING`,
        [this.organizationId, accountIds[ticket.account_idx], contactIds[ticket.contact_idx], ticket.ticket_number, ticket.subject, ticket.priority, ticket.status, ticket.category, ticket.assigned_to, ticket.created_at, ticket.resolved_at, ticket.closed_at || null]
      );
    }
    console.log(`✅ Created ${ticketsData.length} support tickets`);
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
      'order_items',
      'accounts',
      'contacts',
      'deals',
      'deal_stage_history',
      'activities',
      'tickets'
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
      await this.seedCRMData();
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
