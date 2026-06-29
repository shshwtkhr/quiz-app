const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { GoogleGenAI } = require('@google/genai');
const Question = require('../models/Question');
const Config = require('../models/Config');


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
      const pdfData = await pdfParse(buffer);
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

    if (!extractedText.trim()) {
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

    // 1. Chunk the text
    const maxChunkSize = 15000;
    const chunks = [];
    let currentChunk = '';
    // Split by paragraphs to avoid cutting mid-sentence
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
    const promptBase = `Extract questions from the following text and return them as a JSON array. Each question must include the topic, a subtopic (if you cannot determine a specific subtopic, use "General"), the question text, an array of options (at least two), the correct answer (which must exactly match one of the options), and an explanation. Do not include any markdown formatting or extra text.\n\nText:\n`;
    
    await asyncBatch(chunks, 3, async (chunkText) => {
      if (!chunkText.trim()) return;
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: promptBase + chunkText,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  topic: { type: 'string' },
                  subtopic: { type: 'string' },
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
      } catch (err) {
        console.error('Error parsing chunk:', err);
        // We gracefully ignore the chunk failure to salvage the rest of the document
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
      res.write(JSON.stringify({ type: 'error', error: 'An unexpected error occurred during processing.' }) + '\n');
      res.end();
    }
  }
};
