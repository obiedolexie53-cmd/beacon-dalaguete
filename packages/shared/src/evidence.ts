/** Evidence limits. Mirrors backend/app/media/limits.py. */
export const MAX_PHOTOS_PER_REPORT = 5;
export const MAX_VIDEOS_PER_REPORT = 2;
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

/** Photos are resized on the phone before upload to save mobile data. */
export const PHOTO_UPLOAD_MAX_SIDE = 2048;
export const PHOTO_UPLOAD_QUALITY = 0.85;

export const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/3gpp'];

export type EvidenceKind = 'photo' | 'video';

/** "1.4 MB", "50 MB", "820 KB" */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
