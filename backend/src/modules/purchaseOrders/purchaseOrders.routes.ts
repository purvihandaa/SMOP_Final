import { Router } from 'express';
import { purchaseOrdersController } from './purchaseOrders.controller';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { createPurchaseOrderSchema, createFromQuotationSchema, updatePOStatusSchema } from './purchaseOrders.validator';
import { UserRole } from '@prisma/client';

const router = Router();
router.use(authenticate);

router.post(
  '/create',
  authorize(UserRole.ADMINISTRATOR, UserRole.PURCHASE_HANDLER),
  validate({ body: createPurchaseOrderSchema }),
  (req, res, next) => purchaseOrdersController.create(req, res, next),
);

router.post(
  '/create-from-quotation',
  authorize(UserRole.ADMINISTRATOR, UserRole.PURCHASE_HANDLER),
  validate({ body: createFromQuotationSchema }),
  (req, res, next) => purchaseOrdersController.createFromQuotation(req, res, next),
);

router.get(
  '/list',
  authorize(UserRole.ADMINISTRATOR, UserRole.PURCHASE_HANDLER, UserRole.STORES_HANDLER, UserRole.MANAGEMENT),
  (req, res, next) => purchaseOrdersController.list(req, res, next),
);

router.get(
  '/:id',
  authorize(UserRole.ADMINISTRATOR, UserRole.PURCHASE_HANDLER, UserRole.STORES_HANDLER, UserRole.MANAGEMENT),
  (req, res, next) => purchaseOrdersController.getById(req, res, next),
);

router.put(
  '/update-status',
  authorize(UserRole.ADMINISTRATOR, UserRole.PURCHASE_HANDLER),
  validate({ body: updatePOStatusSchema }),
  (req, res, next) => purchaseOrdersController.updateStatus(req, res, next),
);

export default router;
