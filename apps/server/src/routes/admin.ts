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
        orderBy: { date_paid: 'desc' },
        take: 1,
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
    const latestContribution = u.contributions[0];
    let status = 'NO_PAYMENT';
    
    if (latestContribution) {
      const expectedAmount = u.share_count * (config?.share_value || 0);
      if (latestContribution.status === 'FULL' && latestContribution.amount >= expectedAmount) {
        status = 'ON_TIME';
      } else {
        status = 'LATE';
      }
    } else if (now > dueDate) {
      status = 'LATE';
    }
    
    return {
      id: u.id,
      full_name: u.full_name,
      email: u.email,
      phone_number: u.phone_number,
      role: u.role,
      share_count: u.share_count,
      payment_status: status,
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

  const [config, users, totalMembers, contribAgg, loanAgg, loanCount, profitPool] = await Promise.all([
    prisma.systemConfig.findUnique({ where: { id: 1 } }),
    prisma.user.findMany({
      select: {
        id: true,
        share_count: true,
        contributions: {
          where: {
            date_paid: {
              gte: new Date(year, month, 1),
              lte: dueDate,
            },
          },
          orderBy: { date_paid: 'desc' },
          take: 1,
        },
      },
    }),
    prisma.user.count(),
    prisma.contribution.aggregate({ _sum: { amount: true } }),
    prisma.loan.aggregate({ _sum: { principal: true } }),
    prisma.loan.count(),
    prisma.profitPool.findUnique({ where: { year } }),
  ]);

  let onTime = 0;
  let delayed = 0;

  users.forEach((u: any) => {
    const latest = u.contributions[0];
    const expected = u.share_count * (config?.share_value || 0);
    if (latest) {
      if (latest.status === 'FULL' && latest.amount >= expected) {
        onTime += 1;
      } else {
        delayed += 1;
      }
    } else if (now > dueDate) {
      delayed += 1;
    }
  });

  const totalCollections = contribAgg._sum.amount ?? 0;
  const totalLoanAmount = loanAgg._sum.principal ?? 0;
  const availableForLoans = Math.max(totalCollections - totalLoanAmount, 0);

  res.json({
    totalMembers,
    totalCollections,
    onTimeMembers: onTime,
    delayedMembers: delayed,
    loanAvailments: loanCount,
    totalLoanAmount,
    availableForLoans,
    currentYearProfitPool: profitPool?.amount ?? 0,
    cycle,
    dueDate,
  });
});

// Available funds for loans (lightweight endpoint for form)
router.get('/funds-available', async (_req, res) => {
  const [contribAgg, loanAgg] = await Promise.all([
    prisma.contribution.aggregate({ _sum: { amount: true } }),
    prisma.loan.aggregate({ _sum: { principal: true } }),
  ]);

  const totalCollections = contribAgg._sum.amount ?? 0;
  const totalLoanAmount = loanAgg._sum.principal ?? 0;
  const availableForLoans = Math.max(totalCollections - totalLoanAmount, 0);

  res.json({
    totalCollections,
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
      },
      cycleDividendStatus: {
        orderBy: [{ year: 'desc' }, { cycle: 'desc' }],
      },
    },
  });

  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
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

// Create contribution entry with validation
const contributionBody = z.object({
  userId: z.number(),
  amount: z.number().int().positive(),
  date_paid: z.string().datetime().or(z.date()),
  method: z.enum(['GCASH', 'INSTAPAY', 'BANK_TRANSFER', 'CASH']),
  reference_number: z.string().min(3),
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
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

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
  const currentYear = now.getFullYear();
  const dueDate = new Date(currentYear, 11, 31, 23, 59, 59, 999);

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

  const updated = await prisma.loan.update({ where: { id }, data: { status: parsed.data.status } });
  res.json(updated);
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
const bulkPasswordBody = z.object({ userIds: z.array(z.number().int().positive()).nonempty(), sendEmail: z.boolean().optional() });
router.post('/users/bulk-passwords', async (req, res) => {
  const parsed = bulkPasswordBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const users = await prisma.user.findMany({ where: { id: { in: parsed.data.userIds } } });
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
        archived_at: null,
        share_count: { gt: 0 },
        cycleDividendStatus: {
          some: {
            year,
            is_eligible: true,
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

export default router;


