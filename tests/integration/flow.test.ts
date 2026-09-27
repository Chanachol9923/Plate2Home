/**
 * End-to-end API flow against a real Supabase (local `supabase start` in CI, or a dev project):
 * lost watch → found batch → plate upload (real Storage) → instant match → search → match view.
 * Skipped unless NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are set.
 */
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);

// Cloudflare's test secret; the siteverify call itself is stubbed below (no network flakiness).
process.env.TURNSTILE_SECRET_KEY ??= '1x0000000000000000000000000000000AA';
process.env.IP_HASH_SECRET ??= randomBytes(32).toString('base64url');
delete process.env.APP_ORIGIN;

const ORIGIN = 'http://localhost:3000';
const IP = `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.7`;
let turnstileOk = true;

const realFetch = globalThis.fetch;
vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.startsWith('https://challenges.cloudflare.com/')) {
    return Promise.resolve(Response.json({ success: turnstileOk, hostname: 'example.com' }));
  }
  return realFetch(input, init);
});

// Unusual letters + random number so earlier runs or real data can't interfere.
const number = String(1000 + Math.floor(Math.random() * 8999));
const plate = { type: 'car', letters: 'ฬฮ', number, provinceCode: 'TH-10' };
const createdBatches: string[] = [];

function jsonRequest(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    headers: { origin: ORIGIN, 'content-type': 'application/json', 'x-real-ip': IP, ...headers },
    body: JSON.stringify(body),
  });
}

const noParams = { params: Promise.resolve({}) };

async function crop(): Promise<Blob> {
  const png = await sharp({
    create: { width: 420, height: 180, channels: 3, background: { r: 250, g: 250, b: 245 } },
  })
    .png()
    .toBuffer();
  return new Blob([new Uint8Array(png)], { type: 'image/png' });
}

