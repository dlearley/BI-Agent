import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';

export interface OrgCreateRequest {
  name: string;
  slug: string;
  description?: string;
  settings?: Record<string, any>;
}

export interface OrgUpdateRequest {
  name?: string;
  slug?: string;
  description?: string;
  settings?: Record<string, any>;
}

export interface WorkspaceCreateRequest {
  name: string;
  slug: string;
  description?: string;
  settings?: Record<string, any>;
}

export interface TeamCreateRequest {
  name: string;
  slug: string;
  description?: string;
  settings?: Record<string, any>;
}

export class OrgService {
  async createOrg(
    name: string,
    slug: string,
    userId: string,
    description?: string,
    settings?: Record<string, any>
  ): Promise<any> {
    const orgId = uuidv4();

    const result = await db.query(
      `INSERT INTO orgs (id, name, slug, description, settings, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, slug, description, settings, created_by, created_at, updated_at`,
      [orgId, name, slug, description || null, JSON.stringify(settings || {}), userId]
    );

    return result[0];
  }

  async getOrg(orgId: string): Promise<any> {
    return db.queryOne(
      `SELECT id, name, slug, description, settings, created_by, created_at, updated_at
       FROM orgs WHERE id = $1`,
      [orgId]
    );
  }

  async getOrgBySlug(slug: string): Promise<any> {
    return db.queryOne(
      `SELECT id, name, slug, description, settings, created_by, created_at, updated_at
       FROM orgs WHERE slug = $1`,
      [slug]
    );
  }

  async listUserOrgs(userId: string): Promise<any[]> {
    return db.query(
      `SELECT DISTINCT o.id, o.name, o.slug, o.description, o.settings, o.created_by, o.created_at, o.updated_at
       FROM orgs o
       LEFT JOIN org_members om ON o.id = om.org_id
       WHERE om.user_id = $1 AND om.status = 'active'
       ORDER BY o.created_at DESC`,
      [userId]
    );
  }

  async updateOrg(orgId: string, updates: OrgUpdateRequest): Promise<any> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.slug !== undefined) {
      fields.push(`slug = $${paramIndex++}`);
      values.push(updates.slug);
    }
    if (updates.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    if (updates.settings !== undefined) {
      fields.push(`settings = $${paramIndex++}`);
      values.push(JSON.stringify(updates.settings));
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(orgId);

    const sql = `UPDATE orgs SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

    const result = await db.query(sql, values);
    return result[0] || null;
  }

  async deleteOrg(orgId: string): Promise<void> {
    await db.query(`DELETE FROM orgs WHERE id = $1`, [orgId]);
  }

  async addOrgMember(
    orgId: string,
    userId: string,
    roleId: string | null,
    invitedBy?: string
  ): Promise<any> {
    const memberId = uuidv4();

    const result = await db.query(
      `INSERT INTO org_members (id, org_id, user_id, role_id, invited_by, status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       RETURNING id, org_id, user_id, role_id, status, created_at`,
      [memberId, orgId, userId, roleId || null, invitedBy || null]
    );

    return result[0];
  }

  async removeOrgMember(orgId: string, userId: string): Promise<void> {
    await db.query(
      `UPDATE org_members SET status = 'removed' WHERE org_id = $1 AND user_id = $2`,
      [orgId, userId]
    );
  }

  async getOrgMembers(orgId: string): Promise<any[]> {
    return db.query(
      `SELECT om.id, om.user_id, om.role_id, om.status, om.joined_at,
              u.email, u.first_name, u.last_name, r.name as role_name
       FROM org_members om
       JOIN users u ON om.user_id = u.id
       LEFT JOIN roles r ON om.role_id = r.id
       WHERE om.org_id = $1 AND om.status = 'active'
       ORDER BY om.joined_at DESC`,
      [orgId]
    );
  }

  async createWorkspace(
    orgId: string,
    name: string,
    slug: string,
    userId: string,
    description?: string,
    settings?: Record<string, any>
  ): Promise<any> {
    const workspaceId = uuidv4();

    const result = await db.query(
      `INSERT INTO workspaces (id, org_id, name, slug, description, settings, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, org_id, name, slug, description, settings, created_by, created_at, updated_at`,
      [workspaceId, orgId, name, slug, description || null, JSON.stringify(settings || {}), userId]
    );

    return result[0];
  }

  async getWorkspace(workspaceId: string): Promise<any> {
    return db.queryOne(
      `SELECT id, org_id, name, slug, description, settings, created_by, created_at, updated_at
       FROM workspaces WHERE id = $1`,
      [workspaceId]
    );
  }

  async listOrgWorkspaces(orgId: string): Promise<any[]> {
    return db.query(
      `SELECT id, org_id, name, slug, description, settings, created_by, created_at, updated_at
       FROM workspaces WHERE org_id = $1
       ORDER BY created_at DESC`,
      [orgId]
    );
  }

  async updateWorkspace(workspaceId: string, updates: WorkspaceCreateRequest): Promise<any> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.slug !== undefined) {
      fields.push(`slug = $${paramIndex++}`);
      values.push(updates.slug);
    }
    if (updates.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(updates.description);
    }
    if (updates.settings !== undefined) {
      fields.push(`settings = $${paramIndex++}`);
      values.push(JSON.stringify(updates.settings));
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(workspaceId);

    const sql = `UPDATE workspaces SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

    const result = await db.query(sql, values);
    return result[0] || null;
  }

  async addWorkspaceMember(
    workspaceId: string,
    userId: string,
    roleId: string | null
  ): Promise<any> {
    const memberId = uuidv4();

    const result = await db.query(
      `INSERT INTO workspace_members (id, workspace_id, user_id, role_id, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING id, workspace_id, user_id, role_id, status, created_at`,
      [memberId, workspaceId, userId, roleId || null]
    );

    return result[0];
  }

  async getWorkspaceMembers(workspaceId: string): Promise<any[]> {
    return db.query(
      `SELECT wm.id, wm.user_id, wm.role_id, wm.status, wm.created_at,
              u.email, u.first_name, u.last_name, r.name as role_name
       FROM workspace_members wm
       JOIN users u ON wm.user_id = u.id
       LEFT JOIN roles r ON wm.role_id = r.id
       WHERE wm.workspace_id = $1 AND wm.status = 'active'
       ORDER BY wm.created_at DESC`,
      [workspaceId]
    );
  }
}

export const orgService = new OrgService();
