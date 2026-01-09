'use client';

export default function DemoBanner() {
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

  if (!isDemoMode) return null;

  return (
    <div className="bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 text-white py-2 px-4 text-center text-sm font-semibold shadow-md">
      <span className="inline-flex items-center gap-2">
        <span className="text-lg">🎭</span>
        <span>DEMO MODE</span>
        <span className="hidden sm:inline">•</span>
        <span className="hidden sm:inline">Data resets daily at midnight</span>
        <span className="hidden sm:inline">•</span>
        <span className="hidden sm:inline">For demonstration purposes only</span>
      </span>
    </div>
  );
}
