import { Kafka, Consumer, KafkaMessage } from 'kafkajs';
import { SchemaRegistry } from '@kafkajs/confluent-schema-registry';
import { db } from '../config/database';
import config from '../config';
import logger from '../utils/logger';
import { 
  CRMEvent, 
  CRMEventType, 
  CRMLead, 
  CRMContact, 
  CRMOpportunity,
  IngestionResult,
  IngestionJobData
} from '../types';
import { v4 as uuidv4 } from 'uuid';

export class CRMIngestionService {
  private kafka: Kafka;
  private consumer: Consumer;
  private schemaRegistry: SchemaRegistry;
  private isRunning = false;
  private ingestionId: string;

  constructor() {
    this.ingestionId = uuidv4();
    
    this.kafka = new Kafka({
      clientId: config.kafka.clientId,
      brokers: config.kafka.brokers,
      ssl: config.kafka.ssl,
      sasl: config.kafka.sasl.username ? config.kafka.sasl : undefined,
    });

    this.consumer = this.kafka.consumer({
      groupId: config.kafka.consumer.groupId,
      sessionTimeout: config.kafka.consumer.sessionTimeout,
      heartbeatInterval: config.kafka.consumer.heartbeatInterval,
      maxWaitTimeInMs: config.kafka.consumer.maxWaitTimeInMs,
    });

    this.schemaRegistry = new SchemaRegistry({
      url: config.kafka.schemaRegistry.url,
      auth: config.kafka.schemaRegistry.username ? {
        username: config.kafka.schemaRegistry.username,
        password: config.kafka.schemaRegistry.password!,
      } : undefined,
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('CRM ingestion service is already running');
      return;
    }

    try {
      // Subscribe to all CRM topics
      await this.consumer.subscribe({
        topics: [
          config.kafka.topics.crmEvents,
          config.kafka.topics.crmLeads,
          config.kafka.topics.crmContacts,
          config.kafka.topics.crmOpportunities,
        ],
        fromBeginning: false, // Start from latest offset
      });

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          await this.processMessage(topic, partition, message);
        },
        eachBatch: async ({ batch }) => {
          logger.debug(`Processing batch of ${batch.messages.length} messages from topic ${batch.topic}`);
        },
      });

