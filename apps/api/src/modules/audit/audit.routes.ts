import { Router } from 'express';
import { AuditController } from './audit.controller.js';
import { authMiddleware } from '../../common/middleware/auth.middleware.js';
import { rbacMiddleware } from '../../common/middleware/rbac.middleware.js';

const router = Router();

router.use(authMiddleware);
router.use(rbacMiddleware(['ADMIN']));

router.get('/', AuditController.list);

export const auditRoutes = router;
