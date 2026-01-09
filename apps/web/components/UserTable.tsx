"use client";

import { useEffect, useState } from 'react';
import MemberDetail from './MemberDetail';

type User = {
  id: number;
  full_name: string;
  email: string;
  phone_number: string;
  role: 'MEMBER' | 'ADMIN';
  share_count: number;
  payment_status: 'ON_TIME' | 'LATE' | 'NO_PAYMENT';
  hasLoan: boolean;
  isCoMaker: boolean;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('eq_admin_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

type PagedResponse<T> = {
  data: T[];
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
};

export default function UserTable({ refreshToken, onIdsChange }: { refreshToken?: number; onIdsChange?: (ids: number[]) => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users?page=${page}&pageSize=${pageSize}`, {
        headers: getAuthHeaders(),
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Failed to load users');
      const data = await res.json();
      if (data && data.data) {
        const paged = data as PagedResponse<User>;
        setUsers(paged.data);
        setTotalPages(paged.totalPages);
        if (onIdsChange) onIdsChange(paged.data.map((u) => u.id));
      } else {
        setUsers(data);
        setTotalPages(1);
        if (onIdsChange) onIdsChange(data.map((u: User) => u.id));
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [refreshToken, page, pageSize]);

  if (selectedUserId) {
    return <MemberDetail userId={selectedUserId} onBack={() => setSelectedUserId(null)} />;
  }

  if (loading) return <div>Loading members…</div>;
  if (error) return <div className="text-red-400">{error}</div>;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-gray-400">Page {page} of {totalPages}</div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-400">Page size</label>
          <select className="input text-sm" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
            {[10, 20, 50, 100].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="space-x-2">
            <button className="btn btn-secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
            <button className="btn btn-secondary" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
          </div>
        </div>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Shares</th>
            <th>Payment Status</th>
            <th>Loans</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const statusBadge = 
              u.payment_status === 'ON_TIME' ? 'badge-success' :
              u.payment_status === 'LATE' ? 'badge-danger' :
              'badge-warning';
            const statusText = 
              u.payment_status === 'ON_TIME' ? 'On Time' :
              u.payment_status === 'LATE' ? 'Late' :
              'No Payment';
            
            return (
              <tr 
                key={u.id} 
                onClick={() => setSelectedUserId(u.id)}
                className="cursor-pointer hover:bg-gray-700/50 transition-colors"
              >
                <td>{u.id}</td>
                <td>{u.full_name}</td>
                <td>{u.email}</td>
                <td>{u.phone_number}</td>
                <td>{u.share_count}</td>
                <td>
                  <span className={`badge ${statusBadge}`}>{statusText}</span>
                </td>
                <td className="space-x-1">
                  {u.hasLoan && <span className="badge badge-primary">Has Loan</span>}
                  {u.isCoMaker && <span className="badge badge-info">Co-maker</span>}
                  {!u.hasLoan && !u.isCoMaker && (
                    <span className="text-xs text-gray-500">None</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
