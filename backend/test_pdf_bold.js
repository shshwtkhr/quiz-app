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

let dataBuffer = fs.readFileSync('e:\\Projects\\quiz-app\\e2e-test\\sample.pdf');

pdf(dataBuffer, { pagerender: render_page }).then(function(data) {
    console.log(data.text);
}).catch(console.error);
