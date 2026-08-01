const mongoose = require('mongoose');

const parsingJobSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
      default: 'pending',
    },
    fileName: {
      type: String,
      default: 'Unknown Document',
    },
    progress: {
      type: Number,
      default: 0,
    },
    totalChunks: {
      type: Number,
      default: 0,
    },
    chunksMeta: [{
      chunkIndex: Number,
      pageRange: String,
      status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed', 'rate_limited'],
        default: 'pending'
      },
      currentModel: {
        type: String,
        default: null
      },
      attempt: {
        type: Number,
        default: 0
      },
      message: {
        type: String,
        default: 'Waiting to start'
      },
      attemptsHistory: [{
        model: String,
        attemptNumber: Number,
        status: String,
        message: String,
        timestamp: { type: Date, default: Date.now }
      }]
    }],
    parsedQuestions: {
      type: Array,
      default: [],
    },
    error: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ParsingJob', parsingJobSchema);
