const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { PDFDocument } = require('pdf-lib');
const { GoogleGenAI } = require('@google/genai');
const Config = require('../models/Config');
const ParsingJob = require('../models/ParsingJob');
const {
  FALLBACK_MODELS,
  rankModels,
  buildLineDictionary,
  stripPageMarkers,
  chunkIndexedLines,
  reassembleQuestion,
  isValidFlatQuestion,
  dedupeByQuestionText,
} = require('../services/documentParsing');

let cachedModels = null;
let lastModelFetch = 0;
// Global tracker for rate-limited models: modelName -> timeout expiry timestamp
const globalRateLimits = new Map();

// Courtesy pause between chunks so we don't walk straight into a rate limit.
// Configurable so tests can run the pipeline without the wall-clock cost.
const CHUNK_DELAY_MS = Number(process.env.PARSING_CHUNK_DELAY_MS ?? 2000);

// In-flight background workers. uploadDocument answers 202 and keeps working,
// so without a handle on those promises there is no way to know when the work
// has actually stopped — which tests need before tearing the database down.
const backgroundJobs = new Set();

/** Wait for every in-flight background parsing worker to settle. */
function drainBackgroundJobs() {
  return Promise.allSettled([...backgroundJobs]);
}

/**
 * Thrown when the background worker notices the job has already reached a
 * terminal state (typically 'cancelled' via POST /api/jobs/:jobId/cancel).
 * It is a control-flow signal, not an error: the status on record is
 * authoritative and must not be overwritten with 'failed'.
 */
class JobCancelledError extends Error {
  constructor(status) {
    super(`Job is no longer processing (status: ${status})`);
    this.name = 'JobCancelledError';
    this.jobStatus = status;
  }
}

async function getAvailableModels(ai) {
  if (cachedModels && Date.now() - lastModelFetch < 1000 * 60 * 60) {
    return cachedModels;
  }
  
  try {
    const response = await ai.models.list();
    const names = [];
    for await (const m of response) {
      if (!m.name) continue;
      names.push(m.name.replace('models/', ''));
    }

    // Ranked best-first; the order doubles as the fallback order.
    const filteredModels = rankModels(names);

    if (filteredModels.length > 0) {
      cachedModels = filteredModels; // Use all available models for fallback
      lastModelFetch = Date.now();
      return cachedModels;
    }
  } catch (err) {
    console.error("Failed to list models, using hardcoded fallback", err);
  }

  return FALLBACK_MODELS;
}

