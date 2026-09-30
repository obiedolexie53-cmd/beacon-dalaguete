import { Link } from 'react-router';
import { ChartColumnBig } from 'lucide-react';
import { Alert } from '@beacon/ui';
import { ComingSoon } from '../ComingSoon';

export const ANALYSIS_DISCLAIMER =
  'This analysis identifies recurring patterns in recorded disaster reports. It does not ' +
  'predict future disasters and does not replace MDRRMO assessment or emergency decision-making.';

export function AnalysisPage() {
  return (
    <ComingSoon
      title="Machine Learning-Assisted Hazard Pattern Analysis"
      subtitle="4.1 Incident Data Analysis · 4.2 Hazard Pattern Identification · 4.3 Pattern Visualization"
      icon={<ChartColumnBig size={28} />}
      phase="Phases 13–14"
    >
      <Alert tone="info" title="About this analysis">
        {ANALYSIS_DISCLAIMER}
      </Alert>
      <p style={{ margin: 0 }}>
        4.1 Incident Data Analysis is available now under{' '}
        <Link to="/history">Historical Reports</Link>.
      </p>
    </ComingSoon>
  );
}
