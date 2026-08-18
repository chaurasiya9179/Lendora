import { Response } from 'express';
import { db } from '../../database/db.js';
import { AuthenticatedRequest } from '../../common/middleware/auth.middleware.js';

export class NotificationsController {
  public static async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user!.id;
    const notifications = db.notifications
      .filter(n => n.recipientId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({
      success: true,
      data: notifications,
    });
  }

  public static async markAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const notif = db.notifications.find(n => n.id === id);

    if (notif) {
      notif.status = 'READ';
    }

    res.json({
      success: true,
    });
  }
}
