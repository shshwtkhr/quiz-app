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

    // Call Gemini
    const prompt = `Extract questions from the following text and return them as a JSON array. Each question must include the topic, question text, an array of options (at least two), the correct answer (which must exactly match one of the options), and an explanation. Do not include any markdown formatting or extra text.\n\nText:\n${extractedText}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              topic: { type: 'string' },
              question_text: { type: 'string' },
              options: { type: 'array', items: { type: 'string' } },
              correct_answer: { type: 'string' },
              explanation: { type: 'string' },
            },
            required: ['topic', 'question_text', 'options', 'correct_answer', 'explanation'],
          },
        },
      },
    });

    const textOutput = response.text;
    let questions;
    try {
      questions = JSON.parse(textOutput);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse Gemini response as JSON.' });
    }

    // Validate the questions
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Gemini did not return a valid array of questions.' });
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.topic || !q.question_text || !q.options || !q.correct_answer || !q.explanation) {
         return res.status(400).json({ error: `Question at index ${i} is missing required fields.` });
      }
      if (!Array.isArray(q.options) || q.options.length < 2) {
        return res.status(400).json({ error: `Question at index ${i} must have at least 2 options.` });
      }
      if (!q.options.includes(q.correct_answer)) {
        return res.status(400).json({ error: `Question at index ${i} has a correct_answer that is not in the options.` });
      }
    }

    // Upsert questions
    const operations = questions.map((q) => ({
      updateOne: {
        filter: { topic: q.topic, question_text: q.question_text },
        update: { $set: q },
        upsert: true,
      },
    }));

    const result = await Question.bulkWrite(operations);

    res.status(201).json({
      message: 'Document processed and questions uploaded successfully',
      extractedQuestions: questions.length,
      upsertedCount: result.upsertedCount,
      modifiedCount: result.modifiedCount,
    });

  } catch (error) {
    next(error);
  }
};
