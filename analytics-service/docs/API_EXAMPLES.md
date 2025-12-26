# Data Source API Examples

This document provides practical examples of using the data source connector API endpoints.

## Base URL

```
http://localhost:3000/api/v1/datasources
```

## Authentication

All requests require a valid JWT token in the Authorization header:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

## Examples

### 1. Create PostgreSQL Data Source

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/datasources \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Production Database",
    "type": "postgres",
    "config": {
      "host": "db.example.com",
      "port": 5432,
      "database": "analytics",
      "username": "analyst",
      "password": "secure_password",
      "ssl": true,
      "schema": "public"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Production Database",
    "type": "postgres",
    "enabled": true,
    "config": {
      "host": "db.example.com",
      "port": 5432,
      "database": "analytics",
      "username": "analyst",
      "password": "secure_password",
      "ssl": true,
      "schema": "public"
    },
    "createdBy": "user-123",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  },
  "message": "Data source created successfully"
}
```

### 2. Create CSV Data Source (Local File)

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/datasources \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Customer Data CSV",
    "type": "csv",
    "config": {
      "path": "/data/customers.csv",
      "delimiter": ",",
      "hasHeader": true,
      "encoding": "utf-8"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "name": "Customer Data CSV",
    "type": "csv",
    "enabled": true,
    "config": {
      "path": "/data/customers.csv",
      "delimiter": ",",
      "hasHeader": true,
      "encoding": "utf-8"
    },
    "createdBy": "user-123",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  },
  "message": "Data source created successfully"
}
```

### 3. Create CSV Data Source (MinIO-Hosted)

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/datasources \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "MinIO Customer Data",
    "type": "csv",
    "config": {
      "path": "data/customers.csv",
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
  }'
```

### 4. Create S3 Parquet Data Source

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/datasources \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "S3 Analytics Data",
    "type": "s3_parquet",
    "config": {
      "bucket": "analytics-data",
      "prefix": "parquet/",
      "endpoint": "s3.amazonaws.com",
      "accessKey": "AWS_ACCESS_KEY",
      "secretKey": "AWS_SECRET_KEY",
      "region": "us-east-1",
      "useSSL": true
    }
  }'
```

### 5. Test Connection

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/datasources/550e8400-e29b-41d4-a716-446655440000/test \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Success Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Connection successful"
  }
}
```

**Failed Response:**
```json
{
  "success": false,
  "data": {
    "success": false,
    "message": "Connection failed",
    "error": "Connection refused. Are you sure the server is running?"
  }
}
```

### 6. Discover Schema

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/datasources/550e8400-e29b-41d4-a716-446655440000/discover \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "table": "customers",
    "columns": [
      {
        "name": "id",
        "type": "integer",
        "nullable": false
      },
      {
        "name": "name",
        "type": "string",
        "nullable": false
      },
      {
        "name": "email",
        "type": "string",
        "nullable": true
      },
      {
        "name": "created_at",
        "type": "timestamp",
        "nullable": false
      },
      {
        "name": "score",
        "type": "float",
        "nullable": true
      }
    ],
    "rowCount": 15000
  },
  "message": "Schema discovered successfully"
}
```

### 7. Get Sample Data

**Request:**
```bash
curl "http://localhost:3000/api/v1/datasources/550e8400-e29b-41d4-a716-446655440000/samples?limit=5" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Alice Johnson",
      "email": "alice@example.com",
      "created_at": "2024-01-01T00:00:00Z",
      "score": 85.5
    },
    {
      "id": 2,
      "name": "Bob Smith",
      "email": "bob@example.com",
      "created_at": "2024-01-02T00:00:00Z",
      "score": 90.0
    },
    {
      "id": 3,
      "name": "Charlie Brown",
      "email": null,
      "created_at": "2024-01-03T00:00:00Z",
      "score": 78.5
    },
    {
      "id": 4,
      "name": "Diana Prince",
      "email": "diana@example.com",
      "created_at": "2024-01-04T00:00:00Z",
      "score": 92.0
    },
    {
      "id": 5,
      "name": "Edward Norton",
      "email": "edward@example.com",
      "created_at": "2024-01-05T00:00:00Z",
      "score": 88.0
    }
  ],
  "count": 5
}
```

### 8. Profile Columns

