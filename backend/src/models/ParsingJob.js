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
    chunksMeta: {
      type: Array,
      default: [],
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
