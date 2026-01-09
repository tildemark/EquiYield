'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

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
  contributions: Array<{ id: number; amount: number; date_paid: string; status: string }>;
  loans: Array<{ id: number; principal: number; interest: number; status: string; createdAt: string; releasedAt?: string; settledAt?: string }>;
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
      const res = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Change password failed');
      setPwStatus('✓ Password updated successfully');
      setCurrentPassword('');
      setNewPassword('');
      setTimeout(() => setShowChangePw(false), 1500);
    } catch (e: any) {
      setPwStatus('✗ ' + e.message);
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Member Dashboard</h1>
        <div className="flex items-center gap-3">
          <button
            className="btn btn-secondary"
            onClick={() => setShowChangePw(true)}
          >Change Password</button>
          <button
            className="btn btn-primary"
            onClick={() => setShowLoanForm(true)}
          >Apply for Loan</button>
          <button
            className="btn btn-secondary"
            onClick={() => { localStorage.removeItem('eq_member_token'); router.push('/member/login'); }}
          >Sign Out</button>
        </div>
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
              <div>
                <div className="text-xs text-gray-400">Total Amount Due</div>
                <div className="font-semibold text-lg">₱{(selectedLoan.principal + selectedLoan.interest).toLocaleString()}</div>
              </div>
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
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
                <p className="font-semibold mb-1">Repayment Schedule:</p>
                <p>Monthly amortization will be calculated based on the loan terms approved by administration.</p>
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
          <div className="card">
            <h2 className="font-semibold mb-2">Profile</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-400">Name:</span> {me.full_name}</div>
              <div><span className="text-gray-400">Email:</span> {me.email}</div>
              <div><span className="text-gray-400">Phone:</span> {me.phone_number}</div>
              <div><span className="text-gray-400">Shares:</span> {me.share_count}</div>
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold mb-4">Contributions History</h3>
            {me.contributions.length === 0 ? (
              <div className="text-sm text-gray-400">No contributions recorded</div>
            ) : (
              <div className="divide-y">
                {me.contributions.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedContribution(c)}
                    className="w-full text-left p-4 hover:bg-gray-50 transition flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className="font-semibold">{new Date(c.date_paid).toLocaleDateString()}</div>
                      <div className="text-sm text-gray-400">₱{c.amount.toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        c.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                        c.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {c.status}
                      </span>
                      <div className="text-gray-400">→</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="font-semibold mb-4">Loans History</h3>
            {me.loans.length === 0 ? (
              <div className="text-sm text-gray-400">No loans recorded</div>
            ) : (
              <div className="divide-y">
                {me.loans.map(l => (
                  <button
                    key={l.id}
                    onClick={() => setSelectedLoan(l)}
                    className="w-full text-left p-4 hover:bg-gray-50 transition flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className="font-semibold">{new Date(l.createdAt).toLocaleDateString()}</div>
                      <div className="text-sm text-gray-400">₱{l.principal.toLocaleString()} + ₱{l.interest.toLocaleString()} interest</div>
                      {l.releasedAt && <div className="text-xs text-gray-500">Released: {new Date(l.releasedAt).toLocaleDateString()}</div>}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className={`px-2 py-1 rounded text-xs font-semibold block ${
                          l.status === 'ACTIVE' ? 'bg-blue-100 text-blue-800' :
                          l.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                          l.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                          l.status === 'PAID' ? 'bg-green-100 text-green-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {l.status === 'PAID' ? 'Settled' : l.status === 'ACTIVE' ? 'Active' : l.status}
                        </span>
                        {l.settledAt && <div className="text-xs text-gray-500 mt-1">{new Date(l.settledAt).toLocaleDateString()}</div>}
                      </div>
                      <div className="text-gray-400">→</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="font-semibold mb-2">Dividend Payouts</h3>
            {payoutError && <div className="text-sm text-red-400">{payoutError}</div>}
            {payouts.length === 0 ? (
              <div className="text-sm text-gray-400">No payouts recorded</div>
            ) : (
              <table className="table">
                <thead><tr><th>Year</th><th>Per Share</th><th>Shares</th><th>Amount</th><th>Channel</th><th>Destination</th><th>Deposited</th><th>Ref</th></tr></thead>
                <tbody>
                  {payouts.map(p => (
                    <tr key={p.id}>
                      <td>{p.year}</td>
                      <td>₱{p.perShare.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      <td>{p.sharesCount}</td>
                      <td>₱{p.amount.toLocaleString()}</td>
                      <td>{p.channel}</td>
                      <td className="text-xs text-gray-400">{p.channel==='BANK' ? `${p.bankName || ''} ${p.bankAccountNumber || ''}` : (p.gcashNumber || '')}</td>
                      <td>{new Date(p.depositedAt).toLocaleDateString()}</td>
                      <td className="text-xs text-gray-400">{p.reference || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
