"use client";

import { useEffect, useMemo, useState } from 'react';

type User = { id: number; email: string; share_count: number; full_name: string };

type SystemConfig = { min_shares: number; max_shares: number; share_value: number };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
const ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_TOKEN || '';

export default function ContributionForm() {
  const [users, setUsers] = useState<User[]>([]);
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [userId, setUserId] = useState<number | ''>('');
  const [amount, setAmount] = useState<string>('');
  const [datePaid, setDatePaid] = useState<string>('');
  const [method, setMethod] = useState<'GCASH'|'INSTAPAY'|'BANK_TRANSFER'|'CASH'>('GCASH');
  const [ref, setRef] = useState<string>('');
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    async function load() {
      const [uRes, cRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/users`, { headers: { 'x-admin-token': ADMIN_TOKEN }, cache: 'no-store' }),
        fetch(`${API_BASE}/api/admin/system-config`, { headers: { 'x-admin-token': ADMIN_TOKEN }, cache: 'no-store' }),
      ]);
      const [u, c] = await Promise.all([uRes.json(), cRes.json()]);
      setUsers(u);
      setConfig(c);
    }
    load();
  }, []);

  const selectedUser = useMemo(() => users.find(u => u.id === userId), [users, userId]);
  const expected = useMemo(() => {
    if (!selectedUser || !config) return 0;
    return selectedUser.share_count * config.share_value;
  }, [selectedUser, config]);

  const amountNum = Number(amount || 0);
  const isPartial = amountNum > 0 && expected > 0 && amountNum !== expected;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('');
    if (!userId || !datePaid || !ref) { setStatus('Please fill all required fields.'); return; }

    const res = await fetch(`${API_BASE}/api/admin/contributions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': ADMIN_TOKEN,
      },
      body: JSON.stringify({
        userId,
        amount: amountNum,
        date_paid: new Date(datePaid).toISOString(),
        method,
        reference_number: ref,
      }),
    });

    const data = await res.json();
    if (res.ok) setStatus(`Saved. Status: ${data.status}. Expected: PHP ${data.expected}`);
    else setStatus(`Error: ${data.error ? JSON.stringify(data.error) : 'Unknown'}`);
  }

  return (
    <form className="card space-y-4" onSubmit={submit}>
      <div>
        <label className="label">Member</label>
        <select className="input" value={userId} onChange={e => setUserId(Number(e.target.value))}>
          <option value="">Select user…</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.full_name || u.email} — {u.email} (shares: {u.share_count})</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="label">Amount (PHP)</label>
          <input className="input" type="number" value={amount} onChange={e => setAmount(e.target.value)} />
          {expected > 0 && (
            <p className={isPartial ? 'text-yellow-400 text-sm mt-1' : 'text-gray-400 text-sm mt-1'}>
              Expected full amount: PHP {expected}
            </p>
          )}
        </div>
        <div>
          <label className="label">Date Paid</label>
          <input className="input" type="date" value={datePaid} onChange={e => setDatePaid(e.target.value)} />
        </div>
        <div>
          <label className="label">Method</label>
          <select className="input" value={method} onChange={e => setMethod(e.target.value as any)}>
            <option value="GCASH">GCash</option>
            <option value="INSTAPAY">InstaPay</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="CASH">Cash</option>
          </select>
        </div>
      </div>

      <div>
        <label className="label">Reference Number</label>
        <input className="input" value={ref} onChange={e => setRef(e.target.value)} placeholder="e.g., GCash Ref#" />
      </div>

      <div className="flex items-center gap-3">
        <button className="btn btn-primary" type="submit">Record Contribution</button>
        {isPartial && <span className="badge badge-danger">Partial Payment</span>}
      </div>

      {status && <p className="text-sm text-gray-300">{status}</p>}
    </form>
  );
}
