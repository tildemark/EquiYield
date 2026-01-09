import { prisma } from '../prisma.js';
import { getRedis, REDIS_KEYS } from '../redis.js';

export async function getCurrentYear(): Promise<number> {
  const now = new Date();
  return now.getFullYear();
}

// Determine the active contribution cycle due date (15th or 30th/last day of month)
function getCurrentCycleDueDate(now: Date): Date {
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const dueDay = now.getDate() <= 15 ? 15 : Math.min(30, lastDay);
  return new Date(year, month, dueDay, 23, 59, 59, 999);
}

export async function invalidateEstimatedDividendPerShare(year?: number) {
  const redis = getRedis();
  const y = year ?? (await getCurrentYear());
  await redis.del(REDIS_KEYS.estimatedDividendPerShare(y));
}

export async function getEstimatedDividendPerShare(): Promise<number> {
  const redis = getRedis();
  const year = await getCurrentYear();
  const key = REDIS_KEYS.estimatedDividendPerShare(year);

  const cached = await redis.get(key);
  if (cached) return Number(cached);

  const pool = await prisma.profitPool.findUnique({ where: { year } });
  const amount = pool?.amount ?? 0;

  // Get current cycle (1 = due 15th, 2 = due 30th/last day)
  const now = new Date();
  const cycle = now.getDate() <= 15 ? 1 : 2;
  const dueDate = getCurrentCycleDueDate(now);

  // Find members eligible for this cycle
  const cycleEligibilities = await prisma.cycleDividendEligibility.findMany({
    where: { year, cycle, isEligible: true },
    select: { userId: true },
  });
  const eligibleUserIds = cycleEligibilities.map((e: { userId: number }) => e.userId);

  if (eligibleUserIds.length === 0) {
    await redis.set(key, '0');
    return 0;
  }

  // For eligible members, check if they had a FULL payment on/before the due date
  const contributions = await prisma.contribution.findMany({
    where: {
      userId: { in: eligibleUserIds },
      date_paid: { lte: dueDate },
      status: 'FULL',
    },
    orderBy: [{ userId: 'asc' }, { date_paid: 'desc' }],
  });

  const latestByUser = new Map<number, typeof contributions[0]>();
  for (const c of contributions) {
    if (!latestByUser.has(c.userId)) latestByUser.set(c.userId, c);
  }

  // Count shares only from members with valid FULL payment on/before due date
  const users = await prisma.user.findMany({ where: { id: { in: eligibleUserIds } } });
  const totalEligibleShares = users.reduce((acc: number, u: { id: number; share_count: number }) => {
    const hasValidPayment = latestByUser.has(u.id);
    if (hasValidPayment) return acc + (u.share_count || 0);
    return acc;
  }, 0);

  const perShare = totalEligibleShares > 0 ? amount / totalEligibleShares : 0;

  await redis.set(key, String(perShare));
  return perShare;
}
