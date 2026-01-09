import SystemConfigForm from '../../../components/SystemConfigForm';
import ArchiveRunForm from '../../../components/ArchiveRunForm';

export default function Page() {
  return (
    <main className="space-y-4">
      <h2 className="text-lg font-semibold">System Configuration</h2>
      <SystemConfigForm />
      <ArchiveRunForm />
    </main>
  );
}
