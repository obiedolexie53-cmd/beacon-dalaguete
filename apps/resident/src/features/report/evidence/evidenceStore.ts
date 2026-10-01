import type { EvidenceKind } from '@beacon/shared';

/**
 * Photos and videos attached to an unsent draft, kept on this device in
 * IndexedDB (localStorage cannot hold files). Like drafts, they are deleted on
 * submission, discard and logout. If IndexedDB is unavailable (e.g. some private
 * browsing modes), they are kept in memory for the current visit only.
 *
 * File contents are stored as an ArrayBuffer rather than a Blob: older iOS
 * Safari versions cannot store Blobs in IndexedDB reliably.
 */
export interface StoredEvidence {
  id: string;
  draftId: string;
  kind: EvidenceKind;
  blob: Blob;
  mimeType: string;
  size: number;
  addedAt: number;
}

/** What is actually written to IndexedDB. */
type EvidenceRecord = Omit<StoredEvidence, 'blob'> & { data: ArrayBuffer };

async function toRecord(item: StoredEvidence): Promise<EvidenceRecord> {
  const { blob, ...rest } = item;
  return { ...rest, data: await blob.arrayBuffer() };
}

function fromRecord(record: EvidenceRecord): StoredEvidence {
  const { data, ...rest } = record;
  return { ...rest, blob: new Blob([data], { type: record.mimeType }) };
}

const DB_NAME = 'beacon-evidence';
const STORE = 'items';

let dbPromise: Promise<IDBDatabase> | null = null;
const memory = new Map<string, StoredEvidence>();

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB unavailable'));
  if (!dbPromise) {
    const opening = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('draftId', 'draftId');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    // Allow a later retry if opening fails.
    opening.catch(() => {
      dbPromise = null;
    });
    dbPromise = opening;
  }
  return dbPromise;
}

function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = action(tx.objectStore(STORE));
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

export async function listEvidence(draftId: string): Promise<StoredEvidence[]> {
  try {
    const records = await run('readonly', (s) => s.index('draftId').getAll(draftId));
    return (records as EvidenceRecord[]).map(fromRecord).sort((a, b) => a.addedAt - b.addedAt);
  } catch {
    return [...memory.values()]
      .filter((item) => item.draftId === draftId)
      .sort((a, b) => a.addedAt - b.addedAt);
  }
}

export async function putEvidence(item: StoredEvidence): Promise<void> {
  try {
    const record = await toRecord(item);
    await run('readwrite', (s) => s.put(record));
  } catch {
    memory.set(item.id, item);
  }
}

export async function deleteEvidence(id: string): Promise<void> {
  memory.delete(id);
  try {
    await run('readwrite', (s) => s.delete(id));
  } catch {
    /* nothing stored */
  }
}

export async function deleteDraftEvidence(draftId: string): Promise<void> {
  const items = await listEvidence(draftId);
  await Promise.all(items.map((item) => deleteEvidence(item.id)));
}

export async function clearAllEvidence(): Promise<void> {
  memory.clear();
  try {
    await run('readwrite', (s) => s.clear());
  } catch {
    /* nothing stored */
  }
}
