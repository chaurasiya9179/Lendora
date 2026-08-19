import { Router } from 'express';
import { CustomersController } from './customers.controller.js';
import { authMiddleware } from '../../common/middleware/auth.middleware.js';
import { rbacMiddleware } from '../../common/middleware/rbac.middleware.js';
import { validateBody } from '../../common/middleware/validation.middleware.js';
import { CustomerSchema, CustomerNoteSchema } from '@lendora/validation';

const router = Router();

router.use(authMiddleware);

router.get('/', CustomersController.list);
router.get('/:id', CustomersController.getById);
router.post('/', rbacMiddleware(['ADMIN', 'MANAGER']), validateBody(CustomerSchema), CustomersController.create as any);
router.put('/:id', rbacMiddleware(['ADMIN', 'MANAGER']), CustomersController.update as any);
router.delete('/:id', rbacMiddleware(['ADMIN']), CustomersController.delete as any);
router.post('/:id/notes', validateBody(CustomerNoteSchema), CustomersController.addNote as any);
router.post('/:id/documents', CustomersController.addDocument as any);

export const customerRoutes = router;
