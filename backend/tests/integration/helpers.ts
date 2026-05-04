import request from 'supertest';
import app from '../../src/app';

/**
 * Seeded user credentials (all password: password123).
 * Maps role keys to usernames for easy test usage.
 */
export const USERS = {
  admin:         { username: 'admin',           password: 'password123', role: 'ADMINISTRATOR' },
  purchase:      { username: 'rajesh.purchase', password: 'password123', role: 'PURCHASE_HANDLER' },
  stores:        { username: 'sunil.stores',    password: 'password123', role: 'STORES_HANDLER' },
  manufacturing: { username: 'priya.mfg',       password: 'password123', role: 'MANUFACTURING_SUPERVISOR' },
  worker:        { username: 'amit.worker',     password: 'password123', role: 'MANUFACTURING_WORKER' },
  sales:         { username: 'neha.sales',      password: 'password123', role: 'SALES_HANDLER' },
  management:    { username: 'vikram.mgmt',     password: 'password123', role: 'MANAGEMENT' },
} as const;

export type UserKey = keyof typeof USERS;

/**
 * Login as a seeded user and return the smop_token cookie string
 * for use in subsequent requests via `.set('Cookie', cookie)`.
 */
export async function loginAs(userKey: UserKey): Promise<string> {
  const { username, password } = USERS[userKey];
  const res = await request(app)
    .post('/api/auth/login')
    .send({ username, password })
    .expect(200);

  // Extract smop_token from set-cookie header
  const cookies = res.headers['set-cookie'];
  if (!cookies) throw new Error(`Login failed for ${username}: no set-cookie header`);
  const cookieArr = Array.isArray(cookies) ? cookies : [cookies];
  const tokenCookie = cookieArr.find((c: string) => c.startsWith('smop_token='));
  if (!tokenCookie) throw new Error(`Login failed for ${username}: no smop_token cookie`);
  return tokenCookie.split(';')[0]; // "smop_token=xxx"
}

/**
 * Generate a unique suffix for test data to avoid conflicts between runs.
 */
export function uniqueId(prefix = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export { app };
