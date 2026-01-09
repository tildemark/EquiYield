"use client";

import { useState } from 'react';
import { getApiBaseUrl } from '@/lib/api-config';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('eq_admin_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

export default function BulkPasswordReset({ userIds }: { userIds: number[] }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState('');
  const [sendEmail, setSendEmail] = useState(false);
  const [excludeAdmins, setExcludeAdmins] = useState(true);

  const run = async () => {
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const API_BASE = getApiBaseUrl();
      const res = await fetch(`${API_BASE}/api/admin/users/bulk-passwords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ userIds, sendEmail, excludeAdmins }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Bulk reset failed');
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Bulk Password Reset</h3>
        <div className="flex gap-4">
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" checked={excludeAdmins} onChange={(e) => setExcludeAdmins(e.target.checked)} />
            Exclude admin accounts
          </label>
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
            Email passwords to members
          </label>
        </div>
      </div>
      <button className="btn btn-primary" onClick={run} disabled={busy || userIds.length === 0}>
        {busy ? 'Running…' : `Reset for ${userIds.length} member(s)`}
      </button>
      {error && <div className="text-red-300 text-sm">{error}</div>}
      {result && (
        <div className="text-sm">
          <div className="text-green-300 font-semibold mb-1">New Passwords</div>
          <ul className="list-disc pl-5 space-y-1">
            {result.results?.map((r: any) => (
              <li key={r.id}>{r.email} — <span className="font-mono">{r.password}</span> {r.emailed ? '(emailed)' : ''}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
