import { expect, test } from '@playwright/test';

test.describe('Unified Estate Console', () => {
  test('landing page renders core panels', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('CPA Panel')).toBeVisible();
    await expect(page.getByText('Underwriter Panel')).toBeVisible();
    await expect(page.getByText('Treasury Panel')).toBeVisible();
    await expect(page.getByText('Trustee & Investor Controls')).toBeVisible();
  });

  test('treasury validation rejects malformed subscriber', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Subscriber Address').fill('not-an-address');
    await page.getByRole('button', { name: 'KYC Subscribe' }).click();
    await expect(page.getByText('Invalid subscriber address')).toBeVisible();
  });

  test('redeem button surfaces missing wallet error', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Redeem Note' }).click();
    await expect(page.getByText('Wallet connection not ready')).toBeVisible();
  });
});
