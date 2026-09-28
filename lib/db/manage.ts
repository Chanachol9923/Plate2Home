import 'server-only';
import type { MyPost } from './mine';
import { toDbError } from './errors';
import { serviceClient } from './server';

export interface ManageCandidate {
  batchId: string;
  pinHash: string;
  lockedUntil: string | null;
}

/** Batches with a post of this plate text (prefix + letters + number, any province). */
export async function manageCandidates(plateText: string): Promise<ManageCandidate[]> {
  const { data, error } = await serviceClient().rpc('manage_candidates', { p_plate: plateText });
  if (error) throw toDbError('manage_candidates', error);
  return (data as { batch_id: string; pin_hash: string; locked_until: string | null }[]).map(
    (r) => ({ batchId: r.batch_id, pinHash: r.pin_hash, lockedUntil: r.locked_until }),
  );
}

/** Count a wrong PIN; returns when the lock ends if this failure locked the batch. */
export async function pinFailed(batchId: string): Promise<string | null> {
  const { data, error } = await serviceClient().rpc('pin_failed', { p_batch_id: batchId });
  if (error) throw toDbError('pin_failed', error);
  return (data as string | null) ?? null;
}

export async function pinSucceeded(batchId: string): Promise<void> {
  const { error } = await serviceClient().rpc('pin_succeeded', { p_batch_id: batchId });
  if (error) throw toDbError('pin_succeeded', error);
}

export async function batchOwned(batchId: string, tokenHash: string): Promise<boolean> {
  const { data, error } = await serviceClient().rpc('batch_owned', {
    p_batch_id: batchId,
    p_token_hash: tokenHash,
  });
  if (error) throw toDbError('batch_owned', error);
  return data === true;
}

export async function batchPosts(batchId: string): Promise<MyPost[]> {
  const { data, error } = await serviceClient().rpc('batch_posts', { p_batch_id: batchId });
  if (error) throw toDbError('batch_posts', error);
  return (
    data as {
      batch_id: string;
      post_id: string;
      kind: MyPost['kind'];
      plate_type: MyPost['plate']['type'];
      prefix_digit: string | null;
      letters: string;
      number: string;
      province_code: string | null;
      status: MyPost['status'];
      created_at: string;
      expires_at: string;
      matches: MyPost['matches'];
    }[]
  ).map((r) => ({
    batchId: r.batch_id,
    postId: r.post_id,
    kind: r.kind,
    plate: {
      type: r.plate_type,
      prefixDigit: r.prefix_digit,
      letters: r.letters,
      number: r.number,
      provinceCode: r.province_code,
    },
    status: r.status,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    matches: r.matches,
  }));
}

export type ManageAction = 'resolve' | 'extend' | 'delete';

/** Apply the owner's action to one post, or the whole batch when `postId` is null. */
export async function managePost(
  batchId: string,
  postId: string | null,
  action: ManageAction,
): Promise<number> {
  const { data, error } = await serviceClient().rpc('manage_post', {
    p_batch_id: batchId,
    p_post_id: postId,
    p_action: action,
  });
  if (error) throw toDbError('manage_post', error);
  return Number(data ?? 0);
}
