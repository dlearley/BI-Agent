import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, UserRole, Permission } from '../types';
import config from '../config';

export interface AuthenticatedRequest extends Request {
  user?: User;
  organizationId?: string;
}

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, config.jwt.secret) as any;
    
    // In a real application, you would fetch the user from the database
    // For now, we'll assume the decoded token contains the user info
    const user: User = {
      id: decoded.userId,
      email: decoded.email,
      role: decoded.role,
      facilityId: decoded.facilityId,
      permissions: decoded.permissions || [],
    };

    req.user = user;
    // Extract organization ID from header or token
    req.organizationId = (req.headers['x-organization-id'] as string) || decoded.organizationId || 'default-org';
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

export const authorize = (permissions: Permission[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const hasPermission = permissions.every(permission =>
      req.user!.permissions.includes(permission)
    );

    if (!hasPermission) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
};

export const requireRole = (roles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient role privileges' });
      return;
    }

    next();
  };
};

export const facilityScope = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  // Admins can access all facilities, recruiters are limited to their facility
  if (req.user.role === UserRole.RECRUITER && !req.user.facilityId) {
    res.status(403).json({ error: 'Recruiter must be assigned to a facility' });
    return;
  }

  next();
};