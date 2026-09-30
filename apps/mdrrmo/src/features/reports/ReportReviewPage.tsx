import { useParams } from 'react-router';
import { FileSearch } from 'lucide-react';
import { ComingSoon } from '../ComingSoon';

/** Placeholder until report review and verification are built (Phase 10). */
export function ReportReviewPage() {
  const { referenceNo = '' } = useParams();
  return (
    <ComingSoon
      title={`Report ${referenceNo}`}
      subtitle="Review details, evidence and location, and update the report status."
      icon={<FileSearch size={28} />}
      phase="Phase 10"
    />
  );
}
