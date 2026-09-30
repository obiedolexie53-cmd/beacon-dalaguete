import { Map } from 'lucide-react';
import { ComingSoon } from '../ComingSoon';

export function MapPage() {
  return (
    <ComingSoon
      title="Disaster Map"
      subtitle="Recorded reports in Dalaguete, filterable by hazard, barangay, date and status."
      icon={<Map size={28} />}
      phase="Phase 11"
    />
  );
}
