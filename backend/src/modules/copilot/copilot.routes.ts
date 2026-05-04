import { Router } from 'express';
import { copilotController } from './copilot.controller';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { chatSchema } from './copilot.validator';
import { UserRole } from '@prisma/client';

const router = Router();
router.use(authenticate);
router.use(authorize(UserRole.ADMINISTRATOR, UserRole.MANAGEMENT));

// POST /api/copilot/chat — send conversation to AI copilot
router.post(
  '/chat',
  validate({ body: chatSchema }),
  (req, res, next) => copilotController.chat(req, res, next),
);

export default router;
