import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { auditLogger } from '../middleware/audit';

const router = Router();

// Public endpoints
router.post('/login', auditLogger('login', 'auth'), authController.login.bind(authController));
router.post('/register', auditLogger('register', 'auth'), authController.register.bind(authController));
router.post('/refresh', auditLogger('token_refresh', 'auth'), authController.refresh.bind(authController));

// Protected endpoints
router.post('/logout', authenticate, auditLogger('logout', 'auth'), authController.logout.bind(authController));
router.get('/me', authenticate, authController.me.bind(authController));
router.post('/change-password', authenticate, auditLogger('password_change', 'auth'), authController.changePassword.bind(authController));
router.post('/api-keys', authenticate, auditLogger('create_api_key', 'auth'), authController.createAPIKey.bind(authController));

export default router;
