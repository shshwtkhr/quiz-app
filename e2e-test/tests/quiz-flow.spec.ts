import { test, expect } from '@playwright/test';
import path from 'path';

test.setTimeout(180000); // 3 minutes for Next.js compile and Gemini API

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
    // Inject CSS and JS for a visual mouse click ripple effect and fake cursor
    await page.addInitScript(() => {
      const initCursor = () => {
        if (!document.head || !document.body) {
          setTimeout(initCursor, 50);
          return;
        }
        
        if (document.getElementById('e2e-cursor-styles')) return;

        const style = document.createElement('style');
        style.id = 'e2e-cursor-styles';
        style.innerHTML = `
          @keyframes e2e-ripple-anim {
            0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
            100% { transform: translate(-50%, -50%) scale(3); opacity: 0; }
          }
          .e2e-ripple {
            position: fixed;
            border-radius: 50%;
            background-color: rgba(255, 0, 0, 0.8);
            border: 4px solid red;
            pointer-events: none;
            z-index: 2147483647;
            width: 50px;
            height: 50px;
            animation: e2e-ripple-anim 0.8s ease-out forwards;
          }
          .e2e-cursor {
            position: fixed;
            width: 24px;
            height: 24px;
            background: rgba(255, 0, 0, 0.5);
            border: 3px solid red;
            border-radius: 50%;
            pointer-events: none;
            z-index: 2147483646;
            transform: translate(-50%, -50%);
            transition: left 0.1s, top 0.1s;
            display: none;
          }
        `;
        document.head.appendChild(style);

        const cursor = document.createElement('div');
        cursor.className = 'e2e-cursor';
        document.body.appendChild(cursor);

        window.addEventListener('mousemove', (e) => {
          cursor.style.display = 'block';
          cursor.style.left = e.clientX + 'px';
          cursor.style.top = e.clientY + 'px';
        }, true);

        window.addEventListener('mousedown', (e) => {
          cursor.style.display = 'block';
          cursor.style.left = e.clientX + 'px';
          cursor.style.top = e.clientY + 'px';

          const ripple = document.createElement('div');
          ripple.className = 'e2e-ripple';
          ripple.style.left = e.clientX + 'px';
          ripple.style.top = e.clientY + 'px';
          document.body.appendChild(ripple);
          setTimeout(() => ripple.remove(), 1000);
        }, true);
      };
      
      initCursor();
    });

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
    
    // Modify the question text slightly
    await page.locator('textarea').nth(1).fill('What awesome framework is being used for E2E testing?');
    
    // Save the inline edits
    await page.getByRole('button', { name: 'Save Edits' }).click();
    await page.waitForTimeout(500);

    // Save to Database
    await page.getByRole('button', { name: 'Save Questions' }).click();
    
    // Wait for the success state and modal to close (and network request to finish)
    await page.waitForTimeout(3000);
    await expect(page.getByRole('button', { name: 'Upload Document' })).toBeVisible();

    // 5. Global Manager Flow
    await page.goto('/manage');
    await expect(page.locator('h1:has-text("Global Manager")')).toBeVisible();

    // Intercept network to debug what questions we are actually getting back
    page.on('response', async response => {
      if (response.url().includes('/api/questions/search')) {
        try {
          const data = await response.json();
          console.log(`[E2E DEBUG] /api/questions/search returned ${data.length} items`);
          if (data.length > 0) {
            console.log(`[E2E DEBUG] First item topic: ${data[0].topic}, text: ${data[0].question_text}`);
            const e2eItem = data.find(q => q.topic === testTopic);
            console.log(`[E2E DEBUG] Found E2E topic item: ${e2eItem ? e2eItem.question_text : 'NOT FOUND'}`);
          }
        } catch (e) {
          console.log('[E2E DEBUG] Failed to parse search response', e);
        }
      }
    });

    // Search for the topic we just uploaded
    await page.getByPlaceholder('Search questions, answers, explanations...').fill('awesome framework');
    await page.waitForTimeout(2000); // Wait for debounce and network
    
    // Verify it shows up
    await expect(page.locator('h2:has-text("' + testTopic + '")')).toBeVisible();
    await expect(page.locator('p:has-text("What awesome framework")').first()).toBeVisible();
    
    // Expand the question to see options
    await page.locator('p:has-text("What awesome framework")').first().click();
    await expect(page.locator('li:has-text("Playwright")').first()).toBeVisible();

    // 6. Go back home and Start Quiz
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: 'Go back' }).click();
    await expect(page.locator('h1')).toContainText('QuizMaster');

    // Wait for topics to reload
    await expect(page.locator(`h3:has-text("${testTopic}")`)).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(1000);

    // Select the topic
    const topicCard = page.locator('.glass-card').filter({ hasText: testTopic });
    await topicCard.click();
    await page.waitForTimeout(500);

    // Change question count to 2
    await topicCard.locator('input[type="number"]').fill('2');
    await page.waitForTimeout(500);

    // Start Quiz
    await page.getByRole('button', { name: 'Start Quiz' }).click();

    // 7. Quiz Engine Flow
    await expect(page.locator('div:has-text("Question ")').first()).toBeVisible();
    await page.waitForTimeout(1000);
    
    // Answer Question 1 (Select first option)
    await page.locator('div.space-y-3 > button').first().click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Next →' }).click();
    await page.waitForTimeout(1000);

    // Answer Question 2 (Select first option)
    await page.locator('div.space-y-3 > button').first().click();
    await page.waitForTimeout(500);

    // Submit Quiz
    await page.getByRole('button', { name: 'Submit Quiz' }).click();
    
    // Accept confirm dialog automatically
    page.on('dialog', dialog => dialog.accept());

    // 8. Results Page
    await expect(page.locator('h1:has-text("Quiz Complete!")')).toBeVisible({ timeout: 10000 });
    
    // Expect a score percentage to be visible
    await expect(page.locator('text=/%/').first()).toBeVisible();
    
    // Review mode
    await expect(page.locator('h1')).toContainText('Quiz Complete!');
    await expect(page.locator('h2')).toContainText('Detailed Review');
    
    // Check if explanation is visible
    await expect(page.locator('p:has-text("Explanation")').first()).toBeVisible();
    
    // HOLD the results page for 3 seconds so the video captures it clearly
    await page.waitForTimeout(3000);

    // 9. Return to Home Screen
    await page.getByRole('button', { name: 'Take Another Quiz' }).click();
    await expect(page.locator('h1')).toContainText('QuizMaster');
    await page.waitForTimeout(2000); // Give the video a moment to capture the home screen
  });
});
