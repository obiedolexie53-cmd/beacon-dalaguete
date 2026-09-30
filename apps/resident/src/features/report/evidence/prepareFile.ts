import {
  ACCEPTED_PHOTO_TYPES,
  ACCEPTED_VIDEO_TYPES,
  MAX_PHOTO_BYTES,
  MAX_VIDEO_BYTES,
  PHOTO_UPLOAD_MAX_SIDE,
  PHOTO_UPLOAD_QUALITY,
  formatBytes,
  type EvidenceKind,
} from '@beacon/shared';

export class EvidenceRejected extends Error {}

/**
 * Shrink a photo on the phone before it is stored and uploaded: at most
 * PHOTO_UPLOAD_MAX_SIDE pixels, JPEG. Redrawing on a canvas also drops the
 * photo's metadata (the server strips it again). If the browser cannot decode
 * the image, an accepted original is kept as is.
 */
async function shrinkPhoto(file: Blob): Promise<Blob> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    if (ACCEPTED_PHOTO_TYPES.includes(file.type)) return file;
    throw new EvidenceRejected('This photo format is not supported. Use a JPEG or PNG photo.');
  }
  const scale = Math.min(1, PHOTO_UPLOAD_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', PHOTO_UPLOAD_QUALITY),
  );
  return blob && blob.size < file.size ? blob : file;
}

/** Check a picked file and prepare it for storage. Throws EvidenceRejected with a clear reason. */
export async function prepareEvidence(file: File, kind: EvidenceKind): Promise<Blob> {
  if (kind === 'photo') {
    if (!file.type.startsWith('image/')) {
      throw new EvidenceRejected(`"${file.name}" is not a photo.`);
    }
    const prepared = await shrinkPhoto(file);
    if (prepared.size > MAX_PHOTO_BYTES) {
      throw new EvidenceRejected(
        `"${file.name}" is too large (${formatBytes(prepared.size)}). Photos can be up to ${formatBytes(MAX_PHOTO_BYTES)}.`,
      );
    }
    return prepared;
  }
  if (file.type && !ACCEPTED_VIDEO_TYPES.includes(file.type)) {
    throw new EvidenceRejected(`"${file.name}" is not a supported video. Use MP4, MOV or WebM.`);
  }
  if (file.size > MAX_VIDEO_BYTES) {
    throw new EvidenceRejected(
      `"${file.name}" is too large (${formatBytes(file.size)}). Videos can be up to ${formatBytes(MAX_VIDEO_BYTES)}. Try a shorter clip.`,
    );
  }
  return file;
}
