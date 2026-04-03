import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AuthenticatedRequest, JwtPayload } from '../types';
import { UnauthorizedError } from '../utils/errors';

/**
 * JWT authentication middleware.
 * Extracts JWT from HTTP-only cookie named 'smop_token'.
 */
export function authenticate(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): void {
  try {
    const token = req.cookies?.smop_token;

    if (!token) {
      throw new UnauthorizedError('No authentication token provided');
    }

    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      next(err);
      return;
    }
    if (err instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid or expired token'));
      return;
    }
    next(err);
  }
}
