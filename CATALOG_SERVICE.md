# Catalog Service MVP

## Overview

The Catalog Service MVP provides data discovery, column profiling, PII detection, and freshness tracking capabilities for the Analytics Platform. It enables organizations to discover database schemas, profile column statistics, automatically detect sensitive data, and track data lineage.

## Features

### 1. Schema Discovery
Automatically discover and catalog database schemas, tables, and columns from connected data sources.

- **Supported Connectors**: PostgreSQL, MySQL (stub), BigQuery (stub)
- **Discovery Process**: 
  - Queries information_schema for table and column metadata
  - Stores discovered tables in `datasets` table
  - Stores columns in `columns` table with type information

**Example**:
```bash
POST /api/v1/catalog/discovery
{
  "connector_id": "postgres-prod-1",
  "schema_names": ["public", "analytics"],
  "table_patterns": ["customer_*"]
}
```

### 2. Column Profiling
Profile column statistics including null counts, distinct values, min/max values, and data distributions.

- **Profile Statistics**: null_count, distinct_count, min_value, max_value, avg_value, median_value, std_dev
- **Async Processing**: Uses BullMQ job queue for scheduled or on-demand profiling
- **PII Detection**: Runs during profiling to tag sensitive columns

**Example**:
```bash
POST /api/v1/catalog/profile
{
  "dataset_ids": ["dataset-1", "dataset-2"],
  "include_pii_detection": true
}
```

### 3. PII Detection and Tagging
Automatically detect and tag Personally Identifiable Information (PII) columns.

- **Detection Methods**:
  - Column name pattern matching (email, phone, ssn, etc.)
  - Value pattern matching (regex-based)
- **Supported PII Types**:
  - EMAIL, PHONE, SSN, CREDIT_CARD, NAME, ADDRESS
  - DATE_OF_BIRTH, DRIVER_LICENSE, PASSPORT
  - HEALTH_ID, MEDICAL_RECORD, UNKNOWN
- **Confidence Scoring**: 0.0-1.0 confidence score for each detection

**Query Example**:
```bash
# Get all PII columns
GET /api/v1/catalog/columns?is_pii=true

# Get specific PII type (e.g., SSN)
GET /api/v1/catalog/columns?pii_type=ssn
```

### 4. Freshness SLA Tracking
Monitor data freshness and track against SLA targets.

- **SLA Configuration**: Configurable per dataset (default: 24 hours)
- **Freshness Calculation**: Age of data vs. SLA target
- **Status**: is_fresh boolean flag

**Example**:
```bash
GET /api/v1/catalog/freshness
[
  {
    "table_name": "customers",
    "sla_hours": 24,
    "age_hours": 10.5,
    "is_fresh": true,
    "last_updated": "2024-01-15T14:30:00Z"
  }
]
```

### 5. Data Lineage
Track upstream and downstream dependencies for columns (basic implementation).

- **Lineage Types**: upstream, downstream, sibling
- **Storage**: column_lineage table
- **API**: Query lineage for any column

**Example**:
```bash
GET /api/v1/catalog/lineage/col-123
{
  "column_id": "col-123",
  "upstream": [
    {
      "source_column_id": "col-0",
      "source_table": "raw_customers",
      "target_table": "customers"
    }
  ],
  "downstream": [
    {
      "target_column_id": "col-2",
      "source_table": "customers",
      "target_table": "customer_summary"
    }
  ]
}
```

## Database Schema

### datasets Table
Stores discovered datasets/tables
- `id`: UUID primary key
- `organization_id`: Link to organization
- `connector_id`: Link to data connector
- `name`, `schema_name`, `table_name`: Identifiers
- `row_count`: Number of rows in table
- `stats_json`: JSONB for aggregate statistics
- `freshness_sla_hours`: SLA target (default: 24)
- `last_discovered_at`: When schema was last discovered
- `last_profiled_at`: When columns were last profiled

### columns Table
Stores column metadata and statistics
- `id`: UUID primary key
- `dataset_id`: Link to parent dataset
- `column_name`, `column_type`: Basic metadata
- `is_nullable`: Whether column allows NULLs
- `stats_json`: JSONB containing profiling statistics
- `is_pii`: Boolean flag for PII
- `pii_type`: Detected PII type (email, phone, etc.)
- `pii_confidence`: Confidence score (0.0-1.0)

### column_lineage Table
Tracks data lineage
- `id`: UUID primary key
- `source_column_id`, `target_column_id`: Column references
- `lineage_type`: 'upstream', 'downstream', or 'sibling'
- `source_table`, `target_table`: Table names

## API Endpoints

### Public Endpoints (Authentication Required)

**GET /api/v1/catalog/schemas** - List all discovered schemas
- Query Parameters: `limit`, `offset` for pagination
- Returns: Array of datasets with column count

**GET /api/v1/catalog/schemas/:datasetId** - Get schema details
- Returns: Complete dataset metadata with columns, freshness, and PII flags

**GET /api/v1/catalog/columns** - List columns
- Query Parameters: `is_pii`, `pii_type` for filtering
- Returns: Array of columns with stats and PII info

**GET /api/v1/catalog/freshness** - Get freshness status
- Returns: Freshness info for all datasets

**GET /api/v1/catalog/lineage/:columnId** - Get column lineage
- Returns: Upstream and downstream dependencies

### Admin Endpoints (ADMIN role required)

**POST /api/v1/catalog/discovery** - Initiate schema discovery
```json
{
  "connector_id": "connector-uuid",
  "schema_names": ["schema1", "schema2"],
  "table_patterns": ["prefix_*"]
}
```

**POST /api/v1/catalog/profile** - Request dataset profiling
```json
{
  "dataset_ids": ["dataset-1", "dataset-2"],
  "include_pii_detection": true
}
```

## Job Queue Integration

The catalog service uses BullMQ for async job processing:

- **catalog-discovery-queue**: Schema discovery jobs
  - Concurrency: 1 (sequential)
  - Attempts: 3 with exponential backoff
  
- **catalog-profile-queue**: Column profiling jobs
  - Concurrency: 2 (parallel)
  - Attempts: 3 with exponential backoff

## Security & Compliance

- **RBAC Integration**: Uses existing permission system
- **PII Handling**: Automatic detection and tagging for compliance
- **Freshness Monitoring**: Track SLA compliance
- **Audit Trail**: Integrated with existing governance audit logs

## Configuration

Set via environment variables:

```env
# Not required - uses defaults
# All catalog operations use existing database and Redis from main config
```

## Implementation Notes

- **PostgreSQL Support**: Fully implemented with information_schema queries
- **MySQL Support**: Framework in place, ready for implementation
- **BigQuery Support**: Framework in place, ready for implementation
- **Lineage Tracking**: Basic implementation with room for enhancement (can be extended to support full provenance tracking)
- **Performance**: Indexed columns for quick lookups on dataset_id, is_pii, pii_type

## Future Enhancements

- Extended lineage tracking with SQL parsing
- Data quality metrics (completeness, accuracy)
- Advanced PII detection using ML
- Integration with external lineage tools (dbt metadata, Airflow, etc.)
- Column-level compression recommendations
- Cost optimization suggestions
