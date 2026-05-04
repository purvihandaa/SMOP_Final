import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

// ─── Mocks ───────────────────────────────────────────────────────────────
vi.mock('../../src/config', () => ({
  config: { jwt: { secret: 'test-secret', expiresIn: '7d' } },
}));

import { authenticate } from '../../src/middleware/auth';
import { authorize } from '../../src/middleware/rbac';
import { validate } from '../../src/middleware/validate';
import { errorHandler } from '../../src/middleware/errorHandler';
import { AppError, NotFoundError, UnauthorizedError, ForbiddenError } from '../../src/utils/errors';

// Helper to create mock req/res/next
function createMocks(overrides: any = {}) {
  const req = { cookies: {}, user: undefined, body: {}, query: {}, params: {}, ...overrides } as any;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as any;
  const next = vi.fn();
  return { req, res, next };
}

describe('Auth Middleware', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('authenticate', () => {
    it('should call next with error when no token in cookies', () => {
      const { req, res, next } = createMocks({ cookies: {} });
      authenticate(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    });

    it('should call next with error when cookies is undefined', () => {
      const { req, res, next } = createMocks({ cookies: undefined });
      authenticate(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    });

    it('should call next with error for invalid/expired token', () => {
      const { req, res, next } = createMocks({ cookies: { smop_token: 'invalid-token' } });
      authenticate(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    });

    it('should set req.user and call next() for valid token', () => {
      const payload = { userId: 'u1', username: 'admin', role: 'ADMINISTRATOR' };
      const token = jwt.sign(payload, 'test-secret', { expiresIn: '1h' });
      const { req, res, next } = createMocks({ cookies: { smop_token: token } });

      authenticate(req, res, next);

      expect(req.user).toEqual(expect.objectContaining(payload));
      expect(next).toHaveBeenCalledWith(); // called with no args = success
    });

    it('should reject expired tokens', () => {
      const payload = { userId: 'u1', username: 'admin', role: 'ADMINISTRATOR' };
      const token = jwt.sign(payload, 'test-secret', { expiresIn: '0s' });
      const { req, res, next } = createMocks({ cookies: { smop_token: token } });
      authenticate(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    });

    it('should reject token signed with wrong secret', () => {
      const payload = { userId: 'u1', username: 'admin', role: 'ADMINISTRATOR' };
      const token = jwt.sign(payload, 'wrong-secret', { expiresIn: '1h' });
      const { req, res, next } = createMocks({ cookies: { smop_token: token } });
      authenticate(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    });
  });
});

describe('RBAC Middleware', () => {
  describe('authorize', () => {
    it('should call next with error when req.user is undefined', () => {
      const middleware = authorize('ADMINISTRATOR' as any);
      const { req, res, next } = createMocks({ user: undefined });
      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
    });

    it('should call next with ForbiddenError when role is not allowed', () => {
      const middleware = authorize('ADMINISTRATOR' as any);
      const { req, res, next } = createMocks({ user: { role: 'WORKER' } });
      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    });

    it('should call next() when user role is in allowed list', () => {
      const middleware = authorize('ADMINISTRATOR' as any, 'PURCHASE_HANDLER' as any);
      const { req, res, next } = createMocks({ user: { role: 'PURCHASE_HANDLER' } });
      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith(); // success
    });

    it('should allow multiple roles', () => {
      const middleware = authorize('ADMINISTRATOR' as any, 'STORE_MANAGER' as any, 'WORKER' as any);
      const { req, res, next } = createMocks({ user: { role: 'WORKER' } });
      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('should include role name in ForbiddenError message', () => {
      const middleware = authorize('ADMINISTRATOR' as any);
      const { req, res, next } = createMocks({ user: { role: 'WORKER' } });
      middleware(req, res, next);
      const err = next.mock.calls[0][0];
      expect(err.message).toContain('WORKER');
    });
  });
});

describe('Validation Middleware', () => {
  describe('validate', () => {
    it('should call next() when body validates successfully', () => {
      const { z } = require('zod');
      const schema = z.object({ name: z.string().min(1) });
      const middleware = validate({ body: schema });
      const { req, res, next } = createMocks({ body: { name: 'Test' } });

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(); // success
      expect(req.body.name).toBe('Test');
    });

    it('should call next(err) when body validation fails', () => {
      const { z } = require('zod');
      const schema = z.object({ name: z.string().min(1) });
      const middleware = validate({ body: schema });
      const { req, res, next } = createMocks({ body: {} });

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should validate query params when schema provided', () => {
      const { z } = require('zod');
      const schema = z.object({ page: z.string().optional() });
      const middleware = validate({ query: schema });
      const { req, res, next } = createMocks({ query: { page: '1' } });

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
    });
  });
});

describe('Error Handler Middleware', () => {
  describe('errorHandler', () => {
    it('should handle AppError with correct status and message', () => {
      const { req, res, next } = createMocks();
      const err = new AppError('Bad request', 400);

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Bad request' });
    });

    it('should handle NotFoundError with 404', () => {
      const { req, res, next } = createMocks();
      const err = new NotFoundError('User', 'u-123');

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: "User with id 'u-123' not found" });
    });

    it('should handle Prisma P2002 duplicate error', () => {
      const { req, res, next } = createMocks();
      const err = new Error('Unique constraint') as any;
      err.constructor = { name: 'PrismaClientKnownRequestError' };
      err.code = 'P2002';
      err.meta = { target: ['email'] };

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false, error: expect.stringContaining('email'),
      }));
    });

    it('should handle Prisma P2025 not found error', () => {
      const { req, res, next } = createMocks();
      const err = new Error('Record not found') as any;
      err.constructor = { name: 'PrismaClientKnownRequestError' };
      err.code = 'P2025';

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should handle ZodError with 422 and formatted message', () => {
      const { req, res, next } = createMocks();
      const err = new Error('Validation') as any;
      err.constructor = { name: 'ZodError' };
      err.errors = [{ path: ['name'], message: 'Required' }];

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(422);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: false, error: 'Validation failed', message: 'name: Required',
      }));
    });

    it('should return 500 for unknown errors', () => {
      const { req, res, next } = createMocks();
      const err = new Error('Something unexpected');

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('should hide error details in production', () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const { req, res, next } = createMocks();
      const err = new Error('Secret internal error');

      errorHandler(err, req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: false, error: 'Internal server error',
      });
      process.env.NODE_ENV = origEnv;
    });
  });
});
