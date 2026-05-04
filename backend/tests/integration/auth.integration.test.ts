import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app, loginAs, USERS } from './helpers';

describe('Auth Integration', () => {
  // ══════════════════════════════════════════════════════════════════════════
  // POST /api/auth/login
  // ══════════════════════════════════════════════════════════════════════════

  describe('POST /api/auth/login', () => {
    it('should return 200 and set smop_token cookie on valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('userId');
      expect(res.body.data).toHaveProperty('username', 'admin');
      expect(res.body.data).toHaveProperty('role', 'ADMINISTRATOR');
      expect(res.body.data).toHaveProperty('fullName', 'System Administrator');

      // Verify HTTP-only cookie is set
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const tokenCookie = (Array.isArray(cookies) ? cookies : [cookies])
        .find((c: string) => c.includes('smop_token'));
      expect(tokenCookie).toBeDefined();
      expect(tokenCookie).toContain('HttpOnly');
    });

    it('should return 401 for non-existent username', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'nonexistent', password: 'password123' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 for wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 422 for missing username (validation)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ password: 'password123' });

      expect(res.status).toBe(422);
    });

    it('should return 422 for missing password (validation)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin' });

      expect(res.status).toBe(422);
    });

    it('should return 422 for empty body', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({});

      expect(res.status).toBe(422);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // GET /api/auth/session
  // ══════════════════════════════════════════════════════════════════════════

  describe('GET /api/auth/session', () => {
    let cookie: string;

    beforeAll(async () => {
      cookie = await loginAs('admin');
    });

    it('should return 200 with user data when authenticated', async () => {
      const res = await request(app)
        .get('/api/auth/session')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('username', 'admin');
      expect(res.body.data).toHaveProperty('role', 'ADMINISTRATOR');
      expect(res.body.data).toHaveProperty('email');
    });

    it('should return 401 when no cookie provided', async () => {
      const res = await request(app).get('/api/auth/session');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return 401 with invalid cookie', async () => {
      const res = await request(app)
        .get('/api/auth/session')
        .set('Cookie', 'smop_token=invalid-jwt-garbage');

      expect(res.status).toBe(401);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // POST /api/auth/logout
  // ══════════════════════════════════════════════════════════════════════════

  describe('POST /api/auth/logout', () => {
    it('should return 200 and clear cookie on authenticated logout', async () => {
      const cookie = await loginAs('admin');
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Cookie should be cleared (set to empty / expired)
      const cookies = res.headers['set-cookie'];
      if (cookies) {
        const tokenCookie = (Array.isArray(cookies) ? cookies : [cookies])
          .find((c: string) => c.includes('smop_token'));
        if (tokenCookie) {
          // Cookie should be expired or empty
          expect(tokenCookie).toMatch(/expires=.*1970|Max-Age=0|smop_token=;/i);
        }
      }
    });

    it('should return 401 on unauthenticated logout', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(401);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // All seeded users can login
  // ══════════════════════════════════════════════════════════════════════════

  describe('All seeded users can login', () => {
    const userKeys = Object.keys(USERS) as Array<keyof typeof USERS>;

    it.each(userKeys)('should login successfully as %s', async (key) => {
      const { username, password, role } = USERS[key];
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username, password });

      expect(res.status).toBe(200);
      expect(res.body.data.role).toBe(role);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Health check
  // ══════════════════════════════════════════════════════════════════════════

  describe('GET /api/health', () => {
    it('should return healthy status (no auth required)', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('healthy');
    });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // 404 handler
  // ══════════════════════════════════════════════════════════════════════════

  describe('404 handler', () => {
    it('should return 404 for unknown routes', async () => {
      const cookie = await loginAs('admin');
      const res = await request(app)
        .get('/api/does-not-exist-at-all')
        .set('Cookie', cookie);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
