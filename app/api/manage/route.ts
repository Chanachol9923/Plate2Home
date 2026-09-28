import { ApiError, apiRoute, enforceRateLimit, readJson } from '@/lib/api/route';
import { batchOwned, batchPosts, managePost } from '@/lib/db/manage';
import { batchForPin } from '@/lib/manage/verify';
import { sha256Hex } from '@/lib/security/tokens';
import { verifyTurnstile } from '@/lib/security/turnstile';
import { manageSchema } from '@/lib/validation/schemas';

/**
 * Manage a post (D-078): list a batch's posts, mark a plate as returned, extend or delete.
 * Ownership is proven with a plate number + PIN (any device) or with this device's token.
 * Works while the site is dormant too: people must always be able to remove their data.
 */
export const POST = apiRoute('api/manage', async (request, { ip, ipHash }) => {
  const body = manageSchema.parse(await readJson(request));
  await enforceRateLimit('manage', ipHash);

  let batchId: string;
  if (body.auth.kind === 'device') {
    if (!(await batchOwned(body.auth.batchId, sha256Hex(body.auth.token)))) {
      throw new ApiError('not_found', 404);
    }
    batchId = body.auth.batchId;
  } else {
    const first = body.action === 'list';
    if (first && !(await verifyTurnstile(body.auth.turnstileToken, 'manage', ip))) {
      throw new ApiError('turnstile_failed', 403);
    }
    batchId = await batchForPin(body.auth.plate, body.auth.pin);
  }

  if (body.action !== 'list') await managePost(batchId, body.postId ?? null, body.action);
  const posts = await batchPosts(batchId);
  return Response.json({ batchId, posts }, { headers: { 'cache-control': 'no-store' } });
});
