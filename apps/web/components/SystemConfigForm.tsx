"use client";

import { useEffect, useState } from 'react';
import { getApiBaseUrl } from '@/lib/api-config';

type SystemConfig = {
  min_shares: number;
  max_shares: number;
  share_value: number;
  min_loan_amount: number;
  max_loan_amount: number;
};

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('eq_admin_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

export default function SystemConfigForm() {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [minShares, setMinShares] = useState('');
  const [maxShares, setMaxShares] = useState('');
  const [shareValue, setShareValue] = useState('');
  const [minLoan, setMinLoan] = useState('');
  const [maxLoan, setMaxLoan] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    async function load() {
      const API_BASE = getApiBaseUrl();
      const res = await fetch(`${API_BASE}/api/admin/system-config`, {
        headers: getAuthHeaders(),
        cache: 'no-store',
      });
      const data = await res.json();
      setConfig(data);
      setMinShares(String(data.min_shares));
      setMaxShares(String(data.max_shares));
      setShareValue(String(data.share_value));
      setMinLoan(String(data.min_loan_amount));
      setMaxLoan(String(data.max_loan_amount));
    }
    load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('Saving...');

    const API_BASE = getApiBaseUrl();
    const res = await fetch(`${API_BASE}/api/admin/system-config`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        min_shares: Number(minShares),
        max_shares: Number(maxShares),
        share_value: Number(shareValue),
        min_loan_amount: Number(minLoan),
        max_loan_amount: Number(maxLoan),
      }),
    });

    const data = await res.json();
    if (res.ok) {
      setStatus('✓ Configuration updated successfully');
      setConfig(data);
    } else {
      setStatus(`Error: ${data.error ? JSON.stringify(data.error) : 'Unknown'}`);
    }
  }

  if (!config) return <div>Loading configuration...</div>;

  return (
    <form className="card space-y-4" onSubmit={submit}>
      <h3 className="font-semibold">System Configuration</h3>
      
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-2">Share Settings</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Min Shares</label>
              <input 
                className="input" 
                type="number" 
                min="1"
                value={minShares} 
                onChange={e => setMinShares(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Max Shares</label>
              <input 
                className="input" 
                type="number" 
                min="1"
                value={maxShares} 
                onChange={e => setMaxShares(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Share Value (PHP)</label>
              <input 
                className="input" 
                type="number" 
                min="1"
                value={shareValue} 
                onChange={e => setShareValue(e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-2">Loan Limits</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Min Loanable Amount (PHP)</label>
              <input 
                className="input" 
                type="number" 
                min="100"
                value={minLoan} 
                onChange={e => setMinLoan(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Max Loanable Amount (PHP)</label>
              <input 
                className="input" 
                type="number" 
                min="1000"
                value={maxLoan} 
                onChange={e => setMaxLoan(e.target.value)}
                required
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="btn btn-primary" type="submit">Save Configuration</button>
        {status && <span className="text-sm text-gray-300">{status}</span>}
      </div>
    </form>
  );
}
