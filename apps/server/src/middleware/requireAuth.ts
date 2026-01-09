import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { verifyToken } from '../services/auth.js';
import { prisma } from '../prisma.js';

export type AuthUser = { id: number; role: Role };

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.header('authorization');
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization header missing' });
    }

    const token = header.replace('Bearer ', '').trim();
    if (!token) return res.status(401).json({ error: 'Token missing' });

    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || user.archivedAt) return res.status(403).json({ error: 'Account inactive' });

    (req as any).authUser = { id: user.id, role: user.role } as AuthUser;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
