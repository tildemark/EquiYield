'use client';

import { useState, useEffect } from 'react';
import BulkPayoutForm from '../../../components/BulkPayoutForm';
import { getApiBaseUrl } from '@/lib/api-config';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('eq_admin_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

interface DividendPayout {
  id: number;
  userId: number;
  year: number;
  perShare: number;
  sharesCount: number;
  amount: number;
  channel: string;
  bankName?: string;
  bankAccountNumber?: string;
  gcashNumber?: string;
  reference: string;
  depositedAt: string;
  createdAt: string;
  user: { id: number; full_name: string; email: string };
  createdBy?: { id: number; full_name: string };
}

interface Expense {
  id: number;
  year: number;
  amount: number;
  description: string;
  referenceType: string;
  reference: string;
  createdAt: string;
  createdBy?: { id: number; full_name: string; email: string };
}

interface PageParams {
  year?: number;
  userId?: number;
}

export default function DividendsPage() {
  const [payouts, setPayouts] = useState<DividendPayout[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());
  const [totalAmount, setTotalAmount] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [showExpensesSection, setShowExpensesSection] = useState(true);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ amount: '', description: '', referenceType: 'NONE', reference: '' });
  const [expenseBusy, setExpenseBusy] = useState(false);
  const [expenseError, setExpenseError] = useState('');

  const fetchPayouts = async (params?: PageParams) => {
    try {
      setLoading(true);
      setError('');
      const API_BASE = getApiBaseUrl();
      let url = `${API_BASE}/api/admin/dividends/payouts`;
      if (params?.year) url += `?year=${params.year}`;
      
      const res = await fetch(url, {
        headers: getAuthHeaders(),
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Failed to fetch payouts');
      const data = await res.json();
      setPayouts(data);
      
      // Calculate total for filtered year
      const total = data
        .filter((p: DividendPayout) => p.year === filterYear)
        .reduce((sum: number, p: DividendPayout) => sum + p.amount, 0);
      setTotalAmount(total);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const fetchExpenses = async () => {
    try {
      const API_BASE = getApiBaseUrl();
      const res = await fetch(`${API_BASE}/api/admin/expenses?year=${filterYear}`, {
        headers: getAuthHeaders(),
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Failed to fetch expenses');
      const data = await res.json();
      setExpenses(data);
      const total = data.reduce((sum: number, e: Expense) => sum + e.amount, 0);
      setTotalExpenses(total);
    } catch (err: any) {
      console.error('Failed to load expenses:', err.message);
    }
  };

  const submitExpense = async () => {
    if (!expenseForm.amount || !expenseForm.description) {
      setExpenseError('Amount and description required');
      return;
    }

    setExpenseBusy(true);
    setExpenseError('');
    try {
      const API_BASE = getApiBaseUrl();
      const res = await fetch(`${API_BASE}/api/admin/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          amount: Number(expenseForm.amount),
          description: expenseForm.description,
          referenceType: expenseForm.referenceType,
          reference: expenseForm.reference,
          year: filterYear,
        }),
      });

      if (!res.ok) throw new Error('Failed to create expense');
      await fetchExpenses();
      setShowAddExpenseModal(false);
      setExpenseForm({ amount: '', description: '', referenceType: 'NONE', reference: '' });
    } catch (err: any) {
      setExpenseError(err.message);
    } finally {
      setExpenseBusy(false);
    }
  };

  const deleteExpense = async (expenseId: number) => {
    if (!window.confirm('Delete this expense?')) return;
    try {
      const API_BASE = getApiBaseUrl();
      const res = await fetch(`${API_BASE}/api/admin/expenses/${expenseId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to delete expense');
      await fetchExpenses();
    } catch (err: any) {
      alert('Failed to delete expense: ' + err.message);
    }
  };

  useEffect(() => {
    fetchPayouts({ year: filterYear });
    fetchExpenses();
    setLoading(false);
  }, [filterYear]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-PH');
  };

  const filteredPayouts = payouts.filter((p) => p.year === filterYear);
  const years = [...new Set(payouts.map((p) => p.year))].sort((a, b) => b - a);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Dividend & Expenses Management</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="card">
          <div className="text-sm text-gray-400 mb-1">Year</div>
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(Number(e.target.value))}
            className="input w-full"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="card">
          <div className="text-sm text-gray-400 mb-1">Payouts Distributed</div>
          <div className="text-2xl font-bold text-gray-100">{filteredPayouts.length}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-400 mb-1">Total Payout Amount</div>
          <div className="text-2xl font-bold text-green-400">{formatCurrency(totalAmount)}</div>
        </div>
      </div>

      {/* Bulk Payout Form */}
      <div className="mb-6">
        <BulkPayoutForm />
      </div>

      {/* Expenses Section */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Operating Expenses</h3>
          <div className="flex items-center gap-2">
            <button
              className="btn btn-success btn-sm text-sm"
              onClick={() => {
                setExpenseForm({ amount: '', description: '', referenceType: 'NONE', reference: '' });
                setExpenseError('');
                setShowAddExpenseModal(true);
              }}
            >
              + Add Expense
            </button>
            <button
              className="btn btn-secondary btn-sm text-sm"
              onClick={() => setShowExpensesSection(!showExpensesSection)}
            >
              {showExpensesSection ? 'Collapse' : 'Expand'}
            </button>
          </div>
        </div>

        {!showExpensesSection ? null : expenses.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No expenses recorded for {filterYear}</div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-4">
              <div className="p-3 rounded border border-gray-700 bg-gray-900/50">
                <div className="text-xs text-gray-500">Total Expenses</div>
                <div className="text-2xl font-bold text-red-400">{formatCurrency(totalExpenses)}</div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-800/50">
                  <tr className="border-b border-gray-700">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">Description</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">Reference</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">Created By</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-300">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((exp) => (
                    <tr key={exp.id} className="border-b border-gray-700/50 hover:bg-gray-800/30">
                      <td className="px-4 py-3 text-gray-300">{formatDate(exp.createdAt)}</td>
                      <td className="px-4 py-3 text-gray-300">{exp.description}</td>
                      <td className="px-4 py-3 text-right font-bold text-red-400">{formatCurrency(exp.amount)}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs badge badge-sm">{exp.referenceType}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono">{exp.reference || '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{exp.createdBy?.full_name || 'System'}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          className="btn btn-error btn-xs"
                          onClick={() => deleteExpense(exp.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Add Expense Modal */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="card w-full max-w-md mx-auto p-6">
            <h3 className="font-bold text-lg mb-4">Add Operating Expense</h3>
            
            {expenseError && (
              <div className="mb-4 p-3 rounded bg-red-900/20 text-red-300 text-sm">{expenseError}</div>
            )}

            <div className="space-y-4">
              <div>
                <label className="label text-sm">Amount (₱) *</label>
                <input
                  type="number"
                  className="input input-bordered w-full"
                  placeholder="1000"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                />
              </div>

              <div>
                <label className="label text-sm">Description *</label>
                <textarea
                  className="textarea textarea-bordered w-full"
                  placeholder="Office supplies, maintenance, etc."
                  rows={3}
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                />
              </div>

              <div>
                <label className="label text-sm">Reference Type</label>
                <select
                  className="select select-bordered w-full"
                  value={expenseForm.referenceType}
                  onChange={(e) => setExpenseForm({ ...expenseForm, referenceType: e.target.value })}
                >
                  <option value="NONE">None</option>
                  <option value="GCASH">GCash</option>
                  <option value="RECEIPT">Receipt</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                </select>
              </div>

              {expenseForm.referenceType !== 'NONE' && (
                <div>
                  <label className="label text-sm">Reference Number/Code</label>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    placeholder="e.g., GCash reference or receipt number"
                    value={expenseForm.reference}
                    onChange={(e) => setExpenseForm({ ...expenseForm, reference: e.target.value })}
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <button
                className="btn btn-ghost flex-1"
                onClick={() => setShowAddExpenseModal(false)}
                disabled={expenseBusy}
              >
                Cancel
              </button>
              <button
                className="btn btn-success flex-1"
                onClick={submitExpense}
                disabled={expenseBusy}
              >
                {expenseBusy ? 'Saving...' : 'Save Expense'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payouts Table */}
      <div className="card">
        <h3 className="text-xl font-semibold mb-4">Payout Records</h3>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {filteredPayouts.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No payouts recorded for {filterYear}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-800/50">
                <tr className="border-b border-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">Member</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">Per Share</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">Shares</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-300">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">Channel</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">Reference</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">Deposited</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-300">Created By</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayouts.map((payout) => (
                  <tr key={payout.id} className="border-b border-gray-700/50 hover:bg-gray-800/30">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-200 text-sm">{payout.user.full_name}</div>
                      <div className="text-xs text-gray-500">{payout.user.email}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-300 text-sm">
                      ₱{payout.perShare.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300 text-sm">
                      {payout.sharesCount}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-green-400 text-sm">
                      {formatCurrency(payout.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        payout.channel === 'GCASH'
                          ? 'bg-blue-900/30 text-blue-300'
                          : 'bg-purple-900/30 text-purple-300'
                      }`}>
                        {payout.channel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{payout.reference}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">{formatDate(payout.depositedAt)}</td>
                    <td className="px-4 py-3 text-gray-500 text-sm">
                      {payout.createdBy ? payout.createdBy.full_name : 'System'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
