import { Response } from 'express';
import { db } from '../../database/db.js';
import { AuthenticatedRequest } from '../../common/middleware/auth.middleware.js';

export class AuditController {
  public static async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    const businessId = req.user!.businessId;
    const { action, entity, search, page = '1', limit = '50' } = req.query;

    let items = db.auditLogs.filter(a => a.businessId === businessId);

    if (action && typeof action === 'string') {
      items = items.filter(a => a.action === action);
    }

    if (entity && typeof entity === 'string') {
      items = items.filter(a => a.entity === entity);
    }

    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      items = items.filter(
        a =>
          a.entityId.toLowerCase().includes(q) ||
          (a.userEmail && a.userEmail.toLowerCase().includes(q)) ||
          (a.userName && a.userName.toLowerCase().includes(q)) ||
          a.action.toLowerCase().includes(q)
      );
    }

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 50;
    const total = items.length;
    const start = (pageNum - 1) * limitNum;
    const paginated = items.slice(start, start + limitNum);

    res.json({
      success: true,
      data: paginated,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  }
}
