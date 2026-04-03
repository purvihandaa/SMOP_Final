import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../config/database';
import { config } from '../../config';
import { JwtPayload } from '../../types';
import { UnauthorizedError, NotFoundError } from '../../utils/errors';
import { writeAuditLog } from '../../utils/auditLogger';
import { LoginInput } from './auth.validator';

export class AuthService {
  /**
   * Authenticate user and return JWT token
   */
  async login(input: LoginInput, ipAddress?: string): Promise<{ token: string; user: Omit<JwtPayload, 'iat' | 'exp'> & { fullName: string; email: string } }> {
    const user = await prisma.user.findUnique({
      where: { username: input.username },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Generate JWT
    const payload: JwtPayload = {
      userId: user.id,
      username: user.username,
      role: user.role,
    };

    const token = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    } as jwt.SignOptions);

    // Audit log
    await writeAuditLog({
      actorId: user.id,
      action: 'LOGIN',
      entityType: 'User',
      entityId: user.id,
      ipAddress,
    });

    return {
      token,
      user: {
        userId: user.id,
        username: user.username,
        role: user.role,
        fullName: user.fullName,
        email: user.email,
      },
    };
  }

  /**
   * Get current user session info
   */
  async getSession(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        lastLogin: true,
      },
    });

    if (!user || !user.isActive) {
      throw new NotFoundError('User');
    }

    return user;
  }
}

export const authService = new AuthService();
