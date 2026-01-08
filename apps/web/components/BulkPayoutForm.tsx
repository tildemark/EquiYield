'use client';

import { useState } from 'react';

const ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_TOKEN || '';
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

interface PayoutResult {
  created: Array<{ userId: number; full_name: string; amount: number; id: number }>;
  failed: Array<{ userId: number; full_name: string; error: string }>;
  summary: { total: number; created: number; failed: number };
}

export default function BulkPayoutForm() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [perShare, setPerShare] = useState('');
  const [channel, setChannel] = useState<'GCASH' | 'BANK'>('GCASH');
  const [reference, setReference] = useState('');
  const [depositedAt, setDepositedAt] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PayoutResult | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResult(null);

    if (!perShare || !reference || !depositedAt) {
      setError('All fields are required');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/dividends/payouts/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': ADMIN_TOKEN,
        },
        body: JSON.stringify({
          year: Number(year),
          perShare: parseFloat(perShare),
          channel,
          reference,
          depositedAt: new Date(depositedAt).toISOString(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create payouts');
      
      setResult(data);
      setPerShare('');
      setReference('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h3 className="text-xl font-semibold mb-4">Bulk Dividend Payout</h3>
      <p className="text-sm text-gray-400 mb-4">
        Distribute dividends to all eligible members for a specific year using a single reference number.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <label className="text-sm">
            Year
            <input
              type="number"
              className="input mt-1"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              required
            />
          </label>
          <label className="text-sm">
            Per Share Amount (PHP)
            <input
              type="number"
              step="0.01"
              className="input mt-1"
              value={perShare}
              onChange={(e) => setPerShare(e.target.value)}
              placeholder="e.g., 500.50"
              required
            />
          </label>
        </div>

        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="channel"
              checked={channel === 'GCASH'}
              onChange={() => setChannel('GCASH')}
            />
            GCash
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="channel"
              checked={channel === 'BANK'}
              onChange={() => setChannel('BANK')}
            />
            Bank
          </label>
        </div>

        <label className="text-sm">
          Reference Number <span className="text-red-500">*</span>
          <input
            type="text"
            className="input mt-1"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g., BATCH_001, or batch transaction ID"
            required
          />
        </label>
        <p className="text-xs text-gray-400">Used to track the batch payout source (receipt, transfer ID, etc.)</p>

        <label className="text-sm">
          Deposit Date
          <input
            type="date"
            className="input mt-1"
            value={depositedAt}
            onChange={(e) => setDepositedAt(e.target.value)}
            required
          />
        </label>

        {error && <div className="p-3 bg-red-900/30 text-red-300 rounded text-sm">{error}</div>}

        <button type="submit" className="btn btn-primary w-full" disabled={loading}>
          {loading ? 'Processing...' : 'Distribute to Eligible Members'}
        </button>
      </form>

      {result && (
        <div className="mt-6 border-t border-gray-700/50 pt-4">
          <div className="mb-4 p-3 bg-blue-900/30 text-blue-300 rounded text-sm">
            Summary: {result.summary.created} created, {result.summary.failed} failed out of {result.summary.total} eligible members
          </div>

          {result.created.length > 0 && (
            <div className="mb-4">
              <h4 className="font-semibold text-sm mb-2">✓ Created ({result.created.length})</h4>
              <div className="space-y-1 text-xs">
                {result.created.map((r) => (
                  <div key={r.id} className="text-gray-300">
                    {r.full_name} - ₱{r.amount.toLocaleString()}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.failed.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-2 text-yellow-400">⚠ Failed ({result.failed.length})</h4>
              <div className="space-y-1 text-xs">
                {result.failed.map((r, i) => (
                  <div key={i} className="text-gray-400">
                    {r.full_name}: {r.error}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
