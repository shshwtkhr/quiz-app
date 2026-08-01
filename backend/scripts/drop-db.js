// Drops the entire local quiz-app database. Development convenience only.
//
// The URI is hardcoded to localhost on purpose: reading MONGODB_URI would mean
// a production .env in the environment points this at production.
const mongoose = require('mongoose');
mongoose.connect('mongodb://127.0.0.1:27017/quiz-app')
  .then(() => mongoose.connection.db.dropDatabase())
  .then(() => {
    console.log('Database dropped');
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
