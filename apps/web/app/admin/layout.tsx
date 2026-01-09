import React from 'react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">EquiYield Admin</h1>
        <nav className="space-x-3 text-sm">
          <a className="underline" href="/admin/dashboard">Dashboard</a>
          <a className="underline" href="/admin/users">Members</a>
          <a className="underline" href="/admin/loans">Loans</a>
          <a className="underline" href="/admin/payments">Payments</a>
          <a className="underline" href="/admin/dividends">Dividends</a>
          <a className="underline" href="/admin/config">Config</a>
        </nav>
      </header>
      {children}
    </div>
  );
}
