# Data Source Connectors

The analytics service supports multiple connector types for integrating data from various sources. Each connector provides schema discovery, type inference, sample fetching, and metadata extraction capabilities.

## Supported Connectors

### 1. PostgreSQL Connector

The PostgreSQL connector enables seamless integration with PostgreSQL databases. It automatically discovers tables, columns, and data types.

#### Configuration

```json
{
  "name": "Production Database",
  "type": "postgres",
  "config": {
    "host": "db.example.com",
    "port": 5432,
    "database": "analytics",
    "username": "user",
    "password": "password",
    "ssl": false,
    "schema": "public"
  }
}
```

#### Features

- **Schema Discovery**: Automatically discovers all tables and columns in the specified schema
- **Type Inference**: Maps PostgreSQL data types to standard data types (STRING, INTEGER, FLOAT, BOOLEAN, DATE, TIMESTAMP)
- **Sample Fetching**: Retrieves up to N rows from the table for preview
- **Column Profiling**: Calculates statistics including null count, unique count, min/max values, and most common values

#### Endpoints

- `POST /api/v1/datasources` - Create a PostgreSQL data source
- `POST /api/v1/datasources/{id}/test` - Test the connection
- `POST /api/v1/datasources/{id}/discover` - Discover and cache schema
- `GET /api/v1/datasources/{id}/samples?limit=10` - Get sample rows
- `GET /api/v1/datasources/{id}/profiles?sampleSize=1000` - Get column profiles

### 2. CSV Connector

The CSV connector handles local CSV files and can also read from MinIO-hosted files. It includes automatic delimiter and date format detection.

#### Configuration

**Local File:**
```json
{
  "name": "Local CSV Data",
  "type": "csv",
  "config": {
    "path": "/data/customers.csv",
    "delimiter": ",",
    "hasHeader": true,
    "encoding": "utf-8",
    "dateFormat": "YYYY-MM-DD"
  }
}
```

**MinIO-Hosted:**
```json
{
  "name": "MinIO CSV Data",
  "type": "csv",
  "config": {
    "path": "remote-path/data.csv",
    "delimiter": ",",
    "hasHeader": true,
    "s3": {
      "endpoint": "minio.example.com:9000",
      "accessKey": "minioadmin",
      "secretKey": "minioadmin",
      "bucket": "data-bucket",
      "region": "us-east-1",
      "useSSL": true
    }
  }
}
```

#### Features

- **Automatic Delimiter Detection**: Detects comma, semicolon, tab, or pipe delimiters
- **Automatic Date Detection**: Identifies date columns and common date formats
- **Type Inference**: Infers data types from sample rows
- **Schema Discovery**: Extracts headers and infers schema
- **Sample Fetching**: Returns up to N rows for preview
- **Column Profiling**: Calculates statistics for each column

#### Supported Date Formats

- `YYYY-MM-DD`
- `MM/DD/YYYY`
- `DD-MM-YYYY`
- `YYYY/MM/DD`

#### Endpoints

- `POST /api/v1/datasources` - Create a CSV data source
- `POST /api/v1/datasources/{id}/test` - Test the connection
- `POST /api/v1/datasources/{id}/discover` - Discover and cache schema
- `GET /api/v1/datasources/{id}/samples?limit=10` - Get sample rows
- `GET /api/v1/datasources/{id}/profiles?sampleSize=1000` - Get column profiles

### 3. S3 Parquet Connector

The S3 Parquet connector reads Parquet files from AWS S3 or MinIO-compatible storage. It provides efficient columnar data access and schema extraction from Parquet metadata.

#### Configuration

**AWS S3:**
```json
{
  "name": "S3 Parquet Data",
  "type": "s3_parquet",
  "config": {
    "bucket": "data-bucket",
    "prefix": "analytics/parquet/",
    "endpoint": "s3.amazonaws.com",
    "accessKey": "AWS_ACCESS_KEY",
    "secretKey": "AWS_SECRET_KEY",
    "region": "us-east-1",
    "useSSL": true
  }
}
```

**MinIO:**
```json
{
  "name": "MinIO Parquet Data",
  "type": "s3_parquet",
  "config": {
    "bucket": "analytics-data",
    "prefix": "parquet/",
    "endpoint": "minio.example.com:9000",
    "accessKey": "minioadmin",
    "secretKey": "minioadmin",
    "region": "us-east-1",
    "useSSL": true
  }
}
```

#### Features

- **Schema Extraction**: Reads Parquet metadata for schema information
- **Type Mapping**: Maps Parquet types to standard data types
- **Sample Fetching**: Reads sample rows from Parquet files
- **Column Profiling**: Provides statistics from Parquet metadata
- **Multi-file Support**: Handles multiple Parquet files in a prefix

#### Endpoints

- `POST /api/v1/datasources` - Create an S3 Parquet data source
- `POST /api/v1/datasources/{id}/test` - Test the connection
- `POST /api/v1/datasources/{id}/discover` - Discover and cache schema
- `GET /api/v1/datasources/{id}/samples?limit=10` - Get sample rows
- `GET /api/v1/datasources/{id}/profiles?sampleSize=1000` - Get column profiles

## API Reference

### Create Data Source

