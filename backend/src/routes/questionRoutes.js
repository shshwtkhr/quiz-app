const express = require('express');
const multer = require('multer');
const router = express.Router();
const {
  uploadQuestions,
  getTopics,
  getSources,
  generateQuiz,
  getQuestionsByTopic,
  searchQuestions,
  updateQuestion,
  bulkUpdateQuestions,
  deleteQuestions,
} = require('../controllers/questionController');
const { uploadDocument, getJobStatus } = require('../controllers/documentController');

const upload = multer({ storage: multer.memoryStorage() });

// POST /api/upload-questions - Bulk upload/upsert questions
router.post('/upload-questions', uploadQuestions);

// POST /api/upload-document - Upload document to parse and upsert questions
router.post('/upload-document', upload.single('file'), uploadDocument);

// GET /api/jobs/:jobId - Get status of parsing job
router.get('/jobs/:jobId', getJobStatus);

// GET /api/topics - Get all unique topics with counts
router.get('/topics', getTopics);

// GET /api/sources - Get all unique sources
router.get('/sources', getSources);

// POST /api/generate-quiz - Generate a randomized quiz
router.post('/generate-quiz', generateQuiz);

// GET /api/topics/:topic/questions - Get all questions for a specific topic
router.get('/topics/:topic/questions', getQuestionsByTopic);

// GET /api/questions/search - Global search across all questions
router.get('/questions/search', searchQuestions);

// PUT /api/questions/bulk - Bulk update multiple questions
router.put('/questions/bulk', bulkUpdateQuestions);

// PUT /api/questions/:id - Update a question
router.put('/questions/:id', updateQuestion);

// DELETE /api/questions - Delete multiple questions
router.delete('/questions', deleteQuestions);

module.exports = router;