describe.skipIf(!configured)('lost → found → match (real Supabase)', () => {
  let routes: {
    lost: typeof import('@/app/api/lost/route');
    batch: typeof import('@/app/api/found/batch/route');
    plate: typeof import('@/app/api/found/batch/[id]/plate/route');
    search: typeof import('@/app/api/search/route');
    reveal: typeof import('@/app/api/reveal/route');
  };
  let db: typeof import('@/lib/db/server');
  let matches: typeof import('@/lib/db/matches');

  beforeAll(async () => {
    routes = {
      lost: await import('@/app/api/lost/route'),
      batch: await import('@/app/api/found/batch/route'),
      plate: await import('@/app/api/found/batch/[id]/plate/route'),
      search: await import('@/app/api/search/route'),
      reveal: await import('@/app/api/reveal/route'),
    };
    db = await import('@/lib/db/server');
    matches = await import('@/lib/db/matches');
  });

  afterAll(async () => {
    if (!configured || createdBatches.length === 0) return;
    const client = db.serviceClient();
    await client.from('batches').delete().in('id', createdBatches);
    const { data } = await client.from('pending_storage_deletes').select('path');
    const paths = (data ?? [])
      .map((r: { path: string }) => r.path)
      .filter((p) => createdBatches.some((b) => p.startsWith(b)));
    if (paths.length) {
      await client.storage.from('crops').remove(paths);
      await client.from('pending_storage_deletes').delete().in('path', paths);
    }
  });

  const contact = { lineId: 'itest.owner' };
  const base = {
    pin: '2580',
    consent: true,
    consentVersion: '2026-09-v1',
    locale: 'th',
    turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
  };

  let lostMatchCount = -1;
  let batchId = '';
  let uploadToken = '';
  let matchId = '';
  let foundPostId = '';
  let lostPostId = '';

  it('creates a lost watch (no matches yet)', async () => {
    const res = await routes.lost.POST(
      jsonRequest('/api/lost', { ...base, plate, contact, note: 'ป้ายหลัง มีสติกเกอร์' }),
      noParams,
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    createdBatches.push(body.batchId);
    lostPostId = body.postId;
    expect(body.deviceToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(body.formatStatus).toBe('valid');
    lostMatchCount = body.matches.length;
    expect(lostMatchCount).toBe(0);
  });

  it('rejects a failed Turnstile check', async () => {
    turnstileOk = false;
    const res = await routes.lost.POST(
      jsonRequest('/api/lost', { ...base, plate, contact }),
      noParams,
    );
    turnstileOk = true;
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ code: 'turnstile_failed' });
  });

  it('rejects invalid input with field codes', async () => {
    const res = await routes.lost.POST(
      jsonRequest('/api/lost', { ...base, plate, contact: { phone: '123' }, pin: '1111' }),
      noParams,
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.fields).toMatchObject({ 'contact.phone': 'phone_invalid', pin: 'pin_weak' });
  });

  it('opens a found batch', async () => {
    const res = await routes.batch.POST(
      jsonRequest('/api/found/batch', {
        ...base,
        pin: '1397',
        contact: { phone: '0812345678' },
        handover: 'police_station',
        policeStationNote: 'สภ.ทดสอบ',
        district: 'บางเขน',
        note: 'เจอใกล้วัด ทั้งป้ายหน้าและหลัง',
      }),
      noParams,
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    batchId = body.batchId;
    uploadToken = body.uploadToken;
    createdBatches.push(batchId);
  });

  it('refuses a plate upload with a wrong upload token', async () => {
    const form = new FormData();
    form.set('data', JSON.stringify({ plate }));
    form.set('crop', await crop(), 'crop.png');
    const res = await routes.plate.POST(
      new Request(`${ORIGIN}/api/found/batch/${batchId}/plate`, {
        method: 'POST',
        headers: { origin: ORIGIN, 'x-real-ip': IP, 'x-upload-token': 'A'.repeat(43) },
        body: form,
      }),
      { params: Promise.resolve({ id: batchId }) },
    );
    expect(res.status).toBe(403);
  });

  it('uploads the found plate and matches the lost watch instantly', async () => {
    const form = new FormData();
    form.set('data', JSON.stringify({ plate }));
    form.set('crop', await crop(), 'crop.png');
    const res = await routes.plate.POST(
      new Request(`${ORIGIN}/api/found/batch/${batchId}/plate`, {
        method: 'POST',
        headers: { origin: ORIGIN, 'x-real-ip': IP, 'x-upload-token': uploadToken },
        body: form,
      }),
      { params: Promise.resolve({ id: batchId }) },
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.status).toBe('active');
    expect(body.matches).toHaveLength(1);
    expect(body.matches[0].kind).toBe('exact');
    matchId = body.matches[0].matchId;
    foundPostId = body.postId;

    // The stored crop is a re-encoded WebP.
    const { data } = await db
      .serviceClient()
      .storage.from('crops')
      .download(`${batchId}/${body.postId}.webp`);
    const meta = await sharp(Buffer.from(await data!.arrayBuffer())).metadata();
    expect(meta.format).toBe('webp');
  });

  it('finds the found plate by search, with a signed crop URL and no contact data', async () => {
    const res = await routes.search.POST(
      jsonRequest('/api/search', { plate: { ...plate, letters: 'ฬ?' } }),
      noParams,
    );
    expect(res.status).toBe(200);
    const { results } = await res.json();
    const hit = results.find((r: { plate: { number: string } }) => r.plate.number === number);
    expect(hit).toBeDefined();
    expect(hit.kind).toBe('near'); // wildcard → never exact
    expect(hit.cropUrl).toMatch(/token=/);
    const text = JSON.stringify(results);
    expect(text).not.toContain('0812345678');
    expect(text).not.toContain('itest.owner');
    expect(text).not.toContain('บางเขน');
  });

  it('never returns lost watches in search', async () => {
    const res = await routes.search.POST(jsonRequest('/api/search', { plate }), noParams);
    const { results } = await res.json();
    for (const r of results) expect(r.cropUrl).not.toBeNull();
  });

  it('exposes the match view without contact details', async () => {
    const view = await matches.getMatchView(matchId);
    expect(view).toMatchObject({
      kind: 'exact',
      lostPlate: { letters: 'ฬฮ', number },
      found: { handover: 'police_station' },
      lostNote: 'ป้ายหลัง มีสติกเกอร์',
    });
    expect(JSON.stringify(view)).not.toContain('0812345678');
    expect(JSON.stringify(view)).not.toContain('เจอใกล้วัด');
  });

  const revealBody = (postId: string, extra: Record<string, unknown> = {}) => ({
    postId,
    acknowledged: true,
    turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
    ...extra,
  });

  it('reveals the finder contact, district and note after the acknowledgement', async () => {
    const res = await routes.reveal.POST(
      jsonRequest('/api/reveal', revealBody(foundPostId)),
      noParams,
    );
    expect(res.status).toBe(200);
    const { contact } = await res.json();
    expect(contact).toMatchObject({
      phone: '0812345678',
      lineId: null,
      email: null,
      handover: 'police_station',
      policeStationNote: 'สภ.ทดสอบ',
      district: 'บางเขน',
      note: 'เจอใกล้วัด ทั้งป้ายหน้าและหลัง',
    });
  });

  it("never reveals a lost-plate owner's contact through this endpoint", async () => {
    const res = await routes.reveal.POST(
      jsonRequest('/api/reveal', revealBody(lostPostId)),
      noParams,
    );
    expect(res.status).toBe(404);
    expect(JSON.stringify(await res.json())).not.toContain('itest.owner');
  });

  it('requires the safety acknowledgement', async () => {
    const res = await routes.reveal.POST(
      jsonRequest('/api/reveal', revealBody(foundPostId, { acknowledged: false })),
      noParams,
    );
    expect(res.status).toBe(400);
  });

  it('rejects notes with payment details', async () => {
    const res = await routes.lost.POST(
      jsonRequest('/api/lost', { ...base, plate, contact, note: 'โอนมา 123-4-56789-0' }),
      noParams,
    );
    expect(res.status).toBe(400);
    expect((await res.json()).fields).toMatchObject({ note: 'text_account_number' });
  });
});
