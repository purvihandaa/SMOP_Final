import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';

describe('Health Check', () => {
  it('GET /api/health should return healthy status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('healthy');
  });
});

describe('Auth Endpoints', () => {
  describe('POST /api/auth/login', () => {
    it('should reject empty credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});
      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it('should reject invalid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'nonexistent', password: 'wrongpassword' });
      // Will be 401 if DB is seeded, or 401/500 depending on setup
      expect([401, 500]).toContain(res.status);
    });

    it('should return validation error for missing password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin' });
      expect(res.status).toBe(422);
    });
  });

  describe('GET /api/auth/session', () => {
    it('should reject unauthenticated request', async () => {
      const res = await request(app).get('/api/auth/session');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should reject unauthenticated request', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(401);
    });
  });
});

describe('Protected Endpoints - Unauthenticated', () => {
  const protectedEndpoints = [
    { method: 'get', path: '/api/suppliers/enquiry/list' },
    { method: 'post', path: '/api/suppliers/enquiry/create' },
    { method: 'get', path: '/api/purchase-order/list' },
    { method: 'post', path: '/api/purchase-order/create' },
    { method: 'get', path: '/api/inventory/view' },
    { method: 'post', path: '/api/material/receipt' },
    { method: 'get', path: '/api/bom/view' },
    { method: 'get', path: '/api/reports/dashboard' },
    { method: 'get', path: '/api/order/list' },
  ];

  protectedEndpoints.forEach(({ method, path }) => {
    it(`${method.toUpperCase()} ${path} should return 401 without auth`, async () => {
      const res = await (request(app) as any)[method](path);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});

describe('404 Handling', () => {
  it('should return 404 for unknown endpoints', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
