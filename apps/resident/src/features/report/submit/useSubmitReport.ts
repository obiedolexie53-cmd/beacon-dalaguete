import { useCallback, useState } from 'react';
import { useApiClient } from '@beacon/auth';
import { ApiError, type ReportSummary } from '@beacon/shared';
import { useReportDraft } from '../draft/ReportDraftProvider';
import type { ReportDraft } from '../draft/draft';
import { deleteEvidence, listEvidence, type StoredEvidence } from '../evidence/evidenceStore';
import { buildReportRequest } from './buildReport';

export type SubmitState =
  | { phase: 'idle' }
  | { phase: 'sending' }
  | { phase: 'uploading'; current: number; total: number }
  | { phase: 'failed'; error: unknown };

export interface SubmitResult {
  report: ReportSummary;
  /** Files that could not be sent and were dropped (e.g. rejected by the server). */
  rejected: string[];
  /** Files still on the device because of a connection problem; can be retried. */
  pending: number;
}

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/3gpp': '3gp',
};

/** A connection problem or server fault is worth retrying; a 4xx rejection is not. */
function isRetryable(error: unknown): boolean {
  return (
    !(error instanceof ApiError) ||
    error.isNetworkError ||
    error.status >= 500 ||
    error.status === 401
  );
}

/**
 * Send a draft: create the report (idempotent via clientRequestId), then upload
 * each photo/video. Every step can be safely re-run: the report is never
 * duplicated and files already uploaded are removed from the device.
 *
 * When nothing is left to retry (`pending === 0`), the caller discards the
 * draft after navigating away, so the wizard never renders without a draft.
 */
export function useSubmitReport() {
  const api = useApiClient();
  const { updateDraft } = useReportDraft();
  const [state, setState] = useState<SubmitState>({ phase: 'idle' });

  const submit = useCallback(
    async (draft: ReportDraft): Promise<SubmitResult | null> => {
      setState({ phase: 'sending' });
      let report: ReportSummary;
      try {
        report = await api.post<ReportSummary>('/me/reports', buildReportRequest(draft));
      } catch (error) {
        setState({ phase: 'failed', error });
        return null;
      }
      const items: StoredEvidence[] = await listEvidence(draft.clientRequestId);
      const rejected: string[] = [];
      let pending = 0;
      for (const [index, item] of items.entries()) {
        setState({ phase: 'uploading', current: index + 1, total: items.length });
        const form = new FormData();
        form.append('file', item.blob, `evidence.${EXTENSIONS[item.mimeType] ?? 'bin'}`);
        try {
          await api.upload(`/me/reports/${report.reference_no}/media`, form);
          await deleteEvidence(item.id);
        } catch (error) {
          if (isRetryable(error)) {
            pending += 1;
          } else {
            rejected.push(
              `A ${item.kind} was not added: ${error instanceof ApiError ? error.message : 'it was rejected.'}`,
            );
            await deleteEvidence(item.id);
          }
        }
      }

      // Files still waiting are retried from the confirmation screen. If the app closes
      // mid-upload, sending the draft again is safe: the server returns the existing report
      // (same clientRequestId) and only the remaining files are uploaded.
      if (pending > 0) updateDraft({ submittedReferenceNo: report.reference_no });
      setState({ phase: 'idle' });
      return { report, rejected, pending };
    },
    [api, updateDraft],
  );

  return { state, submit };
}
