import { Router } from 'express';
import { materialsController } from '../materials/materials.controller';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { updateLocationSchema } from '../materials/materials.validator';
import { UserRole } from '@prisma/client';

const router = Router();
router.use(authenticate);

// Inventory view
router.get(
  '/view',
  authorize(
    UserRole.ADMINISTRATOR, UserRole.STORES_HANDLER,
    UserRole.MANUFACTURING_SUPERVISOR, UserRole.PURCHASE_HANDLER, UserRole.MANAGEMENT,
  ),
  (req, res, next) => materialsController.viewInventory(req, res, next),
);

// Update inventory location
router.put(
  '/update-location',
  authorize(UserRole.ADMINISTRATOR, UserRole.STORES_HANDLER),
  validate({ body: updateLocationSchema }),
  (req, res, next) => materialsController.updateLocation(req, res, next),
);

export default router;
