const ParsingJob = require('../../src/models/ParsingJob');

const TERMINAL_STATUSES = ['completed', 'failed', 'cancelled'];

/**
 * Wait for a background parsing job to reach a terminal state.
 *
 * POST /api/upload-document answers 202 immediately and does the real work in a
 * fire-and-forget async IIFE, so a test that returns as soon as it has the
 * jobId leaves that worker running against a database the harness is about to
 * tear down. Every test that uploads must await this.
 */
async function waitForJob(jobId, { timeoutMs = 20000, intervalMs = 20 } = {}) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const job = await ParsingJob.findById(jobId);
    if (job && TERMINAL_STATUSES.includes(job.status)) return job;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  const last = await ParsingJob.findById(jobId);
  throw new Error(
    `Job ${jobId} did not reach a terminal state within ${timeoutMs}ms (last status: ${last?.status})`
  );
}

/** A promise plus the function that settles it, for gating a mocked AI call. */
function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

module.exports = { waitForJob, deferred, TERMINAL_STATUSES };
