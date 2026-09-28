import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openTestDb, type TestDb } from './harness';
import { FAKE_PIN_HASH, HEX64 } from './fixtures';

let db: TestDb;
const created: string[] = [];

async function createLost(letters: string, number: string, prefix: string | null = null) {
  const [row] = await db.query<{ out_batch_id: string; out_post_id: string }>(
    `select * from public.create_lost_watch($1,$2,'th','v1','owner.line',null,null,false,false,
       'car',$3,$4,$5,'TH-10',$6,$7,$8,false,'valid')`,
    [
      FAKE_PIN_HASH,
      HEX64,
      prefix,
      letters,
      number,
      `car|${prefix ?? ''}|${letters}|${number}|TH-10`,
      `${prefix ?? ''}${letters}${number}`,
      `${prefix ?? ''}${letters} ${number}`,
    ],
  );
  created.push(row!.out_batch_id);
  return row!;
}

beforeAll(async () => {
  db = await openTestDb();
});

afterAll(async () => {
  if (created.length) {
    await db.query(`delete from public.batches where id = any($1::uuid[])`, [created]);
  }
  await db.query(`delete from public.pending_storage_deletes where path like '%'`);
  await db.close();
});

describe('manage_candidates', () => {
  it('finds batches by plate text in any province, with their PIN hash', async () => {
    const { out_batch_id } = await createLost('ฬฮ', '4321', '9');
    const rows = await db.query<{ batch_id: string; pin_hash: string }>(
      `select * from public.manage_candidates('9ฬฮ4321')`,
    );
    expect(rows.map((r) => r.batch_id)).toContain(out_batch_id);
    expect(rows[0]?.pin_hash).toBe(FAKE_PIN_HASH);
    expect(await db.query(`select * from public.manage_candidates('ฬฮ4321')`)).toHaveLength(0);
  });
});

describe('pin_failed / pin_succeeded', () => {
  it('locks a batch after five wrong PINs, and a right PIN starts over', async () => {
    const { out_batch_id: id } = await createLost('ฬฬ', '1111');
    const fail = async () =>
      (await db.query<{ t: Date | null }>(`select public.pin_failed($1) as t`, [id]))[0]!.t;
    for (let i = 0; i < 4; i++) expect(await fail()).toBeNull();
    const locked = await fail();
    expect(locked).not.toBeNull();
    expect(new Date(locked!).getTime()).toBeGreaterThan(Date.now() + 10 * 60_000);
    const [cand] = await db.query<{ locked_until: Date | null }>(
      `select locked_until from public.manage_candidates('ฬฬ1111')`,
    );
    expect(cand?.locked_until).not.toBeNull();

    await db.query(`select public.pin_succeeded($1)`, [id]);
    const [after] = await db.query<{ locked_until: Date | null; failures: number }>(
      `select locked_until, failures from public.pin_attempts where batch_id = $1`,
      [id],
    );
    expect(after).toMatchObject({ locked_until: null, failures: 0 });
  });

  it('locks longer after every lockout', async () => {
    const { out_batch_id: id } = await createLost('ฮฮ', '2222');
    const lockFor = async () => {
      let t: Date | null = null;
      for (let i = 0; i < 5; i++) {
        t = (await db.query<{ t: Date | null }>(`select public.pin_failed($1) as t`, [id]))[0]!.t;
      }
      return new Date(t!).getTime() - Date.now();
    };
    const first = await lockFor();
    const second = await lockFor();
    expect(second).toBeGreaterThan(first * 1.5);
  });
});

describe('batch_owned / batch_posts', () => {
  it('checks the device token and lists the posts', async () => {
    const { out_batch_id: id, out_post_id } = await createLost('ฬก', '3333');
    const own = async (hash: string) =>
      (await db.query<{ ok: boolean }>(`select public.batch_owned($1, $2) as ok`, [id, hash]))[0]!
        .ok;
    expect(await own(HEX64)).toBe(true);
    expect(await own('c'.repeat(64))).toBe(false);
    const posts = await db.query<{ post_id: string; status: string }>(
      `select * from public.batch_posts($1)`,
      [id],
    );
    expect(posts).toEqual([expect.objectContaining({ post_id: out_post_id, status: 'active' })]);
  });
});

describe('manage_post', () => {
  const act = async (batch: string, post: string | null, action: string) =>
    (
      await db.query<{ n: number }>(`select public.manage_post($1, $2, $3) as n`, [
        batch,
        post,
        action,
      ])
    )[0]!.n;

  it('resolves: the post stops being active', async () => {
    const { out_batch_id: b, out_post_id: p } = await createLost('ฬข', '4444');
    expect(await act(b, p, 'resolve')).toBe(1);
    const [row] = await db.query<{ status: string }>(
      `select status from public.posts where id = $1`,
      [p],
    );
    expect(row?.status).toBe('resolved');
    expect(await act(b, p, 'resolve')).toBe(0);
  });

  it('extends by 30 days, at most to 90 days after posting', async () => {
    const { out_batch_id: b, out_post_id: p } = await createLost('ฬค', '5555');
    const days = async () =>
      (
        await db.query<{ d: number }>(
          `select round(extract(epoch from expires_at - created_at) / 86400)::int as d
           from public.posts where id = $1`,
          [p],
        )
      )[0]!.d;
    expect(await days()).toBe(60);
    expect(await act(b, p, 'extend')).toBe(1);
    expect(await days()).toBe(90);
    expect(await act(b, p, 'extend')).toBe(0);
    expect(await days()).toBe(90);
  });

  it('deletes the post and the empty batch', async () => {
    const { out_batch_id: b, out_post_id: p } = await createLost('ฬง', '6666');
    expect(await act(b, p, 'delete')).toBe(1);
    expect(await db.query(`select 1 from public.batches where id = $1`, [b])).toHaveLength(0);
  });

  it('never touches another batch, and rejects unknown actions', async () => {
    const one = await createLost('ฬจ', '7777');
    const two = await createLost('ฬจ', '8888');
    expect(await act(one.out_batch_id, two.out_post_id, 'delete')).toBe(0);
    expect(
      await db.query(`select 1 from public.posts where id = $1`, [two.out_post_id]),
    ).toHaveLength(1);
    await expect(act(one.out_batch_id, null, 'drop')).rejects.toThrow();
  });
});
