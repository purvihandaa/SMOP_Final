import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

/**
 * Request validation middleware factory.
 * Validates body, query, and/or params against Zod schemas.
 */
export function validate(schemas: {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        req.body = schemas.body.parse(req.body);
      }
      if (schemas.query) {
        req.query = schemas.query.parse(req.query) as any;
      }
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as any;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
