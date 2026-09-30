import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { clearDraft, loadDraft, newDraft, saveDraft, type ReportDraft } from './draft';

interface ReportDraftContextValue {
  draft: ReportDraft | null;
  startDraft(): ReportDraft;
  updateDraft(changes: Partial<ReportDraft>): void;
  discardDraft(): void;
}

const ReportDraftContext = createContext<ReportDraftContextValue | null>(null);

/** Holds the signed-in resident's unsent report and keeps it saved on the device. */
export function ReportDraftProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [draft, setDraft] = useState<ReportDraft | null>(() => loadDraft(userId));

  useEffect(() => {
    if (draft) saveDraft(userId, draft);
    else clearDraft(userId);
  }, [userId, draft]);

  const value = useMemo<ReportDraftContextValue>(
    () => ({
      draft,
      startDraft() {
        const fresh = newDraft();
        setDraft(fresh);
        return fresh;
      },
      updateDraft(changes) {
        setDraft((current) =>
          current ? { ...current, ...changes, updatedAt: new Date().toISOString() } : current,
        );
      },
      discardDraft() {
        setDraft(null);
      },
    }),
    [draft],
  );

  return <ReportDraftContext.Provider value={value}>{children}</ReportDraftContext.Provider>;
}

export function useReportDraft(): ReportDraftContextValue {
  const context = useContext(ReportDraftContext);
  if (!context) throw new Error('useReportDraft must be used inside <ReportDraftProvider>');
  return context;
}
