# CRM Ingestion Quick Start Guide

This guide will help you set up and run the CRM ingestion system for analytics.

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- PostgreSQL 15+ (if not using Docker)
- Redis 6+ (if not using Docker)
- Kafka 2.8+ (if not using Docker)

## Quick Start with Docker

1. **Start all services:**
   ```bash
   docker-compose -f docker-compose.crm.yml up -d
   ```

2. **Wait for services to be ready (2-3 minutes):**
   ```bash
   # Check service status
   docker-compose -f docker-compose.crm.yml ps
   
   # View logs
   docker-compose -f docker-compose.crm.yml logs -f analytics-service
   ```

3. **Verify Kafka topics are created:**
   ```bash
   docker exec kafka kafka-topics --bootstrap-server localhost:9092 --list
   ```

4. **Generate sample CRM events:**
   ```bash
   # Generate 10 sample events
   npm run crm:generate-events 10
   
   # Generate 50 sample events
   npm run crm:generate-events 50
   ```

5. **Start CRM ingestion:**
   ```bash
   curl -X POST http://localhost:3000/api/v1/crm-ingestion/start \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer your-jwt-token"
   ```

6. **Check ingestion metrics:**
   ```bash
   curl http://localhost:3000/api/v1/crm-ingestion/metrics \
     -H "Authorization: Bearer your-jwt-token"
   ```

## Manual Setup (Without Docker)

### 1. Database Setup

```bash
# Create database
createdb analytics_db

# Run migrations
npm run migrate
```

### 2. Redis Setup

```bash
# Start Redis
redis-server

# Test connection
redis-cli ping
```

### 3. Kafka Setup

```bash
# Start Zookeeper
bin/zookeeper-server-start.sh config/zookeeper.properties

# Start Kafka
bin/kafka-server-start.sh config/server.properties

# Create topics
bin/kafka-topics.sh --create --topic crm.events --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1
bin/kafka-topics.sh --create --topic crm.leads --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1
bin/kafka-topics.sh --create --topic crm.contacts --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1
bin/kafka-topics.sh --create --topic crm.opportunities --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1
```

### 4. Schema Registry Setup

```bash
# Start Schema Registry
bin/schema-registry-start.sh config/schema-registry.properties
```

### 5. Environment Configuration

```bash
# Copy example environment file
cp .env.crm-example .env

# Edit with your actual values
nano .env
```

### 6. Start the Service

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start the service
npm start
```

## Testing the System

### 1. Generate Sample Events

```bash
# Generate 10 events
npm run crm:generate-events 10

# Generate custom number of events
npm run crm:generate-events 25
```

### 2. Test Replay Protection

1. Generate and process events
2. Note the event IDs from logs
3. Re-run the same event generator
4. Check that events are marked as "skipped"

### 3. Verify Data in Database

```sql
-- Check leads data
SELECT * FROM analytics.crm_leads_staging LIMIT 10;

-- Check events log
SELECT * FROM analytics.crm_events_log LIMIT 10;

-- Check processing status
SELECT 
  processing_status,
  COUNT(*) as count
FROM analytics.crm_events_log 
GROUP BY processing_status;
```

### 4. API Testing

```bash
# Start ingestion
curl -X POST http://localhost:3000/api/v1/crm-ingestion/start \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token"

# Get metrics
curl http://localhost:3000/api/v1/crm-ingestion/metrics \
  -H "Authorization: Bearer your-jwt-token"

# Get full status
curl http://localhost:3000/api/v1/crm-ingestion/status \
  -H "Authorization: Bearer your-jwt-token"

# Stop ingestion
curl -X POST http://localhost:3000/api/v1/crm-ingestion/stop \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-jwt-token"
```

## Monitoring

### Kafka UI

Access Kafka UI at: http://localhost:8080

- View topics and partitions
- Monitor consumer groups
- Browse messages

### Schema Registry

Access Schema Registry at: http://localhost:8081

- View registered schemas
- Check schema compatibility
- Monitor schema usage

### Application Metrics

Access Prometheus metrics at: http://localhost:3000/metrics

### Health Checks

```bash
# Service health
curl http://localhost:3000/health

# Detailed status
curl http://localhost:3000/api/v1/crm-ingestion/status \
  -H "Authorization: Bearer your-jwt-token"
```

## Troubleshooting

### Common Issues

1. **Kafka Connection Failed**
   ```bash
   # Check if Kafka is running
   docker exec kafka kafka-broker-api-versions --bootstrap-server localhost:9092
   
   # Check topics
   docker exec kafka kafka-topics --bootstrap-server localhost:9092 --list
   ```

2. **Schema Registry Not Available**
   ```bash
   # Check Schema Registry
   curl http://localhost:8081/subjects
   
   # Check logs
   docker logs schema-registry
   ```

3. **Database Connection Issues**
   ```bash
   # Test database connection
   docker exec postgres psql -U analytics_user -d analytics_db -c "SELECT 1;"
   
   # Check migrations
   npm run migrate:status
   ```

4. **Redis Connection Issues**
   ```bash
   # Test Redis
   docker exec redis redis-cli ping
   
   # Check Redis logs
   docker logs redis
   ```

### Logs

```bash
# Application logs
docker-compose -f docker-compose.crm.yml logs -f analytics-service

# Kafka logs
docker-compose -f docker-compose.crm.yml logs -f kafka

# All services
docker-compose -f docker-compose.crm.yml logs -f
```

### Performance Issues

1. **High Memory Usage**
   - Reduce consumer batch size
   - Increase processing frequency
   - Monitor garbage collection

2. **Slow Processing**
   - Check database indexes
   - Monitor queue depth
   - Adjust consumer concurrency

3. **Kafka Lag**
   - Increase consumer instances
   - Check network connectivity
   - Monitor topic partitions

## Production Considerations

### Security

- Enable SSL/TLS for Kafka
- Use SASL authentication
- Secure Schema Registry
- Enable database SSL
- Use environment variables for secrets

### Scalability

- Multiple Kafka brokers
- Partition topics appropriately
- Scale consumer instances
- Use connection pooling
- Implement caching

### Monitoring

- Set up Prometheus/Grafana
- Configure alerting
- Monitor error rates
- Track processing latency
- Log aggregation

### Backup and Recovery

- Database backups
- Kafka topic replication
- Schema registry backups
- Configuration management
- Disaster recovery planning

## Next Steps

1. **Configure Production Environment**
   - Set up proper security
   - Configure monitoring
   - Plan capacity

2. **Integrate with Real CRM**
   - Update event schemas
   - Configure proper topics
   - Set up data validation

3. **Build Analytics Views**
   - Create materialized views
   - Set up dashboards
   - Configure alerts

4. **Implement Advanced Features**
   - Real-time processing
   - Custom transformations
   - Advanced filtering

For detailed documentation, see [CRM_INGESTION_DOCUMENTATION.md](./CRM_INGESTION_DOCUMENTATION.md).