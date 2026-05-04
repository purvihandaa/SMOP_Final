import { describe, it, expect } from 'vitest';
import { parsePagination, buildPaginationMeta } from '../../src/utils/response';
import { AppError, NotFoundError, UnauthorizedError, ForbiddenError, ConflictError, ValidationError } from '../../src/utils/errors';

describe('Response Utilities', () => {
  // ════════════════════════════════════════════════════════════════════════
  // parsePagination — BVA
  // ════════════════════════════════════════════════════════════════════════

  describe('parsePagination', () => {
    it('should return defaults when no params provided', () => {
      const result = parsePagination({});
      expect(result).toEqual({ page: 1, limit: 20, skip: 0 });
    });

    it('should parse valid page and limit', () => {
      const result = parsePagination({ page: '3', limit: '50' });
      expect(result).toEqual({ page: 3, limit: 50, skip: 100 });
    });

    // BVA: page boundaries
    it('should clamp page=0 to page=1 (BVA: below minimum)', () => {
      const result = parsePagination({ page: '0' });
      expect(result.page).toBe(1);
      expect(result.skip).toBe(0);
    });

    it('should clamp page=-5 to page=1 (BVA: negative)', () => {
      const result = parsePagination({ page: '-5' });
      expect(result.page).toBe(1);
    });

    it('should accept page=1 (BVA: minimum valid)', () => {
      const result = parsePagination({ page: '1' });
      expect(result.page).toBe(1);
      expect(result.skip).toBe(0);
    });

    it('should accept page=2 (skip = limit)', () => {
      const result = parsePagination({ page: '2', limit: '10' });
      expect(result.skip).toBe(10);
    });

    // BVA: limit boundaries
    it('should clamp limit=0 to limit=1 (BVA: below minimum)', () => {
      const result = parsePagination({ limit: '0' });
      expect(result.limit).toBe(1);
    });

    it('should clamp limit=-1 to limit=1 (BVA: negative)', () => {
      const result = parsePagination({ limit: '-1' });
      expect(result.limit).toBe(1);
    });

    it('should accept limit=1 (BVA: minimum valid)', () => {
      const result = parsePagination({ limit: '1' });
      expect(result.limit).toBe(1);
    });

    it('should accept limit=100 (BVA: maximum valid)', () => {
      const result = parsePagination({ limit: '100' });
      expect(result.limit).toBe(100);
    });

    it('should clamp limit=101 to limit=100 (BVA: above maximum)', () => {
      const result = parsePagination({ limit: '101' });
      expect(result.limit).toBe(100);
    });

    it('should clamp limit=999 to limit=100 (BVA: far above max)', () => {
      const result = parsePagination({ limit: '999' });
      expect(result.limit).toBe(100);
    });

    // NaN handling — current implementation does NOT guard against NaN
    // parseInt('abc') = NaN, Math.max(1, NaN) = NaN
    // Documenting actual behavior; this is a known limitation
    it('should return NaN for non-numeric page string (no guard in impl)', () => {
      const result = parsePagination({ page: 'abc' });
      expect(result.page).toBeNaN();
    });

    it('should return NaN for non-numeric limit string (no guard in impl)', () => {
      const result = parsePagination({ limit: 'xyz' });
      expect(result.limit).toBeNaN();
    });

    // Skip calculation
    it('should calculate skip correctly for page=5, limit=25', () => {
      const result = parsePagination({ page: '5', limit: '25' });
      expect(result.skip).toBe(100); // (5-1)*25
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // buildPaginationMeta
  // ════════════════════════════════════════════════════════════════════════

  describe('buildPaginationMeta', () => {
    it('should calculate totalPages for exact division', () => {
      const meta = buildPaginationMeta(100, { page: 1, limit: 10, skip: 0 });
      expect(meta).toEqual({ page: 1, limit: 10, total: 100, totalPages: 10 });
    });

    it('should ceil totalPages for remainder (BVA)', () => {
      const meta = buildPaginationMeta(101, { page: 1, limit: 10, skip: 0 });
      expect(meta.totalPages).toBe(11);
    });

    it('should return totalPages=0 when total=0 (BVA: zero)', () => {
      const meta = buildPaginationMeta(0, { page: 1, limit: 10, skip: 0 });
      expect(meta.totalPages).toBe(0);
    });

    it('should return totalPages=1 when total=1 (BVA: minimum)', () => {
      const meta = buildPaginationMeta(1, { page: 1, limit: 10, skip: 0 });
      expect(meta.totalPages).toBe(1);
    });

    it('should return totalPages=1 when total equals limit', () => {
      const meta = buildPaginationMeta(20, { page: 1, limit: 20, skip: 0 });
      expect(meta.totalPages).toBe(1);
    });

    it('should return totalPages=2 when total = limit + 1 (BVA)', () => {
      const meta = buildPaginationMeta(21, { page: 1, limit: 20, skip: 0 });
      expect(meta.totalPages).toBe(2);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Error Classes
// ════════════════════════════════════════════════════════════════════════════

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should set default statusCode=400 and isOperational=true', () => {
      const err = new AppError('Something went wrong');
      expect(err.message).toBe('Something went wrong');
      expect(err.statusCode).toBe(400);
      expect(err.isOperational).toBe(true);
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(AppError);
    });

    it('should accept custom statusCode', () => {
      const err = new AppError('Conflict', 409);
      expect(err.statusCode).toBe(409);
    });

    it('should accept isOperational=false for programming errors', () => {
      const err = new AppError('Critical', 500, false);
      expect(err.isOperational).toBe(false);
    });
  });

  describe('NotFoundError', () => {
    it('should format message with entity name only', () => {
      const err = new NotFoundError('User');
      expect(err.message).toBe('User not found');
      expect(err.statusCode).toBe(404);
    });

    it('should format message with entity name and id', () => {
      const err = new NotFoundError('PurchaseOrder', 'po-123');
      expect(err.message).toBe("PurchaseOrder with id 'po-123' not found");
      expect(err.statusCode).toBe(404);
    });
  });

  describe('UnauthorizedError', () => {
    it('should default message to "Unauthorized"', () => {
      const err = new UnauthorizedError();
      expect(err.message).toBe('Unauthorized');
      expect(err.statusCode).toBe(401);
    });

    it('should accept custom message', () => {
      const err = new UnauthorizedError('Token expired');
      expect(err.message).toBe('Token expired');
    });
  });

  describe('ForbiddenError', () => {
    it('should set statusCode=403', () => {
      const err = new ForbiddenError();
      expect(err.statusCode).toBe(403);
      expect(err.message).toContain('insufficient permissions');
    });

    it('should accept custom message', () => {
      const err = new ForbiddenError('No access to admin panel');
      expect(err.message).toBe('No access to admin panel');
    });
  });

  describe('ConflictError', () => {
    it('should set statusCode=409', () => {
      const err = new ConflictError('Duplicate entry');
      expect(err.statusCode).toBe(409);
      expect(err.message).toBe('Duplicate entry');
    });
  });

  describe('ValidationError', () => {
    it('should set statusCode=422', () => {
      const err = new ValidationError('Invalid input');
      expect(err.statusCode).toBe(422);
      expect(err.message).toBe('Invalid input');
    });
  });

  describe('Error Hierarchy', () => {
    it('all custom errors should be instanceof AppError', () => {
      expect(new NotFoundError('X')).toBeInstanceOf(AppError);
      expect(new UnauthorizedError()).toBeInstanceOf(AppError);
      expect(new ForbiddenError()).toBeInstanceOf(AppError);
      expect(new ConflictError('X')).toBeInstanceOf(AppError);
      expect(new ValidationError('X')).toBeInstanceOf(AppError);
    });

    it('all custom errors should be instanceof Error', () => {
      expect(new NotFoundError('X')).toBeInstanceOf(Error);
      expect(new UnauthorizedError()).toBeInstanceOf(Error);
      expect(new ForbiddenError()).toBeInstanceOf(Error);
      expect(new ConflictError('X')).toBeInstanceOf(Error);
      expect(new ValidationError('X')).toBeInstanceOf(Error);
    });
  });
});
