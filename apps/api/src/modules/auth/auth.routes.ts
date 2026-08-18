import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { validateBody } from '../../common/middleware/validation.middleware.js';
import { LoginSchema, RegisterUserSchema } from '@lendora/validation';
import { authMiddleware } from '../../common/middleware/auth.middleware.js';
import { rbacMiddleware } from '../../common/middleware/rbac.middleware.js';

const router = Router();

router.post('/login', validateBody(LoginSchema), AuthController.login);
router.get('/me', authMiddleware, AuthController.me);
router.post('/register', authMiddleware, rbacMiddleware(['ADMIN']), validateBody(RegisterUserSchema), AuthController.register);

export const authRoutes = router;
