import { Router } from 'express';
import { reportsController } from './reports.controller';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';
import { UserRole } from '@prisma/client';

const router = Router();
router.use(authenticate);

const reportRoles = [
  UserRole.ADMINISTRATOR,
  UserRole.MANAGEMENT,
  UserRole.PURCHASE_HANDLER,
  UserRole.SALES_HANDLER,
  UserRole.MANUFACTURING_SUPERVISOR,
];

router.get('/dashboard', authorize(...reportRoles), (req, res, next) => reportsController.getDashboard(req, res, next));
router.get('/monthly', authorize(...reportRoles), (req, res, next) => reportsController.getMonthly(req, res, next));
router.get('/annual', authorize(...reportRoles), (req, res, next) => reportsController.getAnnual(req, res, next));
router.get('/trends', authorize(...reportRoles), (req, res, next) => reportsController.getTrends(req, res, next));

export default router;
