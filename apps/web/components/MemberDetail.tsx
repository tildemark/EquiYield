"use client";

import React from 'react';
import { useEffect, useState } from 'react';

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
};

type CycleDividendStatus = {
  year: number;
  cycle: number;
  isEligible: boolean;
  reason?: string | null;
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
  cycleDividendStatus: CycleDividendStatus[];
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

  async function load() {
    setLoading(true);
    setError(null);
    try {
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
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
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

  useEffect(() => {
    load();
  }, [userId]);

  useEffect(() => {
    const fetchPayouts = async () => {
      setPayoutLoading(true);
      setPayoutError('');
      try {
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

  // Group contributions by cycle
  type CycleGroup = {
    year: number;
    cycle: number;
    contributions: Contribution[];
    totalAmount: number;
    isEligible: boolean;
    reason?: string | null;
  };

  const cycleGroups: CycleGroup[] = [];
  const cycleMap = new Map<string, CycleGroup>();

  user.contributions.forEach((c) => {
    const date = new Date(c.date_paid);
    const year = date.getFullYear();
    const cycle = getCycleForDate(date);
    const key = `${year}-${cycle}`;

    if (!cycleMap.has(key)) {
      const cycleStatus = user.cycleDividendStatus.find(
        (s) => s.year === year && s.cycle === cycle
      );
      const group: CycleGroup = {
        year,
        cycle,
        contributions: [],
        totalAmount: 0,
        isEligible: cycleStatus?.isEligible ?? true,
        reason: cycleStatus?.reason ?? '',
      };
      cycleMap.set(key, group);
      cycleGroups.push(group);
    }

    const group = cycleMap.get(key)!;
    group.contributions.push(c);
    group.totalAmount += c.amount;
  });

  // Sort by year and cycle descending
  cycleGroups.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.cycle - a.cycle;
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
          <button className="btn btn-secondary text-sm" onClick={isEditing ? cancelEditing : startEditing}>
            {isEditing ? 'Cancel' : 'Edit'}
          </button>
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

        <div className="mt-4 flex items-center gap-3">
          <button className="btn btn-secondary" onClick={resetPassword} disabled={resetBusy}>{resetBusy ? 'Resetting…' : 'Reset Password'}</button>
          {newPassword && (
            <span className="text-xs">New password: <span className="font-mono">{newPassword}</span></span>
          )}
        </div>
      </div>

      {/* Contributions */}
      <div className="card">
        <h3 className="text-xl font-semibold mb-4">Contributions by Cycle</h3>
        {cycleGroups.length === 0 ? (
          <p className="text-gray-400">No contributions recorded</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Cycle</th>
                <th>Total Amount (PHP)</th>
                <th>Payments</th>
                <th>Dividend Eligibility</th>
                              <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {cycleGroups.map((group) => {
                const key = `${group.year}-${group.cycle}`;
                const isExpanded = expandedCycles.has(key);
                const cycleLabel = group.cycle === 1 ? '15th' : '30th/end';
                const hasMultiplePayments = group.contributions.length > 1;

                return (
                  <React.Fragment key={key}>
                    <tr className="font-semibold">
                      <td>
                        <div className="flex items-center gap-2">
                          {hasMultiplePayments && (
                            <button
                              onClick={() => toggleExpanded(key)}
                              className="text-blue-400 hover:text-blue-300"
                            >
                              {isExpanded ? '▼' : '▶'}
                            </button>
                          )}
                          <span>
                            {group.year} C{group.cycle} (Due {cycleLabel})
                          </span>
                        </div>
                      </td>
                      <td>₱{group.totalAmount.toLocaleString()}</td>
                      <td>
                        {hasMultiplePayments ? (
                          <span className="badge badge-warning">
                            {group.contributions.length} payments
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">Single payment</span>
                        )}
                      </td>
                      <td>
                        <div className="flex flex-col gap-1">
                          <span className={`badge ${group.isEligible ? 'badge-success' : 'badge-danger'}`}>
                            {group.isEligible ? 'Eligible' : 'Ineligible'}
                          </span>
                          {!group.isEligible && group.reason ? (
                            <span className="text-xs text-gray-400">{group.reason}</span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <button
                          className={`btn ${group.isEligible ? 'btn-danger' : 'btn-primary'} text-xs px-2 py-1`}
                          onClick={() => toggleCycleEligibility(group.year, group.cycle, group.isEligible, group.reason)}
                          disabled={togglingCycle === key}
                        >
                          {togglingCycle === key 
                            ? 'Updating…' 
                            : group.isEligible 
                              ? 'Mark Ineligible' 
                              : 'Mark Eligible'}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && group.contributions.map((c, idx) => (
                      <tr key={`${key}-${c.id}`} className="bg-gray-800/30 text-sm">
                        <td className="pl-12">Payment {idx + 1}</td>
                        <td>₱{c.amount.toLocaleString()}</td>
                        <td>
                          <div className="flex flex-col gap-1">
                            <span className="text-gray-400">{new Date(c.date_paid).toLocaleDateString()}</span>
                            <span className={`badge ${c.status === 'FULL' ? 'badge-success' : 'badge-warning'}`}>
                              {c.status}
                            </span>
                          </div>
                        </td>
                        <td colSpan={2}>
                          <div className="flex gap-2 text-xs text-gray-400">
                            <span>{c.method}</span>
                            <span>Ref: {c.reference_number}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Loans */}
      <div className="card">
        <h3 className="text-xl font-semibold mb-4">Loans</h3>
        {user.loans.length === 0 ? (
          <p className="text-gray-400">No loans recorded</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Principal (PHP)</th>
                <th>Interest (PHP)</th>
                <th>Total (PHP)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {user.loans.map((loan) => (
                <tr key={loan.id}>
                  <td>{new Date(loan.createdAt).toLocaleDateString()}</td>
                  <td>₱{loan.principal.toLocaleString()}</td>
                  <td>₱{loan.interest.toLocaleString()}</td>
                  <td>₱{(loan.principal + loan.interest).toLocaleString()}</td>
                  <td>
                    <span className="badge badge-info">{loan.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
    </div>
  );
}
