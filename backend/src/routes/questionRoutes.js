const express = require('express');
const multer = require('multer');
const router = express.Router();
const {
  uploadQuestions,
  getTopics,
  generateQuiz,
} = require('../controllers/questionController');
const { uploadDocument } = require('../controllers/documentController');

const upload = multer({ storage: multer.memoryStorage() });

// POST /api/upload-questions - Bulk upload/upsert questions
router.post('/upload-questions', uploadQuestions);

// POST /api/upload-document - Upload document to parse and upsert questions
router.post('/upload-document', upload.single('file'), uploadDocument);

// GET /api/topics - Get all unique topics with counts
router.get('/topics', getTopics);

// POST /api/generate-quiz - Generate a randomized quiz
router.post('/generate-quiz', generateQuiz);

module.exports = router;
