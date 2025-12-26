import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000/api/v1';
const TEST_EMAIL = `e2e-${Date.now()}@example.com`;
const TEST_PASSWORD = 'E2ETestPassword123!';

test.describe('Auth Flow E2E', () => {
  let accessToken: string;
  let refreshToken: string;

  test('should complete full auth flow', async () => {
    // Register new user
    const registerResponse = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        firstName: 'E2E',
        lastName: 'Test',
      }),
    });

    expect(registerResponse.status).toBe(201);
    const registerData = await registerResponse.json();
    expect(registerData).toHaveProperty('id');
    expect(registerData).toHaveProperty('email', TEST_EMAIL);

    // Login with credentials
    const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      }),
    });

    expect(loginResponse.status).toBe(200);
    const loginData = await loginResponse.json();
    expect(loginData).toHaveProperty('accessToken');
    expect(loginData).toHaveProperty('refreshToken');
    expect(loginData.user).toHaveProperty('email', TEST_EMAIL);

    accessToken = loginData.accessToken;
    refreshToken = loginData.refreshToken;

    // Get current user
    const meResponse = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(meResponse.status).toBe(200);
    const meData = await meResponse.json();
    expect(meData).toHaveProperty('email', TEST_EMAIL);

    // Refresh token
    const refreshResponse = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    expect(refreshResponse.status).toBe(200);
    const refreshData = await refreshResponse.json();
    expect(refreshData).toHaveProperty('accessToken');
    accessToken = refreshData.accessToken;

    // Create API key
    const apiKeyResponse = await fetch(`${BASE_URL}/auth/api-keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ name: 'E2E Test Key' }),
    });

    expect(apiKeyResponse.status).toBe(201);
    const apiKeyData = await apiKeyResponse.json();
    expect(apiKeyData).toHaveProperty('apiKey');
    expect(apiKeyData.apiKey).toMatch(/^sk_/);

    // Logout
    const logoutResponse = await fetch(`${BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(logoutResponse.status).toBe(200);
  });

  test('should enforce RBAC on protected endpoints', async () => {
    // Try to access protected endpoint without token
    const response = await fetch(`${BASE_URL}/orgs`);
    expect(response.status).toBe(401);

    // Try with invalid token
    const invalidTokenResponse = await fetch(`${BASE_URL}/orgs`, {
      headers: { Authorization: 'Bearer invalid_token' },
    });
    expect(invalidTokenResponse.status).toBe(401);
  });

  test('should handle login/refresh/logout cycle', async () => {
    // Login
    const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      }),
    });

    expect(loginResponse.status).toBe(200);
    const loginData = await loginResponse.json();
    const token = loginData.accessToken;

    // Verify token works
    const meResponse = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(meResponse.status).toBe(200);

    // Logout
    const logoutResponse = await fetch(`${BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(logoutResponse.status).toBe(200);
  });
});

test.describe('Org and Team Management E2E', () => {
  let accessToken: string;
  let orgId: string;
  let workspaceId: string;
  let teamId: string;
  const testEmail = `org-e2e-${Date.now()}@example.com`;
  const testPassword = 'OrgE2ETest123!';

  test.beforeAll(async () => {
    // Register and login
    await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });

    const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });

    const loginData = await loginResponse.json();
    accessToken = loginData.accessToken;
  });

  test('should create and manage organizations', async () => {
    // Create org
    const createOrgResponse = await fetch(`${BASE_URL}/orgs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        name: 'Test Organization',
        slug: `test-org-${Date.now()}`,
        description: 'A test organization',
      }),
    });

    expect(createOrgResponse.status).toBe(201);
    const orgData = await createOrgResponse.json();
    expect(orgData).toHaveProperty('id');
    expect(orgData).toHaveProperty('name', 'Test Organization');

    orgId = orgData.id;

    // List orgs
    const listOrgsResponse = await fetch(`${BASE_URL}/orgs`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(listOrgsResponse.status).toBe(200);
    const orgsData = await listOrgsResponse.json();
    expect(Array.isArray(orgsData)).toBe(true);
    expect(orgsData.length).toBeGreaterThan(0);

    // Get specific org
    const getOrgResponse = await fetch(`${BASE_URL}/orgs/${orgId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(getOrgResponse.status).toBe(200);
    const getOrgData = await getOrgResponse.json();
    expect(getOrgData.id).toBe(orgId);
  });

  test('should create and manage workspaces', async () => {
    // Create workspace
    const createWorkspaceResponse = await fetch(`${BASE_URL}/orgs/${orgId}/workspaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        name: 'Test Workspace',
        slug: `test-workspace-${Date.now()}`,
      }),
    });

    expect(createWorkspaceResponse.status).toBe(201);
    const workspaceData = await createWorkspaceResponse.json();
    expect(workspaceData).toHaveProperty('id');
    workspaceId = workspaceData.id;

    // List workspaces
    const listWorkspacesResponse = await fetch(`${BASE_URL}/orgs/${orgId}/workspaces`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(listWorkspacesResponse.status).toBe(200);
  });

  test('should create and manage teams', async () => {
    // Create team
    const createTeamResponse = await fetch(`${BASE_URL}/teams/workspace/${workspaceId}/teams`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        name: 'Test Team',
        slug: `test-team-${Date.now()}`,
      }),
    });

    expect(createTeamResponse.status).toBe(201);
    const teamData = await createTeamResponse.json();
    expect(teamData).toHaveProperty('id');
    teamId = teamData.id;

    // List teams
    const listTeamsResponse = await fetch(`${BASE_URL}/teams`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(listTeamsResponse.status).toBe(200);
  });

  test('should manage team members', async () => {
    // Get team members
    const getMembersResponse = await fetch(`${BASE_URL}/teams/${teamId}/members`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(getMembersResponse.status).toBe(200);
    const membersData = await getMembersResponse.json();
    expect(Array.isArray(membersData)).toBe(true);
  });
});
