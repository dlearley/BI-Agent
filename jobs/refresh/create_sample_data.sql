-- Sample data for testing the analytics backend
-- This script creates sample tables and data to demonstrate the analytics views

-- Create sample tables (if they don't exist)
CREATE TABLE IF NOT EXISTS facilities (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100),
    location VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id VARCHAR(50) NOT NULL REFERENCES facilities(id),
    candidate_id UUID NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'interview', 'hired', 'rejected')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    hired_at TIMESTAMP,
    compliance_score INTEGER CHECK (compliance_score >= 0 AND compliance_score <= 100),
    has_violations BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id VARCHAR(50) NOT NULL REFERENCES facilities(id),
    application_id UUID REFERENCES applications(id),
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'paid', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS outreach (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id VARCHAR(50) NOT NULL REFERENCES facilities(id),
    candidate_id UUID NOT NULL,
    channel VARCHAR(100) NOT NULL CHECK (channel IN ('email', 'phone', 'social', 'referral', 'job_board')),
    message TEXT,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    response_received BOOLEAN DEFAULT FALSE,
    responded_at TIMESTAMP,
    converted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample facilities
INSERT INTO facilities (id, name, type, location) VALUES
('facility-1', 'General Hospital', 'Hospital', 'New York, NY'),
('facility-2', 'Specialty Clinic', 'Clinic', 'Boston, MA'),
('facility-3', 'Rehab Center', 'Rehabilitation', 'Philadelphia, PA')
ON CONFLICT (id) DO NOTHING;

-- Insert sample applications
INSERT INTO applications (facility_id, candidate_id, status, created_at, hired_at, compliance_score, has_violations) VALUES
-- Facility 1 - Recent applications
('facility-1', gen_random_uuid(), 'hired', '2023-10-15 09:00:00', '2023-10-30 14:30:00', 95, FALSE),
('facility-1', gen_random_uuid(), 'hired', '2023-10-20 11:00:00', '2023-11-05 16:45:00', 88, TRUE),
('facility-1', gen_random_uuid(), 'pending', '2023-11-01 10:30:00', NULL, 75, FALSE),
('facility-1', gen_random_uuid(), 'interview', '2023-11-05 14:00:00', NULL, 82, FALSE),
('facility-1', gen_random_uuid(), 'rejected', '2023-10-25 13:15:00', NULL, 65, TRUE),
('facility-1', gen_random_uuid(), 'hired', '2023-10-10 08:45:00', '2023-10-25 12:00:00', 92, FALSE),

-- Facility 2 - Recent applications
('facility-2', gen_random_uuid(), 'hired', '2023-10-12 10:00:00', '2023-10-28 15:30:00', 90, FALSE),
('facility-2', gen_random_uuid(), 'hired', '2023-10-18 14:30:00', '2023-11-02 11:00:00', 85, TRUE),
('facility-2', gen_random_uuid(), 'pending', '2023-11-02 09:15:00', NULL, 78, FALSE),
('facility-2', gen_random_uuid(), 'interview', '2023-11-06 13:45:00', NULL, 88, FALSE),
('facility-2', gen_random_uuid(), 'rejected', '2023-10-22 16:00:00', NULL, 70, FALSE),

-- Facility 3 - Recent applications
('facility-3', gen_random_uuid(), 'hired', '2023-10-08 11:30:00', '2023-10-24 10:15:00', 93, FALSE),
('facility-3', gen_random_uuid(), 'pending', '2023-11-03 15:45:00', NULL, 80, FALSE),
('facility-3', gen_random_uuid(), 'interview', '2023-11-07 09:30:00', NULL, 86, FALSE)

ON CONFLICT DO NOTHING;

-- Insert sample invoices
INSERT INTO invoices (facility_id, application_id, amount, status, created_at, paid_at) VALUES
-- Facility 1 invoices
('facility-1', (SELECT id FROM applications WHERE facility_id = 'facility-1' LIMIT 1), 5000.00, 'paid', '2023-10-30 14:30:00', '2023-10-30 14:30:00'),
('facility-1', (SELECT id FROM applications WHERE facility_id = 'facility-1' LIMIT 1 OFFSET 1), 5200.00, 'paid', '2023-11-05 16:45:00', '2023-11-05 16:45:00'),
('facility-1', (SELECT id FROM applications WHERE facility_id = 'facility-1' LIMIT 1 OFFSET 5), 4800.00, 'paid', '2023-10-25 12:00:00', '2023-10-25 12:00:00'),

-- Facility 2 invoices
('facility-2', (SELECT id FROM applications WHERE facility_id = 'facility-2' LIMIT 1), 5500.00, 'paid', '2023-10-28 15:30:00', '2023-10-28 15:30:00'),
('facility-2', (SELECT id FROM applications WHERE facility_id = 'facility-2' LIMIT 1 OFFSET 1), 5300.00, 'paid', '2023-11-02 11:00:00', '2023-11-02 11:00:00'),

-- Facility 3 invoices
('facility-3', (SELECT id FROM applications WHERE facility_id = 'facility-3' LIMIT 1), 4900.00, 'paid', '2023-10-24 10:15:00', '2023-10-24 10:15:00')

ON CONFLICT DO NOTHING;

-- Insert sample outreach records
INSERT INTO outreach (facility_id, candidate_id, channel, message, sent_at, response_received, responded_at, converted) VALUES
-- Facility 1 outreach
('facility-1', gen_random_uuid(), 'email', 'We have a great opportunity for you...', '2023-10-01 09:00:00', TRUE, '2023-10-02 14:30:00', TRUE),
('facility-1', gen_random_uuid(), 'phone', 'Following up on your application...', '2023-10-03 11:00:00', TRUE, '2023-10-03 11:15:00', FALSE),
('facility-1', gen_random_uuid(), 'social', 'Check out our latest job posting...', '2023-10-05 16:00:00', FALSE, NULL, FALSE),
('facility-1', gen_random_uuid(), 'email', 'Application status update...', '2023-10-08 10:30:00', TRUE, '2023-10-08 15:45:00', TRUE),
('facility-1', gen_random_uuid(), 'job_board', 'New position available...', '2023-10-10 08:00:00', TRUE, '2023-10-11 09:30:00', TRUE),

-- Facility 2 outreach
('facility-2', gen_random_uuid(), 'email', 'Exciting career opportunity...', '2023-10-02 13:00:00', TRUE, '2023-10-03 10:15:00', TRUE),
('facility-2', gen_random_uuid(), 'phone', 'Schedule for interview...', '2023-10-04 14:30:00', TRUE, '2023-10-04 14:35:00', TRUE),
('facility-2', gen_random_uuid(), 'referral', 'Employee referral program...', '2023-10-06 09:00:00', TRUE, '2023-10-07 11:20:00', FALSE),

-- Facility 3 outreach
('facility-3', gen_random_uuid(), 'email', 'Join our team...', '2023-10-01 15:00:00', TRUE, '2023-10-02 16:45:00', TRUE),
('facility-3', gen_random_uuid(), 'social', 'Career fair invitation...', '2023-10-04 12:00:00', FALSE, NULL, FALSE)

ON CONFLICT DO NOTHING;

-- Update statistics for better query performance
ANALYZE facilities;
ANALYZE applications;
ANALYZE invoices;
ANALYZE outreach;

-- Verify sample data was created
SELECT 'facilities' as table_name, COUNT(*) as record_count FROM facilities
UNION ALL
SELECT 'applications', COUNT(*) FROM applications
UNION ALL
SELECT 'invoices', COUNT(*) FROM invoices
UNION ALL
SELECT 'outreach', COUNT(*) FROM outreach;