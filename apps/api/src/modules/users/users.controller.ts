import { Response } from 'express';
import { db } from '../../database/db.js';
import { AuthenticatedRequest } from '../../common/middleware/auth.middleware.js';
import { User } from '@lendora/shared-types';

export class UsersController {
  public static async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    const businessId = req.user!.businessId;
    const users = Array.from(db.users.values())
      .filter(u => u.businessId === businessId)
      .map(u => ({
        id: u.id,
        businessId: u.businessId,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        phone: u.phone,
        role: u.role,
        status: u.status,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      }));

    res.json({
      success: true,
      data: users,
    });
  }
}
