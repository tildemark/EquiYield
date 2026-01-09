import { Router } from 'express';
import multer from 'multer';
import xlsx from 'xlsx';
import { prisma } from '../prisma.js';
import { getSystemConfigCached } from '../services/config.js';
import { invalidateSystemConfigCache } from '../services/config.js';
import { getEstimatedDividendPerShare, invalidateEstimatedDividendPerShare } from '../services/dividend.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { generatePassword, hashPassword } from '../services/auth.js';
import { sendEmail } from '../services/email.js';
import { z } from 'zod';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

// Protect all admin routes
router.use(requireAdmin);

// Helper: Generate all payment due dates for a given year
function getPaymentDueDatesForYear(year: number): Array<{ year: number; month: number; day: number; date: Date }> {
  const dueDates: Array<{ year: number; month: number; day: number; date: Date }> = [];
  
  for (let month = 0; month < 12; month++) {
    // 15th of each month
    dueDates.push({
      year,
      month: month + 1,
      day: 15,
      date: new Date(year, month, 15, 23, 59, 59, 999),
    });
    
    // Last day of each month
    const lastDay = new Date(year, month + 1, 0).getDate();
    dueDates.push({
      year,
      month: month + 1,
      day: lastDay,
      date: new Date(year, month, lastDay, 23, 59, 59, 999),
    });
  }
  
  return dueDates;
}

// Helper: Get payment due date key (YYYY-MM-DD)
function getPaymentDueDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Helper: Determine which payment due date a contribution belongs to
function getPaymentDueDateForContribution(
  contributionDate: Date,
  allDueDates: Array<{ year: number; month: number; day: number; date: Date }>
): { year: number; month: number; day: number } | null {
  const contribYear = contributionDate.getFullYear();
  const contribMonth = contributionDate.getMonth() + 1;
  const contribDay = contributionDate.getDate();
  
  // Find the first due date on or after this contribution
  const futureDates = allDueDates.filter(d => 
    d.date.getTime() >= contributionDate.getTime()
  );
  
  if (futureDates.length === 0) return null;
  return futureDates[0];
}

// List users for admin table with payment status
router.get('/users', async (req, res) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const cycle = now.getDate() <= 15 ? 1 : 2;
  const dueDay = cycle === 1 ? 15 : Math.min(30, lastDay);
  const dueDate = new Date(year, month, dueDay, 23, 59, 59, 999);
  const page = req.query.page ? Number(req.query.page) : undefined;
  const pageSize = req.query.pageSize ? Number(req.query.pageSize) : undefined;
  const usePaging = !!(page && pageSize && page > 0 && pageSize > 0);
  
  const users = await prisma.user.findMany({
    orderBy: { id: 'asc' },
    where: { archivedAt: null },
    skip: usePaging ? (page! - 1) * pageSize! : undefined,
    take: usePaging ? pageSize! : undefined,
    select: {
      id: true,
      full_name: true,
      email: true,
      phone_number: true,
      role: true,
      share_count: true,
      contributions: {
        where: {
          date_paid: {
            gte: new Date(year, month, 1),
            lte: dueDate,
          },
        },
        orderBy: { date_paid: 'asc' },
      },
      loans: {
        where: { status: { not: 'PAID' } },
        select: {
          id: true,
          principal: true,
          interest: true,
          dueDate: true,
          status: true,
          payments: { select: { amount: true } },
        },
      },
    },
  });

  const [activeLoansByUser, coMakerByUser, config] = await Promise.all([
    prisma.loan.groupBy({
      by: ['userId'],
      _count: { _all: true },
      where: { userId: { not: null }, status: { not: 'PAID' } },
    }),
    prisma.loanCoMaker.groupBy({ by: ['userId'], _count: { _all: true } }),
    prisma.systemConfig.findUnique({ where: { id: 1 } }),
  ]);

  const loanMap = new Map<number, number>();
  activeLoansByUser.forEach((r: { userId: number | null; _count: { _all: number } }) => {
    if (r.userId != null) loanMap.set(r.userId, r._count._all);
  });

  const coMakerMap = new Map<number, number>();
  coMakerByUser.forEach((r: { userId: number; _count: { _all: number } }) => {
    coMakerMap.set(r.userId, r._count._all);
  });
  
  const usersWithStatus = users.map((u: any) => {
    const expectedAmount = u.share_count * (config?.share_value || 0);

    const totalPaidCurrentDue = (u.contributions || []).reduce((sum: number, c: any) => sum + (c.amount || 0), 0);
    let contribution_status: 'ON_TIME' | 'PARTIAL' | 'LATE' | 'NO_PAYMENT' = 'NO_PAYMENT';
    if (totalPaidCurrentDue >= expectedAmount && expectedAmount > 0) {
      contribution_status = 'ON_TIME';
    } else if (totalPaidCurrentDue > 0) {
      contribution_status = 'PARTIAL';
    } else if (now > dueDate) {
      contribution_status = 'LATE';
    }

    const activeLoans = u.loans || [];
    let loan_payment_status: 'ON_TIME' | 'PARTIAL' | 'LATE' | 'NO_LOAN' = 'NO_LOAN';
    if (activeLoans.length > 0) {
      let hasLate = false;
      let hasPartial = false;

      activeLoans.forEach((loan: any) => {
        const totalDue = (loan.principal || 0) + (loan.interest || 0);
        const totalPaid = (loan.payments || []).reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
        const remaining = totalDue - totalPaid;
        const isPastDue = loan.dueDate ? new Date(loan.dueDate) < now : false;

        if (remaining > 0) {
          if (isPastDue && totalPaid === 0) {
            hasLate = true;
          } else {
            hasPartial = true;
          }
        }
      });

      if (hasLate) loan_payment_status = 'LATE';
      else if (hasPartial) loan_payment_status = 'PARTIAL';
      else loan_payment_status = 'ON_TIME';
    }
    
    return {
      id: u.id,
      full_name: u.full_name,
      email: u.email,
      phone_number: u.phone_number,
      role: u.role,
      share_count: u.share_count,
      contribution_status,
      loan_payment_status,
      hasLoan: loanMap.has(u.id),
      isCoMaker: coMakerMap.has(u.id),
    };
  });

  if (usePaging) {
    const totalItems = await prisma.user.count();
    const totalPages = Math.ceil(totalItems / pageSize!);
    return res.json({ data: usersWithStatus, page, pageSize, totalPages, totalItems });
  }

  res.json(usersWithStatus);
});

