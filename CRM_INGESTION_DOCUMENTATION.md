# CRM Ingestion System Documentation

## Overview

The CRM Ingestion System provides a robust, scalable pipeline for consuming CRM events from Kafka topics and storing them in partitioned staging tables for analytics. The system supports schema registry validation, idempotent processing, and multi-environment configurations.

## Architecture

### Components

1. **Kafka Consumer Service** - Consumes events from CRM topics
2. **Schema Registry Integration** - Validates event schemas
3. **Staging Tables** - Partitioned storage for CRM events
4. **Queue Service** - Manages ingestion jobs via BullMQ
5. **API Controllers** - REST endpoints for managing ingestion
6. **Event Generator** - Sample data generation for testing

### Data Flow

```
CRM Outbox → Kafka Topics → Schema Registry → CRM Ingestion Service → Staging Tables → Analytics
```

## Configuration

### Environment Variables

```bash
# Kafka Configuration
KAFKA_CLIENT_ID=analytics-crm-ingestion
KAFKA_BROKERS=localhost:9092,localhost:9093
KAFKA_USERNAME=your-kafka-username
KAFKA_PASSWORD=your-kafka-password
KAFKA_SASL_MECHANISM=plain

# Schema Registry
SCHEMA_REGISTRY_URL=http://localhost:8081
SCHEMA_REGISTRY_USERNAME=your-registry-username
SCHEMA_REGISTRY_PASSWORD=your-registry-password

# Consumer Configuration
KAFKA_CONSUMER_GROUP_ID=analytics-crm-consumer
KAFKA_SESSION_TIMEOUT=30000
KAFKA_HEARTBEAT_INTERVAL=3000
KAFKA_MAX_WAIT_TIME=5000

# Topic Configuration
CRM_EVENTS_TOPIC=crm.events
CRM_LEADS_TOPIC=crm.leads
CRM_CONTACTS_TOPIC=crm.contacts
CRM_OPPORTUNITIES_TOPIC=crm.opportunities
```

### Environment-Specific Configurations

#### Development
```bash
NODE_ENV=development
KAFKA_BROKERS=localhost:9092
SCHEMA_REGISTRY_URL=http://localhost:8081
```

#### Staging
```bash
NODE_ENV=staging
KAFKA_BROKERS=staging-kafka-01:9092,staging-kafka-02:9092
SCHEMA_REGISTRY_URL=https://staging-schema-registry.company.com
KAFKA_SSL=true
```

#### Production
```bash
NODE_ENV=production
KAFKA_BROKERS=prod-kafka-01:9092,prod-kafka-02:9092,prod-kafka-03:9092
SCHEMA_REGISTRY_URL=https://schema-registry.company.com
KAFKA_SSL=true
KAFKA_SASL_MECHANISM=scram-sha-256
```

## Event Schemas

### Base Event Structure

```typescript
interface CRMEvent {
  id: string;                    // Internal UUID
  eventId: string;              // Unique event identifier from source
  eventType: CRMEventType;      // Type of CRM event
  organizationId: string;       // Organization identifier
  timestamp: Date;              // Event timestamp
  data: any;                    // Event-specific data
  metadata?: {                  // Optional metadata
    source: string;
    version: string;
    correlationId?: string;
  };
}
```

### Event Types

#### Lead Events
- `lead.created` - New lead created
- `lead.updated` - Lead information updated
- `lead.converted` - Lead converted to opportunity

```typescript
interface CRMLead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  title?: string;
  source: string;
  status: string;
  score?: number;
  assignedTo?: string;
  createdAt: Date;
  updatedAt: Date;
  organizationId: string;
}
```

#### Contact Events
- `contact.created` - New contact created
- `contact.updated` - Contact information updated

```typescript
interface CRMContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  title?: string;
  leadId?: string;
  createdAt: Date;
  updatedAt: Date;
  organizationId: string;
}
```

