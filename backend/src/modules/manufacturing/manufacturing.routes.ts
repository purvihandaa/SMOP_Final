import { Router } from 'express';
import { manufacturingController } from './manufacturing.controller';
import { authenticate } from '../../middleware/auth';
import { authorize } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import {
  createProcessSchema,
  createBOMSchema,
  feasibilityAnalyzeSchema,
  scenarioSchema,
} from './manufacturing.validator';
import { UserRole } from '@prisma/client';

const router = Router();
router.use(authenticate);

// Process management
router.post(
  '/process/create',
  authorize(UserRole.ADMINISTRATOR, UserRole.MANUFACTURING_SUPERVISOR),
  validate({ body: createProcessSchema }),
  (req, res, next) => manufacturingController.createProcess(req, res, next),
);

// BOM management
router.post(
  '/bom/create',
  authorize(UserRole.ADMINISTRATOR, UserRole.MANUFACTURING_SUPERVISOR),
  validate({ body: createBOMSchema }),
  (req, res, next) => manufacturingController.createBOM(req, res, next),
);

router.get(
  '/bom/view',
  authorize(
    UserRole.ADMINISTRATOR, UserRole.MANUFACTURING_SUPERVISOR,
    UserRole.MANUFACTURING_WORKER, UserRole.MANAGEMENT,
  ),
  (req, res, next) => manufacturingController.viewBOMs(req, res, next),
);

// Feasibility analysis
router.post(
  '/feasibility/analyze',
  authorize(UserRole.ADMINISTRATOR, UserRole.MANUFACTURING_SUPERVISOR, UserRole.MANAGEMENT),
  validate({ body: feasibilityAnalyzeSchema }),
  (req, res, next) => manufacturingController.analyzeFeasibility(req, res, next),
);

// Scenario planning
router.post(
  '/feasibility/scenario',
  authorize(UserRole.ADMINISTRATOR, UserRole.MANUFACTURING_SUPERVISOR, UserRole.MANAGEMENT),
  validate({ body: scenarioSchema }),
  (req, res, next) => manufacturingController.runScenario(req, res, next),
);

// Worker instructions (read-only access for workers)
router.get(
  '/worker/instructions',
  authorize(
    UserRole.ADMINISTRATOR, UserRole.MANUFACTURING_SUPERVISOR,
    UserRole.MANUFACTURING_WORKER,
  ),
  (req, res, next) => manufacturingController.getWorkerInstructions(req, res, next),
);

export default router;
