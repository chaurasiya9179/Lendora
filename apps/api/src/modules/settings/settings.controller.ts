import { Response } from 'express';
import { db } from '../../database/db.js';
import { AuthenticatedRequest } from '../../common/middleware/auth.middleware.js';
import { BusinessSettingsInput } from '@lendora/validation';
import { BusinessProfile } from '@lendora/shared-types';

export class SettingsController {
  public static async getSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
    const businessId = req.user!.businessId;
    let business = db.businessProfiles.get(businessId);

    if (!business) {
      business = Array.from(db.businessProfiles.values())[0];
    }

    res.json({
      success: true,
      data: business,
    });
  }

  public static async updateSettings(req: AuthenticatedRequest & { body: BusinessSettingsInput }, res: Response): Promise<void> {
    const businessId = req.user!.businessId;
    let business = db.businessProfiles.get(businessId);

    if (!business) {
      business = Array.from(db.businessProfiles.values())[0];
    }

    const previousValue = { ...business };
    const updated: BusinessProfile = {
      ...business,
      ...req.body,
      updatedAt: new Date().toISOString(),
    };

    db.businessProfiles.set(business.id, updated);

    db.logAudit({
      businessId: business.id,
      userId: req.user!.id,
      userEmail: req.user!.email,
      userName: `${req.user!.firstName} ${req.user!.lastName}`,
      action: 'SETTINGS_UPDATED',
      entity: 'SETTINGS',
      entityId: business.id,
      previousValue,
      newValue: updated,
      ipAddress: req.ip || '127.0.0.1',
    });

    res.json({
      success: true,
      data: updated,
    });
  }
}
