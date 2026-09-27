import { ApiError, apiRoute, assertSiteActive, enforceRateLimit, readJson } from '@/lib/api/route';
import { CONSENT_VERSION } from '@/lib/config/app';
import { createLostWatch } from '@/lib/db/posting';
import { logError } from '@/lib/log';
import { matchNewPost } from '@/lib/matching/run';
import { buildPlateRecord } from '@/lib/plate/canonical';
import { hashPin } from '@/lib/security/pin';
import { randomToken, sha256Hex } from '@/lib/security/tokens';
import { verifyTurnstile } from '@/lib/security/turnstile';
import { lostCreateSchema } from '@/lib/validation/schemas';

/** Create a standing watch for a lost plate, then match it against found posts instantly. */
export const POST = apiRoute('api/lost', async (request, { ip, ipHash }) => {
  await assertSiteActive();
  const body = lostCreateSchema.parse(await readJson(request));
  if (body.consentVersion !== CONSENT_VERSION) throw new ApiError('consent_outdated', 409);

  await enforceRateLimit('lost:create', ipHash);
  if (!(await verifyTurnstile(body.turnstileToken, 'lost_create', ip))) {
    throw new ApiError('turnstile_failed', 403);
  }

  const record = buildPlateRecord(body.plate);
  const deviceToken = randomToken();
  const { batchId, postId } = await createLostWatch({
    record,
    contact: body.contact,
    pinHash: await hashPin(body.pin),
    deviceTokenHash: sha256Hex(deviceToken),
    locale: body.locale,
    consentVersion: CONSENT_VERSION,
    notifyEmail: false, // Phase 5 (double opt-in)
    note: body.note || null,
  });

  // The watch exists now; a matching failure must not fail the request (the daily safety-net
  // run will pick it up).
  let matches: { matchId: string; kind: string }[] = [];
  try {
    matches = (await matchNewPost({ id: postId, kind: 'lost', record })).map((m) => ({
      matchId: m.matchId,
      kind: m.kind,
    }));
  } catch (err) {
    logError('api/lost:match', err);
  }

  return Response.json(
    { batchId, postId, deviceToken, formatStatus: record.validation.status, matches },
    { status: 201, headers: { 'cache-control': 'no-store' } },
  );
});
