import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────
vi.mock('../../src/config/database', () => ({
  default: {
    user: { findUnique: vi.fn(), update: vi.fn() },
  },
}));
vi.mock('../../src/utils/auditLogger', () => ({ writeAuditLog: vi.fn() }));
vi.mock('bcryptjs', () => ({
  default: { compare: vi.fn() },
}));
vi.mock('jsonwebtoken', () => ({
  default: { sign: vi.fn().mockReturnValue('mock-jwt-token') },
}));
vi.mock('../../src/config', () => ({
  config: { jwt: { secret: 'test-secret', expiresIn: '7d' } },
}));

import prisma from '../../src/config/database';
import { writeAuditLog } from '../../src/utils/auditLogger';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AuthService } from '../../src/modules/auth/auth.service';
import { UnauthorizedError, NotFoundError } from '../../src/utils/errors';

const service = new AuthService();

describe('AuthService', () => {
  beforeEach(() => vi.clearAllMocks());

  // ════════════════════════════════════════════════════════════════════════
  // login
  // ════════════════════════════════════════════════════════════════════════

  describe('login', () => {
    const activeUser = {
      id: 'u1', username: 'admin', password: 'hashed-pw', role: 'ADMINISTRATOR',
      fullName: 'Admin User', email: 'admin@test.com', isActive: true, lastLogin: null,
    };

    it('should throw UnauthorizedError when user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      await expect(service.login({ username: 'ghost', password: 'pw' }))
        .rejects.toThrow(/Invalid credentials/);
    });

    it('should throw UnauthorizedError when user is inactive', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...activeUser, isActive: false } as any);
      await expect(service.login({ username: 'admin', password: 'pw' }))
        .rejects.toThrow(/Invalid credentials/);
    });

    it('should throw UnauthorizedError when password is wrong', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(activeUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as any);
      await expect(service.login({ username: 'admin', password: 'wrong' }))
        .rejects.toThrow(/Invalid credentials/);
    });

    it('should return token and user info on valid credentials', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(activeUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as any);
      vi.mocked(prisma.user.update).mockResolvedValue(activeUser as any);

      const result = await service.login({ username: 'admin', password: 'correct' });

      expect(result.token).toBe('mock-jwt-token');
      expect(result.user.userId).toBe('u1');
      expect(result.user.username).toBe('admin');
      expect(result.user.role).toBe('ADMINISTRATOR');
      expect(result.user.fullName).toBe('Admin User');
    });

    it('should update lastLogin on successful login', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(activeUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as any);
      vi.mocked(prisma.user.update).mockResolvedValue(activeUser as any);

      await service.login({ username: 'admin', password: 'correct' });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { lastLogin: expect.any(Date) },
      });
    });

    it('should sign JWT with correct payload', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(activeUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as any);
      vi.mocked(prisma.user.update).mockResolvedValue(activeUser as any);

      await service.login({ username: 'admin', password: 'correct' });

      expect(jwt.sign).toHaveBeenCalledWith(
        { userId: 'u1', username: 'admin', role: 'ADMINISTRATOR' },
        'test-secret',
        expect.objectContaining({ expiresIn: '7d' }),
      );
    });

    it('should write audit log with LOGIN action and IP address', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(activeUser as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as any);
      vi.mocked(prisma.user.update).mockResolvedValue(activeUser as any);

      await service.login({ username: 'admin', password: 'correct' }, '192.168.1.1');

      expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
        action: 'LOGIN', actorId: 'u1', ipAddress: '192.168.1.1',
      }));
    });

    it('should NOT write audit log on failed login', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      try { await service.login({ username: 'ghost', password: 'pw' }); } catch {}
      expect(writeAuditLog).not.toHaveBeenCalled();
    });
  });

  // ════════════════════════════════════════════════════════════════════════
  // getSession
  // ════════════════════════════════════════════════════════════════════════

  describe('getSession', () => {
    it('should return user data when active user found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'u1', username: 'admin', email: 'a@b.com', fullName: 'Admin',
        role: 'ADMINISTRATOR', isActive: true, lastLogin: new Date(),
      } as any);

      const result = await service.getSession('u1');

      expect(result.id).toBe('u1');
      expect(result.username).toBe('admin');
    });

    it('should throw NotFoundError when user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      await expect(service.getSession('u-nope')).rejects.toThrow(/not found/i);
    });

    it('should throw NotFoundError when user is inactive', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'u1', isActive: false,
      } as any);
      await expect(service.getSession('u1')).rejects.toThrow(/not found/i);
    });
  });
});
