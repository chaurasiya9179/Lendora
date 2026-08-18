import { Router } from 'express';
import { PaymentsController } from './payments.controller.js';
import { authMiddleware } from '../../common/middleware/auth.middleware.js';
import { rbacMiddleware } from '../../common/middleware/rbac.middleware.js';
import { validateBody } from '../../common/middleware/validation.middleware.js';
import { RecordPaymentSchema, ReversePaymentSchema } from '@lendora/validation';

const router = Router();

router.use(authMiddleware);

router.get('/', PaymentsController.list);
router.get('/:id', PaymentsController.getById);
router.get('/:id/receipt', PaymentsController.getReceipt);
router.post('/', validateBody(RecordPaymentSchema), PaymentsController.record as any);
router.post('/:id/reverse', rbacMiddleware(['ADMIN']), validateBody(ReversePaymentSchema), PaymentsController.reverse as any);

export const paymentRoutes = router;
