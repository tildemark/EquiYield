'use client';

import { useState, useEffect } from 'react';
import BulkPayoutForm from '../../../components/BulkPayoutForm';
import { getApiBaseUrl } from '@/lib/api-config';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('eq_admin_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

interface DividendPayout {
  id: number;
  userId: number;
  year: number;
  perShare: number;
  sharesCount: number;
  amount: number;
  channel: string;
  bankName?: string;
  bankAccountNumber?: string;
  gcashNumber?: string;
  reference: string;
  depositedAt: string;
  createdAt: string;
  user: { id: number; full_name: string; email: string };
  createdBy?: { id: number; full_name: string };
}

interface PageParams {
  year?: number;
  userId?: number;
}

export default function DividendsPage() {
  const [payouts, setPayouts] = useState<DividendPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());
  const [totalAmount, setTotalAmount] = useState(0);

  const fetchPayouts = async (params?: PageParams) => {
    try {
      setLoading(true);
      setError('');
      const API_BASE = getApiBaseUrl();
      let url = `${API_BASE}/api/admin/dividends/payouts`;
      if (params?.year) url += `?year=${params.year}`;
      
      const res = await fetch(url, {
        headers: getAuthHeaders(),
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Failed to fetch payouts');
      const data = await res.json();
      setPayouts(data);
      
      // Calculate total for filtered year
      const total = data
        .filter((p: DividendPayout) => p.year === filterYear)
        .reduce((sum: number, p: DividendPayout) => sum + p.amount, 0);
      setTotalAmount(total);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayouts({ year: filterYear });
  }, [filterYear]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-PH');
  };

  const filteredPayouts = payouts.filter((p) => p.year === filterYear);
  const years = [...new Set(payouts.map((p) => p.year))].sort((a, b) => b - a);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Dividend Payouts Management</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="card">
          <div className="text-sm text-gray-400 mb-1">Year</div>
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(Number(e.target.value))}
            className="input w-full"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="card">
          <div className="text-sm text-gray-400 mb-1">Payouts Distributed</div>
          <div className="text-2xl font-bold text-gray-100">{filteredPayouts.length}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-400 mb-1">Total Amount</div>
          <div className="text-2xl font-bold text-green-400">{formatCurrency(totalAmount)}</div>
        </div>
      </div>

      {/* Bulk Payout Form */}
      <div className="mb-6">
        <BulkPayoutForm />
      </div>

      {/* Payouts Table */}
      <div className="card">
        <h3 className="text-xl font-semibold mb-4">Payout Records</h3>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        ) : filteredPayouts.length === 0 ? (
          <div className="text-center py-8 text-gray-400">No payouts recorded for {filterYear}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800/50">
                <tr className="border-b border-gray-700">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Member</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">Per Share</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">Shares</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">Amount</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Channel</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Reference</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Deposited</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-300">Created By</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayouts.map((payout) => (
                  <tr key={payout.id} className="border-b border-gray-700/50 hover:bg-gray-800/30">
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-gray-200">{payout.user.full_name}</div>
                      <div className="text-xs text-gray-500">{payout.user.email}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-300">
                      ₱{payout.perShare.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-300">
                      {payout.sharesCount}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-green-400">
                      {formatCurrency(payout.amount)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        payout.channel === 'GCASH'
                          ? 'bg-blue-900/30 text-blue-300'
                          : 'bg-purple-900/30 text-purple-300'
                      }`}>
                        {payout.channel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{payout.reference}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{formatDate(payout.depositedAt)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {payout.createdBy ? payout.createdBy.full_name : 'System'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
