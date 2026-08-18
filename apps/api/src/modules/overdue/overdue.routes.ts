import { Router } from 'express';
import { OverdueController } from './overdue.controller.js';
import { authMiddleware } from '../../common/middleware/auth.middleware.js';
import { rbacMiddleware } from '../../common/middleware/rbac.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/aging-summary', OverdueController.getAgingSummary);
router.post('/calculate-penalties', rbacMiddleware(['ADMIN', 'MANAGER']), OverdueController.calculateAndApplyPenalties);
router.post('/penalties/:id/waive', rbacMiddleware(['ADMIN', 'MANAGER']), OverdueController.waivePenalty);

export const overdueRoutes = router;
