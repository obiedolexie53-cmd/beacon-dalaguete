import { History } from 'lucide-react';
import { ComingSoon } from '../ComingSoon';

export function HistoryPage() {
  return (
    <ComingSoon
      title="Historical Reports"
      subtitle="Browse and analyse previously recorded disaster reports."
      icon={<History size={28} />}
      phase="Phase 12"
    />
  );
}
