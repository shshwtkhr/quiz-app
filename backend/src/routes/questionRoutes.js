const express = require('express');
const router = express.Router();
const {
  uploadQuestions,
  getTopics,
  generateQuiz,
} = require('../controllers/questionController');

// POST /api/upload-questions - Bulk upload/upsert questions
router.post('/upload-questions', uploadQuestions);

// GET /api/topics - Get all unique topics with counts
router.get('/topics', getTopics);

// POST /api/generate-quiz - Generate a randomized quiz
router.post('/generate-quiz', generateQuiz);

module.exports = router;
