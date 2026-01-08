const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
const ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_TOKEN || '';

async function fetchDashboard() {
  const res = await fetch(`${API_BASE}/api/admin/dashboard`, {
    headers: { 'x-admin-token': ADMIN_TOKEN },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('Failed to load dashboard');
  return res.json();
}

function formatCurrency(value: number): string {
  return `₱${value.toLocaleString()}`;
}

export default async function DashboardPage() {
  const data = await fetchDashboard();

  const metrics = [
    { label: 'Total Members', value: data.totalMembers },
    { label: 'On-time Members', value: data.onTimeMembers },
    { label: 'Delayed Members', value: data.delayedMembers },
    { label: 'Loan Availments', value: data.loanAvailments },
  ];

  const finances = [
    { label: 'Total Collections', value: formatCurrency(data.totalCollections) },
    { label: 'Total Loan Amount', value: formatCurrency(data.totalLoanAmount) },
    { label: 'Available for Loans', value: formatCurrency(data.availableForLoans) },
    { label: 'Profit Pool (Current Year)', value: formatCurrency(data.currentYearProfitPool) },
  ];

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-semibold">Dashboard</h2>
          <span className="text-xs text-gray-400">Cycle {data.cycle} • Due {new Date(data.dueDate).toLocaleDateString()}</span>
        </div>
        <p className="text-sm text-gray-400">Quick snapshot of members, payments, and loan capacity.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="card">
            <div className="text-xs text-gray-400 mb-1">{m.label}</div>
            <div className="text-2xl font-semibold">{m.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {finances.map((m) => (
          <div key={m.label} className="card">
            <div className="text-xs text-gray-400 mb-1">{m.label}</div>
            <div className="text-xl font-semibold">{m.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
