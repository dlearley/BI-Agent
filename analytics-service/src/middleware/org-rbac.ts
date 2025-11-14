import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { db } from '../config/database';

export interface OrgRBACRequest extends AuthenticatedRequest {
  orgContext?: {
    orgId: string;
    role?: string;
    permissions: string[];
    level: 'org' | 'workspace' | 'team';
  };
}

/**
 * Extract RBAC context for organization operations
 * Attaches org, workspace, and team context to the request
 */
export const extractOrgContext = async (
  req: OrgRBACRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { orgId, workspaceId, teamId } = req.params;

    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Determine the level and get the role
    let level: 'org' | 'workspace' | 'team' = 'org';
    let permissions: string[] = [];
    let role: string | undefined;

    if (teamId) {
      // Team level
      level = 'team';
      const teamMember = await db.queryOne<any>(
        `SELECT r.permissions, r.name FROM team_members tm
         LEFT JOIN roles r ON tm.role_id = r.id
         WHERE tm.team_id = $1 AND tm.user_id = $2 AND tm.status = 'active'`,
        [teamId, req.user.id]
      );

      if (!teamMember) {
        res.status(403).json({ error: 'Access denied to team' });
        return;
      }

      if (teamMember.permissions) {
        permissions = JSON.parse(teamMember.permissions);
      }
      role = teamMember.name;
    } else if (workspaceId) {
      // Workspace level
      level = 'workspace';
      const workspaceMember = await db.queryOne<any>(
        `SELECT r.permissions, r.name FROM workspace_members wm
         LEFT JOIN roles r ON wm.role_id = r.id
         WHERE wm.workspace_id = $1 AND wm.user_id = $2 AND wm.status = 'active'`,
        [workspaceId, req.user.id]
      );

      if (!workspaceMember) {
        res.status(403).json({ error: 'Access denied to workspace' });
        return;
      }

      if (workspaceMember.permissions) {
        permissions = JSON.parse(workspaceMember.permissions);
      }
      role = workspaceMember.name;
    } else if (orgId) {
      // Org level
      level = 'org';
      const orgMember = await db.queryOne<any>(
        `SELECT r.permissions, r.name FROM org_members om
         LEFT JOIN roles r ON om.role_id = r.id
         WHERE om.org_id = $1 AND om.user_id = $2 AND om.status = 'active'`,
        [orgId, req.user.id]
      );

      if (!orgMember) {
        res.status(403).json({ error: 'Access denied to organization' });
        return;
      }

      if (orgMember.permissions) {
        permissions = JSON.parse(orgMember.permissions);
      }
      role = orgMember.name;
    }

    req.orgContext = {
      orgId: orgId || '',
      role,
      permissions,
      level,
    };

    next();
  } catch (error) {
    console.error('Failed to extract org context:', error);
    res.status(500).json({ error: 'Failed to verify permissions' });
  }
};

/**
 * Check if user has required permissions for org resource
 */
export const requireOrgPermission = (requiredPermissions: string[]) => {
  return (req: OrgRBACRequest, res: Response, next: NextFunction): void => {
    if (!req.orgContext) {
      res.status(500).json({ error: 'Org context not found' });
      return;
    }

    const hasPermission = requiredPermissions.every(permission =>
      req.orgContext!.permissions.includes(permission) ||
      req.orgContext!.permissions.includes('*')
    );

    if (!hasPermission) {
      res.status(403).json({
        error: 'Insufficient permissions',
        required: requiredPermissions,
        current: req.orgContext.permissions,
      });
      return;
    }

    next();
  };
};

/**
 * Check if user has specific role
 */
export const requireOrgRole = (roles: string[]) => {
  return (req: OrgRBACRequest, res: Response, next: NextFunction): void => {
    if (!req.orgContext) {
      res.status(500).json({ error: 'Org context not found' });
      return;
    }

    if (!req.orgContext.role || !roles.includes(req.orgContext.role)) {
      res.status(403).json({
        error: 'Insufficient role',
        required: roles,
        current: req.orgContext.role,
      });
      return;
    }

    next();
  };
};
