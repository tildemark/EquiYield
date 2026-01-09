"use client";

import { useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export default function AdminImportForm({ onDone }: { onDone?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any | null>(null);

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('eq_admin_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  const downloadTemplate = async () => {
    try {
      const token = localStorage.getItem('eq_admin_token');
      if (!token) {
        setStatus('Error: Not authenticated');
        return;
      }

      const res = await fetch(`${API_BASE}/api/admin/users/import/template`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Download failed');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'equiyield_member_import.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    }
  };

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    setStatus('Uploading…');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API_BASE}/api/admin/users/import`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      setResult(data);
      setStatus(`Imported ${data.successCount} record(s), ${data.errorCount} error(s)`);
      if (onDone) onDone();
    } catch (e: any) {
      setStatus(`Error: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Bulk Import Members (Excel)</h3>
        <button className="btn btn-secondary" onClick={downloadTemplate}>Download Template</button>
      </div>
      <input type="file" accept=".xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      <div className="flex items-center gap-2">
        <button className="btn btn-primary" onClick={upload} disabled={!file || busy}>Upload</button>
        {status && <span className="text-sm text-gray-300">{status}</span>}
      </div>
      {result && result.errors && result.errors.length > 0 && (
        <div className="mt-2 text-sm">
          <div className="text-red-300 font-semibold mb-1">Errors</div>
          <ul className="list-disc pl-5 space-y-1">
            {result.errors.map((e: any, idx: number) => (
              <li key={idx}>Row {e.row}: {e.message}</li>
            ))}
          </ul>
        </div>
      )}
      {result && result.created && result.created.length > 0 && (
        <div className="mt-2 text-sm">
          <div className="text-green-300 font-semibold mb-1">Created</div>
          <ul className="list-disc pl-5 space-y-1">
            {result.created.map((u: any) => (
              <li key={u.id}>{u.email} — password: <span className="font-mono">{u.password}</span></li>
            ))}
          </ul>
          <div className="text-xs text-gray-400 mt-2">Share these passwords securely with members.</div>
        </div>
      )}
    </div>
  );
}
