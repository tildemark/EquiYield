'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getApiBaseUrl } from '@/lib/api-config';

type Me = {
  id: number;
  full_name: string;
  email: string;
  phone_number: string;
  gcashNumber: string;
  bankName: string;
  bankAccountNumber: string;
  share_count: number;
  forcePasswordReset: boolean;
  contributions: Array<{ id: number; amount: number; date_paid: string; status: string; method?: string; reference_number?: string }>;
  loans: Array<{ 
    id: number; 
    principal: number; 
    interest: number; 
    status: string; 
    createdAt: string; 
    releasedAt?: string; 
    settledAt?: string;
    dueDate?: string;
    monthlyAmortization: number;
    termMonths: number;
    totalPaid: number;
    remainingBalance: number;
    isPastDue: boolean;
    payments: Array<{ id: number; amount: number; createdAt: string; method?: string; reference?: string; date?: string }>;
  }>;
  coMakerOnLoans?: Array<{
    id: number;
    loan: {
      id: number;
      principal: number;
      interest: number;
      status: string;
      createdAt: string;
      releasedAt?: string;
      settledAt?: string;
      dueDate?: string;
      monthlyAmortization: number;
      termMonths: number;
      borrowerName: string;
      borrowerEmail: string;
      user?: { id: number; full_name: string; email: string };
      payments: Array<{ id: number; amount: number; createdAt: string; method?: string; reference?: string; date?: string }>;
    };
  }>;
  totalContributions: number;
};

type SystemConfig = { share_value: number; min_loan_amount: number; max_loan_amount: number };

