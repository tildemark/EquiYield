import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { getSystemConfigCached } from '../services/config.js';

const router = Router();
router.use(requireAuth);

router.get('/me', async (req, res) => {
  const authUser = (req as any).authUser as { id: number };
  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: {
      id: true,
      full_name: true,
      email: true,
      phone_number: true,
      gcashNumber: true,
      bankName: true,
      bankAccountNumber: true,
      role: true,
      share_count: true,
      forcePasswordReset: true,
      contributions: { orderBy: { date_paid: 'desc' }, take: 5 },
      loans: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
  });

  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

router.get('/loans', async (req, res) => {
  const authUser = (req as any).authUser as { id: number };
  const loans = await prisma.loan.findMany({
    where: { userId: authUser.id },
    orderBy: { createdAt: 'desc' },
  });
  res.json(loans);
});

router.get('/dividends', async (req, res) => {
  const authUser = (req as any).authUser as { id: number };
  const payouts = await prisma.dividendPayout.findMany({
    where: { userId: authUser.id },
    orderBy: [{ year: 'desc' }, { depositedAt: 'desc' }],
  });
  res.json(payouts);
});

const memberLoanBody = z.object({
  principal: z.number().int().positive(),
  termMonths: z.number().int().positive().min(1).max(60),
});

router.post('/loans', async (req, res) => {
  const authUser = (req as any).authUser as { id: number };
  const parsed = memberLoanBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const [user, cfg] = await Promise.all([
    prisma.user.findUnique({ where: { id: authUser.id } }),
    getSystemConfigCached(),
  ]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.archivedAt) return res.status(403).json({ error: 'Account archived' });

  const { principal, termMonths } = parsed.data;
  if (principal < cfg.min_loan_amount || principal > cfg.max_loan_amount) {
    return res.status(400).json({ error: `Principal must be between ${cfg.min_loan_amount} and ${cfg.max_loan_amount}` });
  }

  const monthlyRateBps = 500; // 5% for members
  const monthlyRate = monthlyRateBps / 10000;
  const interest = Math.round(principal * monthlyRate * termMonths);
  const totalAmount = principal + interest;
  const monthlyAmortization = Math.round(totalAmount / termMonths);
  const now = new Date();
  const dueDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

  const loan = await prisma.loan.create({
    data: {
      borrowerType: 'MEMBER',
      userId: user.id,
      borrowerName: user.full_name,
      borrowerEmail: user.email,
      borrowerPhone: user.phone_number,
      principal,
      interest,
      monthlyRateBps,
      termMonths,
      monthlyAmortization,
      dueDate,
      status: 'PENDING',
    },
  });

  res.status(201).json(loan);
});

export default router;
