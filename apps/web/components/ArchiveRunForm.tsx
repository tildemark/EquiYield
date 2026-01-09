"use client";

import { useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('eq_admin_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

export default function ArchiveRunForm() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [purgeContribYear, setPurgeContribYear] = useState<number | ''>('');
  const [purgeLoanYear, setPurgeLoanYear] = useState<number | ''>('');
  const [archiveMembers, setArchiveMembers] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState('');

  const run = async () => {
    if (!window.confirm('Proceed with archive/purge? This cannot be undone.')) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const payload: any = { year, archiveMembers, note };
      if (purgeContribYear) payload.purgeContributionsBeforeYear = purgeContribYear;
      if (purgeLoanYear) payload.purgeLoansBeforeYear = purgeLoanYear;
      const res = await fetch(`${API_BASE}/api/admin/archive-run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Archive run failed');
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card space-y-3">
      <h3 className="font-semibold">Annual Archive / Purge</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-sm">Year
          <input className="input mt-1" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </label>
        <label className="text-sm">Purge Contributions Before Year
          <input className="input mt-1" type="number" value={purgeContribYear} onChange={(e) => setPurgeContribYear(e.target.value ? Number(e.target.value) : '')} placeholder="optional" />
        </label>
        <label className="text-sm">Purge Loans Before Year
          <input className="input mt-1" type="number" value={purgeLoanYear} onChange={(e) => setPurgeLoanYear(e.target.value ? Number(e.target.value) : '')} placeholder="optional" />
        </label>
        <label className="text-sm flex items-center gap-2 mt-6">
          <input type="checkbox" checked={archiveMembers} onChange={(e) => setArchiveMembers(e.target.checked)} />
          Archive all current members
        </label>
      </div>
      <textarea className="input min-h-24" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <button className="btn btn-danger" onClick={run} disabled={busy}>{busy ? 'Running…' : 'Run Archive'}</button>
      {error && <div className="text-sm text-red-300">{error}</div>}
      {result && (
        <div className="text-sm text-green-300">
          Done. Purged contributions: {result.purgedContributions}, purged loans: {result.purgedLoans}, archived members: {result.archivedMembers}
        </div>
      )}
    </div>
  );
}
