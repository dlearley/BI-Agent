-- Create CRM tables for analytics warehouse

-- Accounts table (companies/organizations that are customers or prospects)
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    industry VARCHAR(100),
    company_size VARCHAR(50),
    annual_revenue DECIMAL(15,2),
    website VARCHAR(255),
    phone VARCHAR(50),
    billing_address TEXT,
    shipping_address TEXT,
    account_owner VARCHAR(255),
    account_status VARCHAR(50) DEFAULT 'active' CHECK (account_status IN ('active', 'inactive', 'prospect', 'customer', 'churned')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, name)
);

-- Contacts table (individuals associated with accounts)
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    job_title VARCHAR(100),
    department VARCHAR(100),
    is_primary BOOLEAN DEFAULT FALSE,
    contact_status VARCHAR(50) DEFAULT 'active' CHECK (contact_status IN ('active', 'inactive', 'unsubscribed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, email)
);

-- Deals table (sales opportunities)
CREATE TABLE IF NOT EXISTS deals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    amount DECIMAL(12,2) NOT NULL CHECK (amount >= 0),
    stage VARCHAR(50) NOT NULL CHECK (stage IN ('prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost')),
    probability INTEGER CHECK (probability >= 0 AND probability <= 100),
    expected_close_date DATE,
    actual_close_date DATE,
    deal_owner VARCHAR(255),
    lead_source VARCHAR(100),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Deal stage history table (for SCD Type 2 tracking)
CREATE TABLE IF NOT EXISTS deal_stage_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    stage VARCHAR(50) NOT NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    changed_by VARCHAR(255),
    days_in_stage INTEGER,
    previous_stage VARCHAR(50),
    notes TEXT
);

-- Activities table (calls, emails, meetings)
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
    activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN ('call', 'email', 'meeting', 'note', 'task')),
    subject VARCHAR(255),
    description TEXT,
    activity_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    duration_minutes INTEGER,
    outcome VARCHAR(100),
    assigned_to VARCHAR(255),
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Support tickets table
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    ticket_number VARCHAR(50) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(50) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting', 'resolved', 'closed')),
    category VARCHAR(100),
    assigned_to VARCHAR(255),
    resolution TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    closed_at TIMESTAMP,
    UNIQUE(organization_id, ticket_number)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_accounts_org_id ON accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(account_status);
CREATE INDEX IF NOT EXISTS idx_accounts_owner ON accounts(account_owner);

CREATE INDEX IF NOT EXISTS idx_contacts_org_id ON contacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_contacts_account_id ON contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(contact_status);

CREATE INDEX IF NOT EXISTS idx_deals_org_id ON deals(organization_id);
CREATE INDEX IF NOT EXISTS idx_deals_account_id ON deals(account_id);
CREATE INDEX IF NOT EXISTS idx_deals_contact_id ON deals(contact_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_owner ON deals(deal_owner);
CREATE INDEX IF NOT EXISTS idx_deals_close_date ON deals(expected_close_date);
CREATE INDEX IF NOT EXISTS idx_deals_created_at ON deals(created_at);

CREATE INDEX IF NOT EXISTS idx_deal_stage_history_deal_id ON deal_stage_history(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_stage_history_changed_at ON deal_stage_history(changed_at);

CREATE INDEX IF NOT EXISTS idx_activities_org_id ON activities(organization_id);
CREATE INDEX IF NOT EXISTS idx_activities_account_id ON activities(account_id);
CREATE INDEX IF NOT EXISTS idx_activities_contact_id ON activities(contact_id);
CREATE INDEX IF NOT EXISTS idx_activities_deal_id ON activities(deal_id);
CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(activity_type);
CREATE INDEX IF NOT EXISTS idx_activities_date ON activities(activity_date);
CREATE INDEX IF NOT EXISTS idx_activities_assigned ON activities(assigned_to);

CREATE INDEX IF NOT EXISTS idx_tickets_org_id ON tickets(organization_id);
CREATE INDEX IF NOT EXISTS idx_tickets_account_id ON tickets(account_id);
CREATE INDEX IF NOT EXISTS idx_tickets_contact_id ON tickets(contact_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at);