// Dashboard metrics
router.get('/dashboard', async (_req, res) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const cycle = now.getDate() <= 15 ? 1 : 2;
  const dueDay = cycle === 1 ? 15 : Math.min(30, lastDay);
  const dueDate = new Date(year, month, dueDay, 23, 59, 59, 999);

  const [config, users, contribAgg, loanAgg, loanCount, loanInterestAgg, loanPaymentAgg, expenseAgg] = await Promise.all([
    prisma.systemConfig.findUnique({ where: { id: 1 } }),
    prisma.user.findMany({
      where: {
        OR: [
          { role: 'MEMBER' },
          { role: 'ADMIN', share_count: { gt: 0 } },
        ],
      },
      select: {
        id: true,
        role: true,
        share_count: true,
        contributions: {
          where: {
            date_paid: {
              lte: dueDate,
            },
          },
          orderBy: { date_paid: 'desc' },
        },
      },
    }),
    prisma.contribution.aggregate({ _sum: { amount: true } }),
    prisma.loan.aggregate({ _sum: { principal: true } }),
    prisma.loan.count(),
    prisma.loan.aggregate({ _sum: { interest: true } }),
    prisma.loanPayment.aggregate({ _sum: { amount: true } }),
    prisma.expense.aggregate({ 
      where: { year },
      _sum: { amount: true } 
    }),
  ]);

  const totalMembers = users.length;
  let onTime = 0;
  let delayed = 0;

  users.forEach((u: any) => {
    const expected = u.share_count * (config?.share_value || 0);
    const totalPaid = u.contributions.reduce((sum: number, c: any) => sum + c.amount, 0);
    
    if (totalPaid >= expected) {
      onTime += 1;
    } else if (now > dueDate) {
      delayed += 1;
    }
  });

  const totalCollections = contribAgg._sum.amount ?? 0;
  const totalLoanAmount = loanAgg._sum.principal ?? 0;
  const totalLoanPayments = loanPaymentAgg._sum.amount ?? 0;
  const currentYearProfitPool = loanInterestAgg._sum.interest ?? 0;
  const totalExpenses = expenseAgg._sum.amount ?? 0;
  const netProfit = currentYearProfitPool - totalExpenses;
  const availableForLoans = Math.max(totalCollections + totalLoanPayments - totalLoanAmount, 0);

  // Calculate total active shares for dividend estimate
  const sharesAgg = await prisma.user.aggregate({
    where: {
      OR: [
        { role: 'MEMBER' },
        { role: 'ADMIN', share_count: { gt: 0 } },
      ],
    },
    _sum: { share_count: true },
  });

  const activeShares = sharesAgg._sum.share_count ?? 0;
  const estimatedDividendPerShare = activeShares > 0 ? currentYearProfitPool / activeShares : 0;

  // Count members eligible for dividend (have shares)
  const membersEligibleForDividend = await prisma.user.count({
    where: {
      OR: [
        { role: 'MEMBER' },
        { role: 'ADMIN', share_count: { gt: 0 } },
      ],
    },
  });

  res.json({
    totalMembers,
    totalCollections,
    totalLoanPayments,
    onTimeMembers: onTime,
    delayedMembers: delayed,
    loanAvailments: loanCount,
    totalLoanAmount,
    availableForLoans,
    currentYearProfitPool,
    totalExpenses,
    netProfit,
    estimatedDividendPerShare: Math.round((netProfit / activeShares) * 100) / 100,
    activeShares,
    membersEligibleForDividend,
    cycle,
    dueDate,
  });
});

// Available funds for loans (lightweight endpoint for form)
router.get('/funds-available', async (_req, res) => {
  const [contribAgg, loanAgg, loanPaymentAgg] = await Promise.all([
    prisma.contribution.aggregate({ _sum: { amount: true } }),
    prisma.loan.aggregate({ _sum: { principal: true } }),
    prisma.loanPayment.aggregate({ _sum: { amount: true } }),
  ]);

  const totalCollections = contribAgg._sum.amount ?? 0;
  const totalLoanAmount = loanAgg._sum.principal ?? 0;
  const totalLoanPayments = loanPaymentAgg._sum.amount ?? 0;
  const availableForLoans = Math.max(totalCollections + totalLoanPayments - totalLoanAmount, 0);

  res.json({
    totalCollections,
    totalLoanPayments,
    totalLoanAmount,
    availableForLoans,
  });
});

