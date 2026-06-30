const puppeteer = require('puppeteer');
const { PuppeteerScreenRecorder } = require('puppeteer-screen-recorder');
const fs = require('fs');
const path = require('path');

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
  
  const savePath = 'C:\\Users\\shshw\\.gemini\\antigravity\\brain\\748df810-c6af-407e-9e65-3e2754791fd2\\comprehension_test.mp4';
  
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
    
    await new Promise(r => setTimeout(r, 400)); 
    await btn.click();
  }
  
  try {
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 60000 });
    console.log('Navigated to app');
    
    await page.waitForSelector('h1');
    await new Promise(r => setTimeout(r, 5000));
    await page.reload({ waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));

    console.log('Testing File Upload Flow for Comprehension Document...');
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
        // Upload the comprehension text file
        const testFilePath = path.join(__dirname, 'test-files', 'comprehension.txt');
        await fileInput.uploadFile(testFilePath);
        await new Promise(r => setTimeout(r, 1000));
        
        const modalBtns = await page.$$('button');
        for (const b of modalBtns) {
          const text = await page.evaluate(el => el.textContent, b);
          if (text && text.trim() === 'Upload') {
             await slowClick(page, b);
             break;
          }
        }
        
        console.log("Waiting for AI parsing to finish and Review screen to appear...");
        try {
            await page.waitForFunction(() => {
                return Array.from(document.querySelectorAll('h3')).some(h => h.textContent === 'Review Topics');
            }, { timeout: 120000 }); // Longer timeout because it's a longer text
        } catch(e) {
            console.log("Review screen didn't appear in time.");
        }

        console.log("Testing drag-to-select and bulk delete...");
        await new Promise(r => setTimeout(r, 2000));
        const checkboxes = await page.$$('input[type="checkbox"]');
        if (checkboxes.length >= 4) {
            const targets = [];
            for (let i = 1; i <= 3; i++) {
                const cbHandle = await checkboxes[i].evaluateHandle(el => el.parentElement);
                const box = await cbHandle.boundingBox();
                if (box) targets.push(box);
            }
            
            if (targets.length === 3) {
                await page.mouse.move(targets[0].x + targets[0].width / 2, targets[0].y + targets[0].height / 2);
                await page.mouse.down();
                await new Promise(r => setTimeout(r, 500)); 
                
                for (let i = 1; i < 3; i++) {
                    await page.mouse.move(targets[i].x + targets[i].width / 2, targets[i].y + targets[i].height / 2, { steps: 10 });
                    await new Promise(r => setTimeout(r, 300));
                }
                
                await new Promise(r => setTimeout(r, 1000)); 
                await page.mouse.up();
                await new Promise(r => setTimeout(r, 1000));
                
                const allBtns = await page.$$('button');
                for (const b of allBtns) {
                    const text = await page.evaluate(el => el.textContent, b);
                    if (text && text.includes('Delete Selected')) {
                        await slowClick(page, b);
                        break;
                    }
                }
                await new Promise(r => setTimeout(r, 1000));
            }
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

        try {
            await page.waitForFunction(() => {
                return !Array.from(document.querySelectorAll('h2')).some(h => h.textContent === 'Upload Document');
            }, { timeout: 10000 });
        } catch(e) {
            console.log("Modal didn't close after saving.");
        }
        
        await new Promise(r => setTimeout(r, 2000)); 
      }
    }

    await page.waitForSelector('.glass-card', { timeout: 10000 });
    
    // Select the topic we just uploaded (probably "Economy" or "Finance" or "Reading Comprehension")
    const topicsBtns = await page.$$('button.glass-card');
    if (topicsBtns.length > 0) {
      await slowClick(page, topicsBtns[0]); // Select first topic
      await new Promise(r => setTimeout(r, 500));
    }
    
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
      
      let hasNext = true;
      while(hasNext) {
        try {
          await page.waitForSelector('button.group', { timeout: 20000 });
        } catch(e) {
          console.log("No options found, possibly at results screen.");
          break;
        }
        
        // Wait an extra second to show off the context block in the video!
        await new Promise(r => setTimeout(r, 1500));

        // Scroll down slightly so the question is more visible if the context is long
        await page.evaluate(() => window.scrollBy(0, 150));
        await new Promise(r => setTimeout(r, 1000));

        const optionBtns = await page.$$('button.group');
        if (optionBtns.length > 0) {
           await slowClick(page, optionBtns[0]);
           await new Promise(r => setTimeout(r, 1000));
        }
        
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
      
      await new Promise(r => setTimeout(r, 3000));
      
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
      
      const resBtns = await page.$$('button');
      for (const btn of resBtns) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text && text.includes('Take Another Quiz')) {
          await slowClick(page, btn);
          break;
        }
      }
      
      await new Promise(r => setTimeout(r, 2000));
    }
    
  } catch(e) {
    console.error('Error during automation:', e);
  }
  
  await recorder.stop();
  await browser.close();
  console.log('Video saved to', savePath);
})();
