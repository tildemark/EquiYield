'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getApiBaseUrl } from '@/lib/api-config';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('eq_admin_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

interface CoMaker {
  user: {
    id: number;
    full_name: string;
  };
}

interface LoanPayment {
  id: number;
  amount: number;
  createdAt: string;
}

interface Amortization {
  month: number;
  amount: number;
  dueDate: string;
}

interface LoanDetail {
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
    phone_number: string;
  };
  coMakers: CoMaker[];
  createdAt: string;
  releasedAt?: string;
  settledAt?: string;
  payments: LoanPayment[];
  totalDue: number;
  totalPaid: number;
  balance: number;
  amortization: Amortization[];
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
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [actionMessage, setActionMessage] = useState('');
  const [selectedLoan, setSelectedLoan] = useState<LoanDetail | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const fetchLoans = async (pg: number, ps: number, status?: string) => {
    try {
      setLoading(true);
      setError('');
      const API_BASE = getApiBaseUrl();
      let url = `${API_BASE}/api/admin/loans?page=${pg}&pageSize=${ps}`;
      if (status) {
        url += `&status=${encodeURIComponent(status)}`;
      }
      const res = await fetch(url, {
        headers: getAuthHeaders(),
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

  const fetchLoanDetail = async (loanId: number) => {
    try {
      setLoadingDetail(true);
      const res = await fetch(`${API_BASE}/api/admin/loans/${loanId}/details`, {
        headers: getAuthHeaders(),
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Failed to fetch loan details');
      const data = await res.json() as LoanDetail;
      setSelectedLoan(data);
      setPaymentAmount('');
    } catch (err) {
      console.error(err);
      alert('Failed to load loan details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleOpenDetail = async (loan: Loan) => {
    setShowDetailModal(true);
    await fetchLoanDetail(loan.id);
  };

  const handleCloseDetail = () => {
    setShowDetailModal(false);
    setSelectedLoan(null);
    setPaymentAmount('');
  };

  const handleRecordPayment = async () => {
    if (!selectedLoan || !paymentAmount) return;
    
    const amount = Number(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      setSubmittingPayment(true);
      const API_BASE = getApiBaseUrl();
      const res = await fetch(`${API_BASE}/api/admin/loans/${selectedLoan.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ amount }),
      });
      if (!res.ok) throw new Error('Failed to record payment');
      const result = await res.json();
      setActionMessage(result.message);
      setTimeout(() => setActionMessage(''), 3000);
      
      // Refresh loan detail and main loans list
      await fetchLoanDetail(selectedLoan.id);
      await fetchLoans(page, pageSize, statusFilter || undefined);
    } catch (err) {
      console.error(err);
      alert('Failed to record payment');
    } finally {
      setSubmittingPayment(false);
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
        Note: Member-applied loans are created with status <span className="font-semibold">PENDING</span> and require admin action. Loans created here are <span className="font-semibold">RELEASED</span> immediately. Click on a loan row to view details and record payments.
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
                  <tr 
                    key={loan.id} 
                    className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleOpenDetail(loan)}
                  >
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
                    <td className="px-6 py-4 text-sm" onClick={(e) => e.stopPropagation()}>
                      {loan.status === 'PENDING' ? (
                        <button
                          className="rounded bg-green-600 px-3 py-1 text-white hover:bg-green-700 text-xs"
                          onClick={async () => {
                            try {
                              const API_BASE = getApiBaseUrl();
                              const res = await fetch(`${API_BASE}/api/admin/loans/${loan.id}/status`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
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

      {/* Loan Detail Modal */}
      {showDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="card max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            {loadingDetail ? (
              <div className="p-8 text-center text-gray-600">Loading loan details...</div>
            ) : selectedLoan ? (
              <>
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold text-gray-900">Loan #{selectedLoan.id}</h2>
                    <button
                      onClick={handleCloseDetail}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  </div>
                  
                  {/* Borrower Info */}
                  <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-gray-200">
                    <div>
                      <div className="text-sm text-gray-600">Name</div>
                      <div className="font-semibold text-gray-900">{selectedLoan.borrowerName}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Email</div>
                      <div className="font-semibold text-gray-900">{selectedLoan.borrowerEmail}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Phone</div>
                      <div className="font-semibold text-gray-900">{selectedLoan.borrowerPhone}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Type</div>
                      <div className="font-semibold text-gray-900">{selectedLoan.borrowerType}</div>
                    </div>
                  </div>

                  {/* Loan Details */}
                  <div className="grid grid-cols-3 gap-4 mb-6 pb-6 border-b border-gray-200">
                    <div>
                      <div className="text-sm text-gray-600">Principal</div>
                      <div className="text-xl font-bold text-gray-900">{formatCurrency(selectedLoan.principal)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Interest</div>
                      <div className="text-xl font-bold text-gray-900">{formatCurrency(selectedLoan.interest)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Total Due</div>
                      <div className="text-xl font-bold text-gray-900">{formatCurrency(selectedLoan.totalDue)}</div>
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-4 mb-6 pb-6 border-b border-gray-200">
                    <div>
                      <div className="text-sm text-gray-600">Created</div>
                      <div className="font-semibold text-gray-900">{formatDate(selectedLoan.createdAt)}</div>
                    </div>
                    {selectedLoan.releasedAt && (
                      <div>
                        <div className="text-sm text-gray-600">Released</div>
                        <div className="font-semibold text-gray-900">{formatDate(selectedLoan.releasedAt)}</div>
                      </div>
                    )}
                    <div>
                      <div className="text-sm text-gray-600">Due Date</div>
                      <div className="font-semibold text-gray-900">{formatDate(selectedLoan.dueDate)}</div>
                    </div>
                    {selectedLoan.settledAt && (
                      <div>
                        <div className="text-sm text-gray-600">Settled</div>
                        <div className="font-semibold text-gray-900">{formatDate(selectedLoan.settledAt)}</div>
                      </div>
                    )}
                  </div>

                  {/* Status and Payment Info */}
                  <div className="grid grid-cols-3 gap-4 mb-6 pb-6 border-b border-gray-200">
                    <div>
                      <div className="text-sm text-gray-600">Status</div>
                      <div>
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          selectedLoan.status === 'PENDING'
                            ? 'bg-yellow-100 text-yellow-800'
                            : selectedLoan.status === 'PAID'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {selectedLoan.status}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Total Paid</div>
                      <div className="text-xl font-bold text-green-600">{formatCurrency(selectedLoan.totalPaid)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Balance</div>
                      <div className="text-xl font-bold text-red-600">{formatCurrency(selectedLoan.balance)}</div>
                    </div>
                  </div>

                  {/* Payment History */}
                  <div className="mb-6 pb-6 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment History</h3>
                    {selectedLoan.payments.length === 0 ? (
                      <p className="text-sm text-gray-500">No payments recorded yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedLoan.payments.map((payment) => (
                          <div key={payment.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                            <span className="text-sm text-gray-600">{formatDate(payment.createdAt)}</span>
                            <span className="font-semibold text-gray-900">{formatCurrency(payment.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Amortization Schedule */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Amortization Schedule</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="px-4 py-2 text-left text-gray-600">Month</th>
                            <th className="px-4 py-2 text-right text-gray-600">Amount Due</th>
                            <th className="px-4 py-2 text-left text-gray-600">Due Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedLoan.amortization.map((month) => (
                            <tr key={month.month} className="border-b border-gray-100">
                              <td className="px-4 py-2 text-gray-900">{month.month}</td>
                              <td className="px-4 py-2 text-right font-semibold text-gray-900">{formatCurrency(month.amount)}</td>
                              <td className="px-4 py-2 text-gray-700">{month.dueDate}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Record Payment Section */}
                  {selectedLoan.status !== 'PAID' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                      <h3 className="text-sm font-semibold text-gray-900 mb-4">Record Payment</h3>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          placeholder="Amount"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          className="input flex-1"
                        />
                        <button
                          onClick={handleRecordPayment}
                          disabled={submittingPayment || !paymentAmount}
                          className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {submittingPayment ? 'Recording...' : 'Record'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleCloseDetail}
                    className="btn btn-secondary flex-1"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