// Get user details with contributions and loans
router.get('/users/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid user id' });

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      contributions: {
        orderBy: { date_paid: 'desc' },
      },
      loans: {
        orderBy: { createdAt: 'desc' },
        where: { status: { not: 'PENDING' } },
        include: {
          payments: { orderBy: { createdAt: 'asc' } }
        }
      },
      coMakerOnLoans: {
        include: {
          loan: {
            include: {
              user: { select: { id: true, full_name: true, email: true } },
              payments: { orderBy: { createdAt: 'asc' } }
            }
          }
        },
        where: {
          loan: { status: { not: 'PENDING' } }
        }
      },
      cycleDividendStatus: {
        orderBy: [{ year: 'desc' }, { cycle: 'desc' }],
      },
    },
  });

  if (!user) return res.status(404).json({ error: 'User not found' });
  
  // Calculate payment due date status
  const cfg = await getSystemConfigCached();
  const expectedPerPayment = user.share_count * cfg.share_value;
  
  // Get all payment due dates for current and next year
  const now = new Date();
  const currentYear = now.getFullYear();
  const allDueDates = [
    ...getPaymentDueDatesForYear(currentYear),
    ...getPaymentDueDatesForYear(currentYear + 1),
  ];
  
  // Type for payment due date status
  type PaymentDueStatus = {
    year: number;
    month: number;
    day: number;
    expectedAmount: number;
    totalPaid: number;
    status: 'PAID' | 'PARTIAL' | 'NO-PAYMENT';
    remainingAmount: number;
    contributionCount: number;
  };
  
  const paymentDueMap = new Map<string, PaymentDueStatus>();
  let carryoverAmount = 0; // Track advance payments
  
  // Initialize all due dates
  allDueDates.forEach(({ year, month, day }) => {
    const key = getPaymentDueDateKey(year, month, day);
    paymentDueMap.set(key, {
      year,
      month,
      day,
      expectedAmount: expectedPerPayment,
      totalPaid: carryoverAmount,
      status: 'NO-PAYMENT',
      remainingAmount: expectedPerPayment,
      contributionCount: 0,
    });
  });
  
  // Sort contributions by date and apply them
  const sortedContributions = [...user.contributions].sort(
    (a, b) => new Date(a.date_paid).getTime() - new Date(b.date_paid).getTime()
  );
  
  // Process contributions with carryover logic
  for (const contrib of sortedContributions) {
    const dueDate = getPaymentDueDateForContribution(new Date(contrib.date_paid), allDueDates);
    if (!dueDate) continue;
    
    const key = getPaymentDueDateKey(dueDate.year, dueDate.month, dueDate.day);
    const payment = paymentDueMap.get(key);
    if (!payment) continue;
    
    payment.totalPaid += contrib.amount;
    payment.contributionCount += 1;
    
    // Recalculate status and carryover
    if (payment.totalPaid >= payment.expectedAmount) {
      payment.status = 'PAID';
      payment.remainingAmount = 0;
      carryoverAmount = payment.totalPaid - payment.expectedAmount;
      
      // Apply carryover to next due dates
      const currentDueIndex = allDueDates.findIndex(d => 
        getPaymentDueDateKey(d.year, d.month, d.day) === key
      );
      if (currentDueIndex >= 0 && carryoverAmount > 0) {
        for (let i = currentDueIndex + 1; i < allDueDates.length && carryoverAmount > 0; i++) {
          const nextDue = allDueDates[i];
          const nextKey = getPaymentDueDateKey(nextDue.year, nextDue.month, nextDue.day);
          const nextPayment = paymentDueMap.get(nextKey);
          if (nextPayment) {
            nextPayment.totalPaid += carryoverAmount;
            if (nextPayment.totalPaid >= nextPayment.expectedAmount) {
              nextPayment.status = 'PAID';
              nextPayment.remainingAmount = 0;
              carryoverAmount = nextPayment.totalPaid - nextPayment.expectedAmount;
            } else {
              nextPayment.status = 'PARTIAL';
              nextPayment.remainingAmount = nextPayment.expectedAmount - nextPayment.totalPaid;
              carryoverAmount = 0;
            }
          }
        }
      }
    } else {
      payment.status = 'PARTIAL';
      payment.remainingAmount = payment.expectedAmount - payment.totalPaid;
      carryoverAmount = 0;
    }
  }
  
  const paymentDueStatus = Array.from(paymentDueMap.values()).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    if (a.month !== b.month) return a.month - b.month;
    return a.day - b.day;
  });
  
  res.json({
    ...user,
    paymentDueStatus,
  });
});

// Update user details
const updateUserBody = z.object({
  full_name: z.string().min(1).optional(),
  phone_number: z.string().optional(),
  email: z.string().email().optional(),
  share_count: z.number().int().nonnegative().optional(),
  gcashNumber: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
});

router.put('/users/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid user id' });

  const parsed = updateUserBody.safeParse(req.body);
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    const messages = Object.entries(errors).map(([field, msgs]) => `${field}: ${msgs?.join(', ')}`).join('; ');
    return res.status(400).json({ error: messages || 'Invalid user data' });
  }

  // Check if email is already taken by another user
  if (parsed.data.email) {
    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing && existing.id !== id) {
      return res.status(400).json({ error: 'Email already in use by another member' });
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data: parsed.data,
  });

  res.json(updated);
});

// Set cycle-based dividend eligibility (reason required when marking ineligible)
const cycleEligibilityBody = z.object({
  isEligible: z.boolean(),
  reason: z.string().trim().optional(),
});
router.put('/cycles/:year/:cycle/users/:id/eligibility', async (req, res) => {
  const year = Number(req.params.year);
  const cycle = Number(req.params.cycle);
  const id = Number(req.params.id);
  
  if (Number.isNaN(year) || Number.isNaN(cycle) || Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid year, cycle, or user id' });
  }
  if (![1, 2].includes(cycle)) {
    return res.status(400).json({ error: 'Cycle must be 1 or 2' });
  }

  const parsed = cycleEligibilityBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  if (!parsed.data.isEligible && (!parsed.data.reason || parsed.data.reason.length === 0)) {
    return res.status(400).json({ error: 'Reason is required when marking ineligible' });
  }

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const record = await prisma.cycleDividendEligibility.upsert({
    where: { userId_year_cycle: { userId: id, year, cycle } },
    update: { isEligible: parsed.data.isEligible, reason: parsed.data.isEligible ? '' : parsed.data.reason },
    create: { userId: id, year, cycle, isEligible: parsed.data.isEligible, reason: parsed.data.reason ?? '' },
  });

  // Invalidate dividend cache since eligibility affects per-share calculation
  await invalidateEstimatedDividendPerShare(year);

  res.json(record);
});

