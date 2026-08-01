/**
 * The parsing-jobs API: GET /api/jobs/active, GET /api/jobs/:jobId and
 * POST /api/jobs/:jobId/cancel.
 *
 * None of this had coverage before (F-06). These tests drive the endpoints
 * directly against seeded ParsingJob documents — the end-to-end cancellation
 * behaviour, where a live background worker races the cancel, is covered in
 * upload-document.test.js.
 */
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const ParsingJob = require('../src/models/ParsingJob');

/**
 * Seed a job, optionally back-dating createdAt to make ordering assertable.
 *
 * The back-date goes through the native driver on purpose: mongoose treats
 * createdAt as immutable under `timestamps: true` and silently drops it from a
 * Model.updateOne, which would leave the ordering test asserting nothing.
 */
async function seedJob(overrides = {}, createdAt) {
  const job = await ParsingJob.create({
    status: 'processing',
    fileName: 'doc.pdf',
    totalChunks: 3,
    progress: 0,
    ...overrides,
  });

  if (createdAt) {
    await ParsingJob.collection.updateOne({ _id: job._id }, { $set: { createdAt } });
  }
  return job;
}

// ─── GET /api/jobs/active ──────────────────────────────
describe('GET /api/jobs/active', () => {
  it('returns an empty array when nothing is running', async () => {
    const res = await request(app).get('/api/jobs/active');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns only pending and processing jobs', async () => {
    await seedJob({ status: 'pending', fileName: 'pending.pdf' });
    await seedJob({ status: 'processing', fileName: 'processing.pdf' });
    await seedJob({ status: 'completed', fileName: 'completed.pdf' });
    await seedJob({ status: 'failed', fileName: 'failed.pdf' });
    await seedJob({ status: 'cancelled', fileName: 'cancelled.pdf' });

    const res = await request(app).get('/api/jobs/active');

    expect(res.status).toBe(200);
    expect(res.body.map((j) => j.fileName).sort()).toEqual(['pending.pdf', 'processing.pdf']);
  });

  it('drops a job out of the list as soon as it is cancelled', async () => {
    const job = await seedJob();

    expect((await request(app).get('/api/jobs/active')).body).toHaveLength(1);

    await request(app).post(`/api/jobs/${job._id}/cancel`);

    expect((await request(app).get('/api/jobs/active')).body).toHaveLength(0);
  });

  it('orders newest first', async () => {
    // Insertion order is deliberately neither the expected order nor its
    // reverse, so a broken sort cannot accidentally satisfy the assertion.
    await seedJob({ fileName: 'oldest.pdf' }, new Date('2026-01-01T00:00:00Z'));
    await seedJob({ fileName: 'newest.pdf' }, new Date('2026-03-01T00:00:00Z'));
    await seedJob({ fileName: 'middle.pdf' }, new Date('2026-02-01T00:00:00Z'));

    const res = await request(app).get('/api/jobs/active');

    expect(res.body.map((j) => j.fileName)).toEqual(['newest.pdf', 'middle.pdf', 'oldest.pdf']);
  });

  it('includes the per-chunk telemetry the UI renders', async () => {
    await seedJob({
      chunksMeta: [
        { chunkIndex: 0, pageRange: '1-5', status: 'completed', message: 'Success', attempt: 1, currentModel: 'gemini-2.5-flash' },
        { chunkIndex: 1, pageRange: '6-10', status: 'processing', message: 'Requesting AI...', attempt: 2, currentModel: 'gemini-2.0-flash' },
      ],
    });

    const [job] = (await request(app).get('/api/jobs/active')).body;

    expect(job.chunksMeta).toHaveLength(2);
    expect(job.chunksMeta[1].currentModel).toBe('gemini-2.0-flash');
    expect(job.chunksMeta[1].attempt).toBe(2);
  });
});

