import { test, expect } from '@playwright/test';
import path from 'path';

test.setTimeout(120000); // 2 minutes for Next.js compile and Gemini API

test.describe('QuizMaster Full E2E Flow', () => {
  // We use this specific topic name so it can be cleaned up later by the DB script.
  const testTopic = 'E2E-TEST-TOPIC-XYZ123';

  // Ensure DB cleanup after all tests
  test.afterAll(async ({ request }) => {
    // Note: The cleanup is run via an npm script in the backend
    // `npm run db:cleanup`, which will be triggered externally or here if we had an API.
    // For simplicity, we assume `npm run db:cleanup` will be invoked by the test runner.
  });

  test('Complete flow: Upload -> Parse -> Edit -> Manage -> Play -> Results', async ({ page }) => {
    // 1. Visit homepage
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('QuizMaster');

    // 2. Open Upload Modal
    await page.getByRole('button', { name: 'Upload Document' }).click();
    await expect(page.locator('h2').filter({ hasText: 'Upload Document' })).toBeVisible();

    // 3. Upload File
    const filePath = path.join(__dirname, 'test-files', 'sample.txt');
    await page.setInputFiles('input[type="file"]', filePath);

    // Click Upload (exact match to avoid the home page button)
    await page.getByRole('button', { name: 'Upload', exact: true }).click();
    
    // Wait for AI to finish parsing (might take a few seconds)
    await expect(page.locator('h3:has-text("Review Topics")')).toBeVisible({ timeout: 25000 });
    
    // 4. Verify Parsed Output & Inline Edit
    // There should be two questions parsed from our sample
    await expect(page.locator('p:has-text("What framework is being used")')).toBeVisible();

    // Bulk set the topic to our testTopic so it can be cleaned up
    await page.locator('label:has-text("Select All")').click();
    await page.locator('select').first().selectOption('NEW');
    await page.getByPlaceholder('New topic...').fill(testTopic);
    await page.getByRole('button', { name: 'Apply' }).click();
    
    // Click edit on the first question
    await page.locator('button[title="Edit parsed question"]').first().click();
    
    // Wait for textareas to appear
    await expect(page.locator('textarea').first()).toBeVisible();
    
    // Modify the question text slightly to verify edit works
    await page.locator('textarea').nth(1).fill('What awesome framework is being used for E2E testing?');
    await page.getByRole('button', { name: 'Save Edits' }).click();
    
    // Check if the change is reflected in the UI
    await expect(page.locator('p:has-text("What awesome framework is being used for E2E testing?")')).toBeVisible();

    // Save to Database
    await page.getByRole('button', { name: 'Save Questions' }).click();
    
    // Wait for the success state and modal to close
    await expect(page.getByRole('button', { name: 'Upload Document' })).toBeVisible();

    // 5. Global Manager Flow
    await page.getByRole('button', { name: 'Global Manager' }).click();
    await expect(page.locator('h1:has-text("Global Manager")')).toBeVisible();

    // Search for the topic we just uploaded
    await page.getByPlaceholder('Search questions, answers, explanations...').fill('awesome framework');
    
    // Verify it shows up
    await expect(page.locator('h2:has-text("' + testTopic + '")')).toBeVisible();
    await expect(page.locator('p:has-text("What awesome framework")').first()).toBeVisible();
    
    // Expand the question to see options
    await page.locator('p:has-text("What awesome framework")').first().click();
    await expect(page.locator('li:has-text("Playwright")').first()).toBeVisible();

    // 6. Go back home and Start Quiz
    await page.getByRole('button', { name: 'Go back' }).click();
    await expect(page.locator('h1')).toContainText('QuizMaster');

    // Wait for topics to reload
    await expect(page.locator(`h3:has-text("${testTopic}")`)).toBeVisible({ timeout: 10000 });

    // Select the topic
    const topicCard = page.locator('.glass-card').filter({ hasText: testTopic });
    await topicCard.click();

    // Change question count to 2
    await topicCard.locator('input[type="number"]').fill('2');

    // Start Quiz
    await page.getByRole('button', { name: 'Start Quiz' }).click();

    // 7. Quiz Engine Flow
    await expect(page.locator('div:has-text("Question ")').first()).toBeVisible();
    
    // Answer Question 1 (We know Playwright is the answer)
    await page.getByRole('button', { name: 'Playwright' }).click();
    await page.getByRole('button', { name: 'Next →' }).click();

    // Answer Question 2 (Videos)
    await page.getByRole('button', { name: 'Videos' }).click();

    // Submit Quiz
    await page.getByRole('button', { name: 'Submit Quiz' }).click();
    
    // Accept confirm dialog automatically
    page.on('dialog', dialog => dialog.accept());

    // 8. Results Page
    await expect(page.locator('h1:has-text("Quiz Complete!")')).toBeVisible({ timeout: 10000 });
    
    // Expect 100% score (2/2)
    await expect(page.locator('text=100%')).toBeVisible();
    
    // Review mode
    await expect(page.locator('h1')).toContainText('Quiz Complete!');
    await expect(page.locator('h2')).toContainText('Detailed Review');
    
    // Check if explanation is visible
    await expect(page.locator('p:has-text("Explanation")').first()).toBeVisible();
  });
});
