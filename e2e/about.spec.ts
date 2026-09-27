import { expect, test } from '@playwright/test';

test('the About page is linked from the footer and covers use, terms, privacy and contact', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'เกี่ยวกับ · ข้อตกลง · ความเป็นส่วนตัว' }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole('heading', { level: 1, name: 'เกี่ยวกับ Plate2Home' })).toBeVisible();
  for (const name of ['วิธีใช้', 'ข้อตกลงการใช้งาน', 'ความเป็นส่วนตัว', 'ติดต่อ']) {
    await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
  }
  await expect(page.getByRole('link', { name: 'chanachol.polk@gmail.com' })).toHaveAttribute(
    'href',
    'mailto:chanachol.polk@gmail.com',
  );
  await expect(
    page.getByRole('link', { name: /github\.com\/Chanachol9923\/Plate2Home/ }),
  ).toBeVisible();
  await expect(page.getByText('ภายใน 60 วัน')).toBeVisible();

  // English version.
  await page.goto('/en/about');
  await expect(page.getByRole('heading', { level: 1, name: 'About Plate2Home' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Terms of use' })).toBeVisible();
});
