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
  loans: Array<{ id: number; principal: number; interest: number; status: string; createdAt: string }>;
};

export default function MemberDashboard() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [principal, setPrincipal] = useState('');
  const [termMonths, setTermMonths] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwStatus, setPwStatus] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

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
      setTermMonths('');
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
      setPwStatus('Password updated.');
      setCurrentPassword('');
      setNewPassword('');
    } catch (e: any) {
      setPwStatus(e.message);
    } finally {
      setPwBusy(false);
    }
  };

  if (!token) return null;

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Member Dashboard</h1>
        <button
          className="btn btn-secondary"
          onClick={() => { localStorage.removeItem('eq_member_token'); router.push('/member/login'); }}
        >Sign out</button>
      </div>

      {error && <div className="text-sm text-red-400">{error}</div>}

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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="font-semibold mb-2">Change Password</h3>
              <form className="space-y-2" onSubmit={changePassword}>
                <input className="input" type="password" placeholder="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
                <input className="input" type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                <button className="btn btn-primary" type="submit" disabled={pwBusy}>{pwBusy ? 'Updating…' : 'Update Password'}</button>
                {pwStatus && <div className="text-xs text-gray-300">{pwStatus}</div>}
              </form>
            </div>

            <div className="card">
              <h3 className="font-semibold mb-2">Apply for a Loan</h3>
              <form className="space-y-2" onSubmit={applyLoan}>
                <input className="input" type="number" placeholder="Principal (PHP)" value={principal} onChange={(e) => setPrincipal(e.target.value)} required />
                <input className="input" type="number" placeholder="Term months (1-60)" value={termMonths} onChange={(e) => setTermMonths(e.target.value)} min={1} max={60} required />
                <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit Application'}</button>
                <div className="text-xs text-gray-400">Member-applied loans are created with status PENDING.</div>
              </form>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card">
              <h3 className="font-semibold mb-2">Recent Contributions</h3>
              {me.contributions.length === 0 ? (
                <div className="text-sm text-gray-400">No recent contributions</div>
              ) : (
                <table className="table">
                  <thead><tr><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
                  <tbody>
                    {me.contributions.map(c => (
                      <tr key={c.id}><td>{new Date(c.date_paid).toLocaleDateString()}</td><td>₱{c.amount.toLocaleString()}</td><td>{c.status}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="card">
              <h3 className="font-semibold mb-2">Recent Loans</h3>
              {me.loans.length === 0 ? (
                <div className="text-sm text-gray-400">No loans</div>
              ) : (
                <table className="table">
                  <thead><tr><th>Date</th><th>Principal</th><th>Interest</th><th>Status</th></tr></thead>
                  <tbody>
                    {me.loans.map(l => (
                      <tr key={l.id}><td>{new Date(l.createdAt).toLocaleDateString()}</td><td>₱{l.principal.toLocaleString()}</td><td>₱{l.interest.toLocaleString()}</td><td>{l.status}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
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
