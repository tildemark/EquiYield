'use client';

import { useEffect, useState } from 'react';
import { getApiBaseUrl } from '@/lib/api-config';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('eq_admin_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

function formatCurrency(value: number): string {
  return `₱${value.toLocaleString()}`;
}

export default function DashboardPage() {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const API_BASE = getApiBaseUrl();
        const res = await fetch(`${API_BASE}/api/admin/dashboard`, {
          headers: getAuthHeaders(),
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('Failed to load dashboard');
        const data = await res.json();
        setData(data);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

  if (loading) return <div>Loading dashboard…</div>;
  if (error) return <div className="text-red-400">{error}</div>;
  if (!data) return <div>No data available</div>;

  const metrics = [
    { label: 'Total Members', value: data.totalMembers },
    { label: 'On-time Members', value: data.onTimeMembers },
    { label: 'Delayed Members', value: data.delayedMembers },
    { label: 'Loan Availments', value: data.loanAvailments },
  ];

  const finances = [
    { label: 'Total Collections', value: formatCurrency(data.totalCollections) },
    { label: 'Total Loan Amount', value: formatCurrency(data.totalLoanAmount) },
    { label: 'Available for Loans', value: formatCurrency(data.availableForLoans) },
    { label: 'Profit Pool (Current Year)', value: formatCurrency(data.currentYearProfitPool) },
  ];

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-semibold">Dashboard</h2>
          <span className="text-xs text-gray-400">Cycle {data.cycle} • Due {new Date(data.dueDate).toLocaleDateString()}</span>
        </div>
        <p className="text-sm text-gray-400">Quick snapshot of members, payments, and loan capacity.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="card">
            <div className="text-xs text-gray-400 mb-1">{m.label}</div>
            <div className="text-2xl font-semibold">{m.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {finances.map((m) => (
          <div key={m.label} className="card">
            <div className="text-xs text-gray-400 mb-1">{m.label}</div>
            <div className="text-xl font-semibold">{m.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
