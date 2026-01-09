'use client';

import { useEffect, useMemo, useState } from 'react';
import ContributionForm from '../../../components/ContributionForm';
import { getApiBaseUrl } from '@/lib/api-config';

type User = { id: number; email: string; share_count: number; full_name: string };
type SystemConfig = { min_shares: number; max_shares: number; share_value: number };

type Payment = {
  id: number;
  type: 'CONTRIBUTION' | 'LOAN_PAYMENT';
  userId: number;
  userName: string;
  amount: number;
  date: string;
  reference?: string;
  method?: string;
  status?: string;
  loanId?: number;
  principal?: number;
  interest?: number;
  loanStatus?: string;
};

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('eq_admin_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  
  // Loan payment form state
  const [showLoanPaymentForm, setShowLoanPaymentForm] = useState(false);
  const [loanPaymentBusy, setLoanPaymentBusy] = useState(false);
  const [loanPaymentError, setLoanPaymentError] = useState('');
  const [unpaidLoans, setUnpaidLoans] = useState<any[]>([]);
  const [selectedLoanId, setSelectedLoanId] = useState('');
  const [amountPaid, setAmountPaid] = useState('');

  const fetchPayments = async () => {
    setLoading(true);
    setError('');
    try {
      const API_BASE = getApiBaseUrl();
      const [contributionsRes, loansRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/contributions`, { headers: getAuthHeaders(), cache: 'no-store' }),
        fetch(`${API_BASE}/api/admin/loans`, { headers: getAuthHeaders(), cache: 'no-store' }),
      ]);

      const contributions = await contributionsRes.json();
      const loansData = await loansRes.json();

      const allPayments: Payment[] = [];

      // Add contributions
      if (Array.isArray(contributions)) {
        contributions.forEach((c: any) => {
          allPayments.push({
            id: c.id,
            type: 'CONTRIBUTION',
            userId: c.userId,
            userName: c.user?.full_name || 'Unknown',
            amount: c.amount,
            date: c.date_paid,
            reference: c.reference_number,
            method: c.method,
            status: c.status,
          });
        });
      }

      // Add loan payments (treating the full loan as a payment for now)
      const loansList = Array.isArray(loansData) ? loansData : loansData.data || [];
      loansList.forEach((l: any) => {
        allPayments.push({
          id: l.id,
          type: 'LOAN_PAYMENT',
          userId: l.userId || 0,
          userName: l.user?.full_name || l.borrowerName || 'Unknown',
          amount: l.principal + l.interest,
          date: l.createdAt,
          reference: l.id.toString(),
          loanId: l.id,
          principal: l.principal,
          interest: l.interest,
          loanStatus: l.status,
        });
      });

      // Sort by date, latest first
      allPayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setPayments(allPayments);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnpaidLoans = async () => {
    try {
      const API_BASE = getApiBaseUrl();
      const res = await fetch(`${API_BASE}/api/admin/loans`, { headers: getAuthHeaders(), cache: 'no-store' });
      const loansData = await res.json();
      const loansList = Array.isArray(loansData) ? loansData : loansData.data || [];
      // Filter loans that are not PAID
      const unpaid = loansList.filter((l: any) => l.status !== 'PAID');
      setUnpaidLoans(unpaid);
    } catch (e: any) {
      console.error('Failed to fetch unpaid loans:', e);
    }
  };

  useEffect(() => {
    fetchPayments();
    fetchUnpaidLoans();
  }, [refreshToken]);

  const handleContributionAdded = () => {
    setRefreshToken(prev => prev + 1);
  };

  const handleLoanPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoanPaymentError('');
    setLoanPaymentBusy(true);
    try {
      const API_BASE = getApiBaseUrl();
      const res = await fetch(`${API_BASE}/api/admin/loans/${selectedLoanId}/payment`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getAuthHeaders() 
        },
        body: JSON.stringify({ amount: Number(amountPaid) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record loan payment');
      
      setAmountPaid('');
      setSelectedLoanId('');
      setShowLoanPaymentForm(false);
      setRefreshToken(prev => prev + 1);
    } catch (e: any) {
      setLoanPaymentError(e.message);
    } finally {
      setLoanPaymentBusy(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Payments Management</h1>
        <p className="text-gray-600">Record member contributions, loan payments, and view all payment history</p>
      </div>

      {/* Contribution Form */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Record Member Contribution</h2>
        <ContributionForm onSuccess={handleContributionAdded} />
      </div>

      {/* Loan Payment Form */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Record Loan Payment</h2>
        
        {showLoanPaymentForm ? (
          <form className="space-y-4" onSubmit={handleLoanPaymentSubmit}>
            {loanPaymentError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {loanPaymentError}
              </div>
            )}
            
            <div>
              <label className="label">Select Loan</label>
              <select 
                className="input" 
                value={selectedLoanId}
                onChange={(e) => setSelectedLoanId(e.target.value)}
                required
              >
                <option value="">-- Choose a loan --</option>
                {unpaidLoans.map(loan => (
                  <option key={loan.id} value={loan.id}>
                    {loan.borrowerName} - ₱{(loan.principal + loan.interest).toLocaleString()} ({loan.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Amount Paid (PHP)</label>
              <input
                className="input"
                type="number"
                min="0"
                step="100"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                required
              />
            </div>

            <div className="flex gap-2">
              <button className="btn btn-primary" type="submit" disabled={loanPaymentBusy || !selectedLoanId || !amountPaid}>
                {loanPaymentBusy ? 'Recording…' : 'Record Payment'}
              </button>
              <button 
                className="btn btn-secondary" 
                type="button"
                onClick={() => {
                  setShowLoanPaymentForm(false);
                  setAmountPaid('');
                  setSelectedLoanId('');
                  setLoanPaymentError('');
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button className="btn btn-primary" onClick={() => setShowLoanPaymentForm(true)}>
            + Add Loan Payment
          </button>
        )}
      </div>

      {/* Payment Detail Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="card max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Payment Details</h2>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-400">Date</div>
                <div className="font-semibold">{formatDate(selectedPayment.date)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Member</div>
                <div className="font-semibold">{selectedPayment.userName}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Type</div>
                <div className="font-semibold">
                  <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                    selectedPayment.type === 'CONTRIBUTION'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-purple-100 text-purple-800'
                  }`}>
                    {selectedPayment.type === 'CONTRIBUTION' ? 'Contribution' : 'Loan Payment'}
                  </span>
                </div>
              </div>
              {selectedPayment.type === 'CONTRIBUTION' ? (
                <>
                  <div>
                    <div className="text-xs text-gray-400">Amount</div>
                    <div className="font-semibold text-lg">{formatCurrency(selectedPayment.amount)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Method</div>
                    <div className="font-semibold">{selectedPayment.method || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Status</div>
                    <div className="font-semibold">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        selectedPayment.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                        selectedPayment.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {selectedPayment.status}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Reference</div>
                    <div className="font-mono text-sm">{selectedPayment.reference || 'N/A'}</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-gray-400">Principal</div>
                      <div className="font-semibold">{formatCurrency(selectedPayment.principal || 0)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Interest</div>
                      <div className="font-semibold">{formatCurrency(selectedPayment.interest || 0)}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Total Amount</div>
                    <div className="font-semibold text-lg">{formatCurrency(selectedPayment.amount)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-400">Loan Status</div>
                    <div className="font-semibold">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        selectedPayment.loanStatus === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                        selectedPayment.loanStatus === 'APPROVED' ? 'bg-green-100 text-green-800' :
                        selectedPayment.loanStatus === 'ACTIVE' ? 'bg-blue-100 text-blue-800' :
                        selectedPayment.loanStatus === 'PAID' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {selectedPayment.loanStatus}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="mt-6">
              <button 
                className="btn btn-secondary w-full" 
                onClick={() => setSelectedPayment(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payments Table */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Payment History</h2>
        
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div>Loading payments…</div>
        ) : payments.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-gray-600">
            No payments recorded yet
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Date</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Member</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Type</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Amount</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Method/Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Reference</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr 
                    key={`${payment.type}-${payment.id}`} 
                    className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedPayment(payment)}
                  >
                    <td className="px-6 py-3 text-sm text-gray-900">{formatDate(payment.date)}</td>
                    <td className="px-6 py-3 text-sm text-gray-900">{payment.userName}</td>
                    <td className="px-6 py-3 text-sm">
                      <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                        payment.type === 'CONTRIBUTION'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {payment.type === 'CONTRIBUTION' ? 'Contribution' : 'Loan Payment'}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm font-semibold text-gray-900">{formatCurrency(payment.amount)}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">
                      {payment.method || payment.status || '—'}
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-600 font-mono text-xs">
                      {payment.reference || '—'}
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
