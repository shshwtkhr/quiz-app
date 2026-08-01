/**
 * Route-ordering guards.
 *
 * questionRoutes.js is a single flat router, so two pairs of routes are
 * order-dependent: a literal path must be registered before the parameterised
 * one that would otherwise swallow it.
 *
 *   /questions/bulk   before  /questions/:id
 *   /jobs/active      before  /jobs/:jobId
 *
 * Both orderings are correct today, but nothing stopped a careless reorder from
 * silently routing "bulk" and "active" into the :id handlers as ObjectIds. These
 * tests fail loudly if that happens.
 */
const request = require('supertest');
const app = require('../src/app');
const Question = require('../src/models/Question');
const ParsingJob = require('../src/models/ParsingJob');

const sampleQuestion = (overrides = {}) => ({
  topic: 'Physics',
  subtopic: 'Mechanics',
  question_text: 'What is the unit of force?',
  options: ['Newton', 'Joule'],
  correct_answer: 'Newton',
  explanation: 'The SI unit of force is the Newton.',
  ...overrides,
});

describe('PUT /api/questions/bulk is not swallowed by /api/questions/:id', () => {
  it('routes to the bulk handler, not to updateQuestion with id="bulk"', async () => {
    const a = await Question.create(sampleQuestion());
    const b = await Question.create(sampleQuestion({ question_text: 'What is mass?' }));

    const res = await request(app)
      .put('/api/questions/bulk')
      .send({ ids: [a._id, b._id], updateData: { source: '2026 Paper' } });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Questions updated successfully');
    expect(res.body.modifiedCount).toBe(2);

    // If /:id had matched first, "bulk" would have been cast as an ObjectId
    // and nothing would have been updated.
    expect((await Question.findById(a._id)).source).toBe('2026 Paper');
    expect((await Question.findById(b._id)).source).toBe('2026 Paper');
  });

  it('reports bulk-shaped validation errors, proving the bulk handler ran', async () => {
    const res = await request(app).put('/api/questions/bulk').send({ ids: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/array of ids/);
  });

  it('still routes a real ObjectId to the single-question handler', async () => {
    const question = await Question.create(sampleQuestion());

    const res = await request(app)
      .put(`/api/questions/${question._id}`)
      .send({ topic: 'Chemistry' });

    expect(res.status).toBe(200);
    expect(res.body.topic).toBe('Chemistry');
  });
});

describe('GET /api/jobs/active is not swallowed by /api/jobs/:jobId', () => {
  it('routes to getActiveJobs, not to getJobStatus with jobId="active"', async () => {
    await ParsingJob.create({ status: 'processing', fileName: 'a.pdf', totalChunks: 1 });

    const res = await request(app).get('/api/jobs/active');

    // getJobStatus would have tried findById('active'), producing a CastError
    // and a 500 from the global error handler.
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
  });

  it('returns an array even when empty, never a 404 or 500', async () => {
    const res = await request(app).get('/api/jobs/active');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('still routes a real ObjectId to the single-job handler', async () => {
    const job = await ParsingJob.create({ status: 'processing', fileName: 'a.pdf', totalChunks: 1 });

    const res = await request(app).get(`/api/jobs/${job._id}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(false);
    expect(res.body._id).toBe(job._id.toString());
  });
});

describe('GET /api/questions/search is not swallowed by a parameterised route', () => {
  it('routes to searchQuestions', async () => {
    await Question.create(sampleQuestion());

    const res = await request(app).get('/api/questions/search?q=force');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
  });
});