#### Opportunity Events
- `opportunity.created` - New opportunity created
- `opportunity.updated` - Opportunity updated
- `opportunity.won` - Opportunity won
- `opportunity.lost` - Opportunity lost

```typescript
interface CRMOpportunity {
  id: string;
  name: string;
  leadId?: string;
  contactId?: string;
  amount: number;
  currency: string;
  stage: string;
  probability: number;
  expectedCloseDate: Date;
  createdAt: Date;
  updatedAt: Date;
  organizationId: string;
}
```

## Database Schema

### Staging Tables

#### CRM Leads Staging
```sql
CREATE TABLE analytics.crm_leads_staging (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id VARCHAR(255) UNIQUE NOT NULL,
    lead_id VARCHAR(255) NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(100),
    company VARCHAR(255),
    title VARCHAR(255),
    source VARCHAR(100),
    status VARCHAR(50),
    score INTEGER,
    assigned_to VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    organization_id VARCHAR(100) NOT NULL,
    event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    event_type VARCHAR(50) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB,
    ingestion_id UUID DEFAULT uuid_generate_v4()
) PARTITION BY RANGE (event_timestamp);
```

#### CRM Contacts Staging
```sql
CREATE TABLE analytics.crm_contacts_staging (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id VARCHAR(255) UNIQUE NOT NULL,
    contact_id VARCHAR(255) NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(100),
    company VARCHAR(255),
    title VARCHAR(255),
    lead_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    organization_id VARCHAR(100) NOT NULL,
    event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    event_type VARCHAR(50) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB,
    ingestion_id UUID DEFAULT uuid_generate_v4()
) PARTITION BY RANGE (event_timestamp);
```

#### CRM Opportunities Staging
```sql
CREATE TABLE analytics.crm_opportunities_staging (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id VARCHAR(255) UNIQUE NOT NULL,
    opportunity_id VARCHAR(255) NOT NULL,
    name VARCHAR(500) NOT NULL,
    lead_id VARCHAR(255),
    contact_id VARCHAR(255),
    amount DECIMAL(15,2),
    currency VARCHAR(3) DEFAULT 'USD',
    stage VARCHAR(100),
    probability INTEGER,
    expected_close_date DATE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    organization_id VARCHAR(100) NOT NULL,
    event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    event_type VARCHAR(50) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB,
    ingestion_id UUID DEFAULT uuid_generate_v4()
) PARTITION BY RANGE (event_timestamp);
```

#### Events Log
```sql
CREATE TABLE analytics.crm_events_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    topic VARCHAR(100) NOT NULL,
    partition INTEGER NOT NULL,
    offset BIGINT NOT NULL,
    organization_id VARCHAR(100) NOT NULL,
    event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processing_status VARCHAR(20) DEFAULT 'processed',
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    ingestion_id UUID DEFAULT uuid_generate_v4(),
    metadata JSONB
) PARTITION BY RANGE (event_timestamp);
```

## API Endpoints

### Authentication
All endpoints require authentication and appropriate permissions.

### Start Ingestion
```http
POST /api/v1/crm-ingestion/start
Authorization: Bearer <token>
```

### Stop Ingestion
```http
POST /api/v1/crm-ingestion/stop
Authorization: Bearer <token>
```

### Enqueue Ingestion Job
```http
POST /api/v1/crm-ingestion/enqueue
Content-Type: application/json
Authorization: Bearer <token>

{
  "topic": "crm.leads",
  "partition": 0,
  "offset": 1234,
  "delay": 0
}
```

### Get Metrics
```http
GET /api/v1/crm-ingestion/metrics
Authorization: Bearer <token>
```

### Get Status
```http
GET /api/v1/crm-ingestion/status
Authorization: Bearer <token>
```

## Idempotency and Replay Protection

### Event Deduplication
The system ensures idempotent processing through:

1. **Event ID Tracking** - Each event has a unique `eventId`
2. **Database Constraints** - `event_id` is unique in staging tables
3. **Processing Log** - All events are logged with processing status
4. **Duplicate Detection** - Function `analytics.is_event_processed()` checks for existing events

