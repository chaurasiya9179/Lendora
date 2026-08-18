import { Router } from 'express';
import { UsersController } from './users.controller.js';
import { authMiddleware } from '../../common/middleware/auth.middleware.js';
import { rbacMiddleware } from '../../common/middleware/rbac.middleware.js';

const router = Router();

router.use(authMiddleware);
router.use(rbacMiddleware(['ADMIN', 'MANAGER']));

router.get('/', UsersController.list);

export const userRoutes = router;
