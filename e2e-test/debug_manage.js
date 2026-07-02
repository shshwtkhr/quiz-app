const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Listen for console logs
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err));
  
  // Go to manage page
  await page.goto('http://localhost:3000/manage');
  await page.waitForTimeout(2000); // Wait for load
  
  // Take screenshot of empty manage page
  await page.screenshot({ path: 'manage_initial.png' });
  
  // Search
  await page.getByPlaceholder('Search questions, answers, explanations...').fill('awesome framework');
  await page.waitForTimeout(2000);
  
  // Take screenshot of search results
  await page.screenshot({ path: 'manage_search.png' });
  
  // Extract all text on the page
  const text = await page.evaluate(() => document.body.innerText);
  fs.writeFileSync('page_text.txt', text);
  
  await browser.close();
  console.log('Screenshots and text saved.');
})();