// Get pending loans for a user
router.get('/users/:id/pending-loans', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid user id' });

  const loans = await prisma.loan.findMany({
    where: { userId: id, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  });

  res.json(loans);
});

// Create contribution entry with validation
const contributionBody = z.object({
  userId: z.number(),
  amount: z.number().int().positive(),
  date_paid: z.string().datetime().or(z.date()),
  method: z.enum(['GCASH', 'INSTAPAY', 'BANK_TRANSFER', 'CASH']),
  reference_number: z.string().min(3),
});

// List all contributions with user info
router.get('/contributions', async (req, res) => {
  const contributions = await prisma.contribution.findMany({
    orderBy: { date_paid: 'desc' },
    include: {
      user: {
        select: { id: true, full_name: true, email: true },
      },
    },
  });

  res.json(contributions);
});

router.post('/contributions', async (req, res) => {
  const parsed = contributionBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { userId, amount, date_paid, method, reference_number } = parsed.data;

  const [user, cfg] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    getSystemConfigCached(),
  ]);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const expected = user.share_count * cfg.share_value;
  const status = amount === expected ? 'FULL' : 'PARTIAL';
  const created = await prisma.contribution.create({
    data: {
      userId: user.id,
      amount,
      date_paid: typeof date_paid === 'string' ? new Date(date_paid) : date_paid,
      method: method as any,
      reference_number,
      status: status as any,
    },
  });

  res.status(201).json({ id: created.id, status, expected });
});

// Create loan (members or non-members), set rate by type (5% members, 10% non-members)
const loanBody = z.object({
  borrowerType: z.enum(['MEMBER', 'NON_MEMBER']),
  userId: z.number().optional(),
  borrowerName: z.string().min(1),
  borrowerEmail: z.string().email(),
  borrowerPhone: z.string().min(5),
  principal: z.number().int().positive(),
  termMonths: z.number().int().positive().min(1, 'Term must be at least 1 month').max(60, 'Term cannot exceed 60 months'),
  coMakers: z.array(z.number()).optional(),
});

// List loans with pagination
router.get('/loans', async (req, res) => {
  const page = req.query.page ? Number(req.query.page) : undefined;
  const pageSize = req.query.pageSize ? Number(req.query.pageSize) : undefined;
  const status = req.query.status ? String(req.query.status) : undefined;
  const usePaging = !!(page && pageSize && page > 0 && pageSize > 0);

  const where = status ? { status } : undefined;

  const loans = await prisma.loan.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: usePaging ? (page! - 1) * pageSize! : undefined,
    take: usePaging ? pageSize! : undefined,
    include: {
      user: { select: { id: true, full_name: true, email: true } },
      coMakers: { include: { user: { select: { id: true, full_name: true } } } },
      payments: { select: { id: true } },
    },
  });

  if (usePaging) {
    const totalItems = await prisma.loan.count({ where });
    const totalPages = Math.ceil(totalItems / pageSize!);
    return res.json({ data: loans, page, pageSize, totalPages, totalItems });
  }

  res.json(loans);
});

router.post('/loans', async (req, res) => {
  const parsed = loanBody.safeParse(req.body);
  if (!parsed.success) {
    const errors = parsed.error.flatten().fieldErrors;
    const messages = Object.entries(errors).map(([field, msgs]) => `${field}: ${msgs?.join(', ')}`).join('; ');
    return res.status(400).json({ error: messages || 'Invalid loan data' });
  }

  const {
    borrowerType,
    userId,
    borrowerName,
    borrowerEmail,
    borrowerPhone,
    principal,
    termMonths,
    coMakers = [],
  } = parsed.data;

  if (borrowerType === 'MEMBER' && !userId) {
    return res.status(400).json({ error: 'userId is required for member loans' });
  }

  let member: { id: number; full_name: string } | null = null;
  if (borrowerType === 'MEMBER') {
    member = await prisma.user.findUnique({ where: { id: userId } });
    if (!member) return res.status(404).json({ error: 'Member not found' });
  }

  const monthlyRateBps = borrowerType === 'MEMBER' ? 500 : 1000; // 5% vs 10%
  const now = new Date();
  
  // Calculate due date by adding termMonths to current date
  const dueDate = new Date(now);
  dueDate.setMonth(dueDate.getMonth() + termMonths);
  dueDate.setHours(23, 59, 59, 999);

  // Calculate total interest: principal × (monthly_rate × term_months)
  const monthlyRate = monthlyRateBps / 10000; // 0.05 for members, 0.10 for non-members
  const interest = Math.round(principal * monthlyRate * termMonths);

  // Calculate monthly amortization: (principal + total_interest) / term_months
  const totalAmount = principal + interest;
  const monthlyAmortization = Math.round(totalAmount / termMonths);

  const loan = await prisma.loan.create({
    data: {
      borrowerType: borrowerType as any,
      userId: member?.id ?? null,
      borrowerName: borrowerName || member?.full_name || '',
      borrowerEmail,
      borrowerPhone,
      principal,
      interest,
      monthlyRateBps,
      termMonths,
      monthlyAmortization,
      dueDate,
      status: 'RELEASED',
      coMakers: coMakers.length
        ? {
            createMany: {
              data: coMakers.map((uid) => ({ userId: uid })),
              skipDuplicates: true,
            },
          }
        : undefined,
    },
    include: { coMakers: true },
  });

  res.status(201).json(loan);
});

