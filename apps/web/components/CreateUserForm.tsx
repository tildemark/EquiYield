"use client";

import { useState } from 'react';
import { getApiBaseUrl } from '@/lib/api-config';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('eq_admin_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

export default function CreateUserForm({ onSuccess }: { onSuccess?: () => void }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'MEMBER' | 'ADMIN'>('MEMBER');
  const [shareCount, setShareCount] = useState('0');
  const [gcashNumber, setGcashNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [status, setStatus] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('');

    const API_BASE = getApiBaseUrl();
    const res = await fetch(`${API_BASE}/api/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        full_name: fullName,
        email,
        phone_number: phone,
        role,
        share_count: Number(shareCount),
        gcashNumber: gcashNumber || undefined,
        bankName: bankName || undefined,
        bankAccountNumber: bankAccountNumber || undefined,
      }),
    });

    const data = await res.json();
    if (res.ok) {
      setStatus(`✓ Member created: ${data.email}`);
      setFullName('');
      setEmail('');
      setPhone('');
      setShareCount('0');
      setGcashNumber('');
      setBankName('');
      setBankAccountNumber('');
      if (onSuccess) onSuccess();
    } else {
      setStatus(`Error: ${data.error ? JSON.stringify(data.error) : 'Unknown'}`);
    }
  }

  return (
    <form className="card space-y-4" onSubmit={submit}>
      <h3 className="font-semibold">Create New Member</h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Full Name *</label>
          <input
            className="input"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Phone Number *</label>
          <input
            className="input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="label">Email *</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Role *</label>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as any)}>
            <option value="MEMBER">Member</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        <div>
          <label className="label">Initial Shares *</label>
          <input
            className="input"
            type="number"
            min="0"
            value={shareCount}
            onChange={(e) => setShareCount(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="label">GCash Number</label>
          <input
            className="input"
            value={gcashNumber}
            onChange={(e) => setGcashNumber(e.target.value)}
            placeholder="e.g., +639123456789"
          />
        </div>
        <div>
          <label className="label">Bank Name</label>
          <input
            className="input"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="e.g., BDO, Metrobank"
          />
        </div>
        <div>
          <label className="label">Bank Account Number</label>
          <input
            className="input"
            value={bankAccountNumber}
            onChange={(e) => setBankAccountNumber(e.target.value)}
            placeholder="e.g., 123456789"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="btn btn-primary" type="submit">Create Member</button>
        {status && <span className="text-sm text-gray-300">{status}</span>}
      </div>
    </form>
  );
}
