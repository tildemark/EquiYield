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

interface Widget {
  label: string;
  value: string | number;
  color?: string;
  tooltip?: string;
}

function WidgetGrid({ title, widgets }: { title: string; widgets: Widget[] }) {
  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4 text-gray-900">{title}</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {widgets.map((w) => (
          <div key={w.label} className={`p-4 rounded-lg border border-gray-700 bg-gray-800/80 ${w.color || ''}`} title={w.tooltip}>
            <div className="text-xs text-gray-400 mb-1 font-medium">{w.label}</div>
            <div className="text-xl font-bold text-white">{w.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
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

  // Calculate additional metrics
  const totalComplianceRate = data.totalMembers > 0 
    ? Math.round((data.onTimeMembers / data.totalMembers) * 100) 
    : 0;
  const delayedPercentage = data.totalMembers > 0 
    ? Math.round((data.delayedMembers / data.totalMembers) * 100) 
    : 0;
  const loanUtilization = data.totalLoanAmount > 0 
    ? Math.round((data.totalLoanAmount / (data.totalLoanAmount + data.availableForLoans)) * 100) 
    : 0;

  // Member Related Widgets
  const memberWidgets: Widget[] = [
    { label: 'Total Members', value: data.totalMembers },
    { label: 'On-time Members', value: data.onTimeMembers, color: 'border-green-600/30' },
    { label: 'Delayed Members', value: data.delayedMembers, color: 'border-red-600/30' },
    { label: 'Compliance Rate', value: `${totalComplianceRate}%`, color: 'border-blue-600/30' },
  ];

  // Contribution Related Widgets
  const contributionWidgets: Widget[] = [
    { label: 'Total Collections', value: formatCurrency(data.totalCollections), color: 'border-green-600/30' },
    { label: 'Delayed Rate', value: `${delayedPercentage}%`, color: 'border-orange-600/30', tooltip: 'Percentage of members with delayed payments' },
  ];

  // Loan Related Widgets
  const loanWidgets: Widget[] = [
    { label: 'Active Loans', value: data.loanAvailments },
    { label: 'Total Loan Amount', value: formatCurrency(data.totalLoanAmount), color: 'border-yellow-600/30' },
    { label: 'Available for Loans', value: formatCurrency(data.availableForLoans), color: 'border-green-600/30' },
    { label: 'Loan Utilization', value: `${loanUtilization}%`, color: 'border-blue-600/30', tooltip: 'Percentage of available funds used for loans' },
    { label: 'Total Loan Payments', value: formatCurrency(data.totalLoanPayments), color: 'border-purple-600/30' },
  ];

  // Profit & Dividend Related Widgets
  const profitWidgets: Widget[] = [
    { label: 'Est. Profit Pool (Current Year)', value: formatCurrency(data.currentYearProfitPool), color: 'border-pink-600/30' },
    { label: 'Total Expenses', value: formatCurrency(data.totalExpenses), color: 'border-red-600/30' },
    { label: 'Net Profit', value: formatCurrency(data.netProfit), color: data.netProfit >= 0 ? 'border-green-600/30' : 'border-red-600/30' },
    { label: 'Est. Dividend Per Share', value: formatCurrency(data.estimatedDividendPerShare), color: 'border-green-600/30', tooltip: 'Based on net profit ÷ active shares' },
    { label: 'Active Shares', value: data.activeShares },
    { label: 'Members Eligible', value: data.membersEligibleForDividend, tooltip: 'Members with active shares' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <span className="text-sm text-gray-400">
            <span className="font-semibold">Cycle {data.cycle}</span> • Due <span className="font-semibold">{new Date(data.dueDate).toLocaleDateString()}</span>
          </span>
        </div>
        <p className="text-sm text-gray-400">Real-time overview of member compliance, contributions, loans, and profits.</p>
      </div>

      {/* Member Related */}
      <WidgetGrid title="👥 Member Overview" widgets={memberWidgets} />

      {/* Contribution Related */}
      <WidgetGrid title="💰 Contribution Tracking" widgets={contributionWidgets} />

      {/* Loan Related */}
      <WidgetGrid title="📊 Loan Management" widgets={loanWidgets} />

      {/* Profit & Dividend Related */}
      <WidgetGrid title="🎁 Profit & Dividends" widgets={profitWidgets} />
    </div>
  );
}
