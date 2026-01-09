'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getApiBaseUrl } from '@/lib/api-config';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('eq_admin_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

interface Member {
  id: number;
  full_name: string;
  email: string;
  phone_number: string;
}

export default function CreateLoanPage() {
  const [editMode, setEditMode] = useState(false);
  const [loanId, setLoanId] = useState<number | null>(null);
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [borrowerType, setBorrowerType] = useState<'MEMBER' | 'NON_MEMBER'>('MEMBER');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [borrowerName, setBorrowerName] = useState('');
  const [borrowerEmail, setBorrowerEmail] = useState('');
  const [borrowerPhone, setBorrowerPhone] = useState('');
  const [principal, setPrincipal] = useState('');
  const [termMonths, setTermMonths] = useState('');
  const [coMakers, setCoMakers] = useState<string[]>([]);
  const [selectedCoMaker, setSelectedCoMaker] = useState('');

  // Available funds
  const [availableFunds, setAvailableFunds] = useState(0);
  const [totalCollections, setTotalCollections] = useState(0);
  const [totalLoanAmount, setTotalLoanAmount] = useState(0);

  // Calculated values
  const [monthlyRate, setMonthlyRate] = useState(0);
  const [totalInterest, setTotalInterest] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [monthlyAmortization, setMonthlyAmortization] = useState(0);

  // Fetch members on mount
  useEffect(() => {
    // Check if editing
    const params = new URLSearchParams(window.location.search);
    const editId = params.get('edit');
    if (editId) {
      setEditMode(true);
      setLoanId(parseInt(editId));
    }

    const fetchMembers = async () => {
      try {
        const API_BASE = getApiBaseUrl();
        const res = await fetch(`${API_BASE}/api/admin/users?pageSize=1000`, {
          headers: getAuthHeaders(),
          cache: 'no-store',
        });
        if (res.ok) {
          const data = await res.json();
          const memberList = Array.isArray(data) ? data : data.data;
          setMembers(memberList);
        }
      } catch (err) {
        console.error('Failed to fetch members:', err);
      }
    };

    const fetchAvailableFunds = async () => {
      try {
        const API_BASE = getApiBaseUrl();
        const res = await fetch(`${API_BASE}/api/admin/funds-available`, {
          headers: getAuthHeaders(),
          cache: 'no-store',
        });
        if (res.ok) {
          const data = await res.json();
          setAvailableFunds(data.availableForLoans);
          setTotalCollections(data.totalCollections);
          setTotalLoanAmount(data.totalLoanAmount);
        }
      } catch (err) {
        console.error('Failed to fetch available funds:', err);
      }
    };

    fetchMembers();
    fetchAvailableFunds();

    // Fetch loan details if editing
    if (editId) {
      const fetchLoanDetails = async () => {
        try {
          const API_BASE = getApiBaseUrl();
          const res = await fetch(`${API_BASE}/api/admin/loans/${editId}/details`, {
            headers: getAuthHeaders(),
            cache: 'no-store',
          });
          if (!res.ok) throw new Error('Failed to fetch loan');
          const loan = await res.json();
          
          // Populate form with loan data
          setBorrowerType(loan.borrowerType);
          if (loan.user) {
            setSelectedMemberId(loan.user.id.toString());
          }
          setBorrowerName(loan.borrowerName);
          setBorrowerEmail(loan.borrowerEmail);
          setBorrowerPhone(loan.borrowerPhone);
          setPrincipal(loan.principal.toString());
          setTermMonths(loan.termMonths.toString());
          setCoMakers(loan.coMakers.map((cm: any) => cm.user.id.toString()));
        } catch (err) {
          setError('Failed to load loan details: ' + (err as Error).message);
        }
      };
      fetchLoanDetails();
    }
  }, []);

  // Calculate loan details
  useEffect(() => {
    const rate = borrowerType === 'MEMBER' ? 0.05 : 0.10;
    setMonthlyRate(rate);

    const principalAmount = parseInt(principal) || 0;
    const termMonthsNum = parseInt(termMonths) || 0;
    
    // Total interest = principal × (monthly_rate × term_months)
    const interest = Math.round(principalAmount * rate * termMonthsNum);
    setTotalInterest(interest);

    const total = principalAmount + interest;
    setTotalAmount(total);

    // Monthly amortization = (principal + total_interest) / term_months
    const amortization = termMonthsNum > 0 ? Math.round(total / termMonthsNum) : 0;
    setMonthlyAmortization(amortization);
  }, [borrowerType, principal, termMonths]);

  // Update borrower info when member is selected
  useEffect(() => {
    if (borrowerType === 'MEMBER' && selectedMemberId) {
      const member = members.find((m) => m.id === parseInt(selectedMemberId));
      if (member) {
        setBorrowerName(member.full_name);
        setBorrowerEmail(member.email);
        setBorrowerPhone(member.phone_number);
      }
    }
  }, [selectedMemberId, borrowerType, members]);

  const handleAddCoMaker = () => {
    if (selectedCoMaker && !coMakers.includes(selectedCoMaker)) {
      setCoMakers([...coMakers, selectedCoMaker]);
      setSelectedCoMaker('');
    }
  };

  const handleRemoveCoMaker = (userId: string) => {
    setCoMakers(coMakers.filter((id) => id !== userId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (!borrowerName || !borrowerEmail || !borrowerPhone || !principal || !termMonths) {
        throw new Error('Please fill in all required fields');
      }

      if (borrowerType === 'MEMBER' && !selectedMemberId) {
        throw new Error('Please select a member');
      }

      const payload = {
        borrowerType,
        userId: borrowerType === 'MEMBER' ? parseInt(selectedMemberId) : undefined,
        borrowerName,
        borrowerEmail,
        borrowerPhone,
        principal: parseInt(principal),
        termMonths: parseInt(termMonths),
        coMakers: coMakers.map((id) => parseInt(id)),
      };

      const API_BASE = getApiBaseUrl();
      const url = editMode ? `${API_BASE}/api/admin/loans/${loanId}` : `${API_BASE}/api/admin/loans`;
      const method = editMode ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        const errorMsg = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
        throw new Error(errorMsg || (editMode ? 'Failed to update loan' : 'Failed to create loan'));
      }

      setSuccess(editMode ? 'Loan updated successfully!' : 'Loan created successfully!');
      setTimeout(() => {
        router.push('/admin/loans');
      }, 1500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const filteredMembers = members.filter((m) => !coMakers.includes(m.id.toString()));
  const selectedMember = members.find((m) => m.id === parseInt(selectedMemberId));

  return (
    <div className="p-6">
      <div className="mb-6">
        <Link href="/admin/loans" className="text-blue-600 hover:underline">
          ← Back to Loans
        </Link>
        <h1 className="mt-2 text-3xl font-bold text-gray-900">{editMode ? 'Edit Loan' : 'Create Loan'}</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700">
                {success}
              </div>
            )}

            {/* Borrower Type */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Borrower Type</label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="MEMBER"
                    checked={borrowerType === 'MEMBER'}
                    onChange={(e) => {
                      setBorrowerType(e.target.value as 'MEMBER' | 'NON_MEMBER');
                      setSelectedMemberId('');
                      setBorrowerName('');
                      setBorrowerEmail('');
                      setBorrowerPhone('');
                    }}
                    className="mr-2"
                  />
                  <span className="text-gray-700">Member (5% per month)</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="NON_MEMBER"
                    checked={borrowerType === 'NON_MEMBER'}
                    onChange={(e) => {
                      setBorrowerType(e.target.value as 'MEMBER' | 'NON_MEMBER');
                      setSelectedMemberId('');
                      setBorrowerName('');
                      setBorrowerEmail('');
                      setBorrowerPhone('');
                    }}
                    className="mr-2"
                  />
                  <span className="text-gray-700">Non-member (10% per month)</span>
                </label>
              </div>
            </div>

            {/* Member Selection (for MEMBER loans) */}
            {borrowerType === 'MEMBER' && (
              <div className="mb-6">
                <label htmlFor="member" className="block text-sm font-medium text-gray-700 mb-2">
                  Select Member *
                </label>
                <select
                  id="member"
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
                >
                  <option value="">-- Choose a member --</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name} ({m.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Borrower Information */}
            <div className="mb-6 rounded-lg bg-gray-50 p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Borrower Information</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Name *
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={borrowerName}
                    onChange={(e) => setBorrowerName(e.target.value)}
                    disabled={borrowerType === 'MEMBER' && selectedMember !== undefined}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 disabled:bg-gray-100"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={borrowerEmail}
                    onChange={(e) => setBorrowerEmail(e.target.value)}
                    disabled={borrowerType === 'MEMBER' && selectedMember !== undefined}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 disabled:bg-gray-100"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                    Phone *
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    value={borrowerPhone}
                    onChange={(e) => setBorrowerPhone(e.target.value)}
                    disabled={borrowerType === 'MEMBER' && selectedMember !== undefined}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900 disabled:bg-gray-100"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="principal" className="block text-sm font-medium text-gray-700 mb-1">
                    Principal Amount (₱) *
                  </label>
                  <input
                    id="principal"
                    type="number"
                    value={principal}
                    onChange={(e) => setPrincipal(e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="termMonths" className="block text-sm font-medium text-gray-700 mb-1">
                    Loan Term (months) *
                  </label>
                  <input
                    id="termMonths"
                    type="number"
                    min="1"
                    max="60"
                    value={termMonths}
                    onChange={(e) => setTermMonths(e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-gray-900"
                    placeholder="e.g., 6, 12, 24"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Loan repayment period in months</p>
                </div>
              </div>
            </div>

            {/* Co-makers */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-4">Co-makers</h3>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <select
                    value={selectedCoMaker}
                    onChange={(e) => setSelectedCoMaker(e.target.value)}
                    className="flex-1 rounded border border-gray-300 px-3 py-2 text-gray-900"
                  >
                    <option value="">-- Select co-maker --</option>
                    {filteredMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddCoMaker}
                    disabled={!selectedCoMaker}
                    className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>

                {coMakers.length > 0 && (
                  <div className="space-y-2">
                    {coMakers.map((cmId) => {
                      const cm = members.find((m) => m.id === parseInt(cmId));
                      return cm ? (
                        <div
                          key={cmId}
                          className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 p-2 px-3"
                        >
                          <span className="text-sm text-gray-700">{cm.full_name}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCoMaker(cmId)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Submit */}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {loading ? 'Creating...' : 'Create Loan'}
              </button>
              <Link
                href="/admin/loans"
                className="rounded border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 font-medium"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>

        {/* Loan Summary */}
        {principal && termMonths && (
          <div className="lg:col-span-1">
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm sticky top-6 space-y-4">
              {/* Available Funds Section */}
              <div className="border-b border-gray-200 pb-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Available Funds for Loan</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total Collections:</span>
                    <span className="font-medium text-gray-900">{formatCurrency(totalCollections)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Outstanding Loans:</span>
                    <span className="font-medium text-red-600">−{formatCurrency(totalLoanAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm bg-blue-50 p-2 rounded font-semibold">
                    <span className="text-blue-900">Can Release:</span>
                    <span className="text-blue-700">{formatCurrency(availableFunds)}</span>
                  </div>
                  {parseInt(principal) > availableFunds && (
                    <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                      ⚠️ Loan amount exceeds available funds by {formatCurrency(parseInt(principal) - availableFunds)}
                    </div>
                  )}
                </div>
              </div>

              <h3 className="font-semibold text-gray-900 mb-2">Loan Summary</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Loan Type:</span>
                  <span className="font-medium text-gray-900">
                    {borrowerType === 'MEMBER' ? 'Member (5%/mo)' : 'Non-member (10%/mo)'}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Principal:</span>
                  <span className="font-medium text-gray-900">{formatCurrency(parseInt(principal) || 0)}</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Term:</span>
                  <span className="font-medium text-gray-900">{termMonths} months</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Interest Rate:</span>
                  <span className="font-medium text-gray-900">{(monthlyRate * 100).toFixed(0)}% per month</span>
                </div>

                <div className="border-t border-gray-200 pt-3 mt-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Interest ({(monthlyRate * 100).toFixed(0)}% × {termMonths}mo):</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(totalInterest)}</span>
                  </div>

                  <div className="flex justify-between mt-3 bg-blue-50 p-3 rounded">
                    <span className="text-gray-700 font-medium">Total Amount Due:</span>
                    <span className="font-bold text-blue-700">{formatCurrency(totalAmount)}</span>
                  </div>

                  <div className="flex justify-between mt-3 bg-green-50 p-3 rounded text-base">
                    <span className="text-gray-700 font-semibold">Monthly Payment:</span>
                    <span className="font-bold text-green-700">{formatCurrency(monthlyAmortization)}</span>
                  </div>
                </div>

                <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded mt-3 space-y-1">
                  <div><strong>Formula:</strong></div>
                  <div>Interest = ₱{parseInt(principal) || 0} × {(monthlyRate * 100).toFixed(0)}% × {termMonths} = ₱{totalInterest}</div>
                  <div>Payment = ₱{totalAmount} ÷ {termMonths} = ₱{monthlyAmortization}/month</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