export default function MemberDashboard() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState('');
  const [config, setConfig] = useState<SystemConfig | null>(null);
  
  // Change Password Modal
  const [showChangePw, setShowChangePw] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwStatus, setPwStatus] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Apply for Loan Modal
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [principal, setPrincipal] = useState('');
  const [termMonths, setTermMonths] = useState('');

  // Detail modals
  const [selectedContribution, setSelectedContribution] = useState<Me['contributions'][0] | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<Me['loans'][0] | null>(null);

  // Collapsible sections state
  const [showContributions, setShowContributions] = useState(true);
  const [showLoans, setShowLoans] = useState(true);
  const [showPayouts, setShowPayouts] = useState(true);
  const [showCoMakerLoans, setShowCoMakerLoans] = useState(false);
  const [showTransactions, setShowTransactions] = useState(true);

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
  const [payoutError, setPayoutError] = useState('');

  useEffect(() => {
    const t = localStorage.getItem('eq_member_token');
    if (!t) {
      router.push('/member/login');
      return;
    }
    setToken(t);
  }, []);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const API_BASE = getApiBaseUrl();
        const res = await fetch(`${API_BASE}/api/member/me`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load profile');
        setMe(data);
      } catch (e: any) {
        setError(e.message);
      }
    })();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const API_BASE = getApiBaseUrl();
        const res = await fetch(`${API_BASE}/api/member/dividends`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load payouts');
        setPayouts(data);
      } catch (e: any) {
        setPayoutError(e.message);
      }
    })();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const API_BASE = getApiBaseUrl();
        const res = await fetch(`${API_BASE}/api/admin/system-config`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const data = await res.json();
        setConfig(data);
      } catch (e: any) {
        console.error('Failed to load config:', e);
      }
    })();
  }, [token]);

  const applyLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setBusy(true);
    try {
      const API_BASE = getApiBaseUrl();
      const res = await fetch(`${API_BASE}/api/member/loans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ principal: Number(principal), termMonths: Number(termMonths) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Loan application failed');
      setPrincipal('');
      setTermMonths('');
      setShowLoanForm(false);
      // reload profile
      const meRes = await fetch(`${API_BASE}/api/member/me`, { headers: { Authorization: `Bearer ${token}` } });
      setMe(await meRes.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setPwBusy(true);
    setPwStatus('');
    try {
      const API_BASE = getApiBaseUrl();
      const res = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errorMsg = typeof data.error === 'string' ? data.error : 
                        (data.message || JSON.stringify(data.error) || 'Change password failed');
        throw new Error(errorMsg);
      }
      setPwStatus('✓ Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setTimeout(() => setShowChangePw(false), 1500);
    } catch (e: any) {
      const errorMessage = e?.message || (typeof e === 'string' ? e : 'Change password failed. Please try again.');
      setPwStatus('✗ ' + errorMessage);
    } finally {
      setPwBusy(false);
    }
  };

  // Calculate loan details for preview
  const principalNum = Number(principal) || 0;
  const termNum = Number(termMonths) || 0;
  const monthlyRate = 0.05; // 5% for members
  const loanInterest = Math.round(principalNum * monthlyRate * termNum);
  const totalAmount = principalNum + loanInterest;
  const monthlyAmortization = termNum > 0 ? Math.round(totalAmount / termNum) : 0;

  if (!token) return null;

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      {/* Header with Action Buttons */}
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-gray-900">Member Dashboard</h1>
          <div className="flex items-center gap-3">
            <button
              className="btn btn-secondary text-sm"
              onClick={() => setShowChangePw(true)}
            >Change Password</button>
            <button
              className="btn btn-primary text-sm"
              onClick={() => setShowLoanForm(true)}
            >Apply for Loan</button>
            <button
              className="btn btn-secondary text-sm"
              onClick={() => { localStorage.removeItem('eq_member_token'); router.push('/member/login'); }}
            >Sign Out</button>
          </div>
        </div>
        {me && (
          <p className="text-gray-600">Welcome back, {me.full_name}</p>
        )}
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {/* Change Password Modal */}
      {showChangePw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="card max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Change Password</h2>
            <form className="space-y-3" onSubmit={changePassword}>
              <div>
                <label className="label">Current Password</label>
                <input 
                  className="input" 
                  type="password" 
                  value={currentPassword} 
                  onChange={(e) => setCurrentPassword(e.target.value)} 
                  required 
                />
              </div>
              <div>
                <label className="label">New Password</label>
                <input 
                  className="input" 
                  type="password" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                  required 
                />
              </div>
              {pwStatus && (
                <div className={`text-sm p-2 rounded ${pwStatus.startsWith('✓') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {pwStatus}
                </div>
              )}
              <div className="flex gap-2">
                <button className="btn btn-primary flex-1" type="submit" disabled={pwBusy}>
                  {pwBusy ? 'Updating…' : 'Update'}
                </button>
                <button 
                  className="btn btn-secondary flex-1" 
                  type="button" 
                  onClick={() => {
                    setShowChangePw(false);
                    setCurrentPassword('');
                    setNewPassword('');
                    setPwStatus('');
                  }}
                >
                  Close
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Apply for Loan Modal */}
      {showLoanForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="card max-w-lg w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Apply for a Loan</h2>
            
            {/* Check if user has pending loans */}
            {me && me.loans.some(l => l.status === 'PENDING') && (
              <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                <p className="text-sm text-yellow-800 font-semibold">⚠️ Cannot Apply</p>
                <p className="text-xs text-yellow-700 mt-1">You cannot apply for a new loan while you have pending loan applications.</p>
              </div>
            )}
            
            <form className="space-y-4" onSubmit={applyLoan}>
              <div>
                <label className="label">Principal Amount (PHP)</label>
                <input 
                  className="input" 
                  type="number" 
                  min={config?.min_loan_amount || 1000}
                  max={config?.max_loan_amount || 100000}
                  value={principal} 
                  onChange={(e) => setPrincipal(e.target.value)} 
                  disabled={!!(me && me.loans.some(l => l.status === 'PENDING'))}
                  required 
                />
                <p className="text-xs text-gray-400 mt-1">
                  Min: ₱{(config?.min_loan_amount || 1000).toLocaleString()} • 
                  Max: ₱{(config?.max_loan_amount || 100000).toLocaleString()}
                </p>
              </div>
              
              <div>
                <label className="label">Term (Months)</label>
                <input 
                  className="input" 
                  type="number" 
                  min="1" 
                  max="60" 
                  value={termMonths} 
                  onChange={(e) => setTermMonths(e.target.value)} 
                  disabled={!!(me && me.loans.some(l => l.status === 'PENDING'))}
                  required 
                />
                <p className="text-xs text-gray-400 mt-1">1 to 60 months</p>
              </div>

              {/* Loan Computation Preview */}
              {principalNum > 0 && termNum > 0 && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-2">
                  <h4 className="font-semibold text-sm text-blue-900">Loan Computation</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-gray-600">Principal:</div>
                    <div className="font-semibold text-right">₱{principalNum.toLocaleString()}</div>
                    
                    <div className="text-gray-600">Interest Rate (5% p.a.):</div>
                    <div className="font-semibold text-right">{(monthlyRate * 100).toFixed(1)}%</div>
                    
                    <div className="text-gray-600">Term:</div>
                    <div className="font-semibold text-right">{termNum} month{termNum !== 1 ? 's' : ''}</div>
                    
                    <div className="border-t border-blue-200"></div>
                    <div className="border-t border-blue-200"></div>
                    
                    <div className="text-gray-600">Total Interest:</div>
                    <div className="font-semibold text-right">₱{loanInterest.toLocaleString()}</div>
                    
                    <div className="text-gray-600 font-semibold">Total Amount:</div>
                    <div className="font-bold text-right text-lg">₱{totalAmount.toLocaleString()}</div>
                    
                    <div className="text-gray-600">Monthly Amortization:</div>
                    <div className="font-semibold text-right">₱{monthlyAmortization.toLocaleString()}</div>
                  </div>
                </div>
              )}

              <div className="text-xs text-gray-400">
                Member-applied loans are created with status PENDING and require admin approval.
              </div>

              <div className="flex gap-2">
                <button className="btn btn-primary flex-1" type="submit" disabled={busy || principalNum === 0 || termNum === 0 || !!(me && me.loans.some(l => l.status === 'PENDING'))}>
                  {busy ? 'Submitting…' : 'Submit Application'}
                </button>
                <button 
                  className="btn btn-secondary flex-1" 
                  type="button" 
                  onClick={() => {
                    setShowLoanForm(false);
                    setPrincipal('');
                    setTermMonths('');
                  }}
                >
                  Close
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contribution Detail Modal */}
      {selectedContribution && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="card max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Contribution Details</h2>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-400">Date Paid</div>
                <div className="font-semibold">{new Date(selectedContribution.date_paid).toLocaleDateString()}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Amount</div>
                <div className="font-semibold text-lg">₱{selectedContribution.amount.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Status</div>
                <div className="font-semibold">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    selectedContribution.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                    selectedContribution.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {selectedContribution.status}
                  </span>
                </div>
              </div>
              {selectedContribution.method && (
                <div>
                  <div className="text-xs text-gray-400">Payment Method</div>
                  <div className="font-semibold">{selectedContribution.method}</div>
                </div>
              )}
              {selectedContribution.reference_number && (
                <div>
                  <div className="text-xs text-gray-400">Reference Number</div>
                  <div className="font-mono text-sm">{selectedContribution.reference_number}</div>
                </div>
              )}
            </div>
            <div className="mt-6 flex gap-2">
              <button 
                className="btn btn-secondary flex-1" 
                onClick={() => setSelectedContribution(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loan Detail Modal */}
      {selectedLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="card max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Loan Repayment Details</h2>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-400">Date Applied</div>
                <div className="font-semibold">{new Date(selectedLoan.createdAt).toLocaleDateString()}</div>
              </div>
              {selectedLoan.releasedAt && (
                <div>
                  <div className="text-xs text-gray-400">Date Released</div>
                  <div className="font-semibold">{new Date(selectedLoan.releasedAt).toLocaleDateString()}</div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-400">Principal</div>
                  <div className="font-semibold">₱{selectedLoan.principal.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Interest</div>
                  <div className="font-semibold">₱{selectedLoan.interest.toLocaleString()}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-gray-400">Term</div>
                  <div className="font-semibold">{selectedLoan.termMonths} month{selectedLoan.termMonths !== 1 ? 's' : ''}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Monthly Amortization</div>
                  <div className="font-semibold">₱{selectedLoan.monthlyAmortization.toLocaleString()}</div>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-400">Total Amount Due</div>
                <div className="font-semibold text-lg">₱{(selectedLoan.principal + selectedLoan.interest).toLocaleString()}</div>
              </div>
              {selectedLoan.termMonths && (
                <div>
                  <div className="text-xs text-gray-400">Expected Completion Date</div>
                  <div className="font-semibold">
                    {(() => {
                      // Use release date if available, otherwise use application date
                      const startDate = selectedLoan.releasedAt 
                        ? new Date(selectedLoan.releasedAt) 
                        : new Date(selectedLoan.createdAt);
                      const expectedDate = new Date(startDate);
                      expectedDate.setMonth(expectedDate.getMonth() + selectedLoan.termMonths);
                      return expectedDate.toLocaleDateString();
                    })()}
                    {!selectedLoan.releasedAt && (
                      <span className="text-xs text-gray-500 ml-2">(from application date)</span>
                    )}
                  </div>
                </div>
              )}
              <div>
                <div className="text-xs text-gray-400">Status</div>
                <div className="font-semibold">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    selectedLoan.status === 'ACTIVE' ? 'bg-blue-100 text-blue-800' :
                    selectedLoan.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                    selectedLoan.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                    selectedLoan.status === 'PAID' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {selectedLoan.status === 'PAID' ? 'Settled' : selectedLoan.status === 'ACTIVE' ? 'Active' : selectedLoan.status}
                  </span>
                </div>
              </div>
              {selectedLoan.settledAt && (
                <div>
                  <div className="text-xs text-gray-400">Date Settled</div>
                  <div className="font-semibold">{new Date(selectedLoan.settledAt).toLocaleDateString()}</div>
                </div>
              )}
              {selectedLoan.payments && selectedLoan.payments.length > 0 && (
                <div>
                  <div className="text-xs text-gray-400 mb-2">Payment History</div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {selectedLoan.payments.map((payment) => (
                      <div key={payment.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <div className="text-xs text-gray-500">
                              {new Date(payment.createdAt).toLocaleDateString('en-PH', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </div>
                            {payment.method && (
                              <div className="text-xs text-gray-600">
                                Method: <span className="font-medium">{payment.method}</span>
                              </div>
                            )}
                            {payment.reference && (
                              <div className="text-xs text-gray-600">
                                Ref: <span className="font-mono">{payment.reference}</span>
                              </div>
                            )}
                          </div>
                          <div className="font-semibold text-green-600">
                            ₱{payment.amount.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-gray-700">
                <p className="font-semibold mb-1">Note:</p>
                <p>Monthly amortization is calculated based on the loan terms approved by administration.</p>
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <button 
                className="btn btn-secondary flex-1" 
                onClick={() => setSelectedLoan(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {me && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card bg-gradient-to-br from-blue-50 to-blue-100">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Account Information</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Email:</span>
                  <span className="font-medium text-gray-900">{me.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Phone:</span>
                  <span className="font-medium text-gray-900">{me.phone_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Shares:</span>
                  <span className="font-semibold text-blue-600 text-lg">{me.share_count}</span>
                </div>
                {me.gcashNumber && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">GCash:</span>
                    <span className="font-medium text-gray-900">{me.gcashNumber}</span>
                  </div>
                )}
                {me.bankName && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Bank:</span>
                    <span className="font-medium text-gray-900">{me.bankName}</span>
                  </div>
                )}
                {me.bankAccountNumber && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Account:</span>
                    <span className="font-mono text-sm text-gray-900">{me.bankAccountNumber}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="card bg-gradient-to-br from-green-50 to-green-100">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Total Contributions</h3>
              <div className="text-3xl font-bold text-green-700">₱{me.totalContributions.toLocaleString()}</div>
              <p className="text-xs text-gray-600 mt-1">
                {me.contributions.length} payment{me.contributions.length !== 1 ? 's' : ''} recorded
              </p>
            </div>

            {me.loans.filter(l => ['ACTIVE', 'APPROVED', 'RELEASED'].includes(l.status) && l.remainingBalance > 0).length > 0 ? (
              <div className="card bg-gradient-to-br from-purple-50 to-purple-100">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Active Loan Summary</h3>
                {me.loans
                  .filter(l => ['ACTIVE', 'APPROVED', 'RELEASED'].includes(l.status) && l.remainingBalance > 0)
                  .map(loan => {
                    const nextDue = loan.dueDate ? new Date(loan.dueDate) : null;
                    const isPastDue = loan.isPastDue;
                    
                    return (
                      <div key={loan.id} className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Principal:</span>
                          <span className="font-semibold text-gray-900">₱{loan.principal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Balance:</span>
                          <span className="font-semibold text-purple-700">₱{loan.remainingBalance.toLocaleString()}</span>
                        </div>
                        {nextDue && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Due Date:</span>
                            <span className={`font-semibold ${isPastDue ? 'text-red-600' : 'text-green-600'}`}>
                              {nextDue.toLocaleDateString()}
                            </span>
                          </div>
                        )}
                        {isPastDue && (
                          <div className="text-xs text-red-600 font-semibold mt-1">⚠️ PAST DUE</div>
                        )}
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="card bg-gradient-to-br from-gray-50 to-gray-100">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Loan Status</h3>
                <div className="text-gray-600 text-sm">No active loans</div>
              </div>
            )}
          </div>

          {/* Contributions History - Collapsible */}
          <div className="card">
            <button
              onClick={() => setShowContributions(!showContributions)}
              className="w-full flex items-center justify-between mb-4"
            >
              <h3 className="text-xl font-semibold text-gray-900">Contributions History</h3>
              <span className="text-2xl text-gray-500">{showContributions ? '−' : '+'}</span>
            </button>
            {showContributions && (
              <>
                {me.contributions.length === 0 ? (
                  <div className="text-sm text-gray-400">No contributions recorded</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Date Paid</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Amount</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {me.contributions.map(c => (
                          <tr key={c.id} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">{new Date(c.date_paid).toLocaleDateString()}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900">₱{c.amount.toLocaleString()}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                                c.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                c.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {c.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <button
                                onClick={() => setSelectedContribution(c)}
                                className="text-blue-600 hover:text-blue-800 font-medium"
                              >
                                View Details
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Loans History - Collapsible */}
          <div className="card">
            <button
              onClick={() => setShowLoans(!showLoans)}
              className="w-full flex items-center justify-between mb-4"
            >
              <h3 className="text-xl font-semibold text-gray-900">Loans History</h3>
              <span className="text-2xl text-gray-500">{showLoans ? '−' : '+'}</span>
            </button>
            {showLoans && (
              <>
                {me.loans.length === 0 ? (
                  <div className="text-sm text-gray-400">No loans recorded</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Date Applied</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Principal</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Interest</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Total Due</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Term</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Expected Completion</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {me.loans.map(l => {
                          // Calculate expected completion date
                          let expectedCompletion = null;
                          if (l.termMonths) {
                            // Use release date if available, otherwise use application date
                            const startDate = l.releasedAt ? new Date(l.releasedAt) : new Date(l.createdAt);
                            expectedCompletion = new Date(startDate);
                            expectedCompletion.setMonth(expectedCompletion.getMonth() + l.termMonths);
                          }
                          
                          return (
                            <tr key={l.id} className="border-b border-gray-200 hover:bg-gray-50">
                              <td className="px-4 py-3 text-sm text-gray-900">
                                <div>{new Date(l.createdAt).toLocaleDateString()}</div>
                                {l.releasedAt && <div className="text-xs text-gray-500">Released: {new Date(l.releasedAt).toLocaleDateString()}</div>}
                              </td>
                              <td className="px-4 py-3 text-sm font-semibold text-gray-900">₱{l.principal.toLocaleString()}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">₱{l.interest.toLocaleString()}</td>
                              <td className="px-4 py-3 text-sm font-semibold text-gray-900">₱{(l.principal + l.interest).toLocaleString()}</td>
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {l.termMonths} month{l.termMonths !== 1 ? 's' : ''}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {expectedCompletion ? (
                                  <div>
                                    <div>{expectedCompletion.toLocaleDateString()}</div>
                                    {l.settledAt && (
                                      <div className="text-xs text-green-600">
                                        Settled: {new Date(l.settledAt).toLocaleDateString()}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                                  l.status === 'ACTIVE' ? 'bg-blue-100 text-blue-800' :
                                  l.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                                  l.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                  l.status === 'PAID' ? 'bg-green-100 text-green-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {l.status === 'PAID' ? 'Settled' : l.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <button
                                  onClick={() => setSelectedLoan(l)}
                                  className="text-blue-600 hover:text-blue-800 font-medium"
                                >
                                  View Details
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Co-Maker Loans - Collapsible */}
          {me.coMakerOnLoans && me.coMakerOnLoans.length > 0 && (
            <div className="card">
              <button
                onClick={() => setShowCoMakerLoans(!showCoMakerLoans)}
                className="w-full flex items-center justify-between mb-4"
              >
                <h3 className="text-xl font-semibold text-gray-900">Co-Maker on Loans</h3>
                <span className="text-2xl text-gray-500">{showCoMakerLoans ? '−' : '+'}</span>
              </button>
              {showCoMakerLoans && (
                <>
                  <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 mb-4">
                    <p className="text-sm text-orange-800 font-semibold">⚠️ Co-Maker Responsibility</p>
                    <p className="text-xs text-orange-700 mt-1">As a co-maker, you are responsible for loan payments if the borrower defaults. Monitor payment status regularly.</p>
                  </div>
                  <div className="divide-y">
                    {me.coMakerOnLoans.map((coMakerEntry) => {
                      const loan = coMakerEntry.loan;
                      const borrower = loan.user;
                      const totalPaid = loan.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
                      const totalDue = loan.principal + loan.interest;
                      const remainingBalance = totalDue - totalPaid;
                      const monthlyAmortization = loan.monthlyAmortization || 0;
                      const termMonths = loan.termMonths || 0;
                      const releasedDate = loan.releasedAt ? new Date(loan.releasedAt) : null;
                      
                      // Calculate payment status
                      let overdueAmount = 0;
                      let overdueMonths = 0;
                      let isDefaulted = false;
                      let nextDueDate = null;
                      
                      if (releasedDate && termMonths > 0 && monthlyAmortization > 0) {
                        let allocatedPayment = totalPaid;
                        for (let i = 0; i < termMonths; i++) {
                          const dueDate = new Date(releasedDate.getFullYear(), releasedDate.getMonth() + i + 1, releasedDate.getDate());
                          const isPast = dueDate < new Date();
                          
                          if (allocatedPayment >= monthlyAmortization) {
                            allocatedPayment -= monthlyAmortization;
                          } else if (isPast) {
                            overdueAmount += (monthlyAmortization - allocatedPayment);
                            overdueMonths++;
                            allocatedPayment = 0;
                          } else if (!nextDueDate) {
                            nextDueDate = dueDate;
                            break;
                          }
                        }
                        // Consider defaulted if 2+ months overdue
                        isDefaulted = overdueMonths >= 2;
                      }

                      return (
                        <div key={coMakerEntry.id} className={`p-4 border-b last:border-b-0 ${
                          isDefaulted ? 'bg-red-50 border-red-200' : overdueAmount > 0 ? 'bg-yellow-50 border-yellow-200' : ''
                        }`}>
                          {isDefaulted && (
                            <div className="mb-3 rounded-lg border border-red-300 bg-red-100 p-2">
                              <p className="text-sm text-red-800 font-bold">🚨 LOAN DEFAULTED</p>
                              <p className="text-xs text-red-700 mt-1">Borrower is {overdueMonths} months behind. As co-maker, you may be contacted to settle this loan.</p>
                            </div>
                          )}
                          {!isDefaulted && overdueAmount > 0 && (
                            <div className="mb-3 rounded-lg border border-yellow-300 bg-yellow-100 p-2">
                              <p className="text-sm text-yellow-800 font-semibold">⚠️ Payment Overdue</p>
                              <p className="text-xs text-yellow-700 mt-1">{overdueMonths} month(s) overdue. Total overdue: ₱{overdueAmount.toLocaleString()}. Please follow up with borrower.</p>
                            </div>
                          )}
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="font-semibold text-gray-900">Loan #{loan.id}</div>
                              <div className="text-sm text-gray-600">
                                Borrower: {borrower?.full_name || loan.borrowerName}
                              </div>
                              <div className="text-xs text-gray-500">{borrower?.email || loan.borrowerEmail}</div>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                              loan.status === 'PAID' ? 'bg-green-100 text-green-800' :
                              isDefaulted ? 'bg-red-100 text-red-800' :
                              overdueAmount > 0 ? 'bg-yellow-100 text-yellow-800' :
                              loan.status === 'ACTIVE' || loan.status === 'RELEASED' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {isDefaulted ? 'DEFAULTED' : loan.status}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                            <div>
                              <div className="text-xs text-gray-500">Monthly Payment</div>
                              <div className="font-semibold text-gray-900">₱{monthlyAmortization.toLocaleString()}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500">Total Paid</div>
                              <div className="font-semibold text-green-600">₱{totalPaid.toLocaleString()}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500">Remaining Balance</div>
                              <div className="font-semibold text-orange-600">₱{remainingBalance.toLocaleString()}</div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500">{overdueAmount > 0 ? 'Overdue Amount' : 'Next Due Date'}</div>
                              <div className={`font-semibold ${
                                overdueAmount > 0 ? 'text-red-600' : 'text-gray-900'
                              }`}>
                                {overdueAmount > 0 ? `₱${overdueAmount.toLocaleString()}` : (nextDueDate ? nextDueDate.toLocaleDateString() : '—')}
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="bg-white rounded p-2 text-center">
                              <div className="text-gray-500">Payment Status</div>
                              <div className={`font-semibold mt-1 ${
                                isDefaulted ? 'text-red-600' :
                                overdueAmount > 0 ? 'text-yellow-600' :
                                'text-green-600'
                              }`}>
                                {isDefaulted ? 'DEFAULTED' : overdueAmount > 0 ? 'OVERDUE' : 'UP TO DATE'}
                              </div>
                            </div>
                            <div className="bg-white rounded p-2 text-center">
                              <div className="text-gray-500">Term Progress</div>
                              <div className="font-semibold mt-1 text-gray-900">
                                {termMonths > 0 ? `${Math.min(Math.floor(totalPaid / monthlyAmortization), termMonths)}/${termMonths} months` : '—'}
                              </div>
                            </div>
                            <div className="bg-white rounded p-2 text-center">
                              <div className="text-gray-500">Released Date</div>
                              <div className="font-semibold mt-1 text-gray-900">
                                {releasedDate ? releasedDate.toLocaleDateString() : '—'}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* All Transactions (Ledger View) - Collapsible */}
          <div className="card">
            <button
              onClick={() => setShowTransactions(!showTransactions)}
              className="w-full flex items-center justify-between mb-4"
            >
              <h3 className="text-xl font-semibold text-gray-900">All Transactions (Ledger)</h3>
              <span className="text-2xl text-gray-500">{showTransactions ? '−' : '+'}</span>
            </button>
            {showTransactions && (
              <div className="overflow-x-auto">
                {(() => {
                  type Transaction = {
                    date: Date;
                    dateStr: string;
                    type: 'CONTRIBUTION' | 'LOAN_PAYMENT' | 'LOAN_DISBURSEMENT';
                    description: string;
                    debit: number;
                    credit: number;
                    balance: number;
                    reference?: string;
                    method?: string;
                  };

                  const transactions: Transaction[] = [];

                  // Add contributions
                  me.contributions.forEach(c => {
                    transactions.push({
                      date: new Date(c.date_paid),
                      dateStr: c.date_paid,
                      type: 'CONTRIBUTION',
                      description: 'Contribution Payment',
                      debit: 0,
                      credit: c.amount,
                      balance: 0,
                      reference: c.id.toString(),
                      method: 'Payment',
                    });
                  });

                  // Add loan payments from all loans
                  me.loans.forEach(loan => {
                    // Add loan disbursement
                    const loanDate = loan.releasedAt ? new Date(loan.releasedAt) : new Date(loan.createdAt);
                    transactions.push({
                      date: loanDate,
                      dateStr: loan.releasedAt || loan.createdAt,
                      type: 'LOAN_DISBURSEMENT',
                      description: `Loan #${loan.id} Disbursement`,
                      debit: loan.principal,
                      credit: 0,
                      balance: 0,
                      reference: `LOAN-${loan.id}`,
                    });

                    // Add all loan payments
                    (loan.payments || []).forEach(payment => {
                      transactions.push({
                        date: new Date(payment.createdAt),
                        dateStr: payment.createdAt,
                        type: 'LOAN_PAYMENT',
                        description: `Loan #${loan.id} Payment`,
                        debit: 0,
                        credit: payment.amount,
                        balance: 0,
                        reference: `LOAN-${loan.id}`,
                      });
                    });
                  });

                  // Sort by date (oldest first)
                  transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

                  // Calculate running balance (contributions increase balance, loans decrease it, payments increase it)
                  let runningBalance = 0;
                  transactions.forEach(t => {
                    if (t.type === 'CONTRIBUTION' || t.type === 'LOAN_PAYMENT') {
                      runningBalance += t.credit;
                    } else if (t.type === 'LOAN_DISBURSEMENT') {
                      runningBalance -= t.debit;
                    }
                    t.balance = runningBalance;
                  });

                  if (transactions.length === 0) {
                    return <p className="text-gray-400">No transactions found</p>;
                  }

                  return (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Date</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Description</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Method/Ref</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Debit</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Credit</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((t, idx) => (
                          <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="px-4 py-3 text-xs text-gray-900">
                              {new Date(t.dateStr).toLocaleDateString('en-PH', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold mr-2 ${
                                t.type === 'CONTRIBUTION' ? 'bg-green-100 text-green-800' :
                                t.type === 'LOAN_PAYMENT' ? 'bg-blue-100 text-blue-800' :
                                'bg-orange-100 text-orange-800'
                              }`}>
                                {t.type === 'CONTRIBUTION' ? 'CONTRIB' :
                                 t.type === 'LOAN_PAYMENT' ? 'PAYMENT' :
                                 'DISBURSEMENT'}
                              </span>
                              <span className="text-gray-900">{t.description}</span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              {t.method && <div>{t.method}</div>}
                              {t.reference && <div className="font-mono">{t.reference}</div>}
                            </td>
                            <td className="px-4 py-3 text-right font-mono">
                              {t.debit > 0 ? (
                                <span className="text-red-600 font-semibold">₱{t.debit.toLocaleString()}</span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-mono">
                              {t.credit > 0 ? (
                                <span className="text-green-600 font-semibold">₱{t.credit.toLocaleString()}</span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900">
                              ₱{t.balance.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Dividend Payouts - Collapsible */}
          <div className="card">
            <button
              onClick={() => setShowPayouts(!showPayouts)}
              className="w-full flex items-center justify-between mb-4"
            >
              <h3 className="text-xl font-semibold text-gray-900">Dividend Payouts</h3>
              <span className="text-2xl text-gray-500">{showPayouts ? '−' : '+'}</span>
            </button>
            {showPayouts && (
              <>
                {payoutError && <div className="text-sm text-red-600 mb-3">{payoutError}</div>}
                {payouts.length === 0 ? (
                  <div className="text-sm text-gray-400">No payouts recorded</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Year</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Per Share</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Shares</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Amount</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Channel</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Destination</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Date</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Reference</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payouts.map(p => (
                          <tr key={p.id} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-semibold text-gray-900">{p.year}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">₱{p.perShare.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{p.sharesCount}</td>
                            <td className="px-4 py-3 text-sm font-semibold text-green-600">₱{p.amount.toLocaleString()}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                                p.channel === 'GCASH' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                              }`}>
                                {p.channel}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600">
                              {p.channel === 'BANK' ? `${p.bankName || ''} ${p.bankAccountNumber || ''}` : (p.gcashNumber || '')}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">{new Date(p.depositedAt).toLocaleDateString()}</td>
                            <td className="px-4 py-3 text-xs text-gray-500 font-mono">{p.reference || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
