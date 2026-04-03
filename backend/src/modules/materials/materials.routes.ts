import { Router } from 'express';
import { materialsController } from './materials.controller';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import {
  materialReceiptSchema,
  materialInspectionSchema,
  createBatchSchema,
  updateLocationSchema,
} from './materials.validator';
import { UserRole } from '@prisma/client';

const router = Router();
router.use(authenticate);

// Material receipt
router.post(
  '/receipt',
  authorize(UserRole.ADMINISTRATOR, UserRole.STORES_HANDLER),
  validate({ body: materialReceiptSchema }),
  (req, res, next) => materialsController.recordReceipt(req, res, next),
);

// Material inspection
router.post(
  '/inspection',
  authorize(UserRole.ADMINISTRATOR, UserRole.STORES_HANDLER),
  validate({ body: materialInspectionSchema }),
  (req, res, next) => materialsController.recordInspection(req, res, next),
);

// Batch management
router.post(
  '/batch/create',
  authorize(UserRole.ADMINISTRATOR, UserRole.STORES_HANDLER),
  validate({ body: createBatchSchema }),
  (req, res, next) => materialsController.createBatch(req, res, next),
);

// Materials list (reference data)
router.get(
  '/list',
  (req, res, next) => materialsController.listMaterials(req, res, next),
);

// Storage locations
router.get(
  '/locations',
  (req, res, next) => materialsController.listLocations(req, res, next),
);

// Receipts list
router.get(
  '/receipts',
  authorize(UserRole.ADMINISTRATOR, UserRole.STORES_HANDLER, UserRole.PURCHASE_HANDLER),
  (req, res, next) => materialsController.listReceipts(req, res, next),
);

export default router;
