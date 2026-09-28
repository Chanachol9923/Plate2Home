import { expect, test, type Page } from '@playwright/test';

/**
 * Managing a post (D-078): on the same device from "My posts" (device token), and from another
 * device with plate number + PIN: wrong PIN refused, right PIN opens it, then resolve, extend
 * and delete.
 */

const letters = 'ฬภ';

async function fillPlate(page: Page, number: string) {
  await page.getByLabel('เลขทะเบียน', { exact: true }).fill(`${letters}${number}`);
  await expect(page.getByText(`อ่านได้เป็น หมวด ${letters} · เลข ${number}`)).toBeVisible();
}

async function passTurnstile(page: Page) {
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, {
    timeout: 30_000,
  });
}

async function reportLost(page: Page, number: string, pin: string) {
  await page.goto('/lost');
  await fillPlate(page, number);
  await page.getByRole('button', { name: 'ต่อไป' }).click();
  await page.getByLabel('LINE ID (แนะนำ)').fill('e2e.manage');
  await page.getByRole('button', { name: 'ต่อไป' }).click();
  await page.getByLabel('PIN 4–6 หลัก').fill(pin);
  await page.getByRole('button', { name: 'แสดง' }).click();
  await expect(page.getByLabel('PIN 4–6 หลัก')).toHaveAttribute('type', 'text');
  await page.getByRole('checkbox').check();
  await passTurnstile(page);
  await page.getByRole('button', { name: 'แจ้งป้ายหาย', exact: true }).click();
  await expect(page.getByText(/^แจ้งป้ายหายแล้ว/)).toBeVisible();
}

test('the owner manages the post from My posts and from another device with the PIN', async ({
  page,
  browser,
}) => {
  const number = String(1000 + Math.floor(Math.random() * 8999));
  await reportLost(page, number, '2580');

  // Same device: My posts can extend it.
  await page.goto('/my-posts');
  await page.getByRole('button', { name: 'ต่ออายุอีก 30 วัน' }).click();
  await expect(page.getByText('ต่ออายุแล้ว')).toBeVisible();
  await expect(page.getByRole('button', { name: 'ต่ออายุอีก 30 วัน' })).toHaveCount(0);

  // Another device: plate + PIN.
  const other = await (await browser.newContext(test.info().project.use)).newPage();
  await other.goto('/manage');
  await fillPlate(other, number);
  await other.getByLabel('PIN ของโพสต์').fill('1397');
  await passTurnstile(other);
  await other.getByRole('button', { name: 'เปิดโพสต์' }).click();
  await expect(other.getByText('เลขทะเบียนหรือ PIN ไม่ถูกต้อง')).toBeVisible();

  await other.reload();
  await fillPlate(other, number);
  await other.getByLabel('PIN ของโพสต์').fill('2580');
  await passTurnstile(other);
  await other.getByRole('button', { name: 'เปิดโพสต์' }).click();
  await expect(other.getByText('โพสต์นี้มี 1 ป้าย')).toBeVisible();

  await other.getByRole('button', { name: 'ได้ป้ายคืนแล้ว' }).click();
  await expect(other.getByText('บันทึกแล้ว โพสต์นี้จะไม่จับคู่อีก')).toBeVisible();

  await other.getByRole('button', { name: 'ลบโพสต์' }).click();
  await other.getByRole('button', { name: 'ลบเลย' }).click();
  await expect(other.getByText('ลบโพสต์นี้หมดแล้ว')).toBeVisible();

  // Gone from the first device too.
  await page.goto('/my-posts');
  await expect(page.getByText('ยังไม่มีโพสต์บนเครื่องนี้')).toBeVisible();
});
