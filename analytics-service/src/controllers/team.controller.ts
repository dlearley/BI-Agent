import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { teamService } from '../services/team.service';
import { db } from '../config/database';

export class TeamController {
  async createTeam(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { workspaceId } = req.params;
      const { name, slug, description, settings } = req.body;

      if (!name || !slug) {
        res.status(400).json({ error: 'Name and slug are required' });
        return;
      }

      // Check if user is workspace member
      const member = await db.queryOne<any>(
        `SELECT id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'`,
        [workspaceId, req.user?.id]
      );

      if (!member) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const team = await teamService.createTeam(workspaceId, name, slug, req.user!.id, description, settings);
      res.status(201).json(team);
    } catch (error: any) {
      console.error('Create team error:', error);
      if (error.message?.includes('duplicate')) {
        res.status(409).json({ error: 'Team slug already exists in this workspace' });
      } else {
        res.status(500).json({ error: 'Failed to create team' });
      }
    }
  }

  async getTeam(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { teamId } = req.params;

      // Check if user is team member
      const isMember = await teamService.isUserInTeam(teamId, req.user?.id || '');

      if (!isMember) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const team = await teamService.getTeam(teamId);

      if (!team) {
        res.status(404).json({ error: 'Team not found' });
        return;
      }

      res.json(team);
    } catch (error) {
      console.error('Get team error:', error);
      res.status(500).json({ error: 'Failed to get team' });
    }
  }

  async listTeams(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const teams = await teamService.getUserTeams(req.user.id);
      res.json(teams);
    } catch (error) {
      console.error('List teams error:', error);
      res.status(500).json({ error: 'Failed to list teams' });
    }
  }

  async listWorkspaceTeams(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { workspaceId } = req.params;

      // Check if user is workspace member
      const member = await db.queryOne<any>(
        `SELECT id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2 AND status = 'active'`,
        [workspaceId, req.user?.id]
      );

      if (!member) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const teams = await teamService.listWorkspaceTeams(workspaceId);
      res.json(teams);
    } catch (error) {
      console.error('List workspace teams error:', error);
      res.status(500).json({ error: 'Failed to list teams' });
    }
  }

  async updateTeam(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { teamId } = req.params;

      // Check if user is team member with admin role
      const adminMember = await db.queryOne<any>(
        `SELECT tm.id FROM team_members tm
         JOIN roles r ON tm.role_id = r.id
         WHERE tm.team_id = $1 AND tm.user_id = $2 AND r.name = 'team_admin' AND tm.status = 'active'`,
        [teamId, req.user?.id]
      );

      if (!adminMember) {
        res.status(403).json({ error: 'Only team admins can update team' });
        return;
      }

      const { name, slug, description, settings } = req.body;
      const updates: any = {};
      if (name) updates.name = name;
      if (slug) updates.slug = slug;
      if (description !== undefined) updates.description = description;
      if (settings) updates.settings = settings;

      const team = await teamService.updateTeam(teamId, updates);

      if (!team) {
        res.status(404).json({ error: 'Team not found' });
        return;
      }

      res.json(team);
    } catch (error: any) {
      console.error('Update team error:', error);
      if (error.message?.includes('duplicate')) {
        res.status(409).json({ error: 'Team slug already exists in this workspace' });
      } else {
        res.status(500).json({ error: 'Failed to update team' });
      }
    }
  }

  async deleteTeam(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { teamId } = req.params;

      // Check if user is team member with admin role
      const adminMember = await db.queryOne<any>(
        `SELECT tm.id FROM team_members tm
         JOIN roles r ON tm.role_id = r.id
         WHERE tm.team_id = $1 AND tm.user_id = $2 AND r.name = 'team_admin' AND tm.status = 'active'`,
        [teamId, req.user?.id]
      );

      if (!adminMember) {
        res.status(403).json({ error: 'Only team admins can delete team' });
        return;
      }

      await teamService.deleteTeam(teamId);
      res.json({ message: 'Team deleted successfully' });
    } catch (error) {
      console.error('Delete team error:', error);
      res.status(500).json({ error: 'Failed to delete team' });
    }
  }

  async addMember(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { teamId } = req.params;
      const { userId, roleId } = req.body;

      if (!userId) {
        res.status(400).json({ error: 'User ID is required' });
        return;
      }

      // Check if user is team member with admin role
      const adminMember = await db.queryOne<any>(
        `SELECT tm.id FROM team_members tm
         JOIN roles r ON tm.role_id = r.id
         WHERE tm.team_id = $1 AND tm.user_id = $2 AND r.name = 'team_admin' AND tm.status = 'active'`,
        [teamId, req.user?.id]
      );

      if (!adminMember) {
        res.status(403).json({ error: 'Only team admins can add members' });
        return;
      }

      const member = await teamService.addTeamMember(teamId, userId, roleId || null);
      res.status(201).json(member);
    } catch (error: any) {
      console.error('Add member error:', error);
      if (error.message?.includes('duplicate')) {
        res.status(409).json({ error: 'User is already a member of this team' });
      } else {
        res.status(500).json({ error: 'Failed to add member' });
      }
    }
  }

  async removeMember(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { teamId, userId } = req.params;

      // Check if user is team member with admin role
      const adminMember = await db.queryOne<any>(
        `SELECT tm.id FROM team_members tm
         JOIN roles r ON tm.role_id = r.id
         WHERE tm.team_id = $1 AND tm.user_id = $2 AND r.name = 'team_admin' AND tm.status = 'active'`,
        [teamId, req.user?.id]
      );

      if (!adminMember) {
        res.status(403).json({ error: 'Only team admins can remove members' });
        return;
      }

      await teamService.removeTeamMember(teamId, userId);
      res.json({ message: 'Member removed successfully' });
    } catch (error) {
      console.error('Remove member error:', error);
      res.status(500).json({ error: 'Failed to remove member' });
    }
  }

  async getMembers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { teamId } = req.params;

      // Check if user is team member
      const isMember = await teamService.isUserInTeam(teamId, req.user?.id || '');

      if (!isMember) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const members = await teamService.getTeamMembers(teamId);
      res.json(members);
    } catch (error) {
      console.error('Get members error:', error);
      res.status(500).json({ error: 'Failed to get members' });
    }
  }
}

export const teamController = new TeamController();
