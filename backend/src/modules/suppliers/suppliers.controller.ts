import { Response, NextFunction } from 'express';
import { suppliersService } from './suppliers.service';
import { AuthenticatedRequest } from '../../types';
import { sendSuccess, parsePagination, buildPaginationMeta } from '../../utils/response';

export class SuppliersController {
  async createEnquiry(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const enquiry = await suppliersService.createEnquiry(req.body, req.user!.userId);
      sendSuccess(res, enquiry, 'Enquiry created successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  async updateEnquiryStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await suppliersService.updateEnquiryStatus(req.body, req.user!.userId);
      sendSuccess(res, result, 'Enquiry status updated');
    } catch (err) {
      next(err);
    }
  }

  async getEnquiry(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const enquiry = await suppliersService.getEnquiryById(id);
      sendSuccess(res, enquiry);
    } catch (err) {
      next(err);
    }
  }

  async listEnquiries(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const pagination = parsePagination(req.query as any);
      const { search, status, supplierId } = req.query as any;
      const { enquiries, total } = await suppliersService.listEnquiries(pagination, { search, status, supplierId });
      const meta = buildPaginationMeta(total, pagination);
      sendSuccess(res, enquiries, undefined, 200, meta);
    } catch (err) {
      next(err);
    }
  }

  async addQuotation(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const quotation = await suppliersService.addQuotation(req.body, req.user!.userId);
      sendSuccess(res, quotation, 'Quotation added successfully', 201);
    } catch (err) {
      next(err);
    }
  }

  async updateQuotationStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await suppliersService.updateQuotationStatus(req.body, req.user!.userId);
      sendSuccess(res, result, 'Quotation status updated');
    } catch (err) {
      next(err);
    }
  }

  async listQuotations(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const pagination = parsePagination(req.query as any);
      const { search, status, supplierId } = req.query as any;
      const { quotations, total } = await suppliersService.listQuotations(pagination, { search, status, supplierId });
      const meta = buildPaginationMeta(total, pagination);
      sendSuccess(res, quotations, undefined, 200, meta);
    } catch (err) {
      next(err);
    }
  }

  async listSuppliers(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const suppliers = await suppliersService.listSuppliers();
      sendSuccess(res, suppliers);
    } catch (err) {
      next(err);
    }
  }
}

export const suppliersController = new SuppliersController();
