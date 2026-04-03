import { Router } from 'express';
import prisma from '../../config/database';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';
import { AuthenticatedRequest } from '../../types';
import { sendSuccess, parsePagination, buildPaginationMeta } from '../../utils/response';
import { UserRole } from '@prisma/client';
import { Response, NextFunction } from 'express';

const router = Router();
router.use(authenticate);
router.use(authorize(UserRole.ADMINISTRATOR, UserRole.MANAGEMENT));

router.get('/list', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const pagination = parsePagination(req.query as any);
    const { action, entityType, actorId, from, to } = req.query as any;

    const where: any = {};
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (entityType) where.entityType = entityType;
    if (actorId) where.actorId = actorId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: { select: { id: true, fullName: true, role: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    const meta = buildPaginationMeta(total, pagination);
    sendSuccess(res, logs, undefined, 200, meta);
  } catch (err) {
    next(err);
  }
});

export default router;
