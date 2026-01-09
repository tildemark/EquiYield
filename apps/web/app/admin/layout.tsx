'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Skip auth check for login page
    if (pathname === '/admin/login') {
      setIsLoading(false);
      return;
    }

    // Check if user is authenticated
    const token = localStorage.getItem('eq_admin_token');
    if (!token) {
      router.push('/admin/login');
      return;
    }

    setIsAuthenticated(true);
    setIsLoading(false);
  }, [pathname, router]);

  const handleLogout = () => {
    localStorage.removeItem('eq_admin_token');
    localStorage.removeItem('eq_admin_name');
    router.push('/admin/login');
  };

  // Show loading or nothing while checking auth
  if (isLoading) {
    return null;
  }

  // Show login page without header
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  // Show authenticated layout
  return (
    <div className="mx-auto max-w-6xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <img src="/equiyield-horiz-logo.png" alt="EquiYield" className="h-10" />
        <div className="flex items-center gap-6">
          <nav className="space-x-3 text-sm">
            <a className="underline" href="/admin/dashboard">Dashboard</a>
            <a className="underline" href="/admin/members">Members</a>
            <a className="underline" href="/admin/loans">Loans</a>
            <a className="underline" href="/admin/payments">Payments</a>
            <a className="underline" href="/admin/dividends">Dividends</a>
            <a className="underline" href="/admin/config">Config</a>
          </nav>
          <button 
            onClick={handleLogout}
            className="text-sm text-red-600 hover:text-red-800 font-medium"
          >
            Logout
          </button>
        </div>
      </header>
      {children}
    </div>
  );
}
