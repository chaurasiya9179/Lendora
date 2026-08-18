import { Router } from 'express';
import { ReportsController } from './reports.controller.js';
import { authMiddleware } from '../../common/middleware/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/dashboard', ReportsController.getDashboard);
router.get('/export', ReportsController.exportCSV);

export const reportRoutes = router;
