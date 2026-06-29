const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    topic: {
      type: String,
      required: [true, 'Topic is required'],
      trim: true,
      index: true,
    },
    question_text: {
      type: String,
      required: [true, 'Question text is required'],
      trim: true,
    },
    options: {
      type: [String],
      required: [true, 'Options are required'],
      validate: {
        validator: (v) => Array.isArray(v) && v.length >= 2,
        message: 'A question must have at least 2 options',
      },
    },
    correct_answer: {
      type: String,
      required: [true, 'Correct answer is required'],
      trim: true,
    },
    explanation: {
      type: String,
      required: [true, 'Explanation is required'],
      trim: true,
    },
  },
  { timestamps: true }
);

// Compound unique index to prevent duplicate questions within a topic
questionSchema.index({ topic: 1, question_text: 1 }, { unique: true });

module.exports = mongoose.model('Question', questionSchema);
