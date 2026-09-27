import { expect, test, type Page } from '@playwright/test';

/**
 * Automatic plate finding + reading in the found flow (Tesseract fallback). The test photo is
 * drawn in the browser with the page's own Thai web font, so it doesn't depend on fonts
 * installed on the CI machine.
 */

interface PlateSpec {
  x: number;
  y: number;
  text: string;
  province: string;
}

async function addDrawnPhoto(page: Page, plates: PlateSpec[]) {
  await page.evaluate(async (specs) => {
    const family = getComputedStyle(document.body).fontFamily;
    await document.fonts.load(`700 150px ${family}`, 'กข0123456789');
    const c = document.createElement('canvas');
    c.width = 1600;
    c.height = 1200;
    const g = c.getContext('2d')!;
    g.fillStyle = '#6f6452';
    g.fillRect(0, 0, c.width, c.height);
    for (const p of specs) {
      g.fillStyle = '#fbfaf6';
      g.fillRect(p.x, p.y, 760, 340);
      g.strokeStyle = '#111';
      g.lineWidth = 12;
      g.strokeRect(p.x + 14, p.y + 14, 732, 312);
      g.fillStyle = '#111';
      g.textAlign = 'center';
      g.textBaseline = 'alphabetic';
      g.font = `700 150px ${family}`;
      g.fillText(p.text, p.x + 380, p.y + 190);
      g.font = `600 64px ${family}`;
      g.fillText(p.province, p.x + 380, p.y + 290);
    }
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.92));
    const input = document.querySelector<HTMLInputElement>('input[type="file"][multiple]')!;
    const dt = new DataTransfer();
    dt.items.add(new File([blob], 'plates.jpg', { type: 'image/jpeg' }));
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, plates);
}

test('finds and reads plates in a photo automatically', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/found');
  await addDrawnPhoto(page, [
    { x: 120, y: 140, text: 'กท 2058', province: 'ฉะเชิงเทรา' },
    { x: 720, y: 720, text: '1กข 1234', province: 'กรุงเทพมหานคร' },
  ]);

  // Both plates are proposed as cards, marked as found automatically.
  await expect(page.getByText(/เจอ 2 ป้าย/)).toBeVisible({ timeout: 150_000 });
  await expect(page.getByText('พบอัตโนมัติ')).toHaveCount(2);

  // Each card is read and prefilled (the user still confirms). The reading is shown back.
  const readings = page.getByText(/^อ่านได้เป็น หมวด/);
  await expect(readings).toHaveCount(2, { timeout: 60_000 });
  const texts = await readings.allTextContents();
  const joined = texts.join(' | ');
  expect(joined).toContain('หมวด กท · เลข 2058');
  expect(joined).toContain('หมวด 1กข · เลข 1234');
  // Provinces are recognized and snapped to the province list.
  await expect(page.getByRole('button', { name: 'จังหวัด: ฉะเชิงเทรา' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'จังหวัด: กรุงเทพมหานคร' })).toBeVisible();
});
