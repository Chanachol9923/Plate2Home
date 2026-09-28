import 'server-only';
import { ApiError } from '@/lib/api/route';
import { manageCandidates, pinFailed, pinSucceeded } from '@/lib/db/manage';
import { normalizePlate } from '@/lib/plate/normalize';
import type { PlateInput } from '@/lib/plate/types';
import { hashPin, verifyPin } from '@/lib/security/pin';

// Hash of a random PIN, made once: a plate with no posts then costs as much time as a real one.
let dummyHash: Promise<string> | null = null;
const dummy = () => (dummyHash ??= hashPin(String(Math.random()).slice(2, 8)));

/**
 * Which batch does this plate + PIN open? The PIN is checked against every post with that
 * plate text (an owner's and a finder's posts can share a plate). Wrong PIN and unknown plate
 * give the same error, so nobody learns which plates exist; five wrong PINs lock a batch with
 * an escalating wait (D-078).
 */
export async function batchForPin(input: PlateInput, pin: string): Promise<string> {
  const plate = normalizePlate(input);
  const text = `${plate.prefixDigit ?? ''}${plate.letters}${plate.number}`;
  const now = Date.now();
  const candidates = await manageCandidates(text);
  const open = candidates.filter((c) => !c.lockedUntil || Date.parse(c.lockedUntil) <= now);

  if (candidates.length > 0 && open.length === 0) {
    const until = Math.min(...candidates.map((c) => Date.parse(c.lockedUntil!)));
    throw new ApiError('pin_locked', 429, { retryAfter: Math.ceil((until - now) / 1000) });
  }
  for (const c of open) {
    if (await verifyPin(c.pinHash, pin)) {
      await pinSucceeded(c.batchId);
      return c.batchId;
    }
  }
  if (open.length === 0) await verifyPin(await dummy(), pin);

  let lockedUntil: string | null = null;
  for (const c of open) lockedUntil = (await pinFailed(c.batchId)) ?? lockedUntil;
  if (lockedUntil) {
    throw new ApiError('pin_locked', 429, {
      retryAfter: Math.ceil((Date.parse(lockedUntil) - now) / 1000),
    });
  }
  throw new ApiError('pin_wrong', 403);
}
