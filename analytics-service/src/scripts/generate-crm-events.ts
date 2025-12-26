import { crmIngestionService } from '../services/crm-ingestion.service';
import { CRMEventType, CRMLead, CRMContact, CRMOpportunity } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface SampleCRMEvent {
  eventId: string;
  eventType: CRMEventType;
  organizationId: string;
  timestamp: Date;
  data: CRMLead | CRMContact | CRMOpportunity;
  metadata?: {
    source: string;
    version: string;
    correlationId?: string;
  };
}

export class CRMEventGenerator {
  private organizations = ['org-001', 'org-002', 'org-003'];
  private sources = ['website', 'referral', 'cold_call', 'email_campaign', 'social_media'];
  private statuses = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
  private stages = ['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];

  generateSampleEvents(count: number = 10): SampleCRMEvent[] {
    const events: SampleCRMEvent[] = [];

    for (let i = 0; i < count; i++) {
      const organizationId = this.organizations[Math.floor(Math.random() * this.organizations.length)];
      const eventTypes = Object.values(CRMEventType);
      const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];

      let data: CRMLead | CRMContact | CRMOpportunity;

      switch (eventType) {
        case CRMEventType.LEAD_CREATED:
        case CRMEventType.LEAD_UPDATED:
        case CRMEventType.LEAD_CONVERTED:
          data = this.generateSampleLead();
          break;

        case CRMEventType.CONTACT_CREATED:
        case CRMEventType.CONTACT_UPDATED:
          data = this.generateSampleContact();
          break;

        case CRMEventType.OPPORTUNITY_CREATED:
        case CRMEventType.OPPORTUNITY_UPDATED:
        case CRMEventType.OPPORTUNITY_WON:
        case CRMEventType.OPPORTUNITY_LOST:
          data = this.generateSampleOpportunity();
          break;

        default:
          continue; // Skip unknown event types
      }

      const event: SampleCRMEvent = {
        eventId: uuidv4(),
        eventType,
        organizationId,
        timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Random time in last week
        data,
        metadata: {
          source: 'sample_generator',
          version: '1.0',
          correlationId: uuidv4(),
        },
      };

      events.push(event);
    }

    return events;
  }

  private generateSampleLead(): CRMLead {
    const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Lisa'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];
    const companies = ['Acme Corp', 'Tech Solutions', 'Global Industries', 'Innovation Labs', 'Enterprise Co'];
    const titles = ['CEO', 'CTO', 'Engineering Manager', 'Product Manager', 'Sales Director', 'Marketing Lead'];

    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];

    return {
      id: uuidv4(),
      firstName,
      lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
      phone: `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`,
      company: companies[Math.floor(Math.random() * companies.length)],
      title: titles[Math.floor(Math.random() * titles.length)],
      source: this.sources[Math.floor(Math.random() * this.sources.length)],
      status: this.statuses[Math.floor(Math.random() * this.statuses.length)],
      score: Math.floor(Math.random() * 100),
      assignedTo: `user-${Math.floor(Math.random() * 10) + 1}`,
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
      organizationId: '',
    };
  }

  private generateSampleContact(): CRMContact {
    const firstNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Edward', 'Fiona', 'George', 'Helen'];
    const lastNames = ['Anderson', 'Taylor', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin', 'Thompson'];
    const companies = ['Startup Inc', 'Digital Agency', 'Consulting Firm', 'Software House', 'Marketing Agency'];
    const titles = ['VP Engineering', 'Sales Manager', 'Business Analyst', 'Project Manager', 'Director'];

    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];

    return {
      id: uuidv4(),
      firstName,
      lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@company.com`,
      phone: `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`,
      company: companies[Math.floor(Math.random() * companies.length)],
      title: titles[Math.floor(Math.random() * titles.length)],
      leadId: Math.random() > 0.5 ? uuidv4() : undefined,
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
      organizationId: '',
    };
  }

  private generateSampleOpportunity(): CRMOpportunity {
    const opportunityNames = [
      'Enterprise Software Deal',
      'Cloud Migration Project',
      'Digital Transformation Initiative',
      'Data Analytics Platform',
      'Mobile App Development',
      'AI Implementation',
      'Security Audit Contract',
      'Infrastructure Upgrade',
    ];

    const currencies = ['USD', 'EUR', 'GBP'];

    return {
      id: uuidv4(),
      name: opportunityNames[Math.floor(Math.random() * opportunityNames.length)],
      leadId: Math.random() > 0.5 ? uuidv4() : undefined,
      contactId: Math.random() > 0.5 ? uuidv4() : undefined,
      amount: Math.floor(Math.random() * 500000) + 10000,
      currency: currencies[Math.floor(Math.random() * currencies.length)],
      stage: this.stages[Math.floor(Math.random() * this.stages.length)],
      probability: Math.floor(Math.random() * 100),
      expectedCloseDate: new Date(Date.now() + Math.random() * 180 * 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
      organizationId: '',
    };
  }

  async simulateKafkaMessages(events: SampleCRMEvent[]): Promise<void> {
    console.log(`Simulating ${events.length} CRM events...`);

    for (const event of events) {
      try {
        // Simulate processing by calling the ingestion service directly
        // In a real scenario, these would be published to Kafka topics
        console.log(`Processing event: ${event.eventType} for organization: ${event.organizationId}`);
        
        // Log the event for demonstration
        console.log({
          eventId: event.eventId,
          eventType: event.eventType,
          organizationId: event.organizationId,
          timestamp: event.timestamp,
          data: {
            id: event.data.id,
            name: 'name' in event.data ? event.data.name : `${event.data.firstName} ${event.data.lastName}`,
            email: event.data.email,
          },
        });

        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 400));
      } catch (error) {
        console.error(`Failed to process event ${event.eventId}:`, error);
      }
    }

    console.log('Finished simulating CRM events');
  }
}

// CLI function to generate and simulate events
export async function generateAndSimulateCRMEvents(count: number = 10): Promise<void> {
  const generator = new CRMEventGenerator();
  const events = generator.generateSampleEvents(count);
  
  console.log(`Generated ${events.length} sample CRM events:`);
  
  // Group events by type for summary
  const eventsByType = events.reduce((acc, event) => {
    acc[event.eventType] = (acc[event.eventType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('Event types breakdown:');
  Object.entries(eventsByType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  // Group by organization
  const eventsByOrg = events.reduce((acc, event) => {
    acc[event.organizationId] = (acc[event.organizationId] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('Events by organization:');
  Object.entries(eventsByOrg).forEach(([org, count]) => {
    console.log(`  ${org}: ${count}`);
  });

  // Simulate processing
  await generator.simulateKafkaMessages(events);
}

// Run if called directly
if (require.main === module) {
  const count = parseInt(process.argv[2]) || 10;
  generateAndSimulateCRMEvents(count)
    .then(() => {
      console.log('CRM event simulation completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('CRM event simulation failed:', error);
      process.exit(1);
    });
}