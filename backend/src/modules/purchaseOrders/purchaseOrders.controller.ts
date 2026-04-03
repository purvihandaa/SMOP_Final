import { Response, NextFunction } from 'express';
import { purchaseOrdersService } from './purchaseOrders.service';
import { AuthenticatedRequest } from '../../types';
import { sendSuccess, parsePagination, buildPaginationMeta } from '../../utils/response';

export class PurchaseOrdersController {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const po = await purchaseOrdersService.createPurchaseOrder(req.body, req.user!.userId);
      sendSuccess(res, po, 'Purchase order created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  async createFromQuotation(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const po = await purchaseOrdersService.createFromQuotation(req.body, req.user!.userId);
      sendSuccess(res, po, 'Purchase order created from quotation', 201);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const po = await purchaseOrdersService.getById(id);
      sendSuccess(res, po);
    } catch (err) {
      next(err);
    }
  }

  async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const pagination = parsePagination(req.query as any);
      const { search, status, supplierId } = req.query as any;
      const { orders, total } = await purchaseOrdersService.listPurchaseOrders(pagination, { search, status, supplierId });
      const meta = buildPaginationMeta(total, pagination);
      sendSuccess(res, orders, undefined, 200, meta);
    } catch (err) {
      next(err);
    }
  }

  async updateStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const updated = await purchaseOrdersService.updateStatus(req.body, req.user!.userId);
      sendSuccess(res, updated, 'PO status updated');
    } catch (err) {
      next(err);
    }
  }
}

export const purchaseOrdersController = new PurchaseOrdersController();