/** Test seam: drop the 1-hour model cache so suites don't leak state. */
function resetModelCache() {
  cachedModels = null;
  lastModelFetch = 0;
  globalRateLimits.clear();
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
    const textWithoutMarkers = stripPageMarkers(extractedText);
    const isImagePdf = isPdf && textWithoutMarkers.length === 0;
    
    if (textWithoutMarkers.length === 0 && !isImagePdf) {
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
      const indexed = buildLineDictionary(extractedText);
      dictionary = indexed.dictionary;
      chunks.push(...chunkIndexedLines(indexed.textLinesWithIndex, dictionary));
    }

    const chunksMeta = chunks.map((c, idx) => ({
      chunkIndex: idx,
      pageRange: c.pageRange || null,
      status: 'pending',
      message: 'Waiting to start',
      attempt: 0,
      currentModel: null
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
    const backgroundTask = (async () => {
      let totalParsed = 0;
      let resultsByChunk = new Array(chunks.length);

      /**
       * Write the job's terminal state, but only while it is still running.
       * If the user cancelled in the meantime the update matches nothing and
       * the 'cancelled' status survives.
       */
      const finishJob = (update) =>
        ParsingJob.findOneAndUpdate({ _id: job._id, status: 'processing' }, update);

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
          if (currentJobCheck && currentJobCheck.status !== 'processing') {
             throw new JobCancelledError(currentJobCheck.status);
          }

          if (!chunk) return;
          const textContent = typeof chunk === 'string' ? chunk : (chunk.text || '');
          if (!chunk.inlineData && !textContent.trim()) return;
          
          await ParsingJob.updateOne(
            { _id: job._id, 'chunksMeta.chunkIndex': currentIndex },
            { $set: { 'chunksMeta.$.status': 'processing', 'chunksMeta.$.message': 'Starting...' } }
          );
          
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
          let abortAllModels = false;

          for (const modelName of fallbackModels) {
            if (abortAllModels) break;
            
            // If this model is currently in a global timeout, skip it immediately!
            const rateLimitExpiry = globalRateLimits.get(modelName);
            if (rateLimitExpiry && Date.now() < rateLimitExpiry) {
               console.log(`Skipping model ${modelName} because it is globally rate limited until ${new Date(rateLimitExpiry).toLocaleTimeString()}`);
               continue;
            }
            
            let retries = 0;
            const maxRetries = 2; // Reduced to fail faster on API quota limits
            let modelSuccess = false;

            while (retries <= maxRetries && !modelSuccess) {
              try {
                await ParsingJob.updateOne(
                  { _id: job._id, 'chunksMeta.chunkIndex': currentIndex },
                  { $set: { 'chunksMeta.$.currentModel': modelName, 'chunksMeta.$.attempt': retries + 1, 'chunksMeta.$.message': `Requesting AI (Attempt ${retries + 1})...` } }
                );

                const response = await ai.models.generateContent({
                  model: modelName,
                  contents: contentsPayload,
                  config: {
                    responseMimeType: 'application/json',
                    responseSchema: currentSchema,
                  },
                });

                await ParsingJob.updateOne(
                  { _id: job._id, 'chunksMeta.chunkIndex': currentIndex },
                  { $set: { 'chunksMeta.$.message': `Parsing response...` } }
                );

                const textOutput = response.text;
                console.log('--- RAW GEMINI OUTPUT ---');
                console.log(textOutput);
                console.log('-------------------------');
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
                  console.log('DEBUG: Extracted questions:', JSON.stringify(questions, null, 2));
                  let validQuestions = [];
                  
                  if (chunk.inlineData) {
                    validQuestions = questions.filter(isValidFlatQuestion);
                  } else {
                    for (const q of questions) {
                      try {
                         const reassembled = reassembleQuestion(q, dictionary);
                         if (reassembled) validQuestions.push(reassembled);
                      } catch (e) {
                         console.error("Error mapping indexed question:", e);
                      }
                    }
                  }
                  
                  resultsByChunk[currentIndex] = validQuestions;
                  totalParsed += validQuestions.length;
                  
                  // Update Job Progress
                  await ParsingJob.findByIdAndUpdate(job._id, { progress: totalParsed });
                  
                  await ParsingJob.updateOne(
                    { _id: job._id, 'chunksMeta.chunkIndex': currentIndex },
                    { 
                      $set: { 'chunksMeta.$.status': 'completed', 'chunksMeta.$.message': `Success: Found ${validQuestions.length} questions` },
                      $push: { 'chunksMeta.$.attemptsHistory': { model: modelName, attemptNumber: retries + 1, status: 'completed', message: `Success: Found ${validQuestions.length} questions` } }
                    }
                  );
                } else {
                  await ParsingJob.updateOne(
                    { _id: job._id, 'chunksMeta.chunkIndex': currentIndex },
                    { 
                      $set: { 'chunksMeta.$.status': 'completed', 'chunksMeta.$.message': `Success: No questions found` },
                      $push: { 'chunksMeta.$.attemptsHistory': { model: modelName, attemptNumber: retries + 1, status: 'completed', message: `Success: No questions found` } }
                    }
                  );
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
                         const waitTime = Math.pow(2, retries) * 1000; // Exponential backoff: 2s, 4s
                         console.warn(`Model ${modelName} rate limited (429). Retrying in ${waitTime}ms... (Attempt ${retries}/${maxRetries})`);
                         
                         await ParsingJob.updateOne(
                           { _id: job._id, 'chunksMeta.chunkIndex': currentIndex },
                           { 
                             $set: { 'chunksMeta.$.status': 'rate_limited', 'chunksMeta.$.message': `Rate limited, retrying in ${waitTime/1000}s...` },
                             $push: { 'chunksMeta.$.attemptsHistory': { model: modelName, attemptNumber: retries, status: 'rate_limited', message: `Rate limited, retrying in ${waitTime/1000}s...` } }
                           }
                         );
                         
                         await new Promise(r => setTimeout(r, waitTime));
                         continue;
                      }
                   }
                   
                   // After exhausting retries (or if it's a 503/Quota), put this specific model in a 1-minute global timeout
                   const timeoutMinutes = 1;
                   globalRateLimits.set(modelName, Date.now() + (timeoutMinutes * 60 * 1000));
                   console.warn(`Model ${modelName} hit rate limit/unavailable and max retries exhausted. Placed in global timeout for ${timeoutMinutes} minute(s).`);
                   
                   await ParsingJob.updateOne(
                     { _id: job._id, 'chunksMeta.chunkIndex': currentIndex },
                     { $push: { 'chunksMeta.$.attemptsHistory': { model: modelName, attemptNumber: retries + 1, status: 'failed', message: `Rate limit/quota exhausted.` } } }
                   );
                   
                   // DO NOT abortAllModels. We want to fallback to the next model!
                   break; // break the retry loop, but continue to the next model in the fallback array
                }
                console.error(`Error parsing chunk with ${modelName}:`, err);
                
                await ParsingJob.updateOne(
                  { _id: job._id, 'chunksMeta.chunkIndex': currentIndex },
                  { $push: { 'chunksMeta.$.attemptsHistory': { model: modelName, attemptNumber: retries + 1, status: 'failed', message: err.message || 'Unknown error' } } }
                );
                
                // If it's a bad response/JSON parse error, we SHOULD fallback to the next model.
                // We do NOT set abortAllModels = true here.
                break; // break retry loop, move to next model
              }
            } // end while retries
            
            if (chunkSuccess) {
              // Add a small delay between chunks to respect rate limits
              if (CHUNK_DELAY_MS > 0) await new Promise(r => setTimeout(r, CHUNK_DELAY_MS));
              break; // break model loop
            }
          } // end for models
          
          if (!chunkSuccess && lastError) {
             await ParsingJob.updateOne(
               { _id: job._id, 'chunksMeta.chunkIndex': currentIndex },
               { $set: { 'chunksMeta.$.status': 'failed', 'chunksMeta.$.message': `Failed: ${lastError.message || 'Unknown error'}` } }
             );
             throw lastError;
          }
        });

        // Deduplicate questions the chunk overlap saw twice
        const allQuestions = dedupeByQuestionText(resultsByChunk.flat().filter(Boolean));

        if (allQuestions.length === 0) {
          await finishJob({ status: 'failed', error: 'Failed to extract any valid questions from the document.' });
          return;
        }

        await finishJob({
          status: 'completed',
          parsedQuestions: allQuestions
        });

      } catch (error) {
        // A cancelled (or otherwise already-terminal) job is not a failure —
        // the status on record is authoritative, so leave it alone.
        if (error instanceof JobCancelledError) {
          console.log(`Background job ${job._id} stopped early: ${error.message}`);
          return;
        }

        console.error('Background job error:', error);
        let errorMessage = 'An unexpected error occurred during processing.';
        if (error.status === 429 || error.status === 503 || (error.message && (error.message.includes('429') || error.message.includes('503') || error.message.includes('quota')))) {
           errorMessage = 'AI API Rate limit exceeded or service unavailable. Please try again later.';
        }
        await finishJob({ status: 'failed', error: errorMessage });
      }
    })();

    backgroundJobs.add(backgroundTask);
    backgroundTask.finally(() => backgroundJobs.delete(backgroundTask));

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

    // Conditional update rather than read-modify-write, so a job that reaches a
    // terminal state between the read and the write is not silently re-opened.
    const job = await ParsingJob.findOneAndUpdate(
      { _id: jobId, status: { $in: ['pending', 'processing'] } },
      { status: 'cancelled', error: 'Cancelled by user' },
      { new: true }
    );

    if (!job) {
      const exists = await ParsingJob.exists({ _id: jobId });
      if (!exists) {
        return res.status(404).json({ error: 'Job not found' });
      }
      return res.status(400).json({ error: 'Only active jobs can be cancelled' });
    }

    res.json({ message: 'Job cancelled successfully', job });
  } catch (error) {
    next(error);
  }
};

// Exported for tests: the model list and rate-limit map are module-level caches
// that would otherwise leak between suites, and background workers outlive the
// request that started them.
exports.resetModelCache = resetModelCache;
exports.drainBackgroundJobs = drainBackgroundJobs;
exports.JobCancelledError = JobCancelledError;
