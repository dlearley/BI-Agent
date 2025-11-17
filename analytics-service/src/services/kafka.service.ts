import { Kafka, Producer, Consumer, KafkaMessage } from 'kafkajs';
import { redis } from '../config/redis';
import { db } from '../config/database';
import { 
  KafkaMessage as IKafkaMessage, 
  CacheInvalidationMessage, 
  ExportNotificationMessage 
} from '../types';
import config from '../config';

export class KafkaService {
  private kafka: Kafka;
  private producer: Producer;
  private consumer: Consumer;
  private isConnected: boolean = false;

  constructor() {
    this.kafka = new Kafka({
      clientId: 'analytics-service',
      brokers: config.kafka?.brokers || ['localhost:9092'],
      ssl: config.kafka?.ssl || false,
      sasl: config.kafka?.sasl ? config.kafka.sasl.mechanism as any : undefined,
      connectionTimeout: 10000,
      requestTimeout: 30000,
    });

    this.producer = this.kafka.producer({
      maxInFlightRequests: 1,
      idempotent: true,
      transactionTimeout: 30000,
    });

    this.consumer = this.kafka.consumer({
      groupId: 'analytics-service-group',
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });
  }

  async connect(): Promise<void> {
    try {
      await this.producer.connect();
      await this.consumer.connect();
      this.isConnected = true;
      console.log('✅ Kafka connected successfully');
    } catch (error) {
      console.error('❌ Failed to connect to Kafka:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.producer.disconnect();
      await this.consumer.disconnect();
      this.isConnected = false;
      console.log('✅ Kafka disconnected successfully');
    } catch (error) {
      console.error('❌ Failed to disconnect from Kafka:', error);
      throw error;
    }
  }

  async publishCacheInvalidation(message: CacheInvalidationMessage): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const kafkaMessage: IKafkaMessage = {
        topic: 'analytics-cache-invalidation',
        key: message.cacheKey,
        value: message,
        timestamp: Date.now(),
      };

      await this.producer.send({
        topic: kafkaMessage.topic,
        messages: [{
          key: kafkaMessage.key,
          value: JSON.stringify(kafkaMessage.value),
          timestamp: kafkaMessage.timestamp?.toString(),
        }],
      });

      // Log the invalidation
      await this.logCacheInvalidation(message);

      console.log(`📤 Published cache invalidation for key: ${message.cacheKey}`);
    } catch (error) {
      console.error('❌ Failed to publish cache invalidation:', error);
      throw error;
    }
  }

  async publishExportNotification(message: ExportNotificationMessage): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      const kafkaMessage: IKafkaMessage = {
        topic: 'export-notifications',
        key: message.jobId,
        value: message,
        timestamp: Date.now(),
      };

      await this.producer.send({
        topic: kafkaMessage.topic,
        messages: [{
          key: kafkaMessage.key,
          value: JSON.stringify(kafkaMessage.value),
          timestamp: kafkaMessage.timestamp?.toString(),
        }],
      });

      console.log(`📤 Published export notification for job: ${message.jobId}`);
    } catch (error) {
      console.error('❌ Failed to publish export notification:', error);
      throw error;
    }
  }

  async subscribeToCacheInvalidation(): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }

    try {
      await this.consumer.subscribe({
        topic: 'analytics-cache-invalidation',
        fromBeginning: false,
      });

      await this.consumer.run({
        eachMessage: async ({ message }) => {
          await this.handleCacheInvalidation(message);
        },
      });

      console.log('🔔 Subscribed to cache invalidation topic');
    } catch (error) {
      console.error('❌ Failed to subscribe to cache invalidation:', error);
      throw error;
    }
  }

  private async handleCacheInvalidation(message: KafkaMessage): Promise<void> {
    try {
      const invalidationMessage = JSON.parse(message.value?.toString() || '{}') as CacheInvalidationMessage;
      
      // Invalidate Redis cache
      await redis.del(invalidationMessage.cacheKey);

      // Invalidate related cache keys (patterns)
      const relatedKeys = await this.getRelatedCacheKeys(invalidationMessage.cacheKey);
      if (relatedKeys.length > 0) {
        await Promise.all(relatedKeys.map(key => redis.del(key)));
      }

      console.log(`🗑️ Invalidated cache key: ${invalidationMessage.cacheKey}`);
    } catch (error) {
      console.error('❌ Failed to handle cache invalidation:', error);
    }
  }

  private async getRelatedCacheKeys(pattern: string): Promise<string[]> {
    try {
      // Extract base pattern from the key
      const basePattern = pattern.replace(/:[^:]*$/, '');
      const searchPattern = `${basePattern}:*`;
      
      const keys = await redis.getClient().keys(searchPattern);
      return keys.filter(key => key !== pattern);
    } catch (error) {
      console.error('❌ Failed to get related cache keys:', error);
      return [];
    }
  }

  private async logCacheInvalidation(message: CacheInvalidationMessage): Promise<void> {
    try {
      const query = `
        INSERT INTO cache_invalidation_log (topic_name, cache_key, invalidation_reason, triggered_by)
        VALUES ($1, $2, $3, $4)
      `;

      await db.query(query, [
        'analytics-cache-invalidation',
        message.cacheKey,
        message.reason,
        message.triggeredBy,
      ]);
    } catch (error) {
      console.error('❌ Failed to log cache invalidation:', error);
    }
  }

  async invalidateCacheByPattern(pattern: string, reason: string, triggeredBy: string): Promise<void> {
    try {
      const keys = await redis.getClient().keys(pattern);
      
      for (const key of keys) {
        const invalidationMessage: CacheInvalidationMessage = {
          cacheKey: key,
          reason,
          triggeredBy,
          timestamp: new Date().toISOString(),
        };

        await this.publishCacheInvalidation(invalidationMessage);
      }

      console.log(`🗑️ Invalidated ${keys.length} cache keys matching pattern: ${pattern}`);
    } catch (error) {
      console.error('❌ Failed to invalidate cache by pattern:', error);
      throw error;
    }
  }

  async getKafkaTopics(): Promise<any[]> {
    try {
      const admin = this.kafka.admin();
      await admin.connect();
      
      const topics = await admin.listTopics();
      const metadata = await admin.fetchTopicMetadata({ topics });
      
      await admin.disconnect();

      return metadata.topics.map(topic => ({
        name: topic.name,
        partitions: topic.partitions.length,
        replicationFactor: topic.partitions[0]?.replicas.length || 0,
      }));
    } catch (error) {
      console.error('❌ Failed to get Kafka topics:', error);
      return [];
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.isConnected) {
        return false;
      }

      const admin = this.kafka.admin();
      await admin.connect();
      const clusterMetadata = await admin.describeCluster();
      await admin.disconnect();

      return clusterMetadata.brokers.length > 0;
    } catch (error) {
      console.error('❌ Kafka health check failed:', error);
      return false;
    }
  }
}

export const kafkaService = new KafkaService();
export default kafkaService;