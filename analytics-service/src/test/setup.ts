// Mock data for testing
export const mockAdminUser = {
  id: 'admin-1',
  email: 'admin@test.com',
  role: 'admin' as const,
  permissions: ['view_analytics', 'view_facility_analytics', 'manage_analytics', 'view_pii'],
};

export const mockRecruiterUser = {
  id: 'recruiter-1',
  email: 'recruiter@test.com',
  role: 'recruiter' as const,
  facilityId: 'facility-1',
  permissions: ['view_facility_analytics'],
};

export const mockViewerUser = {
  id: 'viewer-1',
  email: 'viewer@test.com',
  role: 'viewer' as const,
  permissions: ['view_analytics'],
};

// Mock analytics data
export const mockPipelineKPIs = [
  {
    facility_id: 'facility-1',
    total_applications: 100,
    hired_count: 25,
    rejected_count: 50,
    pending_count: 20,
    interview_count: 5,
    avg_time_to_fill_days: 15.5,
  },
  {
    facility_id: 'facility-2',
    total_applications: 150,
    hired_count: 40,
    rejected_count: 70,
    pending_count: 30,
    interview_count: 10,
    avg_time_to_fill_days: 12.3,
  },
];

export const mockComplianceMetrics = [
  {
    facility_id: 'facility-1',
    total_applications: 100,
    compliant_applications: 85,
    compliance_rate: 85.0,
    violations: [
      { type: 'documentation_missing', count: 3, severity: 'medium' },
      { type: 'timeline_exceeded', count: 1, severity: 'low' },
    ],
  },
];

export const mockRevenueMetrics = {
  totalRevenue: 250000,
  averageRevenuePerPlacement: 5000,
  revenueByFacility: [
    { facilityId: 'facility-1', facilityName: 'Facility 1', revenue: 125000 },
    { facilityId: 'facility-2', facilityName: 'Facility 2', revenue: 125000 },
  ],
  revenueByMonth: [
    { month: '2023-10-01', revenue: 100000 },
    { month: '2023-11-01', revenue: 150000 },
  ],
};

export const mockOutreachMetrics = {
  totalOutreach: 500,
  responseRate: 30.0,
  conversionRate: 5.0,
  effectiveChannels: [
    { channel: 'email', outreach: 200, responses: 80, conversions: 10 },
    { channel: 'phone', outreach: 150, responses: 45, conversions: 8 },
    { channel: 'social', outreach: 150, responses: 25, conversions: 7 },
  ],
};

// Mock environment setup for tests
export const setupTestEnvironment = () => {
  process.env.HIPAA_MODE = 'true';
  process.env.HIPAA_MIN_THRESHOLD = '5';
};

export const cleanupTestEnvironment = () => {
  delete process.env.HIPAA_MODE;
  delete process.env.HIPAA_MIN_THRESHOLD;
};