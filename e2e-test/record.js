const puppeteer = require('puppeteer');
const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  
  const recorder = new PuppeteerScreenRecorder(page, {
    fps: 30,
    videoFrame: { width: 1280, height: 720 },
    aspectRatio: '16:9',
  });
  
  const savePath = 'C:\\Users\\shshw\\.gemini\\antigravity\\brain\\748df810-c6af-407e-9e65-3e2754791fd2\\quiz_app_demo.mp4';
  
  await recorder.start(savePath);
  
  async function slowClick(p, btn) {
    await btn.hover();
    await new Promise(r => setTimeout(r, 150));
    
    // Explicitly create ripple exactly on the element
    await p.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      
      if (!document.getElementById('puppeteer-ripple-style')) {
          const style = document.createElement('style');
          style.id = 'puppeteer-ripple-style';
          style.innerHTML = `
            .puppeteer-click-ripple {
              position: fixed;
              border-radius: 50%;
              border: 4px solid rgba(255, 50, 50, 0.9);
              background: rgba(255, 50, 50, 0.4);
              width: 60px;
              height: 60px;
              transform: translate(-50%, -50%) scale(0);
              pointer-events: none;
              z-index: 9999999 !important;
              animation: puppeteer-ripple-anim 0.6s ease-out forwards;
            }
            @keyframes puppeteer-ripple-anim {
              0% { transform: translate(-50%, -50%) scale(0.3); opacity: 0.8; }
              100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
            }
          `;
          document.head.appendChild(style);
      }
      
      const ripple = document.createElement('div');
      ripple.className = 'puppeteer-click-ripple';
      ripple.style.left = x + 'px';
      ripple.style.top = y + 'px';
      document.documentElement.appendChild(ripple);
      setTimeout(() => ripple.remove(), 600);
    }, btn);
    
    // Wait for animation to play out
    await new Promise(r => setTimeout(r, 400)); 
    
    // Perform the actual click
    await btn.click();
  }
  
  try {
    // Navigate to the app and ensure Next.js dev server has compiled the CSS
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 60000 });
    console.log('Navigated to app');
    
    // Wait for the h1 to ensure it's rendered
    await page.waitForSelector('h1');
    
    // In dev mode, CSS can take a moment to apply. Let's wait a few seconds to let Tailwind compile.
    await new Promise(r => setTimeout(r, 5000));
    
    // Reload to ensure CSS is fully applied and cached
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));

    // ==== FILE UPLOAD FLOW ====
    console.log('Testing File Upload Flow...');
    const buttons = await page.$$('button');
    let uploadBtn = null;
    for (const b of buttons) {
      const text = await page.evaluate(el => el.textContent, b);
      if (text && text.includes('Upload Document')) {
        uploadBtn = b;
        break;
      }
    }
    
    if (uploadBtn) {
      await slowClick(page, uploadBtn);
      await new Promise(r => setTimeout(r, 1000));
      
      const fileInput = await page.$('input[type="file"]');
      if (fileInput) {
        const fs = require('fs');
        const testFilePath = __dirname + '/test_upload.txt';
        fs.writeFileSync(testFilePath, "Sample topic: Automation\\nWhat is Puppeteer?\\nOptions: Browser automation tool, Video game, Text editor, Music player\\nCorrect Answer: Browser automation tool\\nExplanation: Puppeteer provides a high-level API to control Chrome.");
        
        await fileInput.uploadFile(testFilePath);
        await new Promise(r => setTimeout(r, 1000));
        
        // Find "Upload" button inside modal
        const modalBtns = await page.$$('button');
        for (const b of modalBtns) {
          const text = await page.evaluate(el => el.textContent, b);
          // Looking for exact "Upload" button, avoiding "Upload Document" title
          if (text && text.trim() === 'Upload') {
             await slowClick(page, b);
             break;
          }
        }
        
        // Wait for upload success and modal to close
        // We can wait for the modal container to disappear
        console.log("Waiting for AI parsing to finish and Review screen to appear...");
        try {
            await page.waitForFunction(() => {
                return Array.from(document.querySelectorAll('h3')).some(h => h.textContent === 'Review Topics');
            }, { timeout: 30000 });
        } catch(e) {
            console.log("Review screen didn't appear in time.");
        }

        console.log("Modifying a topic...");
        await new Promise(r => setTimeout(r, 1000));
        
        const inputs = await page.$$('input[type="text"]');
        if (inputs.length > 0) {
           await inputs[0].click({ clickCount: 3 });
           await inputs[0].type('Automation');
           await new Promise(r => setTimeout(r, 500));
        }

        console.log("Saving questions...");
        const saveBtns = await page.$$('button');
        let saveBtn = null;
        for (const b of saveBtns) {
          const text = await page.evaluate(el => el.textContent, b);
          if (text && text.trim() === 'Save Questions') {
             saveBtn = b;
             break;
          }
        }
        if (saveBtn) {
            await slowClick(page, saveBtn);
        }

        // NOW wait for modal to close
        try {
            await page.waitForFunction(() => {
                // The modal has an h2 with "Upload Document"
                return !Array.from(document.querySelectorAll('h2')).some(h => h.textContent === 'Upload Document');
            }, { timeout: 10000 });
        } catch(e) {
            console.log("Modal didn't close after saving.");
        }
        
        // Wait for the new topic "Automation" to appear in the topics list to avoid stale elements
        try {
            await page.waitForFunction(() => {
                return Array.from(document.querySelectorAll('button.glass-card')).some(b => b.textContent.includes('Automation'));
            }, { timeout: 10000 });
        } catch(e) {
            console.log("New topic 'Automation' did not appear.");
        }
        await new Promise(r => setTimeout(r, 1000));
        await new Promise(r => setTimeout(r, 2000)); // allow topics to re-fetch and render
        if(fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);
      }
    }
    // ==== END FILE UPLOAD FLOW ====

    // Wait for topics to load (buttons with glass-card class)
    await page.waitForSelector('.glass-card', { timeout: 10000 });
    
    // Select the first two topics
    const topicsBtns = await page.$$('button.glass-card');
    if (topicsBtns.length > 0) {
      await slowClick(page, topicsBtns[0]);
      await new Promise(r => setTimeout(r, 500));
    }
    if (topicsBtns.length > 1) {
      await slowClick(page, topicsBtns[1]);
      await new Promise(r => setTimeout(r, 500));
    }
    
    // Find the "Start Quiz" button
    const allBtns = await page.$$('button');
    let startBtn = null;
    for (const b of allBtns) {
      const text = await page.evaluate(el => el.textContent, b);
      if (text && text.includes('Start Quiz')) {
        startBtn = b;
        break;
      }
    }
    
    if (startBtn) {
      await slowClick(page, startBtn);
      await new Promise(r => setTimeout(r, 3000));
      
      // We are now in the quiz, loop to answer questions
      let hasNext = true;
      while(hasNext) {
        // Wait for the options container or button
        try {
          await page.waitForSelector('button.group', { timeout: 5000 });
        } catch(e) {
          console.log("No options found, possibly at results screen.");
          break;
        }
        
        const optionBtns = await page.$$('button.group');
        
        if (optionBtns.length > 0) {
           // Click the first option
           await slowClick(page, optionBtns[0]);
           await new Promise(r => setTimeout(r, 1000));
        }
        
        // Find "Next Question" or "Submit Quiz" button
        const anyBtns = await page.$$('button');
        let nextBtn = null;
        let btnText = '';
        for (let btn of anyBtns) {
          const text = await page.evaluate(el => el.textContent, btn);
          if (text && (text.includes('Next') || text.includes('Submit'))) {
            nextBtn = btn;
            btnText = text;
            break;
          }
        }
        
        if (nextBtn) {
           await slowClick(page, nextBtn);
           await new Promise(r => setTimeout(r, 1500));
           if (btnText.includes('Submit')) {
             hasNext = false;
           }
        } else {
           hasNext = false;
        }
      }
      
      // Wait to see the results page and the ring animation
      await new Promise(r => setTimeout(r, 3000));
      
      // Smoothly scroll to the bottom of the page
      await page.evaluate(async () => {
        await new Promise((resolve) => {
          const distance = 50;
          const timer = setInterval(() => {
            window.scrollBy(0, distance);
            
            if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 10) {
              clearInterval(timer);
              resolve(true);
            }
          }, 50);
        });
      });
      
      await new Promise(r => setTimeout(r, 1000));
      
      // Click "Take Another Quiz"
      const resBtns = await page.$$('button');
      for (const btn of resBtns) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text && text.includes('Take Another Quiz')) {
          await slowClick(page, btn);
          break;
        }
      }
      
      // Wait to show the home screen
      await new Promise(r => setTimeout(r, 2000));
    } else {
      console.log('Start Quiz button not found');
    }
    
  } catch(e) {
    console.error('Error during automation:', e);
  }
  
  await recorder.stop();
  await browser.close();
  console.log('Video saved to', savePath);
})();
