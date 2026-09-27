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
  /** Plate size relative to the default 760×340. */
  scale?: number;
}

async function addDrawnPhoto(page: Page, plates: PlateSpec[], size = { w: 1600, h: 1200 }) {
  await page.evaluate(
    async ({ specs, size }) => {
      const family = getComputedStyle(document.body).fontFamily;
      await document.fonts.load(`700 150px ${family}`, 'กข0123456789');
      const c = document.createElement('canvas');
      c.width = size.w;
      c.height = size.h;
      const g = c.getContext('2d')!;
      g.fillStyle = '#6f6452';
      g.fillRect(0, 0, c.width, c.height);
      for (const p of specs) {
        const k = p.scale ?? 1;
        g.fillStyle = '#fbfaf6';
        g.fillRect(p.x, p.y, 760 * k, 340 * k);
        g.strokeStyle = '#111';
        g.lineWidth = 12 * k;
        g.strokeRect(p.x + 14 * k, p.y + 14 * k, 732 * k, 312 * k);
        g.fillStyle = '#111';
        g.textAlign = 'center';
        g.textBaseline = 'alphabetic';
        g.font = `700 ${150 * k}px ${family}`;
        g.fillText(p.text, p.x + 380 * k, p.y + 190 * k);
        g.font = `600 ${64 * k}px ${family}`;
        g.fillText(p.province, p.x + 380 * k, p.y + 290 * k);
      }
      const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.92));
      const input = document.querySelector<HTMLInputElement>('input[type="file"][multiple]')!;
      const dt = new DataTransfer();
      dt.items.add(new File([blob], 'plates.jpg', { type: 'image/jpeg' }));
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    },
    { specs: plates, size },
  );
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
  // Automatic crops keep the whole plate with a margin (the plates are 760×340, ratio 2.2).
  for (const n of [1, 2]) {
    const img = page.getByRole('img', { name: `รูปป้ายที่ ${n}` });
    const size = await img.evaluate((i: HTMLImageElement) => [i.naturalWidth, i.naturalHeight]);
    expect(size[0]! / size[1]!).toBeGreaterThan(1.5);
    expect(size[0]! / size[1]!).toBeLessThan(3);
  }

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

test('a box drawn by hand is cut exactly as drawn when "Crop this plate" is pressed', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.goto('/found');
  await addDrawnPhoto(page, [{ x: 120, y: 140, text: 'กท 2058', province: 'ฉะเชิงเทรา' }]);
  await expect(page.getByText(/เจอ 1 ป้าย/)).toBeVisible({ timeout: 150_000 });

  // Drag a box around the same plate (photo is 1600×1200; plate at 120,140 size 760×340).
  const img = page.locator('figure img').first();
  await img.scrollIntoViewIfNeeded();
  const b = (await img.boundingBox())!;
  const at = (x: number, y: number) => [b.x + (x / 1600) * b.width, b.y + (y / 1200) * b.height];
  const [x0, y0] = at(100, 120);
  const [x1, y1] = at(900, 500);
  await page.mouse.move(x0!, y0!);
  await page.mouse.down();
  await page.mouse.move(x1!, y1!, { steps: 8 });
  await page.mouse.up();

  // Nothing is cut until the user says so.
  await expect(page.getByRole('heading', { name: 'ป้ายที่ 2' })).toHaveCount(0);
  await page.getByRole('button', { name: 'ตัดป้ายนี้' }).click();
  await expect(page.getByRole('heading', { name: 'ป้ายที่ 2' })).toBeVisible();
  // It is read too (a single character may be misread; the user always checks it).
  await expect(page.getByText(/^อ่านได้เป็น หมวด กท · เลข 20\d\d/)).toHaveCount(2, {
    timeout: 60_000,
  });
  // The crop keeps the drawn box's shape (800×380 → about 2.1), not a re-cropped one.
  const ratio = await page
    .getByRole('img', { name: 'รูปป้ายที่ 2' })
    .evaluate((i: HTMLImageElement) => i.naturalWidth / i.naturalHeight);
  expect(ratio).toBeGreaterThan(1.9);
  expect(ratio).toBeLessThan(2.3);
});

test('finds a small plate in a large photo', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/found');
  await addDrawnPhoto(
    page,
    [{ x: 1300, y: 950, text: 'กท 2058', province: 'ฉะเชิงเทรา', scale: 0.4 }],
    { w: 2048, h: 1536 },
  );
  await expect(page.getByText(/เจอ 1 ป้าย/)).toBeVisible({ timeout: 150_000 });
  await expect(page.getByText(/^อ่านได้เป็น หมวด กท · เลข 2058/)).toBeVisible({
    timeout: 60_000,
  });
});
