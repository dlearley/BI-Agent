import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import config from '../config';
import { UserRole, Permission } from '../types';

const router = Router();

const MOCK_USERS = [
  {
    id: '1',
    email: 'admin@example.com',
    password: '$2a$10$rKJ5YXq9pZlZzVbZ0Qm0qOqR7qGqR7qGqR7qGqR7qGqR7qGqR7qGq',
    role: UserRole.ADMIN,
    permissions: [
      Permission.VIEW_ANALYTICS,
      Permission.VIEW_FACILITY_ANALYTICS,
      Permission.MANAGE_ANALYTICS,
      Permission.VIEW_PII,
      Permission.VIEW_AUDIT_LOGS,
      Permission.MANAGE_GOVERNANCE,
      Permission.EXPORT_DATA,
      Permission.VIEW_VERSIONED_METRICS,
    ],
  },
  {
    id: '2',
    email: 'recruiter@example.com',
    password: '$2a$10$rKJ5YXq9pZlZzVbZ0Qm0qOqR7qGqR7qGqR7qGqR7qGqR7qGqR7qGq',
    role: UserRole.RECRUITER,
    facilityId: 'facility-1',
    permissions: [
      Permission.VIEW_ANALYTICS,
      Permission.VIEW_FACILITY_ANALYTICS,
      Permission.EXPORT_DATA,
    ],
  },
  {
    id: '3',
    email: 'viewer@example.com',
    password: '$2a$10$rKJ5YXq9pZlZzVbZ0Qm0qOqR7qGqR7qGqR7qGqR7qGqR7qGqR7qGq',
    role: UserRole.VIEWER,
    permissions: [Permission.VIEW_ANALYTICS],
  },
];

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const user = MOCK_USERS.find((u) => u.email === email);

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const isValidPassword = password === 'password123';

    if (!isValidPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        facilityId: user.facilityId,
        permissions: user.permissions,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        facilityId: user.facilityId,
        permissions: user.permissions,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', (req: Request, res: Response) => {
  res.json({ message: 'Logged out successfully' });
});

export default router;
