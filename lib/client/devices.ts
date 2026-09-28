/**
 * Device tokens: on post creation the server returns a random secret (it stores only the
 * hash). Keeping it in localStorage lets "My posts" (Phase 4) manage posts from this device
 * without a PIN. Storage can be missing (private mode), so everything is best effort.
 */

const KEY = 'p2h.devices';

export interface DevicePost {
  batchId: string;
  kind: 'lost' | 'found';
  token: string;
  /** Plate display text(s) for the "My posts" list. Never contact details. */
  labels: string[];
  createdAt: string;
}

export function readDevicePosts(): DevicePost[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as DevicePost[]) : [];
  } catch {
    return [];
  }
}

export function rememberDevicePost(post: DevicePost): void {
  try {
    const others = readDevicePosts().filter((p) => p.batchId !== post.batchId);
    localStorage.setItem(KEY, JSON.stringify([post, ...others].slice(0, 50)));
  } catch {
    // Without storage the user can still manage the post with plate + PIN.
  }
}

/** The batch was deleted: stop listing it under "My posts". */
export function forgetDevicePost(batchId: string): void {
  try {
    const rest = readDevicePosts().filter((p) => p.batchId !== batchId);
    localStorage.setItem(KEY, JSON.stringify(rest));
  } catch {
    // Nothing stored, nothing to forget.
  }
}
