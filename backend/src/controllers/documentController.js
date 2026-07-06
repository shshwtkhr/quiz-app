const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { PDFDocument } = require('pdf-lib');
const { GoogleGenAI } = require('@google/genai');
const Config = require('../models/Config');
const ParsingJob = require('../models/ParsingJob');

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
      
      if (name.includes('gemini') || name.includes('gemma')) {
        models.push(name);
      }
    }
    
    const getScore = (name) => {
      let score = 0;
      if (name.includes('3.1') || name.includes('3.0') || name.includes('3-pro')) return -100;
      if (name.includes('2.5-flash')) score += 100;
      else if (name.includes('2.0-flash')) score += 80;
      else if (name.includes('1.5-flash')) score += 50;
      else if (name.includes('pro')) score += 20;
      
      if (!name.includes('preview') && !name.includes('exp')) score += 10;
      if (name.includes('lite') || name.includes('8b')) score -= 10;
      return score;
    };
    
    models.sort((a, b) => getScore(b) - getScore(a));
    const filteredModels = models.filter(m => getScore(m) > -50);
    
    if (filteredModels.length > 0) {
      cachedModels = filteredModels;
      lastModelFetch = Date.now();
      return filteredModels;
    }
  } catch (err) {
    console.error("Failed to list models, using hardcoded fallback", err);
  }
  
  return ['gemini-2.5-pro', 'gemini-1.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
}