**Request:**
```bash
curl "http://localhost:3000/api/v1/datasources/550e8400-e29b-41d4-a716-446655440000/profiles?sampleSize=1000" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "name": "id",
      "type": "integer",
      "nullCount": 0,
      "uniqueCount": 1000,
      "sampleValues": [1, 2, 3, 4, 5],
      "minValue": 1,
      "maxValue": 1000
    },
    {
      "name": "name",
      "type": "string",
      "nullCount": 0,
      "uniqueCount": 950,
      "sampleValues": ["Alice", "Bob", "Charlie", "Diana", "Edward"],
      "mostCommon": "John"
    },
    {
      "name": "email",
      "type": "string",
      "nullCount": 50,
      "uniqueCount": 900,
      "sampleValues": ["alice@example.com", "bob@example.com"]
    },
    {
      "name": "score",
      "type": "float",
      "nullCount": 100,
      "uniqueCount": 850,
      "sampleValues": [85.5, 90.0, 78.5, 92.0],
      "minValue": 0.0,
      "maxValue": 100.0
    }
  ],
  "count": 4
}
```

### 9. List Data Sources

**Request:**
```bash
curl "http://localhost:3000/api/v1/datasources?facilityId=facility-123" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Production Database",
      "type": "postgres",
      "enabled": true,
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "name": "Customer Data CSV",
      "type": "csv",
      "enabled": true,
      "createdAt": "2024-01-15T10:32:00Z",
      "updatedAt": "2024-01-15T10:32:00Z"
    }
  ],
  "count": 2
}
```

### 10. Get Data Source Details

**Request:**
```bash
curl "http://localhost:3000/api/v1/datasources/550e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Production Database",
    "type": "postgres",
    "enabled": true,
    "config": {
      "host": "db.example.com",
      "port": 5432,
      "database": "analytics",
      "username": "analyst",
      "schema": "public"
    },
    "schema": {
      "table": "customers",
      "columns": [ /* ... */ ],
      "rowCount": 15000
    },
    "columnProfiles": [ /* ... */ ],
    "createdBy": "user-123",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

### 11. Update Data Source

**Request:**
```bash
curl -X PUT http://localhost:3000/api/v1/datasources/550e8400-e29b-41d4-a716-446655440000 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Production Database (Updated)"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Production Database (Updated)",
    "type": "postgres",
    "enabled": true,
    "updatedAt": "2024-01-15T11:45:00Z"
  },
  "message": "Data source updated successfully"
}
```

### 12. Delete Data Source

**Request:**
```bash
curl -X DELETE http://localhost:3000/api/v1/datasources/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "message": "Data source deleted successfully"
}
```

## Error Responses

### Invalid Configuration

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/datasources \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Bad Config",
    "type": "postgres",
    "config": {
      "host": "localhost"
      # Missing required fields: port, database, username, password
    }
  }'
```

**Response:**
```json
{
  "success": false,
  "error": "Failed to create data source",
  "message": "Validation error: port is required"
}
```

### Not Found

**Request:**
```bash
curl "http://localhost:3000/api/v1/datasources/nonexistent-id" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": false,
  "error": "Data source not found"
}
```

### Unauthorized

**Request:**
```bash
curl http://localhost:3000/api/v1/datasources
```

**Response:**
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Missing or invalid authentication token"
}
```

## Workflow Examples

### Complete Setup Workflow

1. **Create Data Source**
   ```bash
   curl -X POST http://localhost:3000/api/v1/datasources -d '{...}'
   # Returns: data_source_id
   ```

2. **Test Connection**
   ```bash
   curl -X POST http://localhost:3000/api/v1/datasources/{data_source_id}/test
   # Verify: success: true
   ```

3. **Discover Schema**
   ```bash
   curl -X POST http://localhost:3000/api/v1/datasources/{data_source_id}/discover
   # Returns: schema with tables and columns
   ```

4. **Get Samples**
   ```bash
   curl http://localhost:3000/api/v1/datasources/{data_source_id}/samples?limit=10
   # Review sample data
   ```

5. **Profile Columns**
   ```bash
   curl http://localhost:3000/api/v1/datasources/{data_source_id}/profiles
   # Analyze data quality and statistics
   ```

6. **Use in Analytics**
   - Data source is now ready for analytics queries and reporting
   - Schema and profiles are cached for performance
   - Can be used for catalog discovery and data lineage

## Notes

- All timestamps are in ISO 8601 format with UTC timezone
- Password fields are never returned in responses (only shown during creation)
- Pagination not implemented yet; use `limit` parameter for samples
- Schema caching: Results are cached for 1 hour
- Type inference is automatic for CSV files
- Credentials are stored securely and never logged