// ─── GET /api/jobs/:jobId ──────────────────────────────
describe('GET /api/jobs/:jobId', () => {
  it('returns the job document', async () => {
    const job = await seedJob({ progress: 7 });

    const res = await request(app).get(`/api/jobs/${job._id}`);

    expect(res.status).toBe(200);
    expect(res.body._id).toBe(job._id.toString());
    expect(res.body.progress).toBe(7);
    expect(res.body.status).toBe('processing');
  });

  it('returns 404 for an unknown job', async () => {
    const res = await request(app).get(`/api/jobs/${new mongoose.Types.ObjectId()}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Job not found');
  });

  it('returns terminal jobs too, so a poller can observe the outcome', async () => {
    const job = await seedJob({ status: 'completed', parsedQuestions: [{ question_text: 'Q?' }] });

    const res = await request(app).get(`/api/jobs/${job._id}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
    expect(res.body.parsedQuestions).toHaveLength(1);
  });
});

// ─── POST /api/jobs/:jobId/cancel ──────────────────────
describe('POST /api/jobs/:jobId/cancel', () => {
  it('cancels a processing job', async () => {
    const job = await seedJob();

    const res = await request(app).post(`/api/jobs/${job._id}/cancel`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Job cancelled successfully');
    expect(res.body.job.status).toBe('cancelled');
    expect(res.body.job.error).toBe('Cancelled by user');
  });

  it('cancels a pending job', async () => {
    const job = await seedJob({ status: 'pending' });

    const res = await request(app).post(`/api/jobs/${job._id}/cancel`);

    expect(res.status).toBe(200);
    expect((await ParsingJob.findById(job._id)).status).toBe('cancelled');
  });

  it('returns 404 for an unknown job', async () => {
    const res = await request(app).post(`/api/jobs/${new mongoose.Types.ObjectId()}/cancel`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Job not found');
  });

  it.each(['completed', 'failed', 'cancelled'])('returns 400 for a %s job', async (status) => {
    const job = await seedJob({ status });

    const res = await request(app).post(`/api/jobs/${job._id}/cancel`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Only active jobs can be cancelled');
  });

  it('does not disturb a completed job it refuses to cancel', async () => {
    const job = await seedJob({ status: 'completed', parsedQuestions: [{ question_text: 'Q?' }] });

    await request(app).post(`/api/jobs/${job._id}/cancel`);

    const after = await ParsingJob.findById(job._id);
    expect(after.status).toBe('completed');
    expect(after.error).toBeNull();
    expect(after.parsedQuestions).toHaveLength(1);
  });

  it('is idempotent — a second cancel is refused, not reapplied', async () => {
    const job = await seedJob();

    await request(app).post(`/api/jobs/${job._id}/cancel`);
    const second = await request(app).post(`/api/jobs/${job._id}/cancel`);

    expect(second.status).toBe(400);
    expect((await ParsingJob.findById(job._id)).status).toBe('cancelled');
  });
});

// ─── F-01 regression ───────────────────────────────────
describe('a cancelled job stays cancelled (F-01)', () => {
  /**
   * The background worker's terminal writes are all conditional on the job
   * still being 'processing'. These assert the guard from the outside: once
   * cancelled, neither a success nor a failure write may take effect.
   *
   * The live-race version of this — cancelling while a chunk is genuinely in
   * flight — lives in upload-document.test.js.
   */
  const finishJob = (id, update) =>
    ParsingJob.findOneAndUpdate({ _id: id, status: 'processing' }, update);

  it('a completion write cannot overwrite cancelled', async () => {
    const job = await seedJob();
    await request(app).post(`/api/jobs/${job._id}/cancel`);

    await finishJob(job._id, { status: 'completed', parsedQuestions: [{ question_text: 'Q?' }] });

    const after = await ParsingJob.findById(job._id);
    expect(after.status).toBe('cancelled');
    expect(after.parsedQuestions).toHaveLength(0);
  });

  it('a failure write cannot overwrite cancelled', async () => {
    const job = await seedJob();
    await request(app).post(`/api/jobs/${job._id}/cancel`);

    await finishJob(job._id, { status: 'failed', error: 'An unexpected error occurred during processing.' });

    const after = await ParsingJob.findById(job._id);
    expect(after.status).toBe('cancelled');
    expect(after.error).toBe('Cancelled by user');
  });

  it('still lets a genuinely running job reach a terminal state', async () => {
    const completed = await seedJob();
    await finishJob(completed._id, { status: 'completed', parsedQuestions: [{ question_text: 'Q?' }] });
    expect((await ParsingJob.findById(completed._id)).status).toBe('completed');

    const failed = await seedJob();
    await finishJob(failed._id, { status: 'failed', error: 'boom' });
    expect((await ParsingJob.findById(failed._id)).status).toBe('failed');
  });
});