// Update loan status (e.g., release PENDING member loans)
const loanStatusBody = z.object({ status: z.enum(['PENDING', 'RELEASED', 'PAID', 'CANCELLED']) });
router.put('/loans/:id/status', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid loan id' });
  const parsed = loanStatusBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const loan = await prisma.loan.findUnique({ where: { id } });
  if (!loan) return res.status(404).json({ error: 'Loan not found' });

  const updateData: any = { status: parsed.data.status };
  
  // Set releasedAt when status changes to RELEASED
  if (parsed.data.status === 'RELEASED' && !loan.releasedAt) {
    updateData.releasedAt = new Date();
  }
  
  // Set settledAt when status changes to PAID
  if (parsed.data.status === 'PAID' && !loan.settledAt) {
    updateData.settledAt = new Date();
  }

  const updated = await prisma.loan.update({ where: { id }, data: updateData });
  res.json(updated);
});

// Reject loan application with reason
const loanRejectBody = z.object({ reason: z.string().min(1, 'Rejection reason is required') });
router.post('/loans/:id/reject', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid loan id' });
  const parsed = loanRejectBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const loan = await prisma.loan.findUnique({ where: { id } });
  if (!loan) return res.status(404).json({ error: 'Loan not found' });

  if (loan.status !== 'PENDING') {
    return res.status(400).json({ error: 'Only pending loans can be rejected' });
  }

  const updated = await prisma.loan.update({
    where: { id },
    data: { status: 'REJECTED', rejectionReason: parsed.data.reason }
  });
  res.json(updated);
});

// Record loan payment
const loanPaymentBody = z.object({
  amount: z.number().int().positive(),
  date_paid: z.string().datetime().or(z.date()).optional(),
  payment_method: z.enum(['GCASH', 'INSTAPAY', 'BANK_TRANSFER', 'CASH']).optional(),
  reference: z.string().optional(),
});

router.post('/loans/:id/payment', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid loan id' });
  
  const parsed = loanPaymentBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const loan = await prisma.loan.findUnique({ 
    where: { id },
    include: { payments: true }
  });
  if (!loan) return res.status(404).json({ error: 'Loan not found' });
  
  if (loan.status === 'PAID') {
    return res.status(400).json({ error: 'Loan is already fully paid' });
  }

  const { amount } = parsed.data;
  const totalDue = loan.principal + loan.interest;
  
  // Calculate total paid
  const totalPaid = loan.payments.reduce((sum, p) => sum + p.amount, 0) + amount;
  
  // Create payment record
  await prisma.loanPayment.create({
    data: {
      loanId: id,
      amount,
      date_paid: parsed.data.date_paid ? new Date(parsed.data.date_paid) : new Date(),
      payment_method: parsed.data.payment_method || 'CASH',
      reference: parsed.data.reference || '',
    }
  });

  // Check if fully paid
  const isPaid = totalPaid >= totalDue;
  
  const updateData: any = {};
  if (isPaid) {
    updateData.status = 'PAID';
    updateData.settledAt = new Date();
  }

  const updated = await prisma.loan.update({ where: { id }, data: updateData });
  res.json({ 
    message: `Payment of ₱${amount} recorded. Remaining balance: ₱${Math.max(0, totalDue - totalPaid)}${isPaid ? '. Loan automatically marked as PAID.' : ''}`, 
    loan: updated 
  });
});

// Get loan details with payment history
router.get('/loans/:id/details', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid loan id' });
  
  const loan = await prisma.loan.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, full_name: true, email: true, phone_number: true } },
      payments: { orderBy: { createdAt: 'asc' } },
      coMakers: { include: { user: { select: { id: true, full_name: true } } } }
    }
  });
  
  if (!loan) return res.status(404).json({ error: 'Loan not found' });
  
  const totalDue = loan.principal + loan.interest;
  const totalPaid = loan.payments.reduce((sum, p) => sum + p.amount, 0);
  const balance = totalDue - totalPaid;
  
  // Calculate amortization schedule
  const amortization = [];
  const releaseDate = loan.releasedAt || new Date(loan.createdAt);
  for (let i = 1; i <= loan.termMonths; i++) {
    const dueDate = new Date(releaseDate);
    dueDate.setMonth(dueDate.getMonth() + i);
    amortization.push({
      month: i,
      amount: loan.monthlyAmortization,
      dueDate: dueDate.toISOString().split('T')[0],
    });
  }
    router.put('/loans/:id', async (req, res) => {
      const loanId = parseInt(req.params.id);
      if (isNaN(loanId)) return res.status(400).json({ error: 'Invalid loan ID' });

      // Check if loan exists and has no payments
      const existingLoan = await prisma.loan.findUnique({
        where: { id: loanId },
        include: { payments: true },
      });

      if (!existingLoan) return res.status(404).json({ error: 'Loan not found' });
      if (existingLoan.status === 'PAID') {
        return res.status(400).json({ error: 'Cannot edit a paid loan' });
      }
      if (existingLoan.payments.length > 0) {
        return res.status(400).json({ error: 'Cannot edit loan with existing payments' });
      }

      const parsed = loanBody.safeParse(req.body);
      if (!parsed.success) {
        const errors = parsed.error.flatten().fieldErrors;
        const messages = Object.entries(errors).map(([field, msgs]) => `${field}: ${msgs?.join(', ')}`).join('; ');
        return res.status(400).json({ error: messages || 'Invalid loan data' });
      }

      const {
        borrowerType,
        userId,
        borrowerName,
        borrowerEmail,
        borrowerPhone,
        principal,
        termMonths,
        coMakers = [],
      } = parsed.data;

      if (borrowerType === 'MEMBER' && !userId) {
        return res.status(400).json({ error: 'userId is required for member loans' });
      }

      let member: { id: number; full_name: string } | null = null;
      if (borrowerType === 'MEMBER') {
        member = await prisma.user.findUnique({ where: { id: userId } });
        if (!member) return res.status(404).json({ error: 'Member not found' });
      }

      const monthlyRateBps = borrowerType === 'MEMBER' ? 500 : 1000;
      const now = new Date();
  
      const dueDate = new Date(now);
      dueDate.setMonth(dueDate.getMonth() + termMonths);
      dueDate.setHours(23, 59, 59, 999);

      const monthlyRate = monthlyRateBps / 10000;
      const interest = Math.round(principal * monthlyRate * termMonths);
      const totalAmount = principal + interest;
      const monthlyAmortization = Math.round(totalAmount / termMonths);

      // Delete existing co-makers and recreate
      await prisma.loanCoMaker.deleteMany({ where: { loanId } });

      const loan = await prisma.loan.update({
        where: { id: loanId },
        data: {
          borrowerType: borrowerType as any,
          userId: member?.id ?? null,
          borrowerName: borrowerName || member?.full_name || '',
          borrowerEmail,
          borrowerPhone,
          principal,
          interest,
          monthlyRateBps,
          termMonths,
          monthlyAmortization,
          dueDate,
          coMakers: coMakers.length
            ? {
                createMany: {
                  data: coMakers.map((uid) => ({ userId: uid })),
                  skipDuplicates: true,
                },
              }
            : undefined,
        },
        include: { coMakers: true },
      });

      res.json(loan);
    });

  
  res.json({
    ...loan,
    totalDue,
    totalPaid,
    balance,
    amortization,
  });
});

