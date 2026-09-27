import 'server-only';
import { SIGNED_URL_TTL_SECONDS } from '@/lib/config/app';
import { toDbError } from './errors';
import { serviceClient } from './server';

const BUCKET = 'crops';

export function cropPath(batchId: string, postId: string): string {
  return `${batchId}/${postId}.webp`;
}

export async function uploadCrop(path: string, webp: Buffer): Promise<void> {
  const { error } = await serviceClient()
    .storage.from(BUCKET)
    .upload(path, webp, { contentType: 'image/webp', upsert: false, cacheControl: '300' });
  if (error) throw toDbError('storage_upload', { code: error.name });
}

/** Best effort; failures are left for the daily cleanup via pending_storage_deletes. */
export async function removeCrops(paths: string[]): Promise<boolean> {
  if (paths.length === 0) return true;
  const { error } = await serviceClient().storage.from(BUCKET).remove(paths);
  return !error;
}

/** Short-lived signed URLs for private crops, keyed by path. */
export async function signCropUrls(paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths)];
  if (unique.length === 0) return new Map();
  const { data, error } = await serviceClient()
    .storage.from(BUCKET)
    .createSignedUrls(unique, SIGNED_URL_TTL_SECONDS);
  if (error) throw toDbError('storage_sign', { code: error.name });
  const urls = new Map<string, string>();
  for (const item of data) {
    if (item.path && item.signedUrl && !item.error) urls.set(item.path, item.signedUrl);
  }
  return urls;
}
