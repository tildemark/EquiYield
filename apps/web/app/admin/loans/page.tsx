'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_TOKEN || '';
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

interface CoMaker {
  user: {
    id: number;
    full_name: string;
  };
}

interface Loan {
  id: number;
  borrowerType: string;
  borrowerName: string;
  borrowerEmail: string;
  borrowerPhone: string;
  principal: number;
  interest: number;
  monthlyAmortization: number;
  termMonths: number;
  dueDate: string;
  status: string;
  user?: {
    id: number;
    full_name: string;
    email: string;
  };
  coMakers: CoMaker[];
  createdAt: string;
}

interface PaginatedResponse {
  data: Loan[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
}

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(''); // '' for all, 'PENDING', 'RELEASED', 'PAID'
  const [actionMessage, setActionMessage] = useState('');

  const fetchLoans = async (pg: number, ps: number, status?: string) => {
    try {
      setLoading(true);
      setError('');
      let url = `${API_BASE}/api/admin/loans?page=${pg}&pageSize=${ps}`;
      if (status) {
        url += `&status=${encodeURIComponent(status)}`;
      }
      const res = await fetch(url, {
        headers: { 'x-admin-token': ADMIN_TOKEN },
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Failed to fetch loans');
      const data = (await res.json()) as PaginatedResponse;
      setLoans(data.data);
      setPage(data.page);
      setPageSize(data.pageSize);
      setTotalPages(data.totalPages);
      setTotalItems(data.totalItems);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoans(1, 20, statusFilter || undefined);
  }, []);

  const handleStatusFilterChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    fetchLoans(1, 20, newStatus || undefined);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      fetchLoans(newPage, pageSize, statusFilter || undefined);
    }
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    fetchLoans(1, newSize, statusFilter || undefined);
  };

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

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Loans Management</h1>
        <Link
          href="/admin/loans/create"
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Create Loan
        </Link>
      </div>
      <div className="mb-4 text-sm text-gray-600">
        Note: Member-applied loans are created with status <span className="font-semibold">PENDING</span> and require admin action. Loans created here are <span className="font-semibold">RELEASED</span> immediately.
      </div>

      {/* Status Filter */}
      <div className="mb-6 flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Filter by Status:</label>
        <div className="flex gap-2">
          <button
            onClick={() => handleStatusFilterChange('')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              statusFilter === ''
                ? 'bg-blue-600 text-white'
                : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            All
          </button>
          <button
            onClick={() => handleStatusFilterChange('PENDING')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              statusFilter === 'PENDING'
                ? 'bg-yellow-600 text-white'
                : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => handleStatusFilterChange('RELEASED')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              statusFilter === 'RELEASED'
                ? 'bg-red-600 text-white'
                : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Released
          </button>
          <button
            onClick={() => handleStatusFilterChange('PAID')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              statusFilter === 'PAID'
                ? 'bg-green-600 text-white'
                : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Paid
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700">
          {actionMessage}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-600">Loading...</div>
      ) : loans.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center text-gray-600">
          No loans found. <Link href="/admin/loans/create" className="text-blue-600 hover:underline">Create the first loan</Link>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="border-b border-gray-200">
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">ID</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Borrower</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Type</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Principal</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Interest</th>
                  <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">Monthly Payment</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">Term (Months)</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Due Date</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Co-makers</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loans.map((loan) => (
                  <tr key={loan.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900 font-semibold">#{loan.id}</td>
                    <td className="px-6 py-4 text-sm">
                      <div className="font-medium text-gray-900">{loan.borrowerName}</div>
                      <div className="text-xs text-gray-500">{loan.borrowerEmail}</div>
                      {loan.user && (
                        <div className="text-xs text-blue-600">
                          Member: {loan.user.full_name}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        loan.borrowerType === 'MEMBER'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {loan.borrowerType}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-medium text-gray-900">
                      {formatCurrency(loan.principal)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-medium text-gray-900">
                      {formatCurrency(loan.interest)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-medium text-gray-900">
                      {formatCurrency(loan.monthlyAmortization)}
                    </td>
                    <td className="px-6 py-4 text-center text-sm font-medium text-gray-900">
                      {loan.termMonths}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {formatDate(loan.dueDate)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        loan.status === 'PENDING'
                          ? 'bg-yellow-100 text-yellow-800'
                          : loan.status === 'PAID'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {loan.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {loan.coMakers.length > 0 ? (
                        <div className="space-y-1">
                          {loan.coMakers.map((cm) => (
                            <div key={cm.user.id} className="text-xs text-gray-600">
                              • {cm.user.full_name}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">None</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {loan.status === 'PENDING' ? (
                        <button
                          className="rounded bg-green-600 px-3 py-1 text-white hover:bg-green-700 text-xs"
                          onClick={async () => {
                            try {
                              const res = await fetch(`${API_BASE}/api/admin/loans/${loan.id}/status`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json', 'x-admin-token': ADMIN_TOKEN },
                                body: JSON.stringify({ status: 'RELEASED' }),
                              });
                              if (!res.ok) throw new Error('Failed to release');
                              setActionMessage(`Loan #${loan.id} released successfully.`);
                              fetchLoans(page, pageSize, statusFilter || undefined);
                              setTimeout(() => setActionMessage(''), 3000);
                            } catch (e) {
                              console.error(e);
                              alert('Failed to release loan');
                            }
                          }}
                        >
                          Release
                        </button>
                      ) : loan.status === 'RELEASED' ? (
                        <button
                          className="rounded bg-blue-600 px-3 py-1 text-white hover:bg-blue-700 text-xs"
                          onClick={async () => {
                            try {
                              const res = await fetch(`${API_BASE}/api/admin/loans/${loan.id}/status`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json', 'x-admin-token': ADMIN_TOKEN },
                                body: JSON.stringify({ status: 'PAID' }),
                              });
                              if (!res.ok) throw new Error('Failed to mark as paid');
                              setActionMessage(`Loan #${loan.id} marked as PAID.`);
                              fetchLoans(page, pageSize, statusFilter || undefined);
                              setTimeout(() => setActionMessage(''), 3000);
                            } catch (e) {
                              console.error(e);
                              alert('Failed to mark loan as paid');
                            }
                          }}
                        >
                          Mark as PAID
                        </button>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700">Items per page:</label>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="rounded border border-gray-300 px-3 py-2 text-sm"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-sm text-gray-600">
                Showing {loans.length > 0 ? (page - 1) * pageSize + 1 : 0} to{' '}
                {Math.min(page * pageSize, totalItems)} of {totalItems} loans
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="flex items-center px-4 text-sm text-gray-700">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
                className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
