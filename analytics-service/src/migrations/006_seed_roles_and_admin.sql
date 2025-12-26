-- Insert system roles
INSERT INTO roles (id, name, level, permissions, description, is_system)
VALUES 
  ('550e8400-e29b-41d4-a716-446655440001', 'org_admin', 'org', 
   '["org:create","org:read","org:update","org:delete","org:manage_members","workspace:create"]',
   'Organization administrator with full control', true),
  
  ('550e8400-e29b-41d4-a716-446655440002', 'org_member', 'org',
   '["org:read","workspace:read","team:read"]',
   'Regular organization member', true),
  
  ('550e8400-e29b-41d4-a716-446655440003', 'workspace_admin', 'workspace',
   '["workspace:read","workspace:update","workspace:manage_members","team:create","team:read"]',
   'Workspace administrator', true),
  
  ('550e8400-e29b-41d4-a716-446655440004', 'workspace_member', 'workspace',
   '["workspace:read","team:read"]',
   'Regular workspace member', true),
  
  ('550e8400-e29b-41d4-a716-446655440005', 'team_admin', 'team',
   '["team:read","team:update","team:manage_members"]',
   'Team administrator', true),
  
  ('550e8400-e29b-41d4-a716-446655440006', 'team_member', 'team',
   '["team:read"]',
   'Regular team member', true),
  
  ('550e8400-e29b-41d4-a716-446655440007', 'global_admin', 'global',
   '["*"]',
   'Global system administrator with all permissions', true)
ON CONFLICT (name, level) DO NOTHING;

-- Create default admin user if not exists
INSERT INTO users (id, email, password_hash, first_name, last_name, status, is_admin, created_at)
VALUES (
  '550e8400-e29b-41d4-a716-446655440000',
  'admin@example.com',
  '$2a$10$ZCPQ8dN1GbPgwp9Yk6G9V.Z6X2S5T4U3V2W1X0Y9Z8A7B6C5D4E3F2G1H0I9',
  'Admin',
  'User',
  'active',
  true,
  CURRENT_TIMESTAMP
)
ON CONFLICT (email) DO NOTHING;