      this.isRunning = true;
      logger.info('CRM ingestion service started successfully', {
        ingestionId: this.ingestionId,
        topics: Object.values(config.kafka.topics),
      });
    } catch (error) {
      logger.error('Failed to start CRM ingestion service', { error, ingestionId: this.ingestionId });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      await this.consumer.disconnect();
      this.isRunning = false;
      logger.info('CRM ingestion service stopped', { ingestionId: this.ingestionId });
    } catch (error) {
      logger.error('Error stopping CRM ingestion service', { error, ingestionId: this.ingestionId });
      throw error;
    }
  }

  private async processMessage(
    topic: string,
    partition: number,
    message: KafkaMessage
  ): Promise<void> {
    const startTime = Date.now();
    
    try {
      if (!message.value) {
        logger.warn('Received empty message', { topic, partition, offset: message.offset });
        return;
      }

      // Parse and validate the message
      const crmEvent = await this.parseMessage(topic, message);
      
      // Check for idempotency - skip if already processed
      if (await this.isEventProcessed(crmEvent.eventId)) {
        logger.debug('Skipping already processed event', { 
          eventId: crmEvent.eventId, 
          topic, 
          partition, 
          offset: message.offset 
        });
        await this.logEvent(crmEvent, topic, partition, message.offset, 'skipped');
        return;
      }

      // Process the event based on type
      await this.processCRMEvent(crmEvent);

      // Log successful processing
      await this.logEvent(crmEvent, topic, partition, message.offset, 'processed');

      const processingTime = Date.now() - startTime;
      logger.info('Successfully processed CRM event', {
        eventId: crmEvent.eventId,
        eventType: crmEvent.eventType,
        organizationId: crmEvent.organizationId,
        topic,
        partition,
        offset: message.offset,
        processingTimeMs: processingTime,
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('Failed to process CRM message', {
        error,
        topic,
        partition,
        offset: message.offset,
        processingTimeMs: processingTime,
      });

      // Log the failure
      if (message.value) {
        try {
          const crmEvent = await this.parseMessage(topic, message);
          await this.logEvent(crmEvent, topic, partition, message.offset, 'failed', error);
        } catch (parseError) {
          // If we can't even parse, log with minimal info
          await this.logParseFailure(topic, partition, message.offset, error);
        }
      }
    }
  }

  private async parseMessage(topic: string, message: KafkaMessage): Promise<CRMEvent> {
    let rawEvent: any;

    // Try to decode using schema registry first
    try {
      if (message.headers && message.headers['content-type'] === 'application/vnd.kafka.avro.v2+json') {
        rawEvent = await this.schemaRegistry.decode(message.value);
      } else {
        // Fallback to JSON parsing
        rawEvent = JSON.parse(message.value.toString());
      }
    } catch (error) {
      logger.error('Failed to decode message', { topic, error });
      throw new Error(`Message decoding failed: ${error}`);
    }

    // Validate required fields
    if (!rawEvent.eventId || !rawEvent.eventType || !rawEvent.organizationId) {
      throw new Error('Missing required fields: eventId, eventType, organizationId');
    }

    // Validate event type
    if (!Object.values(CRMEventType).includes(rawEvent.eventType)) {
      throw new Error(`Invalid event type: ${rawEvent.eventType}`);
    }

    return {
      id: uuidv4(),
      eventId: rawEvent.eventId,
      eventType: rawEvent.eventType,
      organizationId: rawEvent.organizationId,
      timestamp: new Date(rawEvent.timestamp || Date.now()),
      data: rawEvent.data,
      metadata: rawEvent.metadata,
    };
  }

  private async processCRMEvent(event: CRMEvent): Promise<void> {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');

      switch (event.eventType) {
        case CRMEventType.LEAD_CREATED:
        case CRMEventType.LEAD_UPDATED:
        case CRMEventType.LEAD_CONVERTED:
          await this.processLeadEvent(client, event);
          break;

        case CRMEventType.CONTACT_CREATED:
        case CRMEventType.CONTACT_UPDATED:
          await this.processContactEvent(client, event);
          break;

        case CRMEventType.OPPORTUNITY_CREATED:
        case CRMEventType.OPPORTUNITY_UPDATED:
        case CRMEventType.OPPORTUNITY_WON:
        case CRMEventType.OPPORTUNITY_LOST:
          await this.processOpportunityEvent(client, event);
          break;

        default:
          throw new Error(`Unsupported event type: ${event.eventType}`);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async processLeadEvent(client: any, event: CRMEvent): Promise<void> {
    const leadData = event.data as CRMLead;
    
    const query = `
      INSERT INTO analytics.crm_leads_staging (
        event_id, lead_id, first_name, last_name, email, phone, company,
        title, source, status, score, assigned_to, created_at, updated_at,
        organization_id, event_timestamp, event_type, metadata, ingestion_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19
      )
      ON CONFLICT (event_id) DO NOTHING
    `;

    const values = [
      event.eventId,
      leadData.id,
      leadData.firstName,
      leadData.lastName,
      leadData.email,
      leadData.phone,
      leadData.company,
      leadData.title,
      leadData.source,
      leadData.status,
      leadData.score,
      leadData.assignedTo,
      leadData.createdAt,
      leadData.updatedAt,
      event.organizationId,
      event.timestamp,
      event.eventType,
      JSON.stringify(event.metadata),
      this.ingestionId,
    ];

    await client.query(query, values);
  }

  private async processContactEvent(client: any, event: CRMEvent): Promise<void> {
    const contactData = event.data as CRMContact;
    
    const query = `
      INSERT INTO analytics.crm_contacts_staging (
        event_id, contact_id, first_name, last_name, email, phone, company,
        title, lead_id, created_at, updated_at, organization_id,
        event_timestamp, event_type, metadata, ingestion_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17
      )
      ON CONFLICT (event_id) DO NOTHING
    `;

    const values = [
      event.eventId,
      contactData.id,
      contactData.firstName,
      contactData.lastName,
      contactData.email,
      contactData.phone,
      contactData.company,
      contactData.title,
      contactData.leadId,
      contactData.createdAt,
      contactData.updatedAt,
      event.organizationId,
      event.timestamp,
      event.eventType,
      JSON.stringify(event.metadata),
      this.ingestionId,
    ];

    await client.query(query, values);
  }

  private async processOpportunityEvent(client: any, event: CRMEvent): Promise<void> {
    const opportunityData = event.data as CRMOpportunity;
    
    const query = `
      INSERT INTO analytics.crm_opportunities_staging (
        event_id, opportunity_id, name, lead_id, contact_id, amount,
        currency, stage, probability, expected_close_date, created_at,
        updated_at, organization_id, event_timestamp, event_type,
        metadata, ingestion_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16, $17
      )
      ON CONFLICT (event_id) DO NOTHING
    `;

    const values = [
      event.eventId,
      opportunityData.id,
      opportunityData.name,
      opportunityData.leadId,
      opportunityData.contactId,
      opportunityData.amount,
      opportunityData.currency,
      opportunityData.stage,
      opportunityData.probability,
      opportunityData.expectedCloseDate,
      opportunityData.createdAt,
      opportunityData.updatedAt,
      event.organizationId,
      event.timestamp,
      event.eventType,
      JSON.stringify(event.metadata),
      this.ingestionId,
    ];

    await client.query(query, values);
  }

  private async isEventProcessed(eventId: string): Promise<boolean> {
    const client = await db.getClient();
    
    try {
      const result = await client.query(
        'SELECT analytics.is_event_processed($1) as processed',
        [eventId]
      );
      
      return result.rows[0].processed;
    } finally {
      client.release();
    }
  }

  private async logEvent(
    event: CRMEvent,
    topic: string,
    partition: number,
    offset: string,
    status: 'processed' | 'failed' | 'skipped',
    error?: Error
  ): Promise<void> {
    const client = await db.getClient();
    
    try {
      const query = `
        INSERT INTO analytics.crm_events_log (
          event_id, event_type, topic, partition, offset, organization_id,
          event_timestamp, processing_status, error_message, metadata, ingestion_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
        )
        ON CONFLICT (event_id) DO UPDATE SET
          processing_status = EXCLUDED.processing_status,
          error_message = EXCLUDED.error_message,
          retry_count = crm_events_log.retry_count + 1
      `;

      const values = [
        event.eventId,
        event.eventType,
        topic,
        partition,
        parseInt(offset),
        event.organizationId,
        event.timestamp,
        status,
        error?.message,
        JSON.stringify(event.metadata),
        this.ingestionId,
      ];

      await client.query(query, values);
    } finally {
      client.release();
    }
  }

  private async logParseFailure(
    topic: string,
    partition: number,
    offset: string,
    error: Error
  ): Promise<void> {
    const client = await db.getClient();
    
    try {
      const query = `
        INSERT INTO analytics.crm_events_log (
          event_id, event_type, topic, partition, offset, organization_id,
          event_timestamp, processing_status, error_message, ingestion_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
        )
      `;

      const values = [
        `parse-failure-${topic}-${partition}-${offset}`,
        'parse_failure',
        topic,
        partition,
        parseInt(offset),
        'unknown',
        new Date(),
        'failed',
        error.message,
        this.ingestionId,
      ];

      await client.query(query, values);
    } finally {
      client.release();
    }
  }

  async getIngestionMetrics(): Promise<any> {
    const client = await db.getClient();
    
    try {
      const query = `
        SELECT 
          COUNT(*) as total_events,
          COUNT(CASE WHEN processing_status = 'processed' THEN 1 END) as processed_events,
          COUNT(CASE WHEN processing_status = 'failed' THEN 1 END) as failed_events,
          COUNT(CASE WHEN processing_status = 'skipped' THEN 1 END) as skipped_events,
          COUNT(DISTINCT organization_id) as unique_organizations,
          MIN(event_timestamp) as earliest_event,
          MAX(event_timestamp) as latest_event
        FROM analytics.crm_events_log
        WHERE ingestion_id = $1
      `;

      const result = await client.query(query, [this.ingestionId]);
      return result.rows[0];
    } finally {
      client.release();
    }
  }
}

export const crmIngestionService = new CRMIngestionService();