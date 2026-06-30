const Question = require('../models/Question');

/**
 * POST /api/upload-questions
 * Accepts a JSON array of question objects and performs bulk upsert.
 * Matches on { topic, question_text } for deduplication.
 */
exports.uploadQuestions = async (req, res, next) => {
  try {
    const questions = req.body;

    // Validate input is a non-empty array
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        error: 'Request body must be a non-empty array of question objects',
      });
    }

    // Validate each question has required fields
    const requiredFields = ['topic', 'question_text', 'options', 'correct_answer', 'explanation'];
    for (let i = 0; i < questions.length; i++) {
      for (const field of requiredFields) {
        if (!questions[i][field]) {
          return res.status(400).json({
            error: `Question at index ${i} is missing required field: ${field}`,
          });
        }
      }
      if (!Array.isArray(questions[i].options) || questions[i].options.length < 2) {
        return res.status(400).json({
          error: `Question at index ${i} must have at least 2 options`,
        });
      }
    }

    // Build bulkWrite operations for upsert (deduplication by topic, subtopic + question_text)
    const operations = questions.map((q) => ({
      updateOne: {
        filter: { topic: q.topic, subtopic: q.subtopic || 'General', question_text: q.question_text },
        update: { $set: q },
        upsert: true,
      },
    }));

    const result = await Question.bulkWrite(operations);

    res.status(201).json({
      message: 'Questions uploaded successfully',
      upsertedCount: result.upsertedCount,
      modifiedCount: result.modifiedCount,
      totalProcessed: questions.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/topics
 * Returns all unique topics with their question counts.
 */
exports.getTopics = async (req, res, next) => {
  try {
    const topics = await Question.aggregate([
      { 
        $group: { 
          _id: { topic: '$topic', subtopic: '$subtopic' }, 
          count: { $sum: 1 } 
        } 
      },
      {
        $group: {
          _id: '$_id.topic',
          count: { $sum: '$count' },
          subtopics: {
            $push: {
              name: '$_id.subtopic',
              count: '$count'
            }
          }
        }
      },
      { $sort: { _id: 1 } },
    ]);

    res.json(topics);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/generate-quiz
 * Accepts { topics: [{ topic: string, count: number }] }
 * Returns randomized questions (without answers) and a separate answer key.
 */
exports.generateQuiz = async (req, res, next) => {
  try {
    const { topics } = req.body;

    // Validate input
    if (!Array.isArray(topics) || topics.length === 0) {
      return res.status(400).json({
        error: 'Request body must include a non-empty "topics" array',
      });
    }

    for (const t of topics) {
      if (!t.topic || typeof t.count !== 'number' || t.count < 1) {
        return res.status(400).json({
          error: 'Each topic entry must have a "topic" (string) and "count" (number >= 1)',
        });
      }
    }

    // For each topic, fetch random questions using $sample
    const questionsByTopic = await Promise.all(
      topics.map(({ topic, count }) =>
        Question.aggregate([
          { $match: { topic } },
          { $sample: { size: count } },
        ])
      )
    );

    // Flatten all questions
    const allQuestions = questionsByTopic.flat();

    // Shuffle the combined array (Fisher-Yates)
    for (let i = allQuestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
    }

    // Build answer key (keyed by question _id)
    const answerKey = {};
    allQuestions.forEach((q) => {
      answerKey[q._id.toString()] = {
        correct_answer: q.correct_answer,
        explanation: q.explanation,
      };
    });

    // Strip sensitive fields from questions sent to the client
    const sanitizedQuestions = allQuestions.map(({ correct_answer, explanation, ...rest }) => rest);

    console.log(`Generated quiz with ${sanitizedQuestions.length} questions for topics:`, topics);

    res.json({
      questions: sanitizedQuestions,
      answerKey,
      totalQuestions: sanitizedQuestions.length,
    });
  } catch (error) {
    next(error);
  }
};
