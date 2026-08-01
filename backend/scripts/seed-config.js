// Seeds GEMINI_API_KEY from backend/.env into the MongoDB Config collection,
// which documentController prefers over the environment variable.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Config = require('../src/models/Config');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  if (process.env.GEMINI_API_KEY) {
    await Config.updateOne(
      { key: 'GEMINI_API_KEY' },
      { $set: { value: process.env.GEMINI_API_KEY } },
      { upsert: true }
    );
    console.log('Successfully seeded GEMINI_API_KEY into Config collection!');
  } else {
    console.log('No GEMINI_API_KEY found in .env to seed.');
  }
  mongoose.disconnect();
});