// System config for UI consumption
router.get('/system-config', async (_req, res) => {
  const cfg = await getSystemConfigCached();
  res.json(cfg);
});

// Update system config
const systemConfigBody = z.object({
  min_shares: z.number().int().positive().optional(),
  max_shares: z.number().int().positive().optional(),
  share_value: z.number().int().positive().optional(),
  min_loan_amount: z.number().int().positive().optional(),
  max_loan_amount: z.number().int().positive().optional(),
});

router.put('/system-config', async (req, res) => {
  const parsed = systemConfigBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const updated = await prisma.systemConfig.update({
    where: { id: 1 },
    data: parsed.data,
  });

  await invalidateSystemConfigCache();
  res.json(updated);
});

// Create new user
const createUserBody = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  email: z.string().email(),
  phone_number: z.string().min(5).max(30),
  role: z.enum(['MEMBER', 'ADMIN']).default('MEMBER'),
  share_count: z.number().int().nonnegative().default(0),
  gcashNumber: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  password: z.string().min(6).optional(),
  sendEmail: z.boolean().optional(),
});

router.post('/users', async (req, res) => {
  const parsed = createUserBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) return res.status(400).json({ error: 'User with this email already exists' });
  const plainPassword = parsed.data.password ?? generatePassword();
  const passwordHash = await hashPassword(plainPassword);

  const user = await prisma.user.create({
    data: {
      full_name: parsed.data.full_name,
      email: parsed.data.email,
      phone_number: parsed.data.phone_number,
      role: parsed.data.role,
      share_count: parsed.data.share_count,
      gcashNumber: parsed.data.gcashNumber ?? '',
      bankName: parsed.data.bankName ?? '',
      bankAccountNumber: parsed.data.bankAccountNumber ?? '',
      passwordHash,
      forcePasswordReset: true,
    },
  });

  let emailed = false;
  if (parsed.data.sendEmail) {
    const result = await sendEmail({
      to: user.email,
      subject: 'Your EquiYield account',
      text: `Hello ${user.full_name || 'member'}, your temporary password is ${plainPassword}. Please log in and change it.`,
    });
    emailed = result.sent;
  }

  res.status(201).json({ user, password: plainPassword, emailed });
});

// Reset password for a specific user (returns new password)
const resetPasswordBody = z.object({ password: z.string().min(6).optional(), sendEmail: z.boolean().optional() });
router.post('/users/:id/reset-password', async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid user id' });
  const parsed = resetPasswordBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return res.status(404).json({ error: 'User not found' });

  const plainPassword = parsed.data.password ?? generatePassword();
  const passwordHash = await hashPassword(plainPassword);

  await prisma.user.update({ where: { id }, data: { passwordHash, forcePasswordReset: true } });

  let emailed = false;
  if (parsed.data.sendEmail) {
    const result = await sendEmail({
      to: user.email,
      subject: 'Your password was reset',
      text: `Hello ${user.full_name || 'member'}, your new password is ${plainPassword}. Please log in and change it immediately.`,
    });
    emailed = result.sent;
  }

  res.json({ password: plainPassword, emailed });
});

// Bulk password generation
const bulkPasswordBody = z.object({ userIds: z.array(z.number().int().positive()).nonempty(), sendEmail: z.boolean().optional(), excludeAdmins: z.boolean().optional() });
router.post('/users/bulk-passwords', async (req, res) => {
  const parsed = bulkPasswordBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const whereClause: any = { id: { in: parsed.data.userIds } };
  if (parsed.data.excludeAdmins) {
    whereClause.role = { not: 'ADMIN' };
  }
  const users = await prisma.user.findMany({ where: whereClause });
  const results: Array<{ id: number; email: string; password: string; emailed: boolean }> = [];

  for (const user of users) {
    const pwd = generatePassword();
    const hash = await hashPassword(pwd);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash, forcePasswordReset: true } });
    let emailed = false;
    if (parsed.data.sendEmail) {
      const result = await sendEmail({
        to: user.email,
        subject: 'Your EquiYield credentials',
        text: `Hello ${user.full_name || 'member'}, your password was reset to ${pwd}. Please log in and change it.`,
      });
      emailed = result.sent;
    }
    results.push({ id: user.id, email: user.email, password: pwd, emailed });
  }

  res.json({ count: results.length, results });
});

