import { Router } from 'express';
import { CollectionsController } from './collections.controller.js';
import { authMiddleware } from '../../common/middleware/auth.middleware.js';
import { validateBody } from '../../common/middleware/validation.middleware.js';
import { CreateCollectionTaskSchema, UpdateCollectionNoteSchema } from '@lendora/validation';

const router = Router();

router.use(authMiddleware);

router.get('/tasks', CollectionsController.listTasks);
router.post('/tasks', validateBody(CreateCollectionTaskSchema), CollectionsController.createTask as any);
router.put('/tasks/:id/notes', validateBody(UpdateCollectionNoteSchema), CollectionsController.updateTaskNote as any);
router.get('/performance', CollectionsController.getAgentPerformance);

export const collectionRoutes = router;
