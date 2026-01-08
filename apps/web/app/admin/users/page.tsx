"use client";

import { useEffect, useMemo, useState } from 'react';
import UserTable from '../../../components/UserTable';
import CreateUserForm from '../../../components/CreateUserForm';
import ContributionForm from '../../../components/ContributionForm';
import AdminImportForm from '../../../components/AdminImportForm';
import BulkPasswordReset from '../../../components/BulkPasswordReset';
import ArchiveRunForm from '../../../components/ArchiveRunForm';

export default function Page() {
  const [refreshToken, setRefreshToken] = useState(0);
  const [showActions, setShowActions] = useState(false);
  const [currentPageUserIds, setCurrentPageUserIds] = useState<number[]>([]);

  // Capture user IDs from UserTable by intercepting fetch is complex here;
  // Instead, provide a manual entry for bulk reset on current page via a callback.
  // We will patch UserTable to optionally expose IDs via a prop callback.

  return (
    <main className="space-y-4">
      <h2 className="text-lg font-semibold">Members</h2>
      <div className="card">
        <button className="btn btn-secondary" onClick={() => setShowActions((s) => !s)}>
          {showActions ? 'Hide Actions' : 'Create/Record Payment'}
        </button>
        {showActions && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <CreateUserForm onSuccess={() => setRefreshToken((v) => v + 1)} />
            <div className="space-y-4">
              <h3 className="font-semibold">Record Contribution</h3>
              <ContributionForm />
            </div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Advanced Actions</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <AdminImportForm onDone={() => setRefreshToken((v) => v + 1)} />
            <BulkPasswordReset userIds={currentPageUserIds} />
            <ArchiveRunForm />
          </div>
          <p className="text-xs text-gray-400 mt-3">Tip: Bulk reset acts on the IDs shown below (current page). Select a page size to control.</p>
        </div>
        <UserTable refreshToken={refreshToken} onIdsChange={setCurrentPageUserIds} />
      </div>
    </main>
  );
}
