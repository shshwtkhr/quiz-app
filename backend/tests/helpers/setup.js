const { connect, clearDatabase, closeDatabase } = require('./db');

jest.setTimeout(240000); // 240s timeout for mongodb-memory-server binary download

// The parsing pipeline pauses between chunks to stay clear of API rate limits.
// There is no real API here, so drop it — otherwise every upload test pays 2s
// per chunk in wall-clock time. Must be set before src/ is required.
process.env.PARSING_CHUNK_DELAY_MS = '0';

beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  // Let any fire-and-forget parsing worker finish before the data disappears
  // underneath it — otherwise it fails mid-write and the rejection surfaces as
  // an unrelated suite failing to run.
  const { drainBackgroundJobs } = require('../../src/controllers/documentController');
  await drainBackgroundJobs();
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
});
