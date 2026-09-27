import { apiRoute, enforceRateLimit, readJson } from '@/lib/api/route';
import { myPosts } from '@/lib/db/mine';
import { sha256Hex } from '@/lib/security/tokens';
import { myPostsSchema } from '@/lib/validation/schemas';

/** "My posts": posts created on this device (device tokens from localStorage). */
export const POST = apiRoute('api/my-posts', async (request, { ipHash }) => {
  const body = myPostsSchema.parse(await readJson(request));
  await enforceRateLimit('my-posts', ipHash);
  const posts = await myPosts(
    body.devices.map((d) => ({ batchId: d.batchId, tokenHash: sha256Hex(d.token) })),
  );
  return Response.json({ posts }, { headers: { 'cache-control': 'no-store' } });
});
