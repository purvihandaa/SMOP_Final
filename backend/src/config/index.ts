import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend root
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),

  database: {
    url: process.env.DATABASE_URL || '',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'fallback-secret-do-not-use-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:8080',
  },

  bcrypt: {
    saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
  },

  nim: {
    apiKey: process.env.NVIDIA_API_KEY || '',
    model: process.env.NIM_MODEL || 'deepseek-ai/deepseek-v4-pro',
    baseUrl: process.env.NIM_BASE_URL || 'https://integrate.api.nvidia.com/v1',
  },
} as const;
