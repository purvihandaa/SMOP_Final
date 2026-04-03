import { Response } from 'express';
import { ApiResponse, PaginationMeta, PaginationParams } from '../types';

/**
 * Standard success response
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode = 200,
  meta?: PaginationMeta,
): void {
  const response: ApiResponse<T> = {
    success: true,
    data,
    message,
    meta,
  };
  res.status(statusCode).json(response);
}

/**
 * Standard error response
 */
export function sendError(
  res: Response,
  error: string,
  statusCode = 400,
  message?: string,
): void {
  const response: ApiResponse = {
    success: false,
    error,
    message,
  };
  res.status(statusCode).json(response);
}

/**
 * Parse pagination params from query string
 */
export function parsePagination(query: { page?: string; limit?: string }): PaginationParams {
  const page = Math.max(1, parseInt(query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

/**
 * Build pagination meta from total count
 */
export function buildPaginationMeta(
  total: number,
  params: PaginationParams,
): PaginationMeta {
  return {
    page: params.page,
    limit: params.limit,
    total,
    totalPages: Math.ceil(total / params.limit),
  };
}
