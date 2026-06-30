const puppeteer = require('puppeteer');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const { Document, Packer, Paragraph, TextRun } = require('docx');

async function generateFiles() {
    console.log("Generating test files (PDF, DOCX, TXT) with 20 questions each...");
    const dir = path.join(__dirname, 'test-files');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);

    let textContent = "";
    for (let i = 1; i <= 20; i++) {
        textContent += `Topic: Rigorous Testing\n`;
        textContent += `Subtopic: Format ${i <= 7 ? 'PDF' : i <= 14 ? 'DOCX' : 'TXT'}\n`;
        textContent += `Question ${i}: This is test question number ${i} for volume testing. What is the correct answer?\n`;
        textContent += `A) Option A for Q${i}\n`;
        textContent += `B) Option B for Q${i}\n`;
        textContent += `C) Option C for Q${i}\n`;
        textContent += `D) Option D for Q${i}\n`;
        textContent += `Correct Answer: Option B for Q${i}\n`;
        textContent += `Explanation: Because B is always a good guess for question ${i}.\n\n`;
    }

    // 1. Generate TXT
    const txtPath = path.join(dir, 'volume-test.txt');
    fs.writeFileSync(txtPath, textContent);
    console.log(`Created ${txtPath}`);

    // 2. Generate PDF
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    let page = pdfDoc.addPage();
    let y = 800;
    const lines = textContent.split('\n');
    for (const line of lines) {
        if (y < 50) {
            page = pdfDoc.addPage();
            y = 800;
        }
        page.drawText(line, { x: 50, y, size: 10, font, color: rgb(0, 0, 0) });
        y -= 14;
    }
    const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
    const pdfPath = path.join(dir, 'volume-test.pdf');
    fs.writeFileSync(pdfPath, pdfBytes);
    console.log(`Created ${pdfPath}`);

    // 3. Generate DOCX
    const docChildren = lines.map(line => new Paragraph({
        children: [new TextRun(line)]
    }));
    const doc = new Document({
        sections: [{ properties: {}, children: docChildren }]
    });
    const docxBuffer = await Packer.toBuffer(doc);
    const docxPath = path.join(dir, 'volume-test.docx');
    fs.writeFileSync(docxPath, docxBuffer);
    console.log(`Created ${docxPath}`);

    return { txtPath, pdfPath, docxPath };
}

async function slowClick(page, element) {
    const box = await element.boundingBox();
    if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
        await new Promise(r => setTimeout(r, 200));
        await page.mouse.down();
        await new Promise(r => setTimeout(r, 100));
        await page.mouse.up();
    } else {
        await element.click();
    }
}

async function uploadFileAndSave(page, filePath) {
    console.log(`\n--- Testing Upload for ${path.basename(filePath)} ---`);
    
    // Click "Upload Document" button
    const buttons = await page.$$('button');
    let uploadBtn = null;
    for (const b of buttons) {
        const text = await page.evaluate(el => el.textContent, b);
        if (text && text.includes('Upload Document')) {
            uploadBtn = b;
            break;
        }
    }
    if (!uploadBtn) throw new Error("Upload Document button not found");
    
    await slowClick(page, uploadBtn);
    await new Promise(r => setTimeout(r, 1000));
    
    // Find file input and upload
    const fileInput = await page.$('input[type="file"]');
    await fileInput.uploadFile(filePath);
    
    // Click "Upload" to start backend process
    const allUploadBtns = await page.$$('button');
    for (const b of allUploadBtns) {
        const text = await page.evaluate(el => el.textContent, b);
        if (text && text.trim() === 'Upload') {
            await slowClick(page, b);
            break;
        }
    }
    
    console.log(`Uploaded ${path.basename(filePath)}... Waiting for AI processing...`);
    
    // Wait for the "Review & Save" screen
    try {
        await page.waitForFunction(() => {
            const btns = Array.from(document.querySelectorAll('button'));
            return btns.some(b => b.textContent && b.textContent.includes('Save Questions'));
        }, { timeout: 300000 });
        console.log("AI parsing finished. Review screen appeared.");
    } catch (e) {
        console.error("Timeout waiting for AI processing.");
        throw e;
    }
    await new Promise(r => setTimeout(r, 2000));
    
    // Click "Save Questions"
    const allBtns = await page.$$('button');
    let saveBtn = null;
    for (const b of allBtns) {
        const text = await page.evaluate(el => el.textContent, b);
        if (text && text.includes('Save Questions')) {
            saveBtn = b;
            break;
        }
    }
    if (saveBtn) {
        await slowClick(page, saveBtn);
        console.log("Clicked Save Questions.");
        await new Promise(r => setTimeout(r, 3000));
    } else {
        console.log("Save button not found!");
    }
}

(async () => {
    try {
        const { txtPath, pdfPath, docxPath } = await generateFiles();
        
        console.log("Launching Puppeteer...");
        const browser = await puppeteer.launch({
            headless: true, // Use headless for automated rigorous testing
            protocolTimeout: 300000,
            args: ['--window-size=1280,800']
        });
        const page = await browser.newPage();
        
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        page.on('pageerror', err => console.error('PAGE ERROR:', err));

        await page.setViewport({ width: 1280, height: 800 });
        
        await page.goto('http://localhost:3000', { waitUntil: 'networkidle2' });
        console.log("Navigated to app");
        await new Promise(r => setTimeout(r, 2000));
        
        // 1. Upload TXT
        await uploadFileAndSave(page, txtPath);
        
        // 2. Upload PDF
        await uploadFileAndSave(page, pdfPath);
        
        // 3. Upload DOCX
        await uploadFileAndSave(page, docxPath);
        
        console.log("\nAll rigorous volume testing completed successfully!");
        
        await browser.close();
    } catch (error) {
        console.error("Test failed:", error);
        process.exit(1);
    }
})();
