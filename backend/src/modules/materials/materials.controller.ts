import { Response, NextFunction } from 'express';
import { materialsService } from './materials.service';
import { AuthenticatedRequest } from '../../types';
import { sendSuccess, parsePagination, buildPaginationMeta } from '../../utils/response';

export class MaterialsController {
  async recordReceipt(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const receipt = await materialsService.recordReceipt(req.body, req.user!.userId);
      sendSuccess(res, receipt, 'Material receipt recorded successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  async recordInspection(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const inspection = await materialsService.recordInspection(req.body, req.user!.userId);
      sendSuccess(res, inspection, 'Material inspection recorded successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  async createBatch(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const batch = await materialsService.createBatch(req.body, req.user!.userId);
      sendSuccess(res, batch, 'Batch created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  async viewInventory(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const pagination = parsePagination(req.query as any);
      const { search, type, locationId } = req.query as any;
      const { items, total } = await materialsService.viewInventory(pagination, { search, type, locationId });
      const meta = buildPaginationMeta(total, pagination);
      sendSuccess(res, items, undefined, 200, meta);
    } catch (err) {
      next(err);
    }
  }

  async updateLocation(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await materialsService.updateLocation(req.body, req.user!.userId);
      sendSuccess(res, result, 'Inventory location updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async listLocations(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const locations = await materialsService.listLocations();
      sendSuccess(res, locations);
    } catch (err) {
      next(err);
    }
  }

  async listMaterials(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const materials = await materialsService.listMaterials();
      sendSuccess(res, materials);
    } catch (err) {
      next(err);
    }
  }

  async listReceipts(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const pagination = parsePagination(req.query as any);
      const { status, purchaseOrderId } = req.query as any;
      const { receipts, total } = await materialsService.listReceipts(pagination, { status, purchaseOrderId });
      const meta = buildPaginationMeta(total, pagination);
      sendSuccess(res, receipts, undefined, 200, meta);
    } catch (err) {
      next(err);
    }
  }
}

export const materialsController = new MaterialsController();
