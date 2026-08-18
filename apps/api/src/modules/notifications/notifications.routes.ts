import { Router } from 'express';
import { NotificationsController } from './notifications.controller.js';
import { authMiddleware } from '../../common/middleware/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', NotificationsController.list);
router.put('/:id/read', NotificationsController.markAsRead);

export const notificationRoutes = router;
