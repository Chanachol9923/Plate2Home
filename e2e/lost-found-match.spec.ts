import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';

/**
 * Phase 3 exit criterion: with manual entry only, a lost watch and a found post for the same
 * plate are matched instantly, and both sides reach the match page.
 */

// Unusual letters + a random number per test run, so runs (and viewports) never collide.
const letters = 'ฬฮ';

async function fillPlate(page: Page, number: string) {
  await page.getByLabel(/^หมวดอักษร/).fill(letters);
  await page.getByLabel('เลขทะเบียน', { exact: true }).fill(number);
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

test('lost watch, then found plate, are matched and link to the match page', async ({ page }) => {
  const number = String(1000 + Math.floor(Math.random() * 8999));
  // --- Lost: register a watch --------------------------------------------------------------
  await page.goto('/lost');
  await fillPlate(page, number);
  await page.getByRole('button', { name: 'ต่อไป' }).click();
  await expect(page).toHaveURL(/step=contact/);

  await page.getByLabel('LINE ID (แนะนำ)').fill('e2e.owner');
  await page.getByRole('button', { name: 'ต่อไป' }).click();
  await expect(page).toHaveURL(/step=confirm/);

  await page.getByLabel('PIN 4–6 หลัก').fill('2580');
  await page.getByLabel('ใส่ PIN อีกครั้ง').fill('2580');
  await page.getByRole('checkbox').check();
  await passTurnstile(page);
  await page.getByRole('button', { name: 'ตั้งรับ' }).click();
  await expect(page.getByText('เราจะแจ้งเตือนทันทีเมื่อมีคนเจอป้ายนี้')).toBeVisible();

  // --- Found: photograph, crop, confirm, send ------------------------------------------------
  await page.goto('/found');
  await page
    .locator('input[type="file"][multiple]')
    .setInputFiles({ name: 'plate.jpg', mimeType: 'image/jpeg', buffer: await plateImage() });
  await page.getByRole('button', { name: /ใช้ทั้งรูป/ }).click();
  await expect(page.getByRole('heading', { name: 'ป้ายที่ 1' })).toBeVisible();
  await fillPlate(page, number);
  await page.getByRole('button', { name: 'ต่อไป' }).click();
  await expect(page).toHaveURL(/step=details/);

  await page.getByLabel('LINE ID (แนะนำ)').fill('e2e.finder');
  await page.getByLabel('PIN 4–6 หลัก').fill('1397');
  await page.getByLabel('ใส่ PIN อีกครั้ง').fill('1397');
  await page.getByRole('checkbox').check();
  await passTurnstile(page);
  await page.getByRole('button', { name: /^ส่ง 1 ป้าย/ }).click();

  await expect(page.getByText('เจ้าของกำลังตามหาอยู่!')).toBeVisible();

  // --- Match page ----------------------------------------------------------------------------
  await page.getByRole('link', { name: /ดูรายละเอียด/ }).click();
  await expect(page).toHaveURL(/\/match\/[0-9a-f-]{36}$/);
  await expect(page.getByText('ตรงกัน', { exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'รูปป้ายที่มีคนเจอ' })).toBeVisible();
  // No contact details on the match page (reveal flow comes in Phase 4).
  await expect(page.getByText('e2e.finder')).toHaveCount(0);

  // --- Search finds the found plate --------------------------------------------------------
  await page.goto('/search');
  await fillPlate(page, number);
  await page.getByRole('button', { name: 'ค้นหา', exact: true }).click();
  await expect(page.getByText('ตรงกัน', { exact: true }).first()).toBeVisible();
});
