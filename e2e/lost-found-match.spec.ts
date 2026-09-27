import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';

/**
 * With manual entry only: a lost watch and a found post for the same plate are matched
 * instantly, and each side reaches the other (owner via "My posts" + the anti-scam reveal,
 * finder via the match page with its device token).
 */

// Unusual letters + a random number per test run, so runs (and viewports) never collide.
const letters = 'ฬฮ';

async function fillPlate(page: Page, number: string) {
  // One field for the whole plate, typed the way it reads ("ฬฮ1234").
  await page.getByLabel('เลขทะเบียน', { exact: true }).fill(`${letters}${number}`);
  await expect(page.getByText(`อ่านได้เป็น หมวด ${letters} · เลข ${number}`)).toBeVisible();
  await page.getByRole('button', { name: /^จังหวัด:/ }).click();
  const sheet = page.getByRole('dialog', { name: 'เลือกจังหวัด' });
  await sheet.getByRole('searchbox').fill('กทม');
  await sheet.getByRole('button', { name: /กรุงเทพมหานคร/ }).click();
  await expect(sheet).toBeHidden();
}

async function passTurnstile(page: Page) {
  // The test sitekey solves itself; wait until the widget has produced a token.
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, {
    timeout: 30_000,
  });
}

async function plateImage(): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="360">
    <rect width="800" height="360" fill="#7a6a55"/>
    <rect x="100" y="80" width="600" height="220" fill="#fff" stroke="#111" stroke-width="12"/>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg().toBuffer();
}

test('owner and finder are matched and can reach each other', async ({ page, browser }) => {
  const number = String(1000 + Math.floor(Math.random() * 8999));
  // Roles come from device tokens, so the owner and the finder use separate browsers.
  const owner = page;
  const finderContext = await browser.newContext(test.info().project.use);
  const finder = await finderContext.newPage();

  // --- Owner: register a watch --------------------------------------------------------------
  await owner.goto('/lost');
  await fillPlate(owner, number);
  await owner.getByRole('button', { name: 'ต่อไป' }).click();
  await expect(owner).toHaveURL(/step=contact/);

  await owner.getByLabel('LINE ID (แนะนำ)').fill('e2e.owner');
  await owner.getByLabel(/^หมายเหตุ/).fill('ป้ายหลัง มีสติกเกอร์');
  await owner.getByRole('button', { name: 'ต่อไป' }).click();
  await expect(owner).toHaveURL(/step=confirm/);

  await owner.getByLabel('PIN 4–6 หลัก').fill('2580');
  await owner.getByLabel('ใส่ PIN อีกครั้ง').fill('2580');
  await owner.getByRole('checkbox').check();
  await passTurnstile(owner);
  await owner.getByRole('button', { name: 'ตั้งรับ' }).click();
  await expect(
    owner.getByText('ตั้งรับไว้แล้ว ระบบจะจับคู่ให้อัตโนมัติเมื่อมีคนเจอป้ายนี้'),
  ).toBeVisible();

  // --- Finder: photograph, crop, confirm, send ------------------------------------------------
  await finder.goto('/found');
  await finder
    .locator('input[type="file"][multiple]')
    .setInputFiles({ name: 'plate.jpg', mimeType: 'image/jpeg', buffer: await plateImage() });
  await finder.getByRole('button', { name: /ใช้ทั้งรูป/ }).click();
  await expect(finder.getByRole('heading', { name: 'ป้ายที่ 1' })).toBeVisible();
  await fillPlate(finder, number);
  // Step 1 already says someone is looking for this plate, before anything is posted.
  await expect(finder.getByText('มีคนกำลังตามหาป้ายนี้อยู่!')).toBeVisible();
  await finder.getByRole('button', { name: 'ต่อไป' }).click();
  await expect(finder).toHaveURL(/step=details/);

  await finder.getByLabel(/^หมายเหตุ/).fill('เจอใกล้วัด ทั้งป้ายหน้าและหลัง');
  await finder.getByLabel('LINE ID (แนะนำ)').fill('e2e.finder');
  await finder.getByLabel('PIN 4–6 หลัก').fill('1397');
  await finder.getByLabel('ใส่ PIN อีกครั้ง').fill('1397');
  await finder.getByRole('checkbox').check();
  await passTurnstile(finder);
  await finder.getByRole('button', { name: /^ส่ง 1 ป้าย/ }).click();
  await expect(finder.getByText('เจ้าของกำลังตามหาอยู่!')).toBeVisible();

  // --- Finder on the match page: sees the owner's note and contact ---------------------------
  await finder.getByRole('link', { name: /ดูรายละเอียด/ }).click();
  await expect(finder).toHaveURL(/\/match\/[0-9a-f-]{36}$/);
  await expect(finder.getByText('ตรงกัน', { exact: true })).toBeVisible();
  await expect(finder.getByText('ป้ายหลัง มีสติกเกอร์')).toBeVisible(); // owner's note
  await expect(finder.getByText('คุณเป็นคนเจอป้ายนี้')).toBeVisible();
  await expect(finder.getByText('e2e.owner')).toHaveCount(0);
  await finder.getByRole('button', { name: 'ดูช่องทางติดต่อเจ้าของ' }).click();
  await expect(finder.getByText('e2e.owner')).toBeVisible();

  // --- Owner: "My posts" shows the match; checklist, then the finder's contact --------------
  await owner.goto('/my-posts');
  await expect(owner.getByText('จับคู่ได้ 1 รายการ')).toBeVisible();
  await owner.getByRole('link', { name: 'ดูการจับคู่' }).click();
  await expect(owner.getByText('คุณเป็นเจ้าของป้ายนี้')).toBeVisible();
  await expect(owner.getByRole('img', { name: 'รูปป้ายที่มีคนเจอ' })).toBeVisible();
  await expect(owner.getByText('e2e.finder')).toHaveCount(0);

  await owner.getByRole('button', { name: 'ดูช่องทางติดต่อ' }).click();
  const sheet = owner.getByRole('dialog', { name: 'ก่อนติดต่อ โปรดอ่านให้จบ' });
  await expect(sheet.getByText('ถ้ามีคนขอให้โอนเงินก่อนได้ป้ายคืน อย่าโอนเด็ดขาด')).toBeVisible();
  await sheet.getByRole('checkbox').check();
  await passTurnstile(owner);
  await sheet.getByRole('button', { name: 'แสดงช่องทางติดต่อ' }).click();
  await expect(owner.getByText('e2e.finder')).toBeVisible();
  await expect(owner.getByText('เจอใกล้วัด ทั้งป้ายหน้าและหลัง')).toBeVisible(); // finder's note
  await expect(owner.getByRole('link', { name: 'เปิดใน LINE' })).toHaveAttribute(
    'href',
    'https://line.me/ti/p/~e2e.finder',
  );

  // --- Search finds the found plate --------------------------------------------------------
  await owner.goto('/search');
  await fillPlate(owner, number);
  await owner.getByRole('button', { name: 'ค้นหา', exact: true }).click();
  await expect(owner.getByText('ตรงกัน', { exact: true }).first()).toBeVisible();

  await finderContext.close();
});
