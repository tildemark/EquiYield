import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';

const SALT_ROUNDS = 10;

export type TokenPayload = {
  userId: number;
  role: Role;
};

export function generatePassword(length = 12): string {
  const raw = crypto.randomBytes(Math.ceil(length * 0.75)).toString('base64');
  return raw.replace(/[^a-zA-Z0-9]/g, '').slice(0, length) || 'TempPass123';
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return secret;
}

export function signToken(payload: TokenPayload, expiresIn: string = '30d'): string {
  const secret = getJwtSecret();
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload {
  const secret = getJwtSecret();
  const decoded = jwt.verify(token, secret);
  const { userId, role } = decoded as TokenPayload;
  return { userId, role };
}
