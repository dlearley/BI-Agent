# Seed Data Documentation

This document describes the seed data system for BI-Agent, which populates the database with a demo organization, ecommerce dataset, connectors, dashboards, alerts, and reports.

## Quick Start

To seed the database with demo data:

```bash
# Using npm (from root)
npm run seed

# Using npm (from analytics-service)
cd analytics-service
npm run seed

# Using pnpm (from root)
pnpm run seed
```

The seed command will:
1. Build the TypeScript project
2. Run database migrations
3. Populate all seed data
4. Verify the data was created successfully

## What Gets Seeded

### 1. Demo Organization (1 record)

- **Name:** Demo Ecommerce Inc.
- **Slug:** demo-ecommerce
- **Type:** ecommerce
- **Settings:** Industry, timezone, currency configuration

### 2. Data Connectors (3 records)

1. **Production PostgreSQL** - Primary database connector
2. **Analytics Warehouse** - Snowflake data warehouse
3. **Marketing API** - External marketing platform integration

All connectors are in `active` status with configuration templates.

### 3. Saved Queries (5 records)

1. **Monthly Revenue Trend** - Track revenue over time by month
2. **Top Products by Revenue** - Best selling products ranked by revenue
3. **Customer Lifetime Value** - Calculate average customer LTV
4. **Order Fulfillment Metrics** - Track order processing and shipping times
5. **Product Category Performance** - Revenue and margin analysis by category

All queries include:
- Valid SQL query text
- Query type (kpi, metric, custom)
- Parameters for customization
- Descriptions

### 4. Dashboards (3 records)

#### Marketing Performance Dashboard
- Customer acquisition metrics
- Traffic sources visualization
- Conversion funnel
- Campaign performance table
- 4 widgets configured

#### Sales Dashboard
- Total revenue metric
- Order count and AOV
- Revenue trend chart
- Top products chart
- Recent orders table
- 6 widgets configured

#### Finance Overview Dashboard
- Revenue and gross profit metrics
- Profit margin percentage
- Revenue vs cost comparison
- Category profitability analysis
- P&L summary table
- 6 widgets configured

All dashboards are marked as templates and include:
- Layout configuration with widgets
- Filter settings
- Widget types: metric, chart, table

### 5. Alerts (2 records)

#### Low Inventory Alert
- **Trigger:** Product inventory falls below 10 units
- **Schedule:** Every 6 hours
- **Channels:** Email, Slack
- **Status:** Active

#### Revenue Drop Alert
- **Trigger:** Daily revenue drops more than 20% vs previous week
- **Schedule:** Daily at 8 AM
- **Channels:** Email, PagerDuty
- **Status:** Active

### 6. Report Templates (1 record)

#### Weekly Executive Summary
- **Type:** Weekly report
- **Schedule:** Monday at 9 AM
- **Sections:**
  - Revenue Summary (with week-over-week comparison)
  - Top Performing Products
  - Customer Insights
  - Operational Metrics
- **Recipients:** executive@example.com, operations@example.com

### 7. Ecommerce Data

#### Customers (10+ records)
- Email, name, location
- Total spent and order count
- Distributed across USA, Canada, UK, Spain, Mexico

#### Products (15+ records)
- Multiple categories: Electronics, Accessories, Furniture
- Complete product data: name, SKU, price, cost, inventory
- Realistic pricing and inventory levels

Sample products:
- Wireless Mouse ($29.99)
- Mechanical Keyboard ($89.99)
- Office Chair ($199.99)
- Monitor 27" ($299.99)
- And more...

#### Orders (50+ records)
- Distributed over last 90 days
- Multiple statuses: pending, processing, shipped, delivered
- Realistic order calculations (subtotal + tax + shipping)
- Payment method tracking
- Shipping and delivery timestamps

#### Order Items (100+ records)
- Linked to orders and products
- Multiple items per order
- Realistic quantities and pricing
- Complete fulfillment tracking

## Database Schema

The seed system creates the following tables:

### Core Tables
- `organizations` - Organization/tenant data
- `data_connectors` - Data source connections
- `saved_queries` - Reusable SQL queries
- `dashboards` - Dashboard configurations
- `alerts` - Alert rules and schedules
- `report_templates` - Report configurations

### Ecommerce Tables
- `customers` - Customer records
- `products` - Product catalog
- `orders` - Order records
- `order_items` - Order line items

All tables include:
- UUID primary keys
- Timestamps (created_at, updated_at)
- Foreign key relationships
- Appropriate indexes

## Scheduled Jobs

The seed system configures (but does not activate) scheduled jobs for:

### Alerts
- **Low Inventory Alert:** Runs every 6 hours
- **Revenue Drop Alert:** Runs daily at 8 AM

### Reports
- **Weekly Executive Summary:** Runs Monday at 9 AM

**Note:** Job scheduling uses cron patterns compatible with BullMQ. Actual job execution requires the queue worker to be running.

## Testing

### Unit Tests

Run the seed tests:

```bash
# From analytics-service
npm test -- seed.test.ts

# With coverage
npm run test:coverage -- seed.test.ts
```

Test coverage includes:
- Organization creation
- Connector seeding
- Query creation and validation
- Dashboard configuration
- Alert setup
- Report template creation
- Ecommerce data generation
- Data integrity checks
- Full seed process

### E2E Tests

