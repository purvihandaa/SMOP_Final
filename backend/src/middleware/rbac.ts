import { Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { AuthenticatedRequest } from '../types';
import { ForbiddenError, UnauthorizedError } from '../utils/errors';

/**
 * RBAC middleware factory. Returns middleware that restricts access
 * to the specified roles.
 * 
 * Usage: authorize(UserRole.ADMINISTRATOR, UserRole.PURCHASE_HANDLER)
 */
export function authorize(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(
        new ForbiddenError(
          `Role '${req.user.role}' does not have access to this resource`,
        ),
      );
      return;
    }

    next();
  };
}
