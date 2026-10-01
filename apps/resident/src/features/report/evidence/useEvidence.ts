import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MAX_PHOTOS_PER_REPORT,
  MAX_VIDEOS_PER_REPORT,
  uuidv4,
  type EvidenceKind,
} from '@beacon/shared';
import { deleteEvidence, listEvidence, putEvidence, type StoredEvidence } from './evidenceStore';
import { EvidenceRejected, prepareEvidence } from './prepareFile';

export interface EvidenceItem extends StoredEvidence {
  /** Object URL for previews; revoked automatically. */
  previewUrl: string;
}

export const EVIDENCE_LIMITS: Record<EvidenceKind, number> = {
  photo: MAX_PHOTOS_PER_REPORT,
  video: MAX_VIDEOS_PER_REPORT,
};

function reason(error: unknown, file: File): string {
  return error instanceof EvidenceRejected ? error.message : `"${file.name}" could not be added.`;
}

/** The evidence attached to one draft, persisted on the device. */
export function useEvidence(draftId: string) {
  const [items, setItems] = useState<EvidenceItem[] | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const urls = useRef(new Set<string>());

  const withPreview = useCallback((item: StoredEvidence): EvidenceItem => {
    const previewUrl = URL.createObjectURL(item.blob);
    urls.current.add(previewUrl);
    return { ...item, previewUrl };
  }, []);

  const revoke = useCallback((item: EvidenceItem) => {
    URL.revokeObjectURL(item.previewUrl);
    urls.current.delete(item.previewUrl);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const created = urls.current;
    listEvidence(draftId).then((stored) => {
      if (!cancelled) setItems(stored.map(withPreview));
    });
    return () => {
      cancelled = true;
      created.forEach((url) => URL.revokeObjectURL(url));
      created.clear();
    };
  }, [draftId, withPreview]);

  const store = useCallback(
    async (file: File, kind: EvidenceKind, addedAt = Date.now()): Promise<EvidenceItem> => {
      const blob = await prepareEvidence(file, kind);
      const item: StoredEvidence = {
        id: uuidv4(),
        draftId,
        kind,
        blob,
        mimeType: blob.type || file.type,
        size: blob.size,
        addedAt,
      };
      await putEvidence(item);
      return withPreview(item);
    },
    [draftId, withPreview],
  );

  /** Add picked files, skipping any over the limit or rejected, and explaining why. */
  const add = useCallback(
    async (files: File[], kind: EvidenceKind) => {
      setBusy(true);
      const found: string[] = [];
      const added: EvidenceItem[] = [];
      let count = items?.filter((i) => i.kind === kind).length ?? 0;
      for (const file of files) {
        if (count >= EVIDENCE_LIMITS[kind]) {
          found.push(
            `A report can have up to ${EVIDENCE_LIMITS[kind]} ${kind}s. "${file.name}" was not added.`,
          );
          continue;
        }
        try {
          added.push(await store(file, kind));
          count += 1;
        } catch (error) {
          found.push(reason(error, file));
        }
      }
      setItems((current) => [...(current ?? []), ...added]);
      setProblems(found);
      setBusy(false);
    },
    [items, store],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteEvidence(id);
      setItems((current) => {
        const target = current?.find((i) => i.id === id);
        if (target) revoke(target);
        return current?.filter((i) => i.id !== id) ?? null;
      });
      setProblems([]);
    },
    [revoke],
  );

  /** Swap one item for a newly picked file, keeping its position. */
  const replace = useCallback(
    async (id: string, file: File) => {
      const target = items?.find((i) => i.id === id);
      if (!target) return;
      setBusy(true);
      try {
        const fresh = await store(file, target.kind, target.addedAt);
        await deleteEvidence(id);
        revoke(target);
        setItems((current) => current?.map((i) => (i.id === id ? fresh : i)) ?? null);
        setProblems([]);
      } catch (error) {
        setProblems([reason(error, file)]);
      } finally {
        setBusy(false);
      }
    },
    [items, store, revoke],
  );

  return { items, problems, busy, add, remove, replace };
}
