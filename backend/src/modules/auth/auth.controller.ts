import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { sendSuccess } from '../../utils/response';
import { AuthenticatedRequest } from '../../types';
import { writeAuditLog } from '../../utils/auditLogger';
import { config } from '../../config';

export class AuthController {
  /**
   * POST /api/auth/login
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, user } = await authService.login(req.body, req.ip);

      // Set HTTP-only cookie
      res.cookie('smop_token', token, {
        httpOnly: true,
        secure: config.env === 'production',
        sameSite: config.env === 'production' ? 'strict' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
      });

      sendSuccess(res, user, 'Login successful');
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/auth/logout
   */
  async logout(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Audit log
      if (req.user) {
        await writeAuditLog({
          actorId: req.user.userId,
          action: 'LOGOUT',
          entityType: 'User',
          entityId: req.user.userId,
          ipAddress: req.ip,
        });
      }

      res.clearCookie('smop_token', {
        httpOnly: true,
        secure: config.env === 'production',
        sameSite: config.env === 'production' ? 'strict' : 'lax',
        path: '/',
      });

      sendSuccess(res, null, 'Logged out successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/auth/session
   */
  async getSession(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        sendSuccess(res, null, 'No active session');
        return;
      }

      const user = await authService.getSession(req.user.userId);
      sendSuccess(res, user);
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
