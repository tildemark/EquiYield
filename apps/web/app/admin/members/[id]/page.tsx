"use client";

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import MemberDetail from '../../../../components/MemberDetail';

export default function MemberPage() {
  const params = useParams();
  const router = useRouter();
  const userId = Number(params.id);

  return (
    <main className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Member Details</h2>
        <Link href="/admin/members" className="btn btn-secondary text-sm">Back to Members</Link>
      </div>
      <MemberDetail userId={userId} onBack={() => router.back()} />
    </main>
  );
}
