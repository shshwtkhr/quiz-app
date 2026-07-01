require('dotenv').config();
const mongoose = require('mongoose');
const Question = require('./src/models/Question');

async function cleanup() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/quiz-app';
    await mongoose.connect(MONGODB_URI);
    
    // We will use a specific topic name for E2E tests to avoid deleting real data
    const E2E_TOPIC_NAME = 'E2E-TEST-TOPIC-XYZ123';
    
    const result = await Question.deleteMany({ topic: E2E_TOPIC_NAME });
    console.log(`Cleanup complete: Deleted ${result.deletedCount} questions belonging to E2E test topic.`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
}

cleanup();
