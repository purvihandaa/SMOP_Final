import { Response, NextFunction } from 'express';
import { manufacturingService } from './manufacturing.service';
import { AuthenticatedRequest } from '../../types';
import { sendSuccess } from '../../utils/response';

export class ManufacturingController {
  async createProcess(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const process = await manufacturingService.createProcess(req.body, req.user!.userId);
      sendSuccess(res, process, 'Process created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  async createBOM(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const bom = await manufacturingService.createBOM(req.body, req.user!.userId);
      sendSuccess(res, bom, 'BOM created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  async viewBOMs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { productName, status } = req.query as any;
      const boms = await manufacturingService.viewBOMs({ productName, status });
      sendSuccess(res, boms);
    } catch (err) {
      next(err);
    }
  }

  async analyzeFeasibility(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await manufacturingService.analyzeFeasibility(req.body, req.user!.userId);
      sendSuccess(res, result, result.feasible ? 'Production is feasible' : 'Production is not feasible with current inventory');
    } catch (err) {
      next(err);
    }
  }

  async runScenario(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const results = await manufacturingService.runScenario(req.body, req.user!.userId);
      sendSuccess(res, results, 'Scenario analysis completed');
    } catch (err) {
      next(err);
    }
  }

  async getWorkerInstructions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { processId, bomId, orderId } = req.query as any;
      const instructions = await manufacturingService.getWorkerInstructions({ processId, bomId, orderId });
      sendSuccess(res, instructions);
    } catch (err) {
      next(err);
    }
  }
}

export const manufacturingController = new ManufacturingController();