### Late Arriving Data
- Events are processed based on their timestamp, not arrival time
- Partitioning by date allows efficient querying of time ranges
- No strict ordering requirements - events are processed independently

## Monitoring and Metrics

### Key Metrics
- **Events Processed** - Count of successfully processed events
- **Events Skipped** - Count of duplicate/already processed events
- **Processing Errors** - Count of failed event processing
- **Processing Time** - Time taken to process events
- **Queue Depth** - Number of jobs waiting in queue

### Health Checks
```http
GET /health
```

Returns service health status including:
- Database connectivity
- Redis connectivity
- Kafka consumer status

### Metrics Endpoint
```http
GET /metrics
```

Prometheus-format metrics for monitoring.

## Testing

### Generate Sample Events
```bash
# Generate 10 sample events
npm run build && node dist/scripts/generate-crm-events.js 10

# Generate 50 sample events
npm run build && node dist/scripts/generate-crm-events.js 50
```

### Replay Protection Testing
1. Generate and process sample events
2. Note the event IDs from the logs
3. Re-send the same events
4. Verify events are marked as "skipped" in the events log

### End-to-End Testing
1. Start CRM ingestion service
2. Generate sample events
3. Check metrics endpoint for processing stats
4. Verify data in staging tables
5. Check events log for processing status

## Deployment

### Prerequisites
- PostgreSQL 12+
- Redis 6+
- Kafka 2.8+
- Schema Registry (Confluent)

### Installation
1. Install dependencies: `npm install`
2. Run database migrations: `npm run migrate`
3. Configure environment variables
4. Start service: `npm start`

### Docker Deployment
```yaml
version: '3.8'
services:
  analytics-service:
    image: analytics-service:latest
    environment:
      - NODE_ENV=production
      - KAFKA_BROKERS=kafka:9092
      - SCHEMA_REGISTRY_URL=http://schema-registry:8081
    depends_on:
      - postgres
      - redis
      - kafka
```

## Troubleshooting

### Common Issues

#### Consumer Not Starting
- Check Kafka broker connectivity
- Verify SASL credentials
- Ensure topics exist
- Check consumer group permissions

#### Schema Registry Errors
- Verify schema registry URL
- Check authentication credentials
- Ensure schemas are registered
- Validate Avro schema compatibility

#### Database Connection Issues
- Check PostgreSQL connection string
- Verify database user permissions
- Ensure migrations are run
- Check partition table creation

#### High Memory Usage
- Reduce consumer batch size
- Increase processing concurrency
- Monitor garbage collection
- Check for memory leaks in event processing

### Logging
All components use structured logging with Winston:
- Service startup/shutdown
- Event processing errors
- Performance metrics
- Connection issues

Log levels: `error`, `warn`, `info`, `debug`

### Performance Tuning

#### Consumer Configuration
- Adjust `maxWaitTimeInMs` for latency
- Tune `sessionTimeout` for reliability
- Set appropriate `heartbeatInterval`

#### Database Optimization
- Monitor partition sizes
- Create appropriate indexes
- Consider partition pruning
- Optimize vacuum settings

#### Queue Configuration
- Adjust job removal policies
- Tune retry backoff strategy
- Monitor queue depth
- Set appropriate concurrency

## Security Considerations

### Data Protection
- All PII is stored in secure staging tables
- Audit logging for all data access
- Role-based access control
- Encryption in transit (TLS)

### Access Control
- JWT-based authentication
- Permission-based authorization
- API rate limiting
- Request audit logging

### Compliance
- HIPAA compliance features
- Data retention policies
- Audit trail maintenance
- Secure credential management

## Future Enhancements

### Planned Features
- Real-time analytics dashboards
- Advanced event filtering
- Custom schema validation
- Multi-tenant isolation
- Event replay capabilities

### Scalability Improvements
- Horizontal scaling of consumers
- Dynamic partition management
- Load balancing strategies
- Caching optimizations