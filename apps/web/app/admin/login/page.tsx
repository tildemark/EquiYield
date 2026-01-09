'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getApiBaseUrl } from '@/lib/api-config';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const API_BASE = getApiBaseUrl();
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      
      // Check if user is admin
      if (data.user.role !== 'ADMIN') {
        throw new Error('Access denied. Admin privileges required.');
      }
      
      localStorage.setItem('eq_admin_token', data.token);
      localStorage.setItem('eq_admin_name', data.user.full_name || '');
      router.push('/admin/dashboard');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-md">
        <div className="flex justify-center mb-6">
          <img src="/equiyield-logo.webp" alt="EquiYield" className="w-24 h-24" />
        </div>
        <h1 className="text-3xl font-bold mb-6 text-center text-gray-900">Admin Login</h1>
        <form className="space-y-4" onSubmit={submit}>
          <div>
            <label className="label">Email</label>
            <input 
              className="input" 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              autoComplete="email"
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input 
              className="input" 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              autoComplete="current-password"
            />
          </div>
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
              {error}
            </div>
          )}
          <button 
            className="btn btn-primary w-full" 
            type="submit" 
            disabled={busy}
          >
            {busy ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
