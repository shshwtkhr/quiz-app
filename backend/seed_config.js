require('dotenv').config();
const mongoose = require('mongoose');
const Config = require('./src/models/Config');

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