// Downloadable Excel template for member import
router.get('/users/import/template', (_req, res) => {
  const rows = [
    ['full_name', 'contact_no', 'email', 'gcash_number', 'bank_name', 'bank_account_no', 'shares'],
    ['Juan Dela Cruz', '09171234567', 'juan@example.com', '09171234567', 'BPI', '1234567890', 5],
  ];

  const sheet = xlsx.utils.aoa_to_sheet(rows);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, sheet, 'Members');
  const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="equiyield_member_import.xlsx"');
  res.send(buffer);
});

// Bulk member import via Excel
router.post('/users/import', upload.single('file'), async (req, res) => {
  const uploaded = (req as any).file as { buffer: Buffer } | undefined;
  if (!uploaded) return res.status(400).json({ error: 'No file uploaded' });

  const workbook = xlsx.read(uploaded.buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

  const required = ['full_name', 'contact_no', 'email', 'gcash_number', 'bank_name', 'bank_account_no', 'shares'];
  let successCount = 0;
  const errors: Array<{ row: number; message: string }> = [];
  const created: Array<{ id: number; email: string; password: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const missing = required.filter((k) => !row[k]);
    if (missing.length > 0) {
      errors.push({ row: i + 2, message: `Missing fields: ${missing.join(', ')}` });
      continue;
    }

    const email = String(row.email).trim();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      errors.push({ row: i + 2, message: 'Email already exists' });
      continue;
    }

    const shareCount = Number(row.shares) || 0;
    const pwd = generatePassword();
    const hash = await hashPassword(pwd);

    const user = await prisma.user.create({
      data: {
        full_name: String(row.full_name).trim(),
        email,
        phone_number: String(row.contact_no).trim(),
        gcashNumber: String(row.gcash_number).trim(),
        bankName: String(row.bank_name).trim(),
        bankAccountNumber: String(row.bank_account_no).trim(),
        share_count: shareCount,
        passwordHash: hash,
        forcePasswordReset: true,
      },
    });

    successCount += 1;
    created.push({ id: user.id, email: user.email, password: pwd });
  }

  res.json({ successCount, errorCount: errors.length, errors, created });
});

// Archive/purge historical data with audit log
const archiveBody = z.object({
  year: z.number().int().positive(),
  purgeContributionsBeforeYear: z.number().int().optional(),
  purgeLoansBeforeYear: z.number().int().optional(),
  archiveMembers: z.boolean().optional(),
  note: z.string().optional(),
});

router.post('/archive-run', async (req, res) => {
  const parsed = archiveBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { year, purgeContributionsBeforeYear, purgeLoansBeforeYear, archiveMembers, note } = parsed.data;
  let purgedContributions = 0;
  let purgedLoans = 0;
  let archivedMembers = 0;

  if (purgeContributionsBeforeYear) {
    const cutoff = new Date(purgeContributionsBeforeYear, 0, 1);
    const result = await prisma.contribution.deleteMany({ where: { date_paid: { lt: cutoff } } });
    purgedContributions = result.count;
  }

  if (purgeLoansBeforeYear) {
    const cutoff = new Date(purgeLoansBeforeYear, 0, 1);
    const result = await prisma.loan.deleteMany({ where: { createdAt: { lt: cutoff } } });
    purgedLoans = result.count;
  }

  if (archiveMembers) {
    const result = await prisma.user.updateMany({ where: { archivedAt: null, role: 'MEMBER' }, data: { archivedAt: new Date() } });
    archivedMembers = result.count;
  }

  const performedByUserId = (req as any).adminUserId ?? null;
  const run = await prisma.archiveRun.create({
    data: {
      year,
      purgedContributions,
      purgedLoans,
      note: note ?? '',
      performedByUserId,
    },
  });

  res.json({
    run,
    purgedContributions,
    purgedLoans,
    archivedMembers,
  });
});
// Estimated dividend per share (cached)
router.get('/dividends/estimated-per-share', async (_req, res) => {
  const value = await getEstimatedDividendPerShare();
  res.json({ perShare: value });
});

// Example: when profit pool is updated (e.g., after a loan interest payment), invalidate cache
const profitPoolBody = z.object({ year: z.number().int().positive(), amount: z.number().int().nonnegative() });
router.put('/profit-pool', async (req, res) => {
  const parsed = profitPoolBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { year, amount } = parsed.data;

  const record = await prisma.profitPool.upsert({
    where: { year },
    update: { amount },
    create: { year, amount },
  });
  await invalidateEstimatedDividendPerShare(year);
  res.json(record);
});

// Dividend payouts: list (optional filters) and create
const payoutQuery = z.object({ year: z.string().optional(), userId: z.string().optional() });
router.get('/dividends/payouts', async (req, res) => {
  const q = payoutQuery.safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: q.error.flatten() });
  const where: any = {};
  if (q.data.year) where.year = Number(q.data.year);
  if (q.data.userId) where.userId = Number(q.data.userId);

  const payouts = await prisma.dividendPayout.findMany({
    where,
    orderBy: [{ year: 'desc' }, { depositedAt: 'desc' }],
    include: { 
      user: { select: { id: true, full_name: true, email: true } },
      createdBy: { select: { id: true, full_name: true } }
    },
  });
  res.json(payouts);
});

