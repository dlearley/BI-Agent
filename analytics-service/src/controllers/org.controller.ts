import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { orgService, OrgUpdateRequest } from '../services/org.service';
import { db } from '../config/database';

export class OrgController {
  async createOrg(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { name, slug, description, settings } = req.body;

      if (!name || !slug) {
        res.status(400).json({ error: 'Name and slug are required' });
        return;
      }

      const org = await orgService.createOrg(name, slug, req.user.id, description, settings);

      // Add creator as org member with admin role
      const adminRole = await db.queryOne<any>(
        `SELECT id FROM roles WHERE name = 'org_admin' AND level = 'org'`
      );

      if (adminRole) {
        await orgService.addOrgMember(org.id, req.user.id, adminRole.id, req.user.id);
      } else {
        await orgService.addOrgMember(org.id, req.user.id, null, req.user.id);
      }

      res.status(201).json(org);
    } catch (error: any) {
      console.error('Create org error:', error);
      if (error.message?.includes('duplicate')) {
        res.status(409).json({ error: 'Org slug already exists' });
      } else {
        res.status(500).json({ error: 'Failed to create org' });
      }
    }
  }

  async getOrg(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { orgId } = req.params;

      // Check if user is member of org
      const member = await db.queryOne<any>(
        `SELECT id FROM org_members WHERE org_id = $1 AND user_id = $2 AND status = 'active'`,
        [orgId, req.user?.id]
      );

      if (!member && req.user?.id !== orgId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const org = await orgService.getOrg(orgId);

      if (!org) {
        res.status(404).json({ error: 'Organization not found' });
        return;
      }

      res.json(org);
    } catch (error) {
      console.error('Get org error:', error);
      res.status(500).json({ error: 'Failed to get organization' });
    }
  }

  async listOrgs(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const orgs = await orgService.listUserOrgs(req.user.id);
      res.json(orgs);
    } catch (error) {
      console.error('List orgs error:', error);
      res.status(500).json({ error: 'Failed to list organizations' });
    }
  }

  async updateOrg(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { orgId } = req.params;

      // Check if user is org admin
      const adminMember = await db.queryOne<any>(
        `SELECT om.id FROM org_members om
         JOIN roles r ON om.role_id = r.id
         WHERE om.org_id = $1 AND om.user_id = $2 AND r.name = 'org_admin' AND om.status = 'active'`,
        [orgId, req.user?.id]
      );

      if (!adminMember) {
        res.status(403).json({ error: 'Only organization admins can update org' });
        return;
      }

      const updates: OrgUpdateRequest = {};
      if (req.body.name) updates.name = req.body.name;
      if (req.body.slug) updates.slug = req.body.slug;
      if (req.body.description !== undefined) updates.description = req.body.description;
      if (req.body.settings) updates.settings = req.body.settings;

      const org = await orgService.updateOrg(orgId, updates);

      if (!org) {
        res.status(404).json({ error: 'Organization not found' });
        return;
      }

      res.json(org);
    } catch (error: any) {
      console.error('Update org error:', error);
      if (error.message?.includes('duplicate')) {
        res.status(409).json({ error: 'Org slug already exists' });
      } else {
        res.status(500).json({ error: 'Failed to update organization' });
      }
    }
  }

  async deleteOrg(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { orgId } = req.params;

      // Check if user is org admin
      const adminMember = await db.queryOne<any>(
        `SELECT om.id FROM org_members om
         JOIN roles r ON om.role_id = r.id
         WHERE om.org_id = $1 AND om.user_id = $2 AND r.name = 'org_admin' AND om.status = 'active'`,
        [orgId, req.user?.id]
      );

      if (!adminMember) {
        res.status(403).json({ error: 'Only organization admins can delete org' });
        return;
      }

      await orgService.deleteOrg(orgId);
      res.json({ message: 'Organization deleted successfully' });
    } catch (error) {
      console.error('Delete org error:', error);
      res.status(500).json({ error: 'Failed to delete organization' });
    }
  }

  async addMember(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { orgId } = req.params;
      const { userId, roleId } = req.body;

      if (!userId) {
        res.status(400).json({ error: 'User ID is required' });
        return;
      }

      // Check if user is org admin
      const adminMember = await db.queryOne<any>(
        `SELECT om.id FROM org_members om
         JOIN roles r ON om.role_id = r.id
         WHERE om.org_id = $1 AND om.user_id = $2 AND r.name = 'org_admin' AND om.status = 'active'`,
        [orgId, req.user?.id]
      );

      if (!adminMember) {
        res.status(403).json({ error: 'Only organization admins can add members' });
        return;
      }

      const member = await orgService.addOrgMember(orgId, userId, roleId || null, req.user?.id);
      res.status(201).json(member);
    } catch (error: any) {
      console.error('Add member error:', error);
      if (error.message?.includes('duplicate')) {
        res.status(409).json({ error: 'User is already a member of this organization' });
      } else {
        res.status(500).json({ error: 'Failed to add member' });
      }
    }
  }

  async removeMember(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { orgId, userId } = req.params;

      // Check if user is org admin
      const adminMember = await db.queryOne<any>(
        `SELECT om.id FROM org_members om
         JOIN roles r ON om.role_id = r.id
         WHERE om.org_id = $1 AND om.user_id = $2 AND r.name = 'org_admin' AND om.status = 'active'`,
        [orgId, req.user?.id]
      );

      if (!adminMember) {
        res.status(403).json({ error: 'Only organization admins can remove members' });
        return;
      }

      await orgService.removeOrgMember(orgId, userId);
      res.json({ message: 'Member removed successfully' });
    } catch (error) {
      console.error('Remove member error:', error);
      res.status(500).json({ error: 'Failed to remove member' });
    }
  }

  async getMembers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { orgId } = req.params;

      // Check if user is member of org
      const member = await db.queryOne<any>(
        `SELECT id FROM org_members WHERE org_id = $1 AND user_id = $2 AND status = 'active'`,
        [orgId, req.user?.id]
      );

      if (!member) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const members = await orgService.getOrgMembers(orgId);
      res.json(members);
    } catch (error) {
      console.error('Get members error:', error);
      res.status(500).json({ error: 'Failed to get members' });
    }
  }

  async createWorkspace(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { orgId } = req.params;
      const { name, slug, description, settings } = req.body;

      if (!name || !slug) {
        res.status(400).json({ error: 'Name and slug are required' });
        return;
      }

      // Check if user is org member
      const member = await db.queryOne<any>(
        `SELECT id FROM org_members WHERE org_id = $1 AND user_id = $2 AND status = 'active'`,
        [orgId, req.user?.id]
      );

      if (!member) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const workspace = await orgService.createWorkspace(orgId, name, slug, req.user!.id, description, settings);
      res.status(201).json(workspace);
    } catch (error: any) {
      console.error('Create workspace error:', error);
      if (error.message?.includes('duplicate')) {
        res.status(409).json({ error: 'Workspace slug already exists in this organization' });
      } else {
        res.status(500).json({ error: 'Failed to create workspace' });
      }
    }
  }

  async listWorkspaces(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { orgId } = req.params;

      // Check if user is org member
      const member = await db.queryOne<any>(
        `SELECT id FROM org_members WHERE org_id = $1 AND user_id = $2 AND status = 'active'`,
        [orgId, req.user?.id]
      );

      if (!member) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const workspaces = await orgService.listOrgWorkspaces(orgId);
      res.json(workspaces);
    } catch (error) {
      console.error('List workspaces error:', error);
      res.status(500).json({ error: 'Failed to list workspaces' });
    }
  }
}

export const orgController = new OrgController();
