"use client";

import { useEffect, useMemo, useState } from 'react';
import UserTable from '../../../components/UserTable';
import CreateUserForm from '../../../components/CreateUserForm';
import ContributionForm from '../../../components/ContributionForm';
import AdminImportForm from '../../../components/AdminImportForm';
import BulkPasswordReset from '../../../components/BulkPasswordReset';

export default function Page() {
  const [refreshToken, setRefreshToken] = useState(0);
  const [showActions, setShowActions] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [currentPageUserIds, setCurrentPageUserIds] = useState<number[]>([]);

  return (
    <main className="space-y-4">
      <h2 className="text-lg font-semibold">Members</h2>
      
      <div className="card">
        <button className="btn btn-primary" onClick={() => setShowActions((s) => !s)}>
          {showActions ? 'Hide' : 'Create Member / Record Payment'}
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

      <div className="card">
        <button className="btn btn-primary" onClick={() => setShowAdvanced((s) => !s)}>
          {showAdvanced ? 'Hide' : 'Bulk Import / Password Reset'}
        </button>
        {showAdvanced && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <AdminImportForm onDone={() => setRefreshToken((v) => v + 1)} />
              <BulkPasswordReset userIds={currentPageUserIds} />
            </div>
            <p className="text-xs text-gray-500 mt-3">Tip: Bulk password reset acts on the current page users shown below.</p>
          </>
        )}
      </div>

      <UserTable refreshToken={refreshToken} onIdsChange={setCurrentPageUserIds} />
    </main>
  );
}