exports.uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const apiKeyConfig = await Config.findOne({ key: 'GEMINI_API_KEY' });
    const geminiApiKey = apiKeyConfig ? apiKeyConfig.value : process.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is missing in database configuration.' });
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });

    const { buffer, originalname, mimetype } = req.file;
    let extractedText = '';

    if (mimetype === 'application/pdf' || originalname.endsWith('.pdf')) {
      const render_page = (pageData) => {
        let render_options = { normalizeWhitespace: false, disableCombineTextItems: false };
        return pageData.getTextContent(render_options).then(function(textContent) {
          let lastY, text = `\n___PAGE_START_${pageData.pageIndex + 1}___\n`;
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
      const result = await mammoth.extractRawText({ buffer });
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

    // 1. Chunk the document
    const chunks = [];
    let dictionary = null;
    
    if (isImagePdf) {
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
           pageRange: `${i + 1}-${end}`,
           inlineData: {
             data: Buffer.from(pdfBytes).toString("base64"),
             mimeType: "application/pdf"
           }
         });
      }
    } else {
      dictionary = {};
      let currentLineIndex = 1;
      let currentPage = '1';
      const textLinesWithIndex = [];
      
      const lines = extractedText.split('\n');
      for (const line of lines) {
        // Extract page marker if present
        const pageMatch = line.match(/___PAGE_START_(\d+)___/);
        if (pageMatch) {
          currentPage = pageMatch[1];
          continue;
        }
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        dictionary[currentLineIndex] = { text: trimmed, page: currentPage };
        textLinesWithIndex.push(`[${currentLineIndex}] ${trimmed}`);
        currentLineIndex++;
      }
      
      const maxChunkSize = 250;
      const overlapSize = 50;
      
      for (let i = 0; i < textLinesWithIndex.length; i += (maxChunkSize - overlapSize)) {
        const chunkLines = textLinesWithIndex.slice(i, i + maxChunkSize);
        if (chunkLines.length > 0) {
          chunks.push({ text: chunkLines.join('\n'), isTextIndex: true });
        }
      }
    }

    const chunksMeta = chunks.map((c, idx) => ({
      chunkIndex: idx,
      pageRange: c.pageRange || null
    }));

    // 2. Create ParsingJob
    const job = await ParsingJob.create({
      status: 'processing',
      fileName: originalname,
      totalChunks: chunks.length,
      chunksMeta: chunksMeta,
      progress: 0
    });

    // 3. Return Job ID immediately to frontend
    res.status(202).json({
      message: 'Document uploaded successfully, parsing started in background.',
      jobId: job._id
    });

    // 4. Start Background Process
    (async () => {
      let totalParsed = 0;
      let resultsByChunk = new Array(chunks.length);

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

      const promptBaseOld = `Extract questions from the following text and return them as a JSON array. Each question must include the topic, a subtopic (if you cannot determine a specific subtopic, use "General"), the question text, an array of options (at least two), the correct answer (which must exactly match one of the options), and an explanation. 
CRITICAL: If a question is based on a comprehension passage, a shared context, or is preceded by a block of "Direction", "Directions", or "Instructions" (e.g., "Direction (181-185): ..."), you MUST extract that entire passage or direction block and duplicate it into the "context" field for EVERY SINGLE QUESTION that it applies to. Do not leave the context field empty if a question has an associated direction block above it.
IMPORTANT: Preserve any essential text formatting (such as bolding or italics) in the question text, context, or options by using standard Markdown (e.g., **bold** or *italics*). Do not wrap the final JSON response in markdown code blocks.

Text:
`;

      const promptBaseNew = `Extract questions from the following text and return them as a JSON array. 
The text provided is line-numbered in the format [INDEX] text.
You must act as a semantic router. Instead of outputting the actual text of the question or options, you MUST output the exact integer INDEX of the lines that correspond to them.

CRITICAL RULES:
1. "context_lines": Array of line indexes for the comprehension passage or shared directions. Empty array if none.
2. "question_lines": Array of line indexes for the question text.
3. "options": Array of objects. Each has "lines" (array of indexes for that option) and "is_correct" (boolean).
4. "explanation_lines": Array of line indexes for the explanation.

Text:
`;
      
      try {
        await asyncBatch(chunks, 1, async (chunk, currentIndex) => {
          // Check for cancellation before processing this chunk
          const currentJobCheck = await ParsingJob.findById(job._id).select('status');
          if (currentJobCheck && (currentJobCheck.status === 'cancelled' || currentJobCheck.status === 'failed')) {
             throw new Error('Job was cancelled');
          }

          if (!chunk) return;
          const textContent = typeof chunk === 'string' ? chunk : (chunk.text || '');
          if (!chunk.inlineData && !textContent.trim()) return;
          
          let contentsPayload;
          let currentSchema;
          
          if (chunk.inlineData) {
            contentsPayload = [promptBaseOld, chunk];
            currentSchema = {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  topic: { type: 'string' },
                  subtopic: { type: 'string' },
                  context: { type: 'string' },
                  question_text: { type: 'string' },
                  options: { type: 'array', items: { type: 'string' } },
                  correct_answer: { type: 'string' },
                  explanation: { type: 'string' },
                },
                required: ['topic', 'subtopic', 'question_text', 'options', 'correct_answer', 'explanation'],
              }
            };
          } else {
            contentsPayload = promptBaseNew + textContent;
            currentSchema = {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  topic: { type: 'string' },
                  subtopic: { type: 'string' },
                  context_lines: { type: 'array', items: { type: 'integer' } },
                  question_lines: { type: 'array', items: { type: 'integer' } },
                  options: { 
                    type: 'array', 
                    items: { 
                      type: 'object', 
                      properties: {
                        lines: { type: 'array', items: { type: 'integer' } },
                        is_correct: { type: 'boolean' }
                      },
                      required: ['lines', 'is_correct']
                    } 
                  },
                  explanation_lines: { type: 'array', items: { type: 'integer' } },
                },
                required: ['topic', 'subtopic', 'question_lines', 'options', 'explanation_lines'],
              }
            };
          }
          
          const fallbackModels = await getAvailableModels(ai);
          let chunkSuccess = false;
          let lastError = null;

          for (const modelName of fallbackModels) {
            let retries = 0;
            const maxRetries = 4;
            let modelSuccess = false;

            while (retries <= maxRetries && !modelSuccess) {
              try {
                const response = await ai.models.generateContent({
                model: modelName,
                contents: contentsPayload,
                config: {
                  responseMimeType: 'application/json',
                  responseSchema: currentSchema,
                },
              });

              const textOutput = response.text;
              let questions = [];
              try {
                 const match = textOutput.match(/\[[\s\S]*\]/);
                 if (match) {
                    questions = JSON.parse(match[0]);
                 } else {
                    questions = JSON.parse(textOutput);
                 }
              } catch (parseError) {
                 console.error("Failed to parse JSON for chunk:", textOutput.substring(0, 100) + "...", parseError);
                 throw new Error("Failed to parse JSON response");
              }

              if (Array.isArray(questions) && questions.length > 0) {
                let validQuestions = [];
                
                if (chunk.inlineData) {
                  validQuestions = questions.filter(q => {
                     const hasOptions = Array.isArray(q.options) && q.options.length >= 2;
                     const hasCorrect = hasOptions && q.options.some(opt => opt.trim() === (q.correct_answer || '').trim());
                     return q.topic && q.subtopic && q.question_text && hasOptions && hasCorrect && q.explanation;
                  });
                } else {
                  for (const q of questions) {
                    try {
                       if (!q.question_lines || q.question_lines.length === 0) continue;
                       if (!q.options || q.options.length < 2) continue;
                       
                       const getText = (indexes) => {
                         if (!indexes) return '';
                         return indexes.map(idx => dictionary[idx]?.text || '').filter(Boolean).join('\n');
                       };
                       
                       const allIdxs = [...(q.context_lines || []), ...q.question_lines];
                       q.options.forEach(o => allIdxs.push(...(o.lines || [])));
                       allIdxs.push(...(q.explanation_lines || []));
                       
                       const pages = [...new Set(allIdxs.map(idx => dictionary[idx]?.page).filter(Boolean))];
                       let pageRange = null;
                       if (pages.length === 1) pageRange = pages[0];
                       else if (pages.length > 1) pageRange = `${pages[0]}-${pages[pages.length-1]}`;
                       
                       const correctOpt = q.options.find(o => o.is_correct);
                       if (!correctOpt) continue;
  
                       validQuestions.push({
                         topic: q.topic || 'General',
                         subtopic: q.subtopic || 'General',
                         context: getText(q.context_lines),
                         question_text: getText(q.question_lines),
                         options: q.options.map(o => getText(o.lines)),
                         correct_answer: getText(correctOpt.lines),
                         explanation: getText(q.explanation_lines),
                         pageRange: pageRange
                       });
                    } catch (e) {
                       console.error("Error mapping indexed question:", e);
                    }
                  }
                }
                
                resultsByChunk[currentIndex] = validQuestions;
                totalParsed += validQuestions.length;
                
                // Update Job Progress
                await ParsingJob.findByIdAndUpdate(job._id, { progress: totalParsed });
              }
              
              chunkSuccess = true;
              modelSuccess = true;
              break; 
            } catch (err) {
              lastError = err;
              if (err.status === 429 || err.status === 503 || err.status === 404 || (err.message && (err.message.includes('429') || err.message.includes('503') || err.message.includes('404') || err.message.includes('quota') || err.message.toLowerCase().includes('not found') || err.message.includes('NOT_FOUND')))) {
                 if (err.status === 429 || (err.message && err.message.includes('429'))) {
                    retries++;
                    if (retries <= maxRetries) {
                       const waitTime = Math.pow(2, retries) * 2000; // Exponential backoff: 4s, 8s, 16s, 32s
                       console.warn(`Model ${modelName} rate limited (429). Retrying in ${waitTime}ms... (Attempt ${retries}/${maxRetries})`);
                       await new Promise(r => setTimeout(r, waitTime));
                       continue;
                    }
                 }
                 console.warn(`Model ${modelName} hit rate limit/unavailable and max retries exhausted, trying next model...`);
                 break; // break the retry loop, move to next model
              }
              console.error(`Error parsing chunk with ${modelName}:`, err);
              chunkSuccess = true; // Mark as "processed" so we don't retry a hard fail like a bad prompt
              break; // break retry loop
            }
          } // end while retries
          
          if (chunkSuccess) {
            // Add a small delay between chunks to respect rate limits
            await new Promise(r => setTimeout(r, 2000));
            break; // break model loop
          }
        } // end for models          
          if (!chunkSuccess && lastError) {
             throw lastError;
          }
        });

        let allQuestions = resultsByChunk.flat().filter(Boolean);
        
        // Deduplicate overlapping questions by question_text
        const uniqueMap = new Map();
        for (const q of allQuestions) {
           if (!uniqueMap.has(q.question_text)) {
              uniqueMap.set(q.question_text, q);
           }
        }
        allQuestions = Array.from(uniqueMap.values());

        if (allQuestions.length === 0) {
          await ParsingJob.findByIdAndUpdate(job._id, { status: 'failed', error: 'Failed to extract any valid questions from the document.' });
          return;
        }

        await ParsingJob.findByIdAndUpdate(job._id, {
          status: 'completed',
          parsedQuestions: allQuestions
        });

      } catch (error) {
        console.error('Background job error:', error);
        let errorMessage = 'An unexpected error occurred during processing.';
        if (error.status === 429 || error.status === 503 || (error.message && (error.message.includes('429') || error.message.includes('503') || error.message.includes('quota')))) {
           errorMessage = 'AI API Rate limit exceeded or service unavailable. Please try again later.';
        }
        await ParsingJob.findByIdAndUpdate(job._id, { status: 'failed', error: errorMessage });
      }
    })();

  } catch (error) {
    next(error);
  }
};

exports.getJobStatus = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const job = await ParsingJob.findById(jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);
  } catch (error) {
    next(error);
  }
};

exports.getActiveJobs = async (req, res, next) => {
  try {
    const activeJobs = await ParsingJob.find({
      status: { $in: ['pending', 'processing'] }
    }).sort({ createdAt: -1 });
    
    res.json(activeJobs);
  } catch (error) {
    next(error);
  }
};

exports.cancelJob = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const job = await ParsingJob.findById(jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    if (job.status !== 'pending' && job.status !== 'processing') {
      return res.status(400).json({ error: 'Only active jobs can be cancelled' });
    }

    job.status = 'cancelled';
    job.error = 'Cancelled by user';
    await job.save();

    res.json({ message: 'Job cancelled successfully', job });
  } catch (error) {
    next(error);
  }
};
