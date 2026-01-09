"use client";

import { useEffect, useMemo, useState } from 'react';
import UserTable from '../../../components/UserTable';
import CreateUserForm from '../../../components/CreateUserForm';
import ContributionForm from '../../../components/ContributionForm';
import AdminImportForm from '../../../components/AdminImportForm';
import BulkPasswordReset from '../../../components/BulkPasswordReset';

export default function Page() {
  const [refreshToken, setRefreshToken] = useState(0);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showContribution, setShowContribution] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showBulkReset, setShowBulkReset] = useState(false);
  const [currentPageUserIds, setCurrentPageUserIds] = useState<number[]>([]);

  return (
    <main className="space-y-6">
      {/* Header */}
      <div className="card">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Member Management</h2>
        <p className="text-sm text-gray-600">Create members, record contributions, and manage accounts</p>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button 
            className="btn btn-success flex-col h-auto py-4"
            onClick={() => setShowCreateUser(!showCreateUser)}
          >
            <span className="text-2xl mb-1">➕</span>
            <span className="text-sm">Create Member</span>
          </button>
          <button 
            className="btn btn-primary flex-col h-auto py-4"
            onClick={() => setShowContribution(!showContribution)}
          >
            <span className="text-2xl mb-1">💰</span>
            <span className="text-sm">Record Payment</span>
          </button>
          <button 
            className="btn btn-secondary flex-col h-auto py-4"
            onClick={() => setShowImport(!showImport)}
          >
            <span className="text-2xl mb-1">📥</span>
            <span className="text-sm">Bulk Import</span>
          </button>
          <button 
            className="btn btn-warning flex-col h-auto py-4"
            onClick={() => setShowBulkReset(!showBulkReset)}
          >
            <span className="text-2xl mb-1">🔑</span>
            <span className="text-sm">Reset Passwords</span>
          </button>
        </div>
      </div>

      {/* Create Member Form */}
      {showCreateUser && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Create New Member</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowCreateUser(false)}>✕ Close</button>
          </div>
          <CreateUserForm onSuccess={() => { setRefreshToken((v) => v + 1); setShowCreateUser(false); }} />
        </div>
      )}

      {/* Record Contribution Form */}
      {showContribution && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Record Contribution</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowContribution(false)}>✕ Close</button>
          </div>
          <ContributionForm />
        </div>
      )}

      {/* Bulk Import Form */}
      {showImport && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Bulk Import Members</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowImport(false)}>✕ Close</button>
          </div>
          <AdminImportForm onDone={() => { setRefreshToken((v) => v + 1); setShowImport(false); }} />
        </div>
      )}

      {/* Bulk Password Reset */}
      {showBulkReset && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Bulk Password Reset</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowBulkReset(false)}>✕ Close</button>
          </div>
          <BulkPasswordReset userIds={currentPageUserIds} />
          <p className="text-xs text-gray-500 mt-3 p-3 bg-yellow-50 rounded border border-yellow-200">
            ℹ️ <strong>Note:</strong> This will reset passwords for all members visible on the current page below.
          </p>
        </div>
      )}

      {/* Members Table */}
      <UserTable refreshToken={refreshToken} onIdsChange={setCurrentPageUserIds} />
    </main>
  );
}
