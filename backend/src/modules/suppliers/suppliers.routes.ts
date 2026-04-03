import { Router } from 'express';
import { suppliersController } from './suppliers.controller';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import {
  createEnquirySchema,
  addQuotationSchema,
  updateEnquiryStatusSchema,
  updateQuotationStatusSchema,
  listQuerySchema,
} from './suppliers.validator';
import { UserRole } from '@prisma/client';

const router = Router();

// All supplier routes require authentication
router.use(authenticate);

// Supplier list (available to all authenticated users)
router.get('/list', (req, res, next) => suppliersController.listSuppliers(req, res, next));

// Enquiry routes
router.post(
  '/enquiry/create',
  authorize(UserRole.ADMINISTRATOR, UserRole.PURCHASE_HANDLER),
  validate({ body: createEnquirySchema }),
  (req, res, next) => suppliersController.createEnquiry(req, res, next),
);

router.get(
  '/enquiry/list',
  authorize(UserRole.ADMINISTRATOR, UserRole.PURCHASE_HANDLER, UserRole.MANAGEMENT),
  validate({ query: listQuerySchema }),
  (req, res, next) => suppliersController.listEnquiries(req, res, next),
);

router.get(
  '/enquiry/:id',
  authorize(UserRole.ADMINISTRATOR, UserRole.PURCHASE_HANDLER, UserRole.MANAGEMENT),
  (req, res, next) => suppliersController.getEnquiry(req, res, next),
);

router.put(
  '/enquiry/update-status',
  authorize(UserRole.ADMINISTRATOR, UserRole.PURCHASE_HANDLER),
  validate({ body: updateEnquiryStatusSchema }),
  (req, res, next) => suppliersController.updateEnquiryStatus(req, res, next),
);

// Quotation routes
router.post(
  '/quotation/add',
  authorize(UserRole.ADMINISTRATOR, UserRole.PURCHASE_HANDLER),
  validate({ body: addQuotationSchema }),
  (req, res, next) => suppliersController.addQuotation(req, res, next),
);

router.get(
  '/quotation/list',
  authorize(UserRole.ADMINISTRATOR, UserRole.PURCHASE_HANDLER, UserRole.MANAGEMENT),
  validate({ query: listQuerySchema }),
  (req, res, next) => suppliersController.listQuotations(req, res, next),
);

router.put(
  '/quotation/update-status',
  authorize(UserRole.ADMINISTRATOR, UserRole.PURCHASE_HANDLER),
  validate({ body: updateQuotationStatusSchema }),
  (req, res, next) => suppliersController.updateQuotationStatus(req, res, next),
);

export default router;
