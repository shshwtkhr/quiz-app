const { connect, clearDatabase, closeDatabase } = require('./db');

jest.setTimeout(240000); // 240s timeout for mongodb-memory-server binary download

beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clearDatabase();
});

afterAll(async () => {
  await closeDatabase();
});
