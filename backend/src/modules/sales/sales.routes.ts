import { Router } from 'express';
import { salesController } from './sales.controller';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { customerEnquirySchema, generateQuotationSchema, confirmOrderSchema } from './sales.validator';
import { UserRole } from '@prisma/client';

const router = Router();
router.use(authenticate);

// Customer enquiry
router.post(
  '/customer/enquiry',
  authorize(UserRole.ADMINISTRATOR, UserRole.SALES_HANDLER),
  validate({ body: customerEnquirySchema }),
  (req, res, next) => salesController.createEnquiry(req, res, next),
);

router.get(
  '/customer/enquiry/list',
  authorize(UserRole.ADMINISTRATOR, UserRole.SALES_HANDLER, UserRole.MANAGEMENT),
  (req, res, next) => salesController.listEnquiries(req, res, next),
);

// Quotation generation
router.post(
  '/quotation/generate',
  authorize(UserRole.ADMINISTRATOR, UserRole.SALES_HANDLER),
  validate({ body: generateQuotationSchema }),
  (req, res, next) => salesController.generateQuotation(req, res, next),
);

router.get(
  '/quotation/list',
  authorize(UserRole.ADMINISTRATOR, UserRole.SALES_HANDLER, UserRole.MANAGEMENT),
  (req, res, next) => salesController.listQuotations(req, res, next),
);

// Order confirmation
router.post(
  '/order/confirm',
  authorize(UserRole.ADMINISTRATOR, UserRole.SALES_HANDLER),
  validate({ body: confirmOrderSchema }),
  (req, res, next) => salesController.confirmOrder(req, res, next),
);

// Order list
router.get(
  '/order/list',
  authorize(UserRole.ADMINISTRATOR, UserRole.SALES_HANDLER, UserRole.MANAGEMENT),
  (req, res, next) => salesController.listOrders(req, res, next),
);

export default router;
