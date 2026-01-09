"use client";

import React from 'react';
import { useEffect, useState } from 'react';
import { getApiBaseUrl } from '@/lib/api-config';

type Contribution = {
  id: number;
  amount: number;
  date_paid: string;
  method: string;
  reference_number: string;
  status: 'FULL' | 'PARTIAL';
};

type Loan = {
  id: number;
  principal: number;
  interest: number;
  status: string;
  createdAt: string;
  monthlyAmortization?: number;
  termMonths?: number;
  dueDate?: string;
  releasedAt?: string;
  payments?: Array<{ amount: number; createdAt: string }>;
};

type CyclePaymentStatus = {
  year: number;
  cycle: number;
  isEligible: boolean;
  reason?: string | null;
};

type CycleDividendStatus = {
  year: number;
  cycle: number;
  isEligible: boolean;
  reason?: string | null;
};

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

type UserDetail = {
  id: number;
  full_name: string;
  email: string;
  phone_number: string;
  role: string;
  share_count: number;
  gcashNumber?: string;
  bankName?: string;
  bankAccountNumber?: string;
  contributions: Contribution[];
  loans: Loan[];
  coMakerOnLoans?: Array<{
    id: number;
    loan: Loan & {
      user?: { id: number; full_name: string; email: string };
      borrowerName: string;
      borrowerEmail: string;
    };
  }>;
  cycleDividendStatus: CycleDividendStatus[];
  paymentDueStatus: PaymentDueStatus[];
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('eq_admin_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// Helper: Get current year and cycle
function getCurrentCycle(): { year: number; cycle: number } {
  const now = new Date();
  const year = now.getFullYear();
  const cycle = now.getDate() <= 15 ? 1 : 2;
  return { year, cycle };
}

// Helper: Determine which cycle a date falls into
function getCycleForDate(date: Date): number {
  return date.getDate() <= 15 ? 1 : 2;
}

export default function MemberDetail({ userId, onBack }: { userId: number; onBack: () => void }) {
  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingCycle, setTogglingCycle] = useState<string | null>(null);
  const [expandedCycles, setExpandedCycles] = useState<Set<string>>(new Set());
  const [resetBusy, setResetBusy] = useState(false);
  const [newPassword, setNewPassword] = useState<string | null>(null);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: '',
    phone_number: '',
    email: '',
    share_count: 0,
    gcashNumber: '',
    bankName: '',
    bankAccountNumber: '',
  });

  // Dividend payouts (admin view)
  type Payout = {
    id: number;
    year: number;
    perShare: number;
    sharesCount: number;
    amount: number;
    channel: 'GCASH' | 'BANK';
    bankName?: string;
    bankAccountNumber?: string;
    gcashNumber?: string;
    reference?: string;
    depositedAt: string;
  };
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutError, setPayoutError] = useState('');

  // Create payout form state
  const [pyYear, setPyYear] = useState<number>(new Date().getFullYear());
  const [pyPerShare, setPyPerShare] = useState<string>('');
  const [pyShares, setPyShares] = useState<string>('');
  const [pyAmount, setPyAmount] = useState<number>(0);
  const [pyChannel, setPyChannel] = useState<'GCASH' | 'BANK'>('GCASH');
  const [pyBankName, setPyBankName] = useState('');
  const [pyBankAcc, setPyBankAcc] = useState('');
  const [pyGcash, setPyGcash] = useState('');
  const [pyRef, setPyRef] = useState('');
  const [pyDate, setPyDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [pyBusy, setPyBusy] = useState(false);

  // Contribution recording modal state
  const [showContributionModal, setShowContributionModal] = useState(false);
  const [contribDate, setContribDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [contribAmount, setContribAmount] = useState<string>('');
  const [contribMethod, setContribMethod] = useState<string>('BANK_TRANSFER');
  const [contribReference, setContribReference] = useState<string>('');
  const [contribBusy, setContribBusy] = useState(false);
  const [contribError, setContribError] = useState('');

  // Collapsible sections
  const [showContribSection, setShowContribSection] = useState(true);
  const [showLoansSection, setShowLoansSection] = useState(true);
  const [showPendingLoansSection, setShowPendingLoansSection] = useState(true);

  // Loan payment modal state
  const [showLoanPaymentModal, setShowLoanPaymentModal] = useState(false);
  const [loanPaymentLoanId, setLoanPaymentLoanId] = useState<number | null>(null);
  const [loanPaymentAmount, setLoanPaymentAmount] = useState<string>('');
  const [loanPaymentDate, setLoanPaymentDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [loanPaymentMethod, setLoanPaymentMethod] = useState<string>('CASH');
  const [loanPaymentReference, setLoanPaymentReference] = useState<string>('');
  const [loanPaymentBusy, setLoanPaymentBusy] = useState(false);
  const [loanPaymentError, setLoanPaymentError] = useState('');

  // Loan rejection modal state
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionLoanId, setRejectionLoanId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [rejectionBusy, setRejectionBusy] = useState(false);
  const [rejectionError, setRejectionError] = useState('');

  // Pending loans state
  const [pendingLoans, setPendingLoans] = useState<any[]>([]);
  const [pendingLoansLoading, setPendingLoansLoading] = useState(false);

  // Expanded payment details row state - track which payment rows are expanded
  const [expandedPaymentRows, setExpandedPaymentRows] = useState<Set<string>>(new Set());

  const togglePaymentRowExpanded = (key: string) => {
    const newExpanded = new Set(expandedPaymentRows);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedPaymentRows(newExpanded);
  };

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const API_BASE = getApiBaseUrl();
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
        headers: getAuthHeaders(),
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Failed to load user details');
      const data = await res.json();
      setUser(data);
      // Initialize edit form with user data
      setEditForm({
        full_name: data.full_name || '',
        phone_number: data.phone_number || '',
        email: data.email || '',
        share_count: data.share_count || 0,
        gcashNumber: data.gcashNumber || '',
        bankName: data.bankName || '',
        bankAccountNumber: data.bankAccountNumber || '',
      });
      // Load pending loans
      loadPendingLoans();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadPendingLoans() {
    setPendingLoansLoading(true);
    try {
      const API_BASE = getApiBaseUrl();
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}/pending-loans`, {
        headers: getAuthHeaders(),
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Failed to load pending loans');
      const data = await res.json();
      setPendingLoans(data);
    } catch (e: any) {
      console.error('Failed to load pending loans:', e.message);
    } finally {
      setPendingLoansLoading(false);
    }
  }

  async function handleRejectLoan() {
    if (!rejectionLoanId) {
      setRejectionError('No loan selected');
      return;
    }
    if (!rejectionReason.trim()) {
      setRejectionError('Please provide a rejection reason');
      return;
    }
    setRejectionBusy(true);
    setRejectionError('');
    try {
      const API_BASE = getApiBaseUrl();
      const res = await fetch(`${API_BASE}/api/admin/loans/${rejectionLoanId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ reason: rejectionReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reject loan');
      setShowRejectionModal(false);
      setRejectionReason('');
      setRejectionLoanId(null);
      await loadPendingLoans();
    } catch (e: any) {
      setRejectionError(e.message);
    } finally {
      setRejectionBusy(false);
    }
  }

  function startEditing() {
    setIsEditing(true);
    setEditError('');
  }

  function cancelEditing() {
    setIsEditing(false);
    setEditError('');
    if (user) {
      setEditForm({
        full_name: user.full_name || '',
        phone_number: user.phone_number || '',
        email: user.email || '',
        share_count: user.share_count || 0,
        gcashNumber: user.gcashNumber || '',
        bankName: user.bankName || '',
        bankAccountNumber: user.bankAccountNumber || '',
      });
    }
  }

  async function saveEdits() {
    setEditBusy(true);
    setEditError('');
    try {
      const API_BASE = getApiBaseUrl();
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(editForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save changes');
      setIsEditing(false);
      // Reload full user data including relationships
      await load();
    } catch (e: any) {
      setEditError(e.message);
    } finally {
      setEditBusy(false);
    }
  }

  async function submitContribution() {
    if (!contribAmount || Number(contribAmount) <= 0) {
      setContribError('Amount must be greater than 0');
      return;
    }

    setContribBusy(true);
    setContribError('');
    try {
      const API_BASE = getApiBaseUrl();
      const res = await fetch(`${API_BASE}/api/admin/contributions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          userId,
          amount: Number(contribAmount),
          date_paid: new Date(contribDate).toISOString(),
          method: contribMethod,
          reference_number: contribReference,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record contribution');
      
      setShowContributionModal(false);
      setContribAmount('');
      setContribReference('');
      setContribMethod('BANK_TRANSFER');
      setContribDate(new Date().toISOString().slice(0, 10));
      await load(); // Reload to get updated contributions
    } catch (e: any) {
      setContribError(e.message);
    } finally {
      setContribBusy(false);
    }
  }

  useEffect(() => {
    load();
  }, [userId]);

  useEffect(() => {
    const fetchPayouts = async () => {
      setPayoutLoading(true);
      setPayoutError('');
      try {
        const API_BASE = getApiBaseUrl();
        const res = await fetch(`${API_BASE}/api/admin/dividends/payouts?userId=${userId}`, {
          headers: getAuthHeaders(),
          cache: 'no-store',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load payouts');
        setPayouts(data);
      } catch (e: any) {
        setPayoutError(e.message);
      } finally {
        setPayoutLoading(false);
      }
    };
    fetchPayouts();
  }, [userId]);

  async function resetPassword() {
    if (!window.confirm('Reset this member\'s password?')) return;
    setResetBusy(true);
    setNewPassword(null);
    try {
      const API_BASE = getApiBaseUrl();
      const res = await fetch(`${API_BASE}/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ sendEmail: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reset failed');
      setNewPassword(data.password);
    } catch (e) {
      console.error(e);
      alert('Failed to reset password');
    } finally {
      setResetBusy(false);
    }
  }

  async function toggleCycleEligibility(year: number, cycle: number, currentStatus: boolean, currentReason?: string | null) {
    const key = `${year}-${cycle}`;

    // Require a reason when marking ineligible
    let reason: string | undefined = undefined;
    if (currentStatus) {
      const input = window.prompt('Reason for marking ineligible? (required)', currentReason || '');
      if (!input || input.trim().length === 0) {
        return; // cancelled or empty
      }
      reason = input.trim();
    }

    setTogglingCycle(key);
    try {
      const API_BASE = getApiBaseUrl();
      const res = await fetch(`${API_BASE}/api/admin/cycles/${year}/${cycle}/users/${userId}/eligibility`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ isEligible: !currentStatus, reason }),
      });
      if (res.ok) {
        await load(); // Reload to get updated status
      }
    } catch (e: any) {
      console.error('Failed to update eligibility:', e);
    } finally {
      setTogglingCycle(null);
    }
  }

  if (loading) return <div>Loading member details…</div>;
  if (error) return <div className="text-red-400">{error}</div>;
  if (!user) return <div>User not found</div>;

  // Use backend-calculated payment due date status
  const paymentDueStatus = user.paymentDueStatus || [];
  
  // Get current date
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  
  // Helper to check if a payment due date has passed
  const hasPaymentDueDatePassed = (year: number, month: number, day: number): boolean => {
    if (year < currentYear) return true;
    if (year === currentYear && month < currentMonth) return true;
    if (year === currentYear && month === currentMonth && day < currentDay) return true;
    return false;
  };
  
  // Type for display
  type PaymentDueDisplay = {
    year: number;
    month: number;
    day: number;
    dateStr: string;
    expectedAmount: number;
    totalPaid: number;
    status: 'PAID' | 'PARTIAL' | 'NO-PAYMENT';
    remainingAmount: number;
    contributionCount: number;
    isPast: boolean;
  };
  
  // Convert payment due status to display format
  const paymentDueDates: PaymentDueDisplay[] = paymentDueStatus.map(p => {
    const dateStr = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
    return {
      ...p,
      dateStr,
      isPast: hasPaymentDueDatePassed(p.year, p.month, p.day),
    };
  });
  
  // Helpers for due date keying and mapping contributions to due dates
  const getPaymentDueDateKey = (year: number, month: number, day: number) => {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  type AllocatedContribution = Contribution & {
    appliedAmount: number;
    carriedOver: boolean;
  };

  // Prepare due date entries sorted ascending
  const dueEntries = paymentDueDates
    .map(pd => ({
      ...pd,
      key: getPaymentDueDateKey(pd.year, pd.month, pd.day),
      paidAllocated: 0,
      contributionsAllocated: [] as AllocatedContribution[],
    }))
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      if (a.month !== b.month) return a.month - b.month;
      return a.day - b.day;
    });

  const findDueIndexForContribution = (date: Date) => {
    return dueEntries.findIndex(d => {
      const dueDateObj = new Date(d.year, d.month - 1, d.day, 23, 59, 59, 999);
      return date.getTime() <= dueDateObj.getTime();
    });
  };

  // Allocate contributions to due dates with carryover
  const sortedContributions = [...user.contributions].sort(
    (a, b) => new Date(a.date_paid).getTime() - new Date(b.date_paid).getTime()
  );

  sortedContributions.forEach(contrib => {
    let amountLeft = contrib.amount;
    const contribDate = new Date(contrib.date_paid);
    const startIdx = findDueIndexForContribution(contribDate);
    if (startIdx === -1) return; // no future due date

    let idx = startIdx;
    while (amountLeft > 0 && idx < dueEntries.length) {
      const entry = dueEntries[idx];
      const remainingForDue = Math.max(entry.expectedAmount - entry.paidAllocated, 0);
      if (remainingForDue <= 0) {
        idx += 1;
        continue;
      }
      const applied = Math.min(amountLeft, remainingForDue);
      entry.contributionsAllocated.push({
        ...contrib,
        appliedAmount: applied,
        carriedOver: idx > startIdx,
      });
      entry.paidAllocated += applied;
      amountLeft -= applied;
      if (amountLeft > 0) idx += 1;
    }
  });

  const contributionsByDueKey = new Map<string, AllocatedContribution[]>(
    dueEntries.map(d => [d.key, d.contributionsAllocated])
  );

  // Group contributions by payment due date (allocated amounts only)
  type CycleGroup = PaymentDueDisplay & {
    contributions: AllocatedContribution[];
    totalAmount: number;
  };

  const cycleGroups: CycleGroup[] = paymentDueDates.map(pd => {
    const key = getPaymentDueDateKey(pd.year, pd.month, pd.day);
    const contributions = contributionsByDueKey.get(key) || [];
    return {
      ...pd,
      contributions,
      contributionCount: contributions.length,
      totalAmount: contributions.reduce((sum, c) => sum + c.appliedAmount, 0),
    };
  });

  const toggleExpanded = (key: string) => {
    setExpandedCycles((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="btn btn-secondary mb-4">
        ← Back to Members
      </button>

      {/* Member Info Card */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">{user.full_name}</h2>
          <div className="flex items-center gap-2">
            <button className="btn btn-secondary text-sm" onClick={isEditing ? cancelEditing : startEditing}>
              {isEditing ? 'Cancel' : 'Edit'}
            </button>
            <button className="btn btn-secondary text-sm" onClick={resetPassword} disabled={resetBusy}>
              {resetBusy ? 'Resetting…' : 'Reset Password'}
            </button>
          </div>
        </div>

        {editError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {editError}
          </div>
        )}

        {!isEditing ? (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Email:</span> {user.email}
            </div>
            <div>
              <span className="text-gray-400">Phone:</span> {user.phone_number}
            </div>
            <div>
              <span className="text-gray-400">Shares:</span> {user.share_count}
            </div>
            <div>
              <span className="text-gray-400">Role:</span> {user.role}
            </div>
            {user.gcashNumber && (
              <div>
                <span className="text-gray-400">GCash:</span> {user.gcashNumber}
              </div>
            )}
            {user.bankName && (
              <div>
                <span className="text-gray-400">Bank:</span> {user.bankName}
              </div>
            )}
            {user.bankAccountNumber && (
              <div>
                <span className="text-gray-400">Bank Account:</span> {user.bankAccountNumber}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Full Name</label>
                <input
                  className="input"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Email</label>
                <input
                  className="input"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Phone</label>
                <input
                  className="input"
                  value={editForm.phone_number}
                  onChange={(e) => setEditForm({ ...editForm, phone_number: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Shares</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={editForm.share_count}
                  onChange={(e) => setEditForm({ ...editForm, share_count: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold text-sm mb-3">Payment Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">GCash Number</label>
                  <input
                    className="input"
                    value={editForm.gcashNumber}
                    onChange={(e) => setEditForm({ ...editForm, gcashNumber: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Bank Name</label>
                  <input
                    className="input"
                    value={editForm.bankName}
                    onChange={(e) => setEditForm({ ...editForm, bankName: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <label className="label">Bank Account Number</label>
                  <input
                    className="input"
                    value={editForm.bankAccountNumber}
                    onChange={(e) => setEditForm({ ...editForm, bankAccountNumber: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button className="btn btn-primary" onClick={saveEdits} disabled={editBusy}>
                {editBusy ? 'Saving…' : 'Save Changes'}
              </button>
              <button className="btn btn-secondary" onClick={cancelEditing} disabled={editBusy}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {newPassword && (
          <div className="mt-2 text-xs">New password: <span className="font-mono">{newPassword}</span></div>
        )}
      </div>

      {/* Summary Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="text-sm text-gray-400">Total Contributions</div>
          <div className="text-2xl font-bold">₱{user.contributions.reduce((s, c) => s + c.amount, 0).toLocaleString()}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-400">Contribution Due Now</div>
          <div className="text-2xl font-bold">
            {(() => {
              const upcoming = paymentDueDates.find(d => !d.isPast) || paymentDueDates[paymentDueDates.length - 1];
              if (!upcoming) return '₱0';
              const due = Math.max(upcoming.expectedAmount - Math.min(upcoming.totalPaid, upcoming.expectedAmount), 0);
              return `₱${due.toLocaleString()}`;
            })()}
          </div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-400">Loan Due Now</div>
          <div className="text-2xl font-bold">
            {(() => {
              const nowTs = Date.now();
              let total = 0;
              (user.loans || []).forEach(loan => {
                const startDate = loan.releasedAt ? new Date(loan.releasedAt) : new Date(loan.createdAt);
                const endDate = loan.dueDate ? new Date(loan.dueDate) : undefined;
                const termMonths = loan.termMonths ?? 0;
                const monthlyDue = loan.monthlyAmortization ?? 0;
                const schedule: Array<{ date: Date; expectedAmount: number }> = [];
                if (termMonths > 0 && monthlyDue > 0) {
                  let d = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
                  for (let i = 0; i < termMonths; i++) {
                    const dt = new Date(d.getFullYear(), d.getMonth() + i + 1, 0);
                    if (endDate && dt > endDate) break;
                    schedule.push({ date: dt, expectedAmount: monthlyDue });
                  }
                } else if (endDate) {
                  schedule.push({ date: endDate, expectedAmount: loan.principal + loan.interest });
                }
                const paidByIndex = schedule.map(() => 0);
                const payments = [...(loan.payments ?? [])].sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                payments.forEach(p => {
                  let amountLeft = p.amount;
                  let idx = schedule.findIndex(s => new Date(p.createdAt).getTime() <= s.date.getTime());
                  if (idx < 0) idx = 0;
                  while (amountLeft > 0 && idx < schedule.length) {
                    const remaining = Math.max(schedule[idx].expectedAmount - paidByIndex[idx], 0);
                    if (remaining <= 0) { idx++; continue; }
                    const applied = Math.min(amountLeft, remaining);
                    paidByIndex[idx] += applied;
                    amountLeft -= applied;
                    if (amountLeft > 0) idx++;
                  }
                });
                const upcomingIdx = schedule.findIndex(s => s.date.getTime() >= nowTs);
                const i = upcomingIdx >= 0 ? upcomingIdx : schedule.length - 1;
                if (i >= 0) {
                  const remaining = Math.max(schedule[i].expectedAmount - paidByIndex[i], 0);
                  total += remaining;
                }
              });
              return `₱${total.toLocaleString()}`;
            })()}
          </div>
        </div>
      </div>

      {/* Contributions */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Contribution Payment Schedule</h3>
          <div className="flex items-center gap-2">
            <button 
              className="btn btn-primary text-sm"
              onClick={() => {
                setContribError('');
                setShowContributionModal(true);
              }}
            >
              + Add Contribution
            </button>
            <button className="btn btn-secondary text-sm" onClick={() => setShowContribSection((s) => !s)}>
              {showContribSection ? 'Collapse' : 'Expand'}
            </button>
          </div>
        </div>
        {!showContribSection ? null : cycleGroups.length === 0 ? (
          <p className="text-gray-400">No payment schedule available</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table text-sm">
              <thead>
                <tr>
                  <th>Payment Due Date</th>
                  <th>Payment Due</th>
                  <th>Paid So Far</th>
                  <th>Remaining</th>
                  <th>Status</th>
                  <th>Dividend</th>
                </tr>
              </thead>
              <tbody>
                {cycleGroups.map((group) => {
                  const key = `${group.year}-${group.month}-${group.day}`;
                  const isFuture = !group.isPast;
                  const monthName = new Date(group.year, group.month - 1).toLocaleString('default', { month: 'short' });
                  const dateDisplay = `${monthName} ${group.day}, ${group.year}`;
                  const isLatePayment = group.isPast && (group.status === 'PARTIAL' || group.status === 'NO-PAYMENT');
                  const isExpanded = expandedPaymentRows.has(key);

                  return (
                    <React.Fragment key={key}>
                      <tr 
                        className={`${isFuture ? 'opacity-50' : ''} cursor-pointer hover:bg-gray-700 transition-colors`}
                        onClick={() => {
                          togglePaymentRowExpanded(key);
                        }}
                      >
                        <td className="font-medium">{dateDisplay}</td>
                        <td>₱{group.expectedAmount.toLocaleString()}</td>
                        <td>
                          <span className="font-semibold">₱{group.totalPaid.toLocaleString()}</span>
                          {group.contributionCount > 0 && (
                            <div className="text-xs text-gray-400">
                              {group.contributionCount} payment{group.contributionCount !== 1 ? 's' : ''}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`font-semibold ${group.remainingAmount > 0 ? 'text-orange-500' : 'text-green-500'}`}>
                            ₱{group.remainingAmount.toLocaleString()}
                          </span>
                        </td>
                        <td>
                          <span className={`badge badge-sm ${
                            group.status === 'PAID' ? 'badge-success' : 
                            group.status === 'PARTIAL' ? 'badge-warning' : 
                            'badge-danger'
                          }`}>
                            {group.status}
                          </span>
                        </td>
                        <td>
                          <span className={`badge badge-sm ${
                            isLatePayment ? 'badge-error' : 'badge-success'
                          }`}>
                            {isLatePayment ? 'LATE PAYMENT' : 'ELIGIBLE'}
                          </span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-gray-800/50">
                          <td colSpan={6} className="p-0">
                            <div className="p-4">
                              <h4 className="font-semibold mb-3 text-sm">Contribution Details ({group.contributionCount})</h4>
                              <div className="overflow-x-auto">
                                <table className="table table-sm text-xs">
                                  <thead>
                                    <tr className="border-b border-gray-700">
                                      <th className="text-left">Date Paid</th>
                                      <th className="text-left">Amount Applied</th>
                                      <th className="text-left">Method</th>
                                      <th className="text-left">Reference</th>
                                      <th className="text-left">Notes</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {group.contributions.map((contrib, idx) => (
                                      <tr key={`${contrib.id}-${idx}`} className="border-b border-gray-700/50">
                                        <td>{new Date(contrib.date_paid).toLocaleDateString()}</td>
                                        <td className="font-semibold">₱{contrib.appliedAmount.toLocaleString()}</td>
                                        <td>{contrib.method}</td>
                                        <td className="text-gray-400">{contrib.reference_number || '—'}</td>
                                        <td className="text-gray-400">{contrib.carriedOver ? 'Carried over from previous payment' : 'Applied to this due date'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending Loan Applications */}
      {pendingLoans.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">Pending Loan Applications</h3>
            <button className="btn btn-secondary text-sm" onClick={() => setShowPendingLoansSection((s) => !s)}>
              {showPendingLoansSection ? 'Collapse' : 'Expand'}
            </button>
          </div>
          {!showPendingLoansSection ? null : pendingLoansLoading ? (
            <p className="text-gray-400">Loading pending loans...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>Loan ID</th>
                    <th>Principal</th>
                    <th>Interest (%)</th>
                    <th>Monthly Payment</th>
                    <th>Term (months)</th>
                    <th>Requested At</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingLoans.map((loan: any) => (
                    <tr key={loan.id}>
                      <td>#{loan.id}</td>
                      <td>₱{loan.principal.toLocaleString()}</td>
                      <td>{loan.interest}%</td>
                      <td>₱{loan.monthlyAmortization?.toLocaleString() || '—'}</td>
                      <td>{loan.termMonths || '—'}</td>
                      <td>{new Date(loan.createdAt).toLocaleDateString()}</td>
                      <td>
                        <button
                          className="btn btn-error btn-sm"
                          onClick={() => {
                            setRejectionLoanId(loan.id);
                            setRejectionReason('');
                            setRejectionError('');
                            setShowRejectionModal(true);
                          }}
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Active Loans */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Loans</h3>
          <div className="flex items-center gap-2">
            <button className="btn btn-primary text-sm" onClick={() => {
              setLoanPaymentError('');
              const firstLoanId = user?.loans[0]?.id ?? null;
              setLoanPaymentLoanId(firstLoanId);
              setLoanPaymentAmount('');
              setLoanPaymentDate(new Date().toISOString().slice(0, 10));
              setLoanPaymentMethod('CASH');
              setLoanPaymentReference('');
              if (firstLoanId) setShowLoanPaymentModal(true);
            }}>+ Record Loan Payment</button>
            <button className="btn btn-secondary text-sm" onClick={() => setShowLoansSection((s) => !s)}>
              {showLoansSection ? 'Collapse' : 'Expand'}
            </button>
          </div>
        </div>
        {!showLoansSection ? null : !user || user.loans.length === 0 ? (
          <p className="text-gray-400">No loans recorded</p>
        ) : (
          <div className="space-y-6">
            {user.loans.map((loan) => {
              const loanTitle = (loan as any).name ? `Loan: ${(loan as any).name}` : `Loan #${loan.id}`;
              const startDate = loan.releasedAt ? new Date(loan.releasedAt) : new Date(loan.createdAt);
              const endDate = loan.dueDate ? new Date(loan.dueDate) : undefined;
              const termMonths = loan.termMonths ?? 0;
              const monthlyDue = loan.monthlyAmortization ?? 0;

              // Generate amortization schedule dates (monthly)
              const schedule: Array<{ year: number; month: number; day: number; date: Date; expectedAmount: number }>=[];
              if (termMonths > 0 && monthlyDue > 0) {
                let d = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
                for (let i = 0; i < termMonths; i++) {
                  const dt = new Date(d.getFullYear(), d.getMonth() + i + 1, 0); // end of month
                  if (endDate && dt > endDate) break;
                  schedule.push({ year: dt.getFullYear(), month: dt.getMonth() + 1, day: dt.getDate(), date: dt, expectedAmount: monthlyDue });
                }
              } else {
                // Fallback: single due at loan.dueDate
                if (endDate && (loan.principal + loan.interest) > 0) {
                  schedule.push({ year: endDate.getFullYear(), month: endDate.getMonth() + 1, day: endDate.getDate(), date: endDate, expectedAmount: (loan.principal + loan.interest) });
                }
              }

              // Allocate payments across schedule with carryover
              type LoanAlloc = { 
                amount: number; 
                createdAt: string; 
                date_paid?: string;
                payment_method?: string;
                reference?: string;
                appliedAmount: number; 
                carriedOver: boolean 
              };
              const allocByIndex: Array<LoanAlloc[]> = schedule.map(() => []);
              const paidByIndex: number[] = schedule.map(() => 0);
              const sortedPayments = [...(loan.payments ?? [])].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

              sortedPayments.forEach(p => {
                let amountLeft = p.amount;
                // Find first schedule slot at or after payment date
                let idx = schedule.findIndex(s => p.createdAt ? new Date(p.createdAt).getTime() <= s.date.getTime() : true);
                if (idx < 0) idx = 0;
                while (amountLeft > 0 && idx < schedule.length) {
                  const remaining = Math.max(schedule[idx].expectedAmount - paidByIndex[idx], 0);
                  if (remaining <= 0) { idx++; continue; }
                  const applied = Math.min(amountLeft, remaining);
                  allocByIndex[idx].push({ amount: p.amount, createdAt: p.createdAt, appliedAmount: applied, carriedOver: allocByIndex[idx].length > 0 });
                  paidByIndex[idx] += applied;
                  amountLeft -= applied;
                  if (amountLeft > 0) idx++;
                }
              });

              // Build display rows
              const rows = schedule.map((s, i) => {
                const totalPaid = paidByIndex[i];
                const remainingAmount = Math.max(s.expectedAmount - totalPaid, 0);
                let status: 'PAID' | 'PARTIAL' | 'NO-PAYMENT' = 'NO-PAYMENT';
                if (totalPaid >= s.expectedAmount) status = 'PAID';
                else if (totalPaid > 0) status = 'PARTIAL';
                else status = 'NO-PAYMENT';
                const isPast = new Date() > s.date;
                const isLate = isPast && totalPaid === 0;
                return { key: `${s.year}-${s.month}-${s.day}`, s, totalPaid, remainingAmount, status, isPast, isLate, payments: allocByIndex[i] };
              });

              return (
                <div key={loan.id} className="border rounded p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold">{loanTitle}</h4>
                      <div className="text-xs text-gray-400">Principal ₱{loan.principal.toLocaleString()} • Interest ₱{loan.interest.toLocaleString()} • Status {loan.status}</div>
                    </div>
                  </div>

                  {rows.length === 0 ? (
                    <p className="text-gray-400 mt-3">No amortization schedule available</p>
                  ) : (
                    <div className="mt-4 overflow-x-auto">
                      <table className="table text-sm">
                        <thead>
                          <tr>
                            <th>Due Date</th>
                            <th>Amortization</th>
                            <th>Paid So Far</th>
                            <th>Remaining</th>
                            <th>Status</th>
                            <th>Late</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => (
                            <React.Fragment key={row.key}>
                              <tr 
                                className={`${!row.isPast ? 'opacity-50' : ''} cursor-pointer hover:bg-gray-700 transition-colors`}
                                onClick={() => row.payments.length > 0 && togglePaymentRowExpanded(row.key)}
                              >
                                <td className="font-medium">{new Date(row.s.date).toLocaleDateString()}</td>
                                <td>₱{row.s.expectedAmount.toLocaleString()}</td>
                                <td>
                                  <span className="font-semibold">₱{row.totalPaid.toLocaleString()}</span>
                                  {row.payments.length > 0 && (
                                    <div className="text-xs text-gray-400">
                                      {expandedPaymentRows.has(row.key) ? '▼' : '▶'} {row.payments.length} payment{row.payments.length !== 1 ? 's' : ''}
                                    </div>
                                  )}
                                </td>
                                <td>
                                  <span className={`font-semibold ${row.remainingAmount > 0 ? 'text-orange-500' : 'text-green-500'}`}>₱{row.remainingAmount.toLocaleString()}</span>
                                </td>
                                <td>
                                  <span className={`badge badge-sm ${row.status === 'PAID' ? 'badge-success' : row.status === 'PARTIAL' ? 'badge-warning' : 'badge-danger'}`}>{row.status}</span>
                                </td>
                                <td>
                                  <span className={`badge badge-sm ${row.isLate ? 'badge-error' : 'badge-neutral'}`}>{row.isLate ? 'LATE' : '—'}</span>
                                </td>
                              </tr>
                              {row.payments.length > 0 && expandedPaymentRows.has(row.key) && (
                                <tr className="bg-gray-800/50">
                                  <td colSpan={6} className="p-0">
                                    <div className="p-4">
                                      <h5 className="font-semibold mb-3 text-sm">Payments Applied ({row.payments.length})</h5>
                                      <div className="overflow-x-auto">
                                        <table className="table table-sm text-xs">
                                          <thead>
                                            <tr className="border-b border-gray-700">
                                              <th className="text-left">Date Paid</th>
                                              <th className="text-left">Amount Applied</th>
                                              <th className="text-left">Method</th>
                                              <th className="text-left">Reference</th>
                                              <th className="text-left">Notes</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {row.payments.map((p, idx) => (
                                              <tr key={`${row.key}-${idx}`} className="border-b border-gray-700/50">
                                                <td>{new Date(p.date_paid || p.createdAt).toLocaleDateString()}</td>
                                                <td className="font-semibold">₱{p.appliedAmount.toLocaleString()}</td>
                                                <td>
                                                  <span className="badge badge-xs">
                                                    {p.payment_method === 'BANK_TRANSFER' ? 'BANK' : p.payment_method || 'CASH'}
                                                  </span>
                                                </td>
                                                <td className="text-gray-400 text-xs">{p.reference || '—'}</td>
                                                <td className="text-gray-400">{p.carriedOver ? 'Carried over from previous payment' : 'Applied to this amortization'}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Co-Maker Loans */}
      {user.coMakerOnLoans && user.coMakerOnLoans.length > 0 && (
        <div className="card">
          <h3 className="text-xl font-semibold mb-4">Co-Maker on Loans (View Only)</h3>
          <p className="text-sm text-gray-400 mb-4">You are a co-maker on the following loans:</p>
          <div className="space-y-6">
            {user.coMakerOnLoans.map((coMakerEntry: any) => {
              const loan = coMakerEntry.loan;
              const borrower = loan.user;
              const loanTitle = `Loan #${loan.id} - ${borrower?.full_name || loan.borrowerName}`;
              
              // Calculate loan payment status
              const totalPaid = loan.payments?.reduce((sum: number, p: any) => sum + p.amount, 0) || 0;
              const totalDue = loan.principal + loan.interest;
              const remainingBalance = totalDue - totalPaid;
              const isPaid = remainingBalance <= 0;
              
              // Calculate amortization details
              const monthlyAmortization = loan.monthlyAmortization || 0;
              const termMonths = loan.termMonths || 0;
              const releasedDate = loan.releasedAt ? new Date(loan.releasedAt) : null;
              
              // Generate monthly amortization schedule
              const amortizations: Array<{
                monthNumber: number;
                dueDate: Date;
                amortization: number;
                paidSoFar: number;
                remaining: number;
                status: string;
                isLate: boolean;
              }> = [];
              
              if (releasedDate && termMonths > 0) {
                let carryoverAmount = 0;
                for (let i = 0; i < termMonths; i++) {
                  const dueDate = new Date(releasedDate.getFullYear(), releasedDate.getMonth() + i + 1, releasedDate.getDate());
                  const amortizationDue = monthlyAmortization;
                  
                  // Allocate payments to this amortization
                  const paymentsForThisMonth = carryoverAmount;
                  const remaining = Math.max(0, amortizationDue - paymentsForThisMonth);
                  const isLate = remaining > 0 && new Date() > dueDate;
                  
                  let status = 'UNPAID';
                  if (paymentsForThisMonth >= amortizationDue) {
                    status = 'PAID';
                    carryoverAmount = paymentsForThisMonth - amortizationDue;
                  } else if (paymentsForThisMonth > 0) {
                    status = 'PARTIAL';
                    carryoverAmount = 0;
                  } else {
                    carryoverAmount = 0;
                  }
                  
                  amortizations.push({
                    monthNumber: i + 1,
                    dueDate,
                    amortization: amortizationDue,
                    paidSoFar: paymentsForThisMonth,
                    remaining,
                    status,
                    isLate,
                  });
                }
                
                // Apply actual payments
                let paymentIndex = 0;
                let remainingPayment = 0;
                for (const amort of amortizations) {
                  let allocated = remainingPayment;
                  
                  while (allocated < amort.amortization && paymentIndex < loan.payments.length) {
                    const payment = loan.payments[paymentIndex];
                    allocated += payment.amount;
                    paymentIndex++;
                  }
                  
                  amort.paidSoFar = Math.min(allocated, amort.amortization);
                  amort.remaining = Math.max(0, amort.amortization - amort.paidSoFar);
                  remainingPayment = Math.max(0, allocated - amort.amortization);
                  
                  if (amort.paidSoFar >= amort.amortization) {
                    amort.status = 'PAID';
                  } else if (amort.paidSoFar > 0) {
                    amort.status = 'PARTIAL';
                  } else {
                    amort.status = 'UNPAID';
                  }
                  
                  amort.isLate = amort.remaining > 0 && new Date() > amort.dueDate;
                }
              }
              
              return (
                <div key={coMakerEntry.id} className="border border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="font-semibold text-lg">{loanTitle}</h4>
                      <p className="text-sm text-gray-400">Borrower: {borrower?.email || loan.borrowerEmail}</p>
                    </div>
                    <div className="text-right">
                      <div className={`badge ${isPaid ? 'badge-success' : 'badge-warning'}`}>
                        {loan.status}
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-400">Principal</p>
                      <p className="font-semibold">₱{loan.principal.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Interest</p>
                      <p className="font-semibold">₱{loan.interest.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Total Due</p>
                      <p className="font-semibold">₱{totalDue.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Remaining</p>
                      <p className="font-semibold text-warning">₱{remainingBalance.toLocaleString()}</p>
                    </div>
                  </div>
                  
                  {amortizations.length > 0 && (
                    <div className="mt-4">
                      <h5 className="font-semibold mb-2">Monthly Amortization Schedule</h5>
                      <div className="overflow-x-auto">
                        <table className="table table-sm">
                          <thead>
                            <tr>
                              <th>Month</th>
                              <th>Due Date</th>
                              <th>Amortization</th>
                              <th>Paid So Far</th>
                              <th>Remaining</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {amortizations.map((amort) => (
                              <tr key={amort.monthNumber}>
                                <td>{amort.monthNumber}</td>
                                <td>
                                  {amort.dueDate.toLocaleDateString()}
                                  {amort.isLate && <span className="ml-2 badge badge-error badge-xs">LATE</span>}
                                </td>
                                <td>₱{amort.amortization.toLocaleString()}</td>
                                <td>₱{amort.paidSoFar.toLocaleString()}</td>
                                <td className={amort.remaining > 0 ? 'text-warning' : ''}>
                                  ₱{amort.remaining.toLocaleString()}
                                </td>
                                <td>
                                  <span className={`badge badge-xs ${
                                    amort.status === 'PAID' ? 'badge-success' : 
                                    amort.status === 'PARTIAL' ? 'badge-warning' : 
                                    'badge-ghost'
                                  }`}>
                                    {amort.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dividend Payouts */}
      <div className="card">
        <h3 className="text-xl font-semibold mb-4">Dividend Payouts</h3>
        {payoutLoading ? (
          <div className="text-sm text-gray-400">Loading payouts…</div>
        ) : payouts.length === 0 ? (
          <p className="text-gray-400">No payout records</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Year</th>
                <th>Per Share</th>
                <th>Shares</th>
                <th>Amount</th>
                <th>Channel</th>
                <th>Destination</th>
                <th>Deposited</th>
                <th>Ref</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map(p => (
                <tr key={p.id}>
                  <td>{p.year}</td>
                  <td>₱{p.perShare.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                  <td>{p.sharesCount}</td>
                  <td>₱{p.amount.toLocaleString()}</td>
                  <td>{p.channel}</td>
                  <td className="text-xs text-gray-400">
                    {p.channel === 'BANK' ? `${p.bankName || ''} ${p.bankAccountNumber || ''}` : (p.gcashNumber || '')}
                  </td>
                  <td>{new Date(p.depositedAt).toLocaleDateString()}</td>
                  <td className="text-xs text-gray-400">{p.reference || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="mt-6 border-t border-gray-700/50 pt-4">
          <h4 className="font-semibold mb-2">Record Payout</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="text-sm">Year
              <input className="input mt-1" type="number" value={pyYear} onChange={(e) => setPyYear(Number(e.target.value))} />
            </label>
            <label className="text-sm">Per Share (PHP)
              <input className="input mt-1" type="number" step="0.01" value={pyPerShare} onChange={(e) => { setPyPerShare(e.target.value); const ps = parseFloat(e.target.value || '0'); const sh = parseInt(pyShares || '0', 10) || 0; setPyAmount(Math.round(ps * sh)); }} />
            </label>
            <label className="text-sm">Shares
              <input className="input mt-1" type="number" value={pyShares} onChange={(e) => { setPyShares(e.target.value); const sh = parseInt(e.target.value || '0', 10) || 0; const ps = parseFloat(pyPerShare || '0'); setPyAmount(Math.round(ps * sh)); }} />
            </label>
            <label className="text-sm">Amount (PHP)
              <input className="input mt-1" type="number" value={pyAmount} onChange={(e) => setPyAmount(parseInt(e.target.value || '0', 10) || 0)} />
            </label>
            <div className="text-sm mt-6 flex items-center gap-4">
              <label className="flex items-center gap-2"><input type="radio" name="channel" checked={pyChannel==='GCASH'} onChange={() => setPyChannel('GCASH')} />GCASH</label>
              <label className="flex items-center gap-2"><input type="radio" name="channel" checked={pyChannel==='BANK'} onChange={() => setPyChannel('BANK')} />Bank</label>
            </div>
            {pyChannel === 'BANK' ? (
              <>
                <label className="text-sm">Bank Name
                  <input className="input mt-1" value={pyBankName} onChange={(e) => setPyBankName(e.target.value)} placeholder={user.bankName || ''} />
                </label>
                <label className="text-sm">Bank Account No.
                  <input className="input mt-1" value={pyBankAcc} onChange={(e) => setPyBankAcc(e.target.value)} placeholder={user.bankAccountNumber || ''} />
                </label>
              </>
            ) : (
              <label className="text-sm">GCash Number
                <input className="input mt-1" value={pyGcash} onChange={(e) => setPyGcash(e.target.value)} placeholder={user.gcashNumber || ''} />
              </label>
            )}
            <label className="text-sm">Deposit Date
              <input className="input mt-1" type="date" value={pyDate} onChange={(e) => setPyDate(e.target.value)} />
            </label>
            <label className="text-sm col-span-2">Reference Number <span className="text-red-500">*</span>
              <input className="input mt-1" value={pyRef} onChange={(e) => setPyRef(e.target.value)} placeholder="Transaction ID, receipt no., or transfer reference for traceability" required />
            </label>
          </div>
          <p className="text-xs text-gray-400 mt-2">Reference number is required to track payout source (receipt, transfer ID, transaction hash, etc.)</p>
          <div className="mt-3">
            <button className="btn btn-primary" disabled={pyBusy || !pyRef.trim()} onClick={async () => {
              if (!pyRef.trim()) {
                alert('Please enter a reference number for traceability');
                return;
              }
              setPyBusy(true);
              try {
                const API_BASE = getApiBaseUrl();
                const res = await fetch(`${API_BASE}/api/admin/dividends/payouts`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                  body: JSON.stringify({
                    userId,
                    year: pyYear,
                    perShare: parseFloat(pyPerShare || '0'),
                    sharesCount: parseInt(pyShares || '0', 10) || 0,
                    amount: pyAmount,
                    channel: pyChannel,
                    bankName: pyChannel==='BANK' ? (pyBankName || user.bankName || '') : '',
                    bankAccountNumber: pyChannel==='BANK' ? (pyBankAcc || user.bankAccountNumber || '') : '',
                    gcashNumber: pyChannel==='GCASH' ? (pyGcash || user.gcashNumber || '') : '',
                    reference: pyRef,
                    depositedAt: new Date(pyDate).toISOString(),
                  }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to record payout');
                // Refresh payout list
                const list = await fetch(`${API_BASE}/api/admin/dividends/payouts?userId=${userId}`, { headers: getAuthHeaders() });
                setPayouts(await list.json());
                setPyRef('');
              } catch (e: any) {
                alert(e.message);
              } finally {
                setPyBusy(false);
              }
            }}>{pyBusy ? 'Saving…' : 'Save Payout'}</button>
          </div>
        </div>
      </div>

      {/* Cycle Eligibility History */}
      <div className="card">
        <h3 className="text-xl font-semibold mb-4">Cycle Eligibility History</h3>
        {user.cycleDividendStatus.length === 0 ? (
          <p className="text-gray-400">No eligibility records</p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {user.cycleDividendStatus.map((status) => (
              <div
                key={`${status.year}-${status.cycle}`}
                className={`p-3 rounded border ${
                  status.isEligible ? 'border-green-500/30 bg-green-500/10' : 'border-red-500/30 bg-red-500/10'
                }`}
              >
                <div className="text-sm font-semibold">
                  {status.year} C{status.cycle}
                </div>
                <div className="text-xs text-gray-400">
                  {status.isEligible ? 'Eligible' : 'Ineligible'}
                </div>
                {!status.isEligible && status.reason ? (
                  <div className="text-xs text-gray-500 mt-1">{status.reason}</div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>


      {/* Loan Payment Modal */}
      {showLoanPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="card max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Record Loan Payment</h2>

            {loanPaymentError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {loanPaymentError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="label">Loan</label>
                <select className="input w-full" value={loanPaymentLoanId ?? ''} onChange={(e) => setLoanPaymentLoanId(Number(e.target.value) || null)}>
                  {user.loans.map(l => (
                    <option key={l.id} value={l.id}>{(l as any).name ? (l as any).name : `Loan #${l.id}`}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Amount (PHP) *</label>
                <input 
                  type="number" 
                  className="input w-full" 
                  value={loanPaymentAmount}
                  onChange={(e) => setLoanPaymentAmount(e.target.value)}
                  placeholder="0"
                  step="100"
                  min="0"
                />
              </div>

              <div>
                <label className="label">Date Paid *</label>
                <input 
                  type="date" 
                  className="input w-full" 
                  value={loanPaymentDate}
                  onChange={(e) => setLoanPaymentDate(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Payment Method *</label>
                <select 
                  className="input w-full" 
                  value={loanPaymentMethod}
                  onChange={(e) => setLoanPaymentMethod(e.target.value)}
                >
                  <option value="CASH">Cash</option>
                  <option value="GCASH">GCash</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="INSTAPAY">Instapay</option>
                </select>
              </div>

              <div>
                <label className="label">Reference Number</label>
                <input 
                  type="text" 
                  className="input w-full" 
                  value={loanPaymentReference}
                  onChange={(e) => setLoanPaymentReference(e.target.value)}
                  placeholder="Optional reference/transaction ID"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button 
                className="btn btn-primary flex-1" 
                onClick={async () => {
                  if (!loanPaymentLoanId) { setLoanPaymentError('Please select a loan'); return; }
                  const amt = parseInt(loanPaymentAmount || '0', 10) || 0;
                  if (amt <= 0) { setLoanPaymentError('Enter a valid amount'); return; }
                  setLoanPaymentBusy(true);
                  setLoanPaymentError('');
                  try {
                    const API_BASE = getApiBaseUrl();
                    const res = await fetch(`${API_BASE}/api/admin/loans/${loanPaymentLoanId}/payment`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
                      body: JSON.stringify({
                        amount: amt,
                        date_paid: new Date(loanPaymentDate).toISOString(),
                        payment_method: loanPaymentMethod,
                        reference: loanPaymentReference,
                      }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Failed to record loan payment');
                    setShowLoanPaymentModal(false);
                    setLoanPaymentAmount('');
                    setLoanPaymentDate(new Date().toISOString().slice(0, 10));
                    setLoanPaymentMethod('CASH');
                    setLoanPaymentReference('');
                    await load();
                  } catch (e: any) {
                    setLoanPaymentError(e.message);
                  } finally {
                    setLoanPaymentBusy(false);
                  }
                }}
                disabled={loanPaymentBusy}
              >
                {loanPaymentBusy ? 'Recording…' : 'Record Payment'}
              </button>
              <button 
                className="btn btn-secondary flex-1"
                onClick={() => {
                  setShowLoanPaymentModal(false);
                  setLoanPaymentAmount('');
                  setLoanPaymentDate(new Date().toISOString().slice(0, 10));
                  setLoanPaymentMethod('CASH');
                  setLoanPaymentReference('');
                  setLoanPaymentError('');
                }}
                disabled={loanPaymentBusy}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loan Rejection Modal */}
      {showRejectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="card max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Reject Pending Loan Application</h2>
            
            {rejectionError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {rejectionError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="label">Rejection Reason *</label>
                <textarea
                  className="textarea textarea-bordered w-full"
                  placeholder="Provide a reason for rejecting this loan application..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                />
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button 
                className="btn btn-error flex-1"
                onClick={handleRejectLoan}
                disabled={rejectionBusy}
              >
                {rejectionBusy ? 'Rejecting…' : 'Reject Loan'}
              </button>
              <button 
                className="btn btn-secondary flex-1"
                onClick={() => {
                  setShowRejectionModal(false);
                  setRejectionReason('');
                  setRejectionError('');
                  setRejectionLoanId(null);
                }}
                disabled={rejectionBusy}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contribution Recording Modal */}
      {showContributionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="card max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Record Contribution for {user?.full_name}</h2>
            
            {contribError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {contribError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="label">Date Paid *</label>
                <input 
                  type="date" 
                  className="input w-full" 
                  value={contribDate}
                  onChange={(e) => setContribDate(e.target.value)}
                />
              </div>

              <div>
                <label className="label">Amount (PHP) *</label>
                <input 
                  type="number" 
                  className="input w-full" 
                  value={contribAmount}
                  onChange={(e) => setContribAmount(e.target.value)}
                  placeholder="0"
                  step="100"
                  min="0"
                />
              </div>

              <div>
                <label className="label">Payment Method *</label>
                <select 
                  className="input w-full"
                  value={contribMethod}
                  onChange={(e) => setContribMethod(e.target.value)}
                >
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="GCASH">GCash</option>
                  <option value="INSTAPAY">Instapay</option>
                  <option value="CASH">Cash</option>
                </select>
              </div>

              <div>
                <label className="label">Reference Number</label>
                <input 
                  type="text" 
                  className="input w-full" 
                  value={contribReference}
                  onChange={(e) => setContribReference(e.target.value)}
                  placeholder="Transaction ID, receipt number, etc"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button 
                className="btn btn-primary flex-1" 
                onClick={submitContribution}
                disabled={contribBusy}
              >
                {contribBusy ? 'Recording…' : 'Record Contribution'}
              </button>
              <button 
                className="btn btn-secondary flex-1"
                onClick={() => {
                  setShowContributionModal(false);
                  setContribError('');
                  setContribAmount('');
                  setContribReference('');
                }}
                disabled={contribBusy}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