```bash
POST /api/v1/datasources
Content-Type: application/json

{
  "name": "My Data Source",
  "type": "postgres|csv|s3_parquet",
  "config": {
    // Type-specific configuration
  },
  "facilityId": "optional-facility-id"
}
```

### Test Connection

```bash
POST /api/v1/datasources/{id}/test
```

Response:
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Connection successful"
  }
}
```

### Discover Schema

```bash
POST /api/v1/datasources/{id}/discover
```

Response:
```json
{
  "success": true,
  "data": {
    "path": "table_name or file_path",
    "columns": [
      {
        "name": "id",
        "type": "integer",
        "nullable": false
      },
      {
        "name": "created_at",
        "type": "timestamp",
        "nullable": true
      }
    ],
    "rowCount": 10000
  },
  "message": "Schema discovered successfully"
}
```

### Get Samples

```bash
GET /api/v1/datasources/{id}/samples?limit=10
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Example",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "count": 1
}
```

### Profile Columns

```bash
GET /api/v1/datasources/{id}/profiles?sampleSize=1000
```

Response:
```json
{
  "success": true,
  "data": [
    {
      "name": "id",
      "type": "integer",
      "nullCount": 0,
      "uniqueCount": 10000,
      "sampleValues": [1, 2, 3],
      "minValue": 1,
      "maxValue": 10000
    }
  ],
  "count": 3
}
```

### Get Data Source

```bash
GET /api/v1/datasources/{id}
```

### List Data Sources

```bash
GET /api/v1/datasources?facilityId=optional-filter
```

### Update Data Source

```bash
PUT /api/v1/datasources/{id}
Content-Type: application/json

{
  "name": "Updated Name",
  "config": { /* Updated config */ }
}
```

### Delete Data Source

```bash
DELETE /api/v1/datasources/{id}
```

## Data Types

The connectors map source data types to the following standard types:

| Type | Description |
|------|-------------|
| `string` | Text/character data |
| `integer` | Whole numbers |
| `float` | Decimal numbers |
| `boolean` | True/false values |
| `date` | Date values (YYYY-MM-DD) |
| `timestamp` | Date and time with timezone |
| `unknown` | Unable to determine type |

## Type Inference Algorithm

For CSV and other file-based connectors, type inference works as follows:

1. Sample 80% of non-null values from the column
2. Check type patterns (boolean, date, integer, float, string)
3. Return the type with the highest percentage match (threshold: 80%)
4. Default to STRING if no clear match

## Error Handling

### Connection Errors

If connection testing fails, check:

- **Postgres**: Host, port, credentials, database name, network connectivity
- **CSV**: File path exists, file is readable, file is not empty
- **S3**: Bucket name, credentials, region, endpoint, network connectivity

### Schema Discovery Errors

- Ensure the data source is properly connected
- For PostgreSQL, verify the schema exists
- For CSV, verify headers are present if expected

### Sample/Profile Errors

- Verify the data source has been successfully discovered
- Ensure sufficient permissions to read data
- Check that data source is enabled

## Performance Considerations

- **Column Profiling**: Set `sampleSize` parameter conservatively (default: 1000) to avoid timeout on large datasets
- **Sample Fetching**: Use `limit` parameter to control response size (max: 100)
- **Schema Discovery**: May take longer for tables with many columns or remote sources
- **Caching**: Results are cached for 1 hour to improve performance

## Security

- Credentials are stored securely in encrypted JSONB columns
- Connection tests do not retain any data
- All operations respect RBAC and facility-level security
- Access logs are maintained for compliance

## Examples

### PostgreSQL Example

```bash
# Create
curl -X POST http://localhost:3000/api/v1/datasources \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Production DB",
    "type": "postgres",
    "config": {
      "host": "prod-db.example.com",
      "port": 5432,
      "database": "analytics",
      "username": "analyst",
      "password": "secure-password"
    }
  }'

# Test connection
curl -X POST http://localhost:3000/api/v1/datasources/{id}/test \
  -H "Authorization: Bearer YOUR_TOKEN"

# Discover schema
curl -X POST http://localhost:3000/api/v1/datasources/{id}/discover \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get samples
curl http://localhost:3000/api/v1/datasources/{id}/samples?limit=10 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### CSV Example

```bash
# Create
curl -X POST http://localhost:3000/api/v1/datasources \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Customer Data",
    "type": "csv",
    "config": {
      "path": "/data/customers.csv"
    }
  }'
```

### MinIO CSV Example

```bash
# Create
curl -X POST http://localhost:3000/api/v1/datasources \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "MinIO Customer Data",
    "type": "csv",
    "config": {
      "path": "data/customers.csv",
      "s3": {
        "endpoint": "minio.example.com:9000",
        "accessKey": "minioadmin",
        "secretKey": "minioadmin",
        "bucket": "data-bucket"
      }
    }
  }'
```

## Enabling Connectors

Connectors are enabled by default in the service. To manage connector availability:

1. Update the `ENABLED_CONNECTORS` environment variable (comma-separated list)
2. Restart the service
3. Use the API to create data sources of enabled types only

Example:
```bash
ENABLED_CONNECTORS=postgres,csv
```

## Future Enhancements

- Support for additional formats (Avro, Delta Lake, HDF5)
- Real-time data source monitoring and health checks
- Data source transformation and joining
- Query pushdown optimization
- Incremental schema discovery and change tracking
