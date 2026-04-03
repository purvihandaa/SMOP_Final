import { beforeAll, afterAll } from 'vitest';

// Test setup - ensure test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-for-testing';
process.env.PORT = '3099';
process.env.CORS_ORIGIN = 'http://localhost:8080';
process.env.BCRYPT_SALT_ROUNDS = '4'; // faster for tests

beforeAll(() => {
  console.log('🧪 Test suite starting...');
});

afterAll(() => {
  console.log('🧪 Test suite completed.');
});
