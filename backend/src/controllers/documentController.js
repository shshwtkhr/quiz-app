const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { PDFDocument } = require('pdf-lib');
const { GoogleGenAI } = require('@google/genai');
const Question = require('../models/Question');
const Config = require('../models/Config');

let cachedModels = null;
let lastModelFetch = 0;

async function getAvailableModels(ai) {
  if (cachedModels && Date.now() - lastModelFetch < 1000 * 60 * 60) {
    return cachedModels;
  }
  
  try {
    const response = await ai.models.list();
    const models = [];
    for await (const m of response) {
      if (!m.name) continue;
      const name = m.name.replace('models/', '');
      
      // Filter out media, embeddings, and highly specialized models
      if (
        name.includes('embedding') || 
        name.includes('imagen') || 
        name.includes('veo') || 
        name.includes('tts') ||
        name.includes('audio') ||
        name.includes('aqa') ||
        name.includes('research') ||
        name.includes('antigravity') ||
        name.includes('robotics') ||
        name.includes('computer-use')
      ) {
        continue;
      }
      
      // Keep only Gemini/Gemma generative text models
      if (name.includes('gemini') || name.includes('gemma')) {
        models.push(name);
      }
    }
    
    // Sort logic to prefer Flash models which are fast and reliable on free tier
    const getScore = (name) => {
      let score = 0;
      if (name.includes('3.1') || name.includes('3.0') || name.includes('3-pro')) return -100; // Avoid non-free tier models
      if (name.includes('2.5-flash')) score += 100;
      else if (name.includes('2.0-flash')) score += 80;
      else if (name.includes('1.5-flash')) score += 50;
      else if (name.includes('pro')) score += 20;
      
      if (!name.includes('preview') && !name.includes('exp')) score += 10; // Prefer stable
      if (name.includes('lite') || name.includes('8b')) score -= 10;
      return score;
    };
    
    models.sort((a, b) => getScore(b) - getScore(a));
    
    // Filter out models with negative scores
    const filteredModels = models.filter(m => getScore(m) > -50);
    
    if (filteredModels.length > 0) {
      cachedModels = filteredModels;
      lastModelFetch = Date.now();
      return filteredModels;
    }
  } catch (err) {
    console.error("Failed to list models, using hardcoded fallback", err);
  }
  
  // Hardcoded ultimate fallback if API fails
  return ['gemini-2.5-pro', 'gemini-1.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
}

exports.uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Fetch Gemini API key from the database configuration collection
    const apiKeyConfig = await Config.findOne({ key: 'GEMINI_API_KEY' });
    const geminiApiKey = apiKeyConfig ? apiKeyConfig.value : process.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is missing in database configuration.' });
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    const { buffer, originalname, mimetype } = req.file;
    let extractedText = '';

    // Extract text based on file type
    if (mimetype === 'application/pdf' || originalname.endsWith('.pdf')) {
      const render_page = (pageData) => {
        let render_options = { normalizeWhitespace: false, disableCombineTextItems: false };
        return pageData.getTextContent(render_options).then(function(textContent) {
          let lastY, text = '';
          for (let item of textContent.items) {
            let str = item.str;
            if (item.fontName && str.trim().length > 0) {
              let fontLower = item.fontName.toLowerCase();
              if (fontLower.includes('bold')) {
                str = '**' + str + '**';
              } else if (fontLower.includes('italic')) {
                str = '*' + str + '*';
              }
            }
            if (lastY == item.transform[5] || !lastY) {
              text += str;
            } else {
              text += '\n' + str;
            }
            lastY = item.transform[5];
          }
          return text;
        });
      };

      const pdfData = await pdfParse(buffer, { pagerender: render_page });
      extractedText = pdfData.text;
    } else if (
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      originalname.endsWith('.docx')
    ) {
      const result = await mammoth.convertToHtml({ buffer });
      extractedText = result.value;
    } else if (mimetype === 'text/plain' || originalname.endsWith('.txt')) {
      extractedText = buffer.toString('utf8');
    } else {
      return res.status(400).json({ error: 'Unsupported file type. Please upload a PDF, DOCX, or TXT file.' });
    }

    const isPdf = mimetype === 'application/pdf' || originalname.endsWith('.pdf');
    const isImagePdf = isPdf && !extractedText.trim();
    
    if (!extractedText.trim() && !isImagePdf) {
      return res.status(400).json({ error: 'Failed to extract text from the document or document is empty.' });
    }

    // Set headers for streaming response (NDJSON)
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.flushHeaders();
    
    // Keep connection alive
    const keepAlive = setInterval(() => {
      res.write(JSON.stringify({ type: 'ping' }) + '\n');
    }, 15000);

    // 1. Chunk the document
    const chunks = [];
    
    if (isImagePdf) {
      // Split PDF into smaller page-chunks so Gemini output doesn't truncate
      const pdfDoc = await PDFDocument.load(buffer);
      const totalPages = pdfDoc.getPageCount();
      const MAX_PAGES = 5;
      
      for (let i = 0; i < totalPages; i += MAX_PAGES) {
         const subDocument = await PDFDocument.create();
         const end = Math.min(i + MAX_PAGES, totalPages);
         const pages = await subDocument.copyPages(pdfDoc, Array.from({length: end - i}, (_, idx) => i + idx));
         pages.forEach(page => subDocument.addPage(page));
         const pdfBytes = await subDocument.save();
         chunks.push({
           inlineData: {
             data: Buffer.from(pdfBytes).toString("base64"),
             mimeType: "application/pdf"
           }
         });
      }
    } else {
      // Chunk the extracted text
      const maxChunkSize = 15000;
      let currentChunk = '';
      const paragraphs = extractedText.split(/\n\s*\n/);
      
      for (const p of paragraphs) {
        if (currentChunk.length + p.length > maxChunkSize && currentChunk.length > 0) {
          chunks.push(currentChunk);
          currentChunk = '';
        }
        currentChunk += p + '\n\n';
      }
      if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk);
      }
    }

    // 2. Concurrency Limiter Helper
    let totalParsed = 0;
    let allQuestions = [];

    const asyncBatch = async (items, limit, asyncCallback) => {
      let index = 0;
      const workers = Array.from({ length: limit }).map(async () => {
        while (index < items.length) {
          const currentIndex = index++;
          await asyncCallback(items[currentIndex], currentIndex);
        }
      });
      await Promise.all(workers);
    };

    // 3. Process chunks
    const promptBase = `Extract questions from the following text and return them as a JSON array. Each question must include the topic, a subtopic (if you cannot determine a specific subtopic, use "General"), the question text, an array of options (at least two), the correct answer (which must exactly match one of the options), and an explanation. 
CRITICAL: If a question is based on a comprehension passage, a shared context, or is preceded by a block of "Direction", "Directions", or "Instructions" (e.g., "Direction (181-185): ..."), you MUST extract that entire passage or direction block and duplicate it into the "context" field for EVERY SINGLE QUESTION that it applies to. Do not leave the context field empty if a question has an associated direction block above it.
IMPORTANT: Preserve any essential text formatting (such as bolding or italics) in the question text, context, or options by using standard Markdown (e.g., **bold** or *italics*). Do not wrap the final JSON response in markdown code blocks.

Text:
`;
    
    await asyncBatch(chunks, 3, async (chunk) => {
      if (typeof chunk === 'string' && !chunk.trim()) return;
      
      const contentsPayload = chunk.inlineData ? [promptBase, chunk] : promptBase + chunk;
      
      const fallbackModels = await getAvailableModels(ai);
      let chunkSuccess = false;
      let lastError = null;

      for (const modelName of fallbackModels) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: contentsPayload,
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    topic: { type: 'string' },
                    subtopic: { type: 'string' },
                    context: { type: 'string', description: 'The comprehension passage or shared context for the question, if any.' },
                    question_text: { type: 'string' },
                    options: { type: 'array', items: { type: 'string' } },
                    correct_answer: { type: 'string' },
                    explanation: { type: 'string' },
                  },
                  required: ['topic', 'subtopic', 'question_text', 'options', 'correct_answer', 'explanation'],
                },
              },
            },
          });

          const textOutput = response.text;
          const questions = JSON.parse(textOutput);

          if (Array.isArray(questions) && questions.length > 0) {
            const validQuestions = questions.filter(q => {
               const hasOptions = Array.isArray(q.options) && q.options.length >= 2;
               const hasCorrect = hasOptions && q.options.some(opt => opt.trim() === (q.correct_answer || '').trim());
               const isValid = q.topic && q.subtopic && q.question_text && hasOptions && hasCorrect && q.explanation;
               if (!isValid) {
                  console.error("Filtered out invalid question:", q);
               }
               return isValid;
            });
            
            allQuestions.push(...validQuestions);
            totalParsed += validQuestions.length;
            
            // Stream progress event
            res.write(JSON.stringify({ type: 'progress', parsedSoFar: totalParsed }) + '\n');
          }
          
          chunkSuccess = true;
          break; // Success, stop trying fallback models
        } catch (err) {
          lastError = err;
          // If rate limit (429), overloaded (503), or not found (404), try next model
          if (err.status === 429 || err.status === 503 || err.status === 404 || (err.message && (err.message.includes('429') || err.message.includes('503') || err.message.includes('404') || err.message.includes('quota') || err.message.toLowerCase().includes('not found') || err.message.includes('NOT_FOUND')))) {
             console.warn(`Model ${modelName} hit rate limit or is unavailable (Error: ${err.message}), trying next model...`);
             continue;
          }
          
          // Other errors (e.g. malformed JSON, prompt issues) are ignored for this chunk gracefully
          console.error(`Error parsing chunk with ${modelName}:`, err);
          chunkSuccess = true; // Mark as "handled" so we don't throw outer rate limit error
          break;
        }
      }
      
      if (!chunkSuccess && lastError) {
         // All fallback models were exhausted due to rate limits
         throw lastError;
      }
    });

    if (allQuestions.length === 0) {
      clearInterval(keepAlive);
      res.write(JSON.stringify({ type: 'error', error: 'Failed to extract any valid questions from the document.' }) + '\n');
      return res.end();
    }

    clearInterval(keepAlive);
    res.write(JSON.stringify({
      type: 'complete',
      message: 'Document processed successfully',
      questions: allQuestions,
    }) + '\n');
    
    res.end();

  } catch (error) {
    if (typeof keepAlive !== 'undefined') clearInterval(keepAlive);
    if (!res.headersSent) {
      next(error);
    } else {
      console.error('Streaming error:', error);
      let errorMessage = 'An unexpected error occurred during processing.';
      if (error.status === 429 || error.status === 503 || (error.message && (error.message.includes('429') || error.message.includes('503') || error.message.includes('quota')))) {
         errorMessage = 'AI API Rate limit exceeded or service unavailable. Please try again later.';
      }
      res.write(JSON.stringify({ type: 'error', error: errorMessage }) + '\n');
      res.end();
    }
  }
};
