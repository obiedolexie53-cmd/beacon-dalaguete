import { FileSearch } from 'lucide-react';
import { ComingSoon } from '../ComingSoon';

export function ReportsPage() {
  return (
    <ComingSoon
      title="Reports"
      subtitle="Search, filter, review and verify submitted disaster reports."
      icon={<FileSearch size={28} />}
      phase="Phases 9–10"
    />
  );
}
