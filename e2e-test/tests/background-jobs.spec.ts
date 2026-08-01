import { test, expect } from '@playwright/test';

test.describe('Background Jobs Modal UI', () => {
  test('should display active jobs and allow cancellation', async ({ page }) => {
    // 0. Listen to console logs
    page.on('console', msg => console.log('BROWSER:', msg.text()));
    // 1. Intercept the active jobs API to return our mock job immediately
    await page.route('**/api/jobs/active', async route => {
      const json = [
        {
          _id: 'mock-job-123',
          fileName: 'large_test_document.pdf',
          status: 'processing',
          progress: 5,
          totalChunks: 20,
          createdAt: new Date().toISOString(),
          chunksMeta: []
        }
      ];
      await route.fulfill({
        headers: { 'Access-Control-Allow-Origin': '*' },
        json
      });
    });

    // 2. Intercept the cancel job API to simulate success
    let cancelCalled = false;
    await page.route('**/api/jobs/mock-job-123/cancel', async route => {
      cancelCalled = true;
      await route.fulfill({
        headers: { 'Access-Control-Allow-Origin': '*' },
        json: { message: 'Job cancelled successfully' }
      });
    });

    // 3. Navigate to the app
    await page.goto('/');

    // 4. Open the Upload Modal
    await page.click('text=Upload Questions');

    // 5. Verify the "Background Jobs" section appears and shows our mock job
    await expect(page.locator('h4:has-text("Background Jobs")').first()).toBeVisible();
    await expect(page.locator('text=large_test_document.pdf')).toBeVisible();
    await expect(page.locator('text=5 parsed')).toBeVisible();

    // 6. Click the stop/cancel button for the job
    const stopButton = page.locator('button[title="Stop AI processing"]');
    await expect(stopButton).toBeVisible();
    await stopButton.click();

    // 7. Verify the cancellation API was hit
    expect(cancelCalled).toBeTruthy();

    // 8. Update the mock to return empty active jobs, simulating it was removed
    await page.route('**/api/jobs/active', async route => {
      await route.fulfill({
        headers: { 'Access-Control-Allow-Origin': '*' },
        json: []
      });
    });

    // 9. Wait for the UI to update and verify the section disappears or shows 0
    // The component only renders the list if activeJobs.length > 0
    await expect(page.locator('text=large_test_document.pdf')).not.toBeVisible();
  });
});
