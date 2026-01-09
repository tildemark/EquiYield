import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { comparePassword, hashPassword, signToken } from '../services/auth.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

router.post('/login', async (req, res) => {
  const parsed = loginBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || !user.passwordHash || user.archivedAt) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await comparePassword(parsed.data.password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const token = signToken({ userId: user.id, role: user.role });
  res.json({
    token,
    user: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      forcePasswordReset: user.forcePasswordReset,
    },
  });
});

const changePasswordBody = z.object({
  currentPassword: z.string().min(6).optional(),
  newPassword: z.string().min(8),
});

router.post('/change-password', requireAuth, async (req, res) => {
  const parsed = changePasswordBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const authUser = (req as any).authUser as { id: number };
  const user = await prisma.user.findUnique({ where: { id: authUser.id } });
  if (!user || !user.passwordHash) return res.status(400).json({ error: 'Account missing password' });

  // Require current password to avoid hijacking
  if (parsed.data.currentPassword) {
    const ok = await comparePassword(parsed.data.currentPassword, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Current password incorrect' });
  }

  const newHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash, forcePasswordReset: false } });

  res.json({ message: 'Password updated' });
});

export default router;
