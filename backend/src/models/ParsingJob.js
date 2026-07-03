const mongoose = require('mongoose');

const parsingJobSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    progress: {
      type: Number,
      default: 0,
    },
    totalChunks: {
      type: Number,
      default: 0,
    },
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
