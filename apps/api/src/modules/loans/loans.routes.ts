import { Router } from 'express';
import { LoansController } from './loans.controller.js';
import { authMiddleware } from '../../common/middleware/auth.middleware.js';
import { rbacMiddleware } from '../../common/middleware/rbac.middleware.js';
import { validateBody } from '../../common/middleware/validation.middleware.js';
import {
  LoanCreationSchema,
  LoanPreviewSchema,
  LoanRestructureSchema,
  LoanForeclosureSchema,
} from '@lendora/validation';

const router = Router();

router.use(authMiddleware);

router.post('/preview-calculation', validateBody(LoanPreviewSchema), LoansController.previewCalculation as any);
router.get('/', LoansController.list);
router.get('/:id', LoansController.getById);
router.post('/', rbacMiddleware(['ADMIN', 'MANAGER']), validateBody(LoanCreationSchema), LoansController.create as any);
router.get('/:id/prepayment-quote', LoansController.getPrepaymentQuote);
router.post('/:id/foreclose', rbacMiddleware(['ADMIN', 'MANAGER', 'ACCOUNTANT']), validateBody(LoanForeclosureSchema), LoansController.foreclose as any);
router.post('/:id/restructure', rbacMiddleware(['ADMIN', 'MANAGER']), validateBody(LoanRestructureSchema), LoansController.restructure as any);
router.put('/:id/principal', rbacMiddleware(['ADMIN']), LoansController.updatePrincipal as any);
router.put('/:id/emi-status', rbacMiddleware(['ADMIN', 'MANAGER']), LoansController.updateEmiStatus as any);
router.put('/:id/schedule-items/:itemId/status', rbacMiddleware(['ADMIN', 'MANAGER']), LoansController.updateScheduleItemStatus as any);

export const loanRoutes = router;
