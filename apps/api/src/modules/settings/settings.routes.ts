import { Router } from 'express';
import { SettingsController } from './settings.controller.js';
import { authMiddleware } from '../../common/middleware/auth.middleware.js';
import { rbacMiddleware } from '../../common/middleware/rbac.middleware.js';
import { validateBody } from '../../common/middleware/validation.middleware.js';
import { BusinessSettingsSchema } from '@lendora/validation';

const router = Router();

router.use(authMiddleware);

router.get('/', SettingsController.getSettings);
router.put('/', rbacMiddleware(['ADMIN']), validateBody(BusinessSettingsSchema), SettingsController.updateSettings as any);

export const settingRoutes = router;