const createPayoutBody = z.object({
  userId: z.number().int().positive(),
  year: z.number().int().positive(),
  perShare: z.number().positive(),
  sharesCount: z.number().int().nonnegative(),
  amount: z.number().int().nonnegative(),
  channel: z.enum(['GCASH', 'BANK']),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  gcashNumber: z.string().optional(),
  reference: z.string().min(1, 'Reference number is required for traceability'),
  depositedAt: z.string().datetime().or(z.date()),
});
router.post('/dividends/payouts', async (req, res) => {
  const parsed = createPayoutBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const data = parsed.data;
  const createdByUserId = (req as any).adminUserId ?? null;
  try {
    const created = await prisma.dividendPayout.create({
      data: {
        userId: data.userId,
        year: data.year,
        perShare: data.perShare,
        sharesCount: data.sharesCount,
        amount: data.amount,
        channel: data.channel as any,
        bankName: data.bankName ?? '',
        bankAccountNumber: data.bankAccountNumber ?? '',
        gcashNumber: data.gcashNumber ?? '',
        reference: data.reference ?? '',
        createdByUserId,
        depositedAt: typeof data.depositedAt === 'string' ? new Date(data.depositedAt) : data.depositedAt,
      },
    });
    res.status(201).json(created);
  } catch (e: any) {
    if (String(e.message).includes('Unique constraint') || String(e.code) === 'P2002') {
      return res.status(409).json({ error: 'Payout already exists for this user and year' });
    }
    res.status(500).json({ error: 'Failed to create payout' });
  }
});

// Bulk payout creation for a year (assign to all eligible members)
const bulkPayoutBody = z.object({
  year: z.number().int().positive(),
  perShare: z.number().positive(),
  channel: z.enum(['GCASH', 'BANK']),
  reference: z.string().min(1, 'Reference number is required'),
  depositedAt: z.string().datetime().or(z.date()),
});

router.post('/dividends/payouts/bulk', async (req, res) => {
  const parsed = bulkPayoutBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { year, perShare, channel, reference, depositedAt } = parsed.data;

  try {
    // Get all eligible members for the year
    const eligibleMembers = await prisma.user.findMany({
      where: {
        archivedAt: null,
        share_count: { gt: 0 },
        cycleDividendStatus: {
          some: {
            year,
            isEligible: true,
          },
        },
      },
      select: { id: true, full_name: true, share_count: true, bankName: true, bankAccountNumber: true, gcashNumber: true },
    });

    if (eligibleMembers.length === 0) {
      return res.status(404).json({ error: 'No eligible members found for this year' });
    }

    const created: any[] = [];
    const failed: any[] = [];
    const createdByUserId = (req as any).adminUserId ?? null;

    for (const member of eligibleMembers) {
      try {
        const amount = Math.round(perShare * member.share_count);
        const payout = await prisma.dividendPayout.create({
          data: {
            userId: member.id,
            year,
            perShare,
            sharesCount: member.share_count,
            amount,
            channel,
            bankName: channel === 'BANK' ? member.bankName || '' : '',
            bankAccountNumber: channel === 'BANK' ? member.bankAccountNumber || '' : '',
            gcashNumber: channel === 'GCASH' ? member.gcashNumber || '' : '',
            reference,
            createdByUserId,
            depositedAt: typeof depositedAt === 'string' ? new Date(depositedAt) : depositedAt,
          },
        });
        created.push({ userId: member.id, full_name: member.full_name, amount, id: payout.id });
      } catch (e: any) {
        if (String(e.message).includes('Unique constraint') || String(e.code) === 'P2002') {
          failed.push({ userId: member.id, full_name: member.full_name, error: 'Payout already exists' });
        } else {
          failed.push({ userId: member.id, full_name: member.full_name, error: e.message });
        }
      }
    }

    invalidateEstimatedDividendPerShare(year);
    res.json({ created, failed, summary: { total: eligibleMembers.length, created: created.length, failed: failed.length } });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to create bulk payouts', details: e.message });
  }
});

// Get expenses for a year
router.get('/expenses', async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const expenses = await prisma.expense.findMany({
      where: { year },
      include: { createdBy: { select: { id: true, full_name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(expenses);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to fetch expenses', details: e.message });
  }
});

// Create expense
router.post('/expenses', async (req, res) => {
  try {
    const { amount, description, referenceType, reference, year } = req.body;
    const userId = (req as any).user?.id;

    if (!amount || !description) {
      return res.status(400).json({ error: 'Amount and description required' });
    }

    const expense = await prisma.expense.create({
      data: {
        year: year || new Date().getFullYear(),
        amount: Number(amount),
        description,
        referenceType: referenceType || 'NONE',
        reference: reference || '',
        createdByUserId: userId,
      },
      include: { createdBy: { select: { id: true, full_name: true, email: true } } },
    });

    res.json(expense);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to create expense', details: e.message });
  }
});

// Update expense
router.put('/expenses/:id', async (req, res) => {
  try {
    const expenseId = Number(req.params.id);
    const { amount, description, referenceType, reference } = req.body;

    const expense = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        amount: amount !== undefined ? Number(amount) : undefined,
        description: description || undefined,
        referenceType: referenceType || undefined,
        reference: reference || undefined,
      },
      include: { createdBy: { select: { id: true, full_name: true, email: true } } },
    });

    res.json(expense);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to update expense', details: e.message });
  }
});

// Delete expense
router.delete('/expenses/:id', async (req, res) => {
  try {
    const expenseId = Number(req.params.id);
    await prisma.expense.delete({ where: { id: expenseId } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to delete expense', details: e.message });
  }
});

export default router;


