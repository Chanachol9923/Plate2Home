import 'server-only';
import type { MatchKind } from '@/lib/matching/score';
import type { Plate, PlateType } from '@/lib/plate/types';
import { toDbError } from './errors';
import { serviceClient } from './server';

export interface MyPost {
  batchId: string;
  postId: string;
  kind: 'lost' | 'found';
  plate: Plate;
  status: 'active' | 'needs_review' | 'hidden' | 'resolved';
  createdAt: string;
  expiresAt: string;
  matches: { matchId: string; kind: MatchKind; createdAt: string }[];
}

/** Posts of the batches whose device token hash matches; no contact details. */
export async function myPosts(
  devices: { batchId: string; tokenHash: string }[],
): Promise<MyPost[]> {
  if (devices.length === 0) return [];
  const { data, error } = await serviceClient().rpc('my_posts', {
    p_batch_ids: devices.map((d) => d.batchId),
    p_token_hashes: devices.map((d) => d.tokenHash),
  });
  if (error) throw toDbError('my_posts', error);
  return (
    data as {
      batch_id: string;
      post_id: string;
      kind: 'lost' | 'found';
      plate_type: PlateType;
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

export interface OwnerContact {
  lineId: string | null;
  phone: string | null;
  email: string | null;
}

/** The owner's contact for the matched finder (device token proof); logged. Null if refused. */
export async function revealOwnerContact(
  matchId: string,
  tokenHash: string,
  ipHash: string,
): Promise<OwnerContact | null> {
  const { data, error } = await serviceClient().rpc('reveal_owner_contact', {
    p_match_id: matchId,
    p_device_token_hash: tokenHash,
    p_ip_hash: ipHash,
  });
  if (error) throw toDbError('reveal_owner_contact', error);
  const r = (data as { line_id: string | null; phone: string | null; email: string | null }[])[0];
  return r ? { lineId: r.line_id, phone: r.phone, email: r.email } : null;
}
