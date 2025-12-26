# Dashboard API Integration Test

This document describes the integration testing approach for the dashboard APIs.

## API Endpoints Implemented

### Core Dashboard Endpoints

1. **GET /api/v1/dashboard** - Main dashboard endpoint with query parameters
   - `dashboardType`: pipeline, revenue, compliance, outreach, combined
   - `team`, `rep`, `pipeline`: array filters
   - `startDate`, `endDate`: date range filters  
   - `timeRange`: preset date ranges (today, yesterday, last7days, etc.)
   - `includeDrilldowns`: boolean to include drilldown data
   - `format`: json or csv

2. **GET /api/v1/dashboard/pipeline** - Pipeline-specific dashboard

3. **GET /api/v1/dashboard/revenue** - Revenue-specific dashboard

4. **GET /api/v1/dashboard/compliance** - Compliance-specific dashboard

5. **GET /api/v1/dashboard/outreach** - Outreach-specific dashboard

6. **GET /api/v1/dashboard/combined** - Combined metrics dashboard

### Saved Views Endpoints

7. **POST /api/v1/dashboard/views** - Create saved view
   - Body: `{ name, description, dashboardType, filters, layout, isPublic, isDefault }`

8. **GET /api/v1/dashboard/views** - Get saved views
   - Query: `dashboardType` filter by type

9. **PUT /api/v1/dashboard/views/:id** - Update saved view

10. **DELETE /api/v1/dashboard/views/:id** - Delete saved view

### Drilldown Endpoints

11. **POST /api/v1/dashboard/drilldowns** - Create drilldown config
   - Body: `{ viewId, metricName, drilldownPath, targetTable, filters }`

12. **GET /api/v1/dashboard/drilldowns** - Get drilldown configs
   - Query: `viewId` filter by saved view

### Export Endpoints

13. **POST /api/v1/dashboard/export** - Create export job
   - Body: same as dashboard query + `format: csv`

14. **GET /api/v1/dashboard/export/jobs** - Get export jobs

15. **GET /api/v1/dashboard/export/jobs/:jobId** - Get specific export job

16. **GET /api/v1/dashboard/export/download/:jobId** - Download CSV file

## Security & RBAC

- All endpoints require authentication via JWT Bearer token
- RBAC middleware enforces permissions:
  - `VIEW_ANALYTICS` or `VIEW_FACILITY_ANALYTICS` for read access
  - `EXPORT_DATA` for export endpoints
  - `MANAGE_ANALYTICS` for create/update/delete operations
- HIPAA compliance middleware applied to all endpoints
- Row-level security restricts data by facility and user role
- Column-level security masks PII based on permissions

## Caching & Performance

- Redis caching with configurable TTL (default 5 minutes)
- Cache keys include user context and query parameters
- Kafka-based cache invalidation for real-time updates
- Database query optimization with proper indexing

## Data Flow

1. **Request Authentication** → JWT validation → User context
2. **RBAC Check** → Permission validation → Security context
3. **Cache Check** → Redis lookup (if hit, return cached)
4. **Database Query** → Materialized views with row-level filters
5. **Data Processing** → Apply column-level security & PII masking
6. **Response Formatting** → Standardized response structure
7. **Cache Storage** → Store in Redis with TTL
8. **Kafka Publishing** → Cache invalidation events

## Response Format

```json
{
  "success": true,
  "data": { ... dashboard data ... },
  "metadata": {
    "viewId": "uuid",
    "dashboardType": "combined",
    "filters": { ... applied filters ... },
    "timestamp": "2024-01-01T00:00:00.000Z",
    "recordCount": 150,
    "cached": false,
    "hasDrilldowns": true
  }
}
```

## Error Handling

- Standardized error responses with proper HTTP status codes
- Detailed error messages in development
- Generic error messages in production
- Audit logging for all access attempts

## Testing Status

✅ **API Structure**: All routes properly defined and middleware applied
✅ **Authentication**: JWT validation working correctly
✅ **Authorization**: RBAC middleware functioning
✅ **Type Safety**: TypeScript compilation successful
⚠️ **Integration Testing**: Requires database/Redis for full testing

## Next Steps for Full Testing

1. Start PostgreSQL and Redis services
2. Run database migrations: `npm run migrate`
3. Run dbt models: `npm run analytics:run`
4. Execute full test suite: `npm test`
5. Test API endpoints with real data
6. Verify CSV export streaming functionality
7. Test cache invalidation via Kafka

## Files Created

- `src/routes/dashboard.ts` - Dashboard API routes
- `src/controllers/dashboard.controller.ts` - Request handlers
- `src/services/dashboard.service.ts` - Business logic
- `src/services/export.service.ts` - CSV export streaming
- `src/services/kafka.service.ts` - Cache invalidation
- `src/migrations/005_create_dashboard_tables.sql` - Database schema
- `src/types/index.ts` - Extended type definitions
- `src/config/index.ts` - Kafka configuration