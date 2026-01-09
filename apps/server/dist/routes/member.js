import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { getSystemConfigCached } from '../services/config.js';
const router = Router();
router.use(requireAuth);
// Helper: Generate all payment due dates for a given year
function getPaymentDueDatesForYear(year) {
    const dueDates = [];
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
function getPaymentDueDateKey(year, month, day) {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
// Helper: Determine which payment due date a contribution belongs to
function getPaymentDueDateForContribution(contributionDate, allDueDates) {
    // Find the first due date on or after this contribution
    const futureDates = allDueDates.filter(d => d.date.getTime() >= contributionDate.getTime());
    if (futureDates.length === 0)
        return null;
    return futureDates[0];
}
router.get('/me', async (req, res) => {
    const authUser = req.authUser;
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
            contributions: { orderBy: { date_paid: 'desc' } },
            loans: {
                orderBy: { createdAt: 'desc' },
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
        },
    });
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    // Calculate total contributions
    const totalContributions = user.contributions.reduce((sum, c) => sum + c.amount, 0);
    // Enrich loans with payment status
    const cfg = await getSystemConfigCached();
    const now = new Date();
    const enrichedLoans = user.loans.map(loan => {
        const totalPaid = loan.payments.reduce((sum, p) => sum + p.amount, 0);
        const totalDue = loan.principal + loan.interest;
        const remainingBalance = totalDue - totalPaid;
        const isPastDue = loan.status === 'ACTIVE' && loan.dueDate && new Date(loan.dueDate) < now;
        return {
            ...loan,
            totalPaid,
            remainingBalance,
            isPastDue,
        };
    });
    // Calculate payment due date status
    const expectedPerPayment = user.share_count * cfg.share_value;
    const currentYear = now.getFullYear();
    const allDueDates = [
        ...getPaymentDueDatesForYear(currentYear),
        ...getPaymentDueDatesForYear(currentYear + 1),
    ];
    const paymentDueMap = new Map();
    // Initialize all due dates
    allDueDates.forEach(({ year, month, day }) => {
        const key = getPaymentDueDateKey(year, month, day);
        paymentDueMap.set(key, {
            year,
            month,
            day,
            expectedAmount: expectedPerPayment,
            totalPaid: 0,
            status: 'NO-PAYMENT',
            remainingAmount: expectedPerPayment,
            contributionCount: 0,
        });
    });
    // Sort contributions by date
    const sortedContributions = [...user.contributions].sort((a, b) => new Date(a.date_paid).getTime() - new Date(b.date_paid).getTime());
    let carryoverAmount = 0;
    // Process contributions with carryover logic
    for (const contrib of sortedContributions) {
        const dueDate = getPaymentDueDateForContribution(new Date(contrib.date_paid), allDueDates);
        if (!dueDate)
            continue;
        const key = getPaymentDueDateKey(dueDate.year, dueDate.month, dueDate.day);
        const payment = paymentDueMap.get(key);
        if (!payment)
            continue;
        payment.totalPaid += contrib.amount;
        payment.contributionCount += 1;
        // Recalculate status and carryover
        if (payment.totalPaid >= payment.expectedAmount) {
            payment.status = 'PAID';
            payment.remainingAmount = 0;
            carryoverAmount = payment.totalPaid - payment.expectedAmount;
            // Apply carryover to next due dates
            const currentDueIndex = allDueDates.findIndex(d => getPaymentDueDateKey(d.year, d.month, d.day) === key);
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
                        }
                        else {
                            nextPayment.status = 'PARTIAL';
                            nextPayment.remainingAmount = nextPayment.expectedAmount - nextPayment.totalPaid;
                            carryoverAmount = 0;
                        }
                    }
                }
            }
        }
        else {
            payment.status = 'PARTIAL';
            payment.remainingAmount = payment.expectedAmount - payment.totalPaid;
            carryoverAmount = 0;
        }
    }
    const paymentDueStatus = Array.from(paymentDueMap.values()).sort((a, b) => {
        if (a.year !== b.year)
            return a.year - b.year;
        if (a.month !== b.month)
            return a.month - b.month;
        return a.day - b.day;
    });
    // Enrich co-maker loans with additional data
    const enrichedCoMakerLoans = user.coMakerOnLoans?.map(coMakerEntry => ({
        ...coMakerEntry,
        loan: {
            ...coMakerEntry.loan,
            borrowerName: coMakerEntry.loan.user?.full_name || coMakerEntry.loan.borrowerName,
            borrowerEmail: coMakerEntry.loan.user?.email || coMakerEntry.loan.borrowerEmail,
        }
    }));
    res.json({
        ...user,
        loans: enrichedLoans,
        coMakerOnLoans: enrichedCoMakerLoans,
        totalContributions,
        paymentDueStatus,
    });
});
router.get('/loans', async (req, res) => {
    const authUser = req.authUser;
    const loans = await prisma.loan.findMany({
        where: { userId: authUser.id },
        orderBy: { createdAt: 'desc' },
    });
    res.json(loans);
});
router.get('/dividends', async (req, res) => {
    const authUser = req.authUser;
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
    const authUser = req.authUser;
    const parsed = memberLoanBody.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const [user, cfg, pendingLoans] = await Promise.all([
        prisma.user.findUnique({ where: { id: authUser.id } }),
        getSystemConfigCached(),
        prisma.loan.findMany({
            where: { userId: authUser.id, status: 'PENDING' },
        }),
    ]);
    if (!user)
        return res.status(404).json({ error: 'User not found' });
    if (user.archivedAt)
        return res.status(403).json({ error: 'Account archived' });
    // Check if user has pending loans
    if (pendingLoans.length > 0) {
        return res.status(400).json({ error: 'Cannot apply for a new loan while you have pending loans' });
    }
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
