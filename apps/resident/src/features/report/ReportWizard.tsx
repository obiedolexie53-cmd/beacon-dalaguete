import { useEffect, useRef } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { CircleCheck } from 'lucide-react';
import { useReportDraft } from './draft/ReportDraftProvider';
import { StepIndicator } from './StepIndicator';
import { stepIndex } from './steps';

/** Layout for /report/new/*: progress, the current step and the saved-draft note. */
export function ReportWizard() {
  const { draft } = useReportDraft();
  const { pathname } = useLocation();
  const current = stepIndex(pathname);
  const stepRef = useRef<HTMLDivElement>(null);

  // Move focus to the new step's heading so screen reader users hear where they are.
  useEffect(() => {
    stepRef.current?.querySelector<HTMLElement>('h1')?.focus();
  }, [pathname]);

  if (!draft) return <Navigate to="/report" replace />;
  // Already sent: only its evidence upload can continue, from the confirmation screen.
  if (draft.submittedReferenceNo) {
    return <Navigate to={`/report/submitted/${draft.submittedReferenceNo}`} replace />;
  }
  // Later steps need a hazard first.
  if (current > 0 && !draft.hazardCode) return <Navigate to="/report/new/hazard" replace />;

  return (
    <div className="bcn-stack">
      <StepIndicator current={Math.max(current, 0)} />
      <div ref={stepRef} className="bcn-stack">
        <Outlet />
      </div>
      <p className="r-draft-note">
        <CircleCheck size={16} aria-hidden="true" />
        Draft saved on this device
      </p>
    </div>
  );
}
