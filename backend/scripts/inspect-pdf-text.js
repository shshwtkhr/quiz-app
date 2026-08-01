// Dumps what pdf-parse extracts from a PDF, with the same bold/italic
// inference the upload pipeline applies. Use it to see why a PDF parsed badly,
// or to confirm a PDF is image-only (output will be empty).
//
//   node scripts/inspect-pdf-text.js <path-to.pdf>
const fs = require('fs');
const pdf = require('pdf-parse');

function render_page(pageData) {
    let render_options = {
        normalizeWhitespace: false,
        disableCombineTextItems: false
    }

    return pageData.getTextContent(render_options)
        .then(function(textContent) {
            let lastY, text = '';
            for (let item of textContent.items) {
                if (lastY == item.transform[5] || !lastY) {
                    // same line
                    // check if fontName contains 'Bold'
                    let isBold = item.fontName && item.fontName.toLowerCase().includes('bold');
                    let isItalic = item.fontName && item.fontName.toLowerCase().includes('italic');
                    
                    let str = item.str;
                    if (isBold) str = '**' + str + '**';
                    else if (isItalic) str = '*' + str + '*';
                    
                    text += str;
                } else {
                    let isBold = item.fontName && item.fontName.toLowerCase().includes('bold');
                    let isItalic = item.fontName && item.fontName.toLowerCase().includes('italic');
                    
                    let str = item.str;
                    if (isBold) str = '**' + str + '**';
                    else if (isItalic) str = '*' + str + '*';
                    
                    text += '\n' + str;
                }
                lastY = item.transform[5];
            }
            return text;
        });
}

const target = process.argv[2];
if (!target) {
    console.error('Usage: node scripts/inspect-pdf-text.js <path-to.pdf>');
    process.exit(1);
}
if (!fs.existsSync(target)) {
    console.error(`No such file: ${target}`);
    process.exit(1);
}

const dataBuffer = fs.readFileSync(target);

pdf(dataBuffer, { pagerender: render_page }).then(function(data) {
    console.log(data.text);
}).catch(console.error);
