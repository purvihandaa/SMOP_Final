import { Response, NextFunction } from 'express';
import { reportsService } from './reports.service';
import { AuthenticatedRequest } from '../../types';
import { sendSuccess } from '../../utils/response';

export class ReportsController {
  async getDashboard(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await reportsService.getDashboard();
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  }

  async getMonthly(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      const month = req.query.month ? parseInt(req.query.month as string) : undefined;
      const data = await reportsService.getMonthlyReport(year, month);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  }

  async getAnnual(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const year = req.query.year ? parseInt(req.query.year as string) : undefined;
      const data = await reportsService.getAnnualReport(year);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  }

  async getTrends(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const days = req.query.days ? parseInt(req.query.days as string) : 30;
      const data = await reportsService.getTrends(days);
      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  }
}

export const reportsController = new ReportsController();
