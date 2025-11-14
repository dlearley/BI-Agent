import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';

export interface TeamCreateRequest {
  name: string;
  slug: string;
  description?: string;
  settings?: Record<string, any>;
}

export class TeamService {
  async createTeam(
    workspaceId: string,
    name: string,
    slug: string,
    userId: string,
    description?: string,
    settings?: Record<string, any>
  ): Promise<any> {
    const teamId = uuidv4();

    const result = await db.query(
      `INSERT INTO teams (id, workspace_id, name, slug, description, settings, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, workspace_id, name, slug, description, settings, created_by, created_at, updated_at`,
      [teamId, workspaceId, name, slug, description || null, JSON.stringify(settings || {}), userId]
    );

    return result[0];
  }

  async getTeam(teamId: string): Promise<any> {
    return db.queryOne(
      `SELECT id, workspace_id, name, slug, description, settings, created_by, created_at, updated_at
       FROM teams WHERE id = $1`,
      [teamId]
    );
  }

  async listWorkspaceTeams(workspaceId: string): Promise<any[]> {
    return db.query(
      `SELECT id, workspace_id, name, slug, description, settings, created_by, created_at, updated_at
       FROM teams WHERE workspace_id = $1
       ORDER BY created_at DESC`,
      [workspaceId]
    );
  }

  async updateTeam(teamId: string, updates: TeamCreateRequest): Promise<any> {
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
    values.push(teamId);

    const sql = `UPDATE teams SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;

    const result = await db.query(sql, values);
    return result[0] || null;
  }

  async deleteTeam(teamId: string): Promise<void> {
    await db.query(`DELETE FROM teams WHERE id = $1`, [teamId]);
  }

  async addTeamMember(
    teamId: string,
    userId: string,
    roleId: string | null
  ): Promise<any> {
    const memberId = uuidv4();

    const result = await db.query(
      `INSERT INTO team_members (id, team_id, user_id, role_id, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING id, team_id, user_id, role_id, status, created_at`,
      [memberId, teamId, userId, roleId || null]
    );

    return result[0];
  }

  async removeTeamMember(teamId: string, userId: string): Promise<void> {
    await db.query(
      `UPDATE team_members SET status = 'removed' WHERE team_id = $1 AND user_id = $2`,
      [teamId, userId]
    );
  }

  async getTeamMembers(teamId: string): Promise<any[]> {
    return db.query(
      `SELECT tm.id, tm.user_id, tm.role_id, tm.status, tm.created_at,
              u.email, u.first_name, u.last_name, r.name as role_name
       FROM team_members tm
       JOIN users u ON tm.user_id = u.id
       LEFT JOIN roles r ON tm.role_id = r.id
       WHERE tm.team_id = $1 AND tm.status = 'active'
       ORDER BY tm.created_at DESC`,
      [teamId]
    );
  }

  async isUserInTeam(teamId: string, userId: string): Promise<boolean> {
    const result = await db.queryOne<any>(
      `SELECT id FROM team_members WHERE team_id = $1 AND user_id = $2 AND status = 'active'`,
      [teamId, userId]
    );

    return !!result;
  }

  async getUserTeams(userId: string): Promise<any[]> {
    return db.query(
      `SELECT t.id, t.workspace_id, t.name, t.slug, t.description, tm.role_id, tm.status
       FROM teams t
       JOIN team_members tm ON t.id = tm.team_id
       WHERE tm.user_id = $1 AND tm.status = 'active'
       ORDER BY t.created_at DESC`,
      [userId]
    );
  }
}

export const teamService = new TeamService();
