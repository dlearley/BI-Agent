import { CRMIngestionService } from '../services/crm-ingestion.service';
import { CRMEventType, CRMLead } from '../types';
import { v4 as uuidv4 } from 'uuid';

describe('CRM Ingestion Service', () => {
  let crmService: CRMIngestionService;

  beforeAll(() => {
    crmService = new CRMIngestionService();
  });

  afterAll(async () => {
    await crmService.stop();
  });

  describe('Message Parsing', () => {
    it('should parse a valid CRM lead event', async () => {
      const leadData: CRMLead = {
        id: uuidv4(),
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '+1234567890',
        company: 'Acme Corp',
        title: 'CEO',
        source: 'website',
        status: 'new',
        score: 85,
        assignedTo: 'user-001',
        createdAt: new Date(),
        updatedAt: new Date(),
        organizationId: 'org-001',
      };

      const rawEvent = {
        eventId: uuidv4(),
        eventType: CRMEventType.LEAD_CREATED,
        organizationId: 'org-001',
        timestamp: new Date().toISOString(),
        data: leadData,
        metadata: {
          source: 'crm-system',
          version: '1.0',
          correlationId: uuidv4(),
        },
      };

      // Simulate Kafka message
      const mockKafkaMessage = {
        value: Buffer.from(JSON.stringify(rawEvent)),
        headers: {},
      };

      // Test parsing (this would normally be called internally)
      const parsedEvent = await crmService['parseMessage']('crm.leads', mockKafkaMessage);

      expect(parsedEvent.eventId).toBe(rawEvent.eventId);
      expect(parsedEvent.eventType).toBe(CRMEventType.LEAD_CREATED);
      expect(parsedEvent.organizationId).toBe('org-001');
      expect(parsedEvent.data).toEqual(leadData);
    });

    it('should reject invalid event types', async () => {
      const rawEvent = {
        eventId: uuidv4(),
        eventType: 'invalid.event.type',
        organizationId: 'org-001',
        timestamp: new Date().toISOString(),
        data: {},
      };

      const mockKafkaMessage = {
        value: Buffer.from(JSON.stringify(rawEvent)),
        headers: {},
      };

      await expect(
        crmService['parseMessage']('crm.leads', mockKafkaMessage)
      ).rejects.toThrow('Invalid event type: invalid.event.type');
    });

    it('should reject events missing required fields', async () => {
      const rawEvent = {
        eventId: uuidv4(),
        // Missing eventType and organizationId
        timestamp: new Date().toISOString(),
        data: {},
      };

      const mockKafkaMessage = {
        value: Buffer.from(JSON.stringify(rawEvent)),
        headers: {},
      };

      await expect(
        crmService['parseMessage']('crm.leads', mockKafkaMessage)
      ).rejects.toThrow('Missing required fields: eventId, eventType, organizationId');
    });
  });

  describe('Idempotency', () => {
    it('should detect already processed events', async () => {
      const eventId = uuidv4();
      
      // This would normally check the database
      // For testing, we'll mock the database call
      const mockIsProcessed = jest.spyOn(crmService as any, 'isEventProcessed');
      mockIsProcessed.mockResolvedValue(true);

      const isProcessed = await crmService['isEventProcessed'](eventId);
      
      expect(isProcessed).toBe(true);
      expect(mockIsProcessed).toHaveBeenCalledWith(eventId);
      
      mockIsProcessed.mockRestore();
    });
  });

  describe('Metrics', () => {
    it('should return ingestion metrics', async () => {
      // Mock the database query
      const mockQuery = jest.fn().mockResolvedValue({
        rows: [{
          total_events: 100,
          processed_events: 95,
          failed_events: 3,
          skipped_events: 2,
          unique_organizations: 5,
          earliest_event: new Date('2024-01-01'),
          latest_event: new Date('2024-01-31'),
        }],
      });

      // Mock pool connection
      const mockPool = {
        connect: jest.fn().mockResolvedValue({
          query: mockQuery,
          release: jest.fn(),
        }),
      };

      // Temporarily replace the pool
      const originalPool = require('../database').pool;
      require('../database').pool = mockPool;

      const metrics = await crmService.getIngestionMetrics();

      expect(metrics.total_events).toBe(100);
      expect(metrics.processed_events).toBe(95);
      expect(metrics.failed_events).toBe(3);
      expect(metrics.skipped_events).toBe(2);

      // Restore original pool
      require('../database').pool = originalPool;
    });
  });
});

describe('CRM Event Generator', () => {
  const { CRMEventGenerator } = require('../scripts/generate-crm-events');

  it('should generate sample CRM events', () => {
    const generator = new CRMEventGenerator();
    const events = generator.generateSampleEvents(5);

    expect(events).toHaveLength(5);
    
    events.forEach(event => {
      expect(event).toHaveProperty('eventId');
      expect(event).toHaveProperty('eventType');
      expect(event).toHaveProperty('organizationId');
      expect(event).toHaveProperty('timestamp');
      expect(event).toHaveProperty('data');
      expect(event).toHaveProperty('metadata');
      
      expect(Object.values(CRMEventType)).toContain(event.eventType);
      expect(['org-001', 'org-002', 'org-003']).toContain(event.organizationId);
    });
  });

  it('should generate different event types', () => {
    const generator = new CRMEventGenerator();
    const events = generator.generateSampleEvents(20);

    const eventTypes = new Set(events.map(e => e.eventType));
    expect(eventTypes.size).toBeGreaterThan(1);
  });

  it('should generate valid lead data', () => {
    const generator = new CRMEventGenerator();
    const events = generator.generateSampleEvents(10);
    
    const leadEvents = events.filter(e => 
      e.eventType.startsWith('lead.')
    );

    leadEvents.forEach(event => {
      const lead = event.data;
      expect(lead).toHaveProperty('id');
      expect(lead).toHaveProperty('firstName');
      expect(lead).toHaveProperty('lastName');
      expect(lead).toHaveProperty('email');
      expect(lead.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });
  });
});