Run end-to-end tests:

```bash
# From analytics-service
npm run test:e2e -- seed-data.spec.ts
```

E2E tests verify:
- Demo organization accessibility
- Data connector status
- Saved query availability
- Dashboard rendering capability
- Alert configuration
- Report template setup
- Ecommerce data relationships
- Data integrity constraints
- Sample data calculations

## Verification

After seeding, verify the data:

```bash
# Connect to PostgreSQL
psql $DATABASE_URL

# Check record counts
SELECT 'organizations' as table_name, COUNT(*) FROM organizations
UNION ALL
SELECT 'data_connectors', COUNT(*) FROM data_connectors
UNION ALL
SELECT 'saved_queries', COUNT(*) FROM saved_queries
UNION ALL
SELECT 'dashboards', COUNT(*) FROM dashboards
UNION ALL
SELECT 'alerts', COUNT(*) FROM alerts
UNION ALL
SELECT 'report_templates', COUNT(*) FROM report_templates
UNION ALL
SELECT 'customers', COUNT(*) FROM customers
UNION ALL
SELECT 'products', COUNT(*) FROM products
UNION ALL
SELECT 'orders', COUNT(*) FROM orders
UNION ALL
SELECT 'order_items', COUNT(*) FROM order_items;

# Query demo organization
SELECT * FROM organizations WHERE slug = 'demo-ecommerce';

# Check dashboard templates
SELECT id, name, type FROM dashboards WHERE is_template = true;
```

## Sample Queries

### Get Revenue Metrics

```sql
SELECT 
  COUNT(*) as order_count,
  SUM(total) as total_revenue,
  AVG(total) as avg_order_value
FROM orders
WHERE status NOT IN ('cancelled', 'refunded')
  AND created_at >= CURRENT_DATE - INTERVAL '30 days';
```

### Get Top Products

```sql
SELECT 
  p.name,
  p.category,
  SUM(oi.total_price) as revenue,
  SUM(oi.quantity) as units_sold
FROM order_items oi
JOIN products p ON oi.product_id = p.id
JOIN orders o ON oi.order_id = o.id
WHERE o.status NOT IN ('cancelled', 'refunded')
GROUP BY p.id, p.name, p.category
ORDER BY revenue DESC
LIMIT 10;
```

### Get Customer Metrics

```sql
SELECT 
  COUNT(*) as total_customers,
  COUNT(CASE WHEN order_count > 0 THEN 1 END) as customers_with_orders,
  AVG(total_spent) as avg_ltv,
  MAX(total_spent) as max_ltv
FROM customers;
```

## Customization

### Adding More Seed Data

Edit `/analytics-service/src/scripts/seed.ts`:

```typescript
// Add more customers
const customerData = [
  { email: 'new.customer@example.com', first_name: 'New', last_name: 'Customer', ... },
  // Add more...
];

// Add more products
const productData = [
  { name: 'New Product', sku: 'PROD-001', category: 'New Category', ... },
  // Add more...
];
```

### Creating Custom Queries

Add to the `seedSavedQueries()` method:

```typescript
{
  name: 'My Custom Query',
  description: 'Description of the query',
  query_text: 'SELECT ...',
  query_type: 'custom',
  parameters: { param1: 'value1' }
}
```

### Adding Dashboard Widgets

Edit the dashboard configurations in `seedDashboards()`:

```typescript
layout: [
  { id: 'widget-1', type: 'metric', title: 'My Metric' },
  { id: 'widget-2', type: 'chart', title: 'My Chart', chartType: 'line' },
  // Add more widgets...
]
```

## Troubleshooting

### Migration Errors

If you encounter migration errors:

```bash
# Check migration status
npm run migrate:status

# Rollback if needed
npm run migrate:rollback
```

### Duplicate Data

The seed script is idempotent for most data. To start fresh:

```sql
-- Delete all seeded data
DELETE FROM organizations WHERE slug = 'demo-ecommerce';
```

This will cascade delete all related records due to foreign key constraints.

### Connection Issues

Ensure your database is running and environment variables are set:

```bash
# Check environment
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

## Production Usage

**Warning:** This seed data is for demo/development purposes only.

Do not run the seed script in production unless:
- You specifically want demo data
- The demo organization slug doesn't conflict
- You understand the data that will be created

For production data:
- Create migration scripts for schema
- Use ETL processes for data import
- Implement proper data validation
- Follow your organization's data policies

## API Access

After seeding, you can access the demo data via API:

```bash
# Get organization info
GET /api/v1/organizations/demo-ecommerce

# Get dashboards
GET /api/v1/dashboards?organization_id={org_id}

# Get saved queries
GET /api/v1/queries?organization_id={org_id}

# Get alerts
GET /api/v1/alerts?organization_id={org_id}
```

## Integration Testing

Use the seeded data for integration testing:

```typescript
import { db } from './config/database';

// Get demo org ID
const org = await db.queryOne(
  'SELECT id FROM organizations WHERE slug = $1',
  ['demo-ecommerce']
);

// Use in tests
const dashboards = await db.query(
  'SELECT * FROM dashboards WHERE organization_id = $1',
  [org.id]
);
```

## Support

For issues or questions about the seed system:
1. Check the test files for examples
2. Review the seed script implementation
3. Consult the main README.md
4. Open an issue in the repository
