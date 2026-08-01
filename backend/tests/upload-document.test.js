/**
 * POST /api/upload-document — the async background-job contract.
 *
 * This suite previously asserted the pre-1.1.0 synchronous streaming contract
 * (200 + NDJSON) against an endpoint that has answered 202 + { jobId } since
 * 4fc67bc, and mocked the AI with the old flat schema that the text path no
 * longer uses (F-04, F-05). It now:
 *
 *   - asserts 202 + jobId, then awaits the ParsingJob reaching a terminal state
 *   - mocks Gemini with the *indexed* schema, so the line-index reassembly path
 *     is genuinely exercised rather than silently yielding zero questions
 */
const request = require('supertest');

jest.mock('@google/genai', () => require('./helpers/genai-mock'));
jest.mock('pdf-parse', () => jest.fn());
jest.mock('mammoth', () => ({ extractRawText: jest.fn() }));

// Image PDFs are split with pdf-lib; stand in a 7-page document so the 5-page
// chunking boundary is exercised without needing a real PDF fixture.
jest.mock('pdf-lib', () => ({
  PDFDocument: {
    load: jest.fn(async () => ({ getPageCount: () => 7 })),
    create: jest.fn(async () => ({
      copyPages: jest.fn(async (_source, indices) => indices.map(() => ({}))),
      addPage: jest.fn(),
      save: jest.fn(async () => new Uint8Array([1, 2, 3])),
    })),
  },
}));

const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { __mocks } = require('@google/genai');
const app = require('../src/app');
const ParsingJob = require('../src/models/ParsingJob');
const { resetModelCache } = require('../src/controllers/documentController');
const { waitForJob, deferred } = require('./helpers/jobs');

// ─── Fixtures ──────────────────────────────────────────

/** The document every extraction path is mocked to produce. */
const DOC_TEXT = [
  'What is a mock?',
  'Fake',
  'Real',
  'Undefined',
  'Null',
  'A mock is a fake object.',
].join('\n');

/** What the model returns for DOC_TEXT: line indexes, not text. */
const INDEXED_ANSWER = [
  {
    topic: 'MockTopic',
    subtopic: 'MockSubtopic',
    context_lines: [],
    question_lines: [1],
    options: [
      { lines: [2], is_correct: true },
      { lines: [3], is_correct: false },
      { lines: [4], is_correct: false },
      { lines: [5], is_correct: false },
    ],
    explanation_lines: [6],
  },
];

/** What the model returns for an image PDF: literal text, flat schema. */
const FLAT_ANSWER = [
  {
    topic: 'ScannedTopic',
    subtopic: 'ScannedSubtopic',
    question_text: 'What is on the scan?',
    options: ['Words', 'Pictures'],
    correct_answer: 'Words',
    explanation: 'It is a scanned page of words.',
  },
];

const AVAILABLE_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'text-embedding-004'];

/** Answer with the schema appropriate to the chunk being sent. */
function respondPerChunkType({ contents }) {
  // Text chunks arrive as a prompt string; image-PDF chunks as [prompt, part].
  const isTextChunk = typeof contents === 'string';
  return { text: JSON.stringify(isTextChunk ? INDEXED_ANSWER : FLAT_ANSWER) };
}

const uploadTxt = (text = DOC_TEXT, filename = 'quiz.txt') =>
  request(app).post('/api/upload-document').attach('file', Buffer.from(text), filename);

// ─── Suite ─────────────────────────────────────────────

describe('POST /api/upload-document', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test_key';

    resetModelCache();
    __mocks.generateContent.mockReset();
    __mocks.list.mockReset();

    __mocks.list.mockResolvedValue(__mocks.modelList(AVAILABLE_MODELS));
    __mocks.generateContent.mockImplementation(async (req) => respondPerChunkType(req));

    pdfParse.mockResolvedValue({ text: DOC_TEXT });
    mammoth.extractRawText.mockResolvedValue({ value: DOC_TEXT });
  });

  // ─── Request validation (answered before the job exists) ───

  it('returns 400 if no file is uploaded', async () => {
    const res = await request(app).post('/api/upload-document');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('No file uploaded');
  });

  it('returns 500 if GEMINI_API_KEY is missing', async () => {
    delete process.env.GEMINI_API_KEY;

    const res = await uploadTxt();

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/GEMINI_API_KEY is missing/);
  });

  it('returns 400 for unsupported file types', async () => {
    const res = await request(app)
      .post('/api/upload-document')
      .attach('file', Buffer.from('fake image data'), 'image.png');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unsupported file type/);
  });

  it('returns 400 for a document with no extractable text', async () => {
    const res = await uploadTxt('   \n\n  ');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Failed to extract text/);
  });

  // ─── The async contract ───

  it('answers 202 with a jobId rather than the parsed questions', async () => {
    const res = await uploadTxt();

    expect(res.status).toBe(202);
    expect(res.body.jobId).toBeDefined();
    expect(res.body.message).toMatch(/parsing started in background/i);
    expect(res.body.questions).toBeUndefined();

    await waitForJob(res.body.jobId);
  });

  it('creates the job in a processing state with per-chunk metadata', async () => {
    const res = await uploadTxt();
    const job = await ParsingJob.findById(res.body.jobId);

    expect(job.fileName).toBe('quiz.txt');
    expect(job.totalChunks).toBe(1);
    expect(job.chunksMeta).toHaveLength(1);
    expect(job.chunksMeta[0].chunkIndex).toBe(0);
    expect(['pending', 'processing']).toContain(job.status);

    await waitForJob(res.body.jobId);
  });

  // ─── The indexed (text) path ───

  it('reassembles questions from line indexes for a TXT file', async () => {
    const res = await uploadTxt();
    const job = await waitForJob(res.body.jobId);

    expect(job.status).toBe('completed');
    expect(job.parsedQuestions).toHaveLength(1);

    const q = job.parsedQuestions[0];
    expect(q.topic).toBe('MockTopic');
    expect(q.subtopic).toBe('MockSubtopic');
    // Text comes from the server's dictionary, not from the model's output.
    expect(q.question_text).toBe('What is a mock?');
    expect(q.options).toEqual(['Fake', 'Real', 'Undefined', 'Null']);
    expect(q.correct_answer).toBe('Fake');
    expect(q.explanation).toBe('A mock is a fake object.');
  });

  it('sends the model line-numbered text and expects indexes back', async () => {
    const res = await uploadTxt();
    await waitForJob(res.body.jobId);

    const { contents } = __mocks.generateContent.mock.calls[0][0];
    expect(contents).toContain('[1] What is a mock?');
    expect(contents).toContain('semantic router');
  });

  it('parses a PDF file through the same indexed path', async () => {
    const res = await request(app)
      .post('/api/upload-document')
      .attach('file', Buffer.from('fake pdf data'), {
        filename: 'quiz.pdf',
        contentType: 'application/pdf',
      });

    expect(res.status).toBe(202);
    const job = await waitForJob(res.body.jobId);

    expect(job.status).toBe('completed');
    expect(job.parsedQuestions[0].question_text).toBe('What is a mock?');
  });

  it('parses a DOCX file through the same indexed path', async () => {
    const res = await request(app)
      .post('/api/upload-document')
      .attach('file', Buffer.from('fake docx data'), {
        filename: 'quiz.docx',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

    expect(res.status).toBe(202);
    const job = await waitForJob(res.body.jobId);

    expect(job.status).toBe('completed');
    expect(job.parsedQuestions[0].question_text).toBe('What is a mock?');
  });

  it('carries page provenance from the PDF page markers onto the question', async () => {
    pdfParse.mockResolvedValue({
      text: [
        '___PAGE_START_4___',
        'What is a mock?',
        'Fake',
        'Real',
        'Undefined',
        'Null',
        '___PAGE_START_5___',
        'A mock is a fake object.',
      ].join('\n'),
    });

    const res = await request(app)
      .post('/api/upload-document')
      .attach('file', Buffer.from('fake pdf'), { filename: 'q.pdf', contentType: 'application/pdf' });
    const job = await waitForJob(res.body.jobId);

    expect(job.parsedQuestions[0].pageRange).toBe('4-5');
  });

  it('drops model answers that fail post-validation', async () => {
    __mocks.generateContent.mockResolvedValue({
      text: JSON.stringify([
        { ...INDEXED_ANSWER[0] },
        { ...INDEXED_ANSWER[0], question_lines: [] },                  // no question
        { ...INDEXED_ANSWER[0], options: [{ lines: [2], is_correct: true }] }, // one option
      ]),
    });

    const res = await uploadTxt();
    const job = await waitForJob(res.body.jobId);

    expect(job.status).toBe('completed');
    expect(job.parsedQuestions).toHaveLength(1);
  });

  it('recovers a JSON array wrapped in a markdown code fence', async () => {
    __mocks.generateContent.mockResolvedValue({
      text: '```json\n' + JSON.stringify(INDEXED_ANSWER) + '\n```',
    });

    const res = await uploadTxt();
    const job = await waitForJob(res.body.jobId);

    expect(job.status).toBe('completed');
    expect(job.parsedQuestions).toHaveLength(1);
  });

  it('fails the job when no valid question survives', async () => {
    __mocks.generateContent.mockResolvedValue({ text: JSON.stringify([]) });

    const res = await uploadTxt();
    const job = await waitForJob(res.body.jobId);

    expect(job.status).toBe('failed');
    expect(job.error).toMatch(/Failed to extract any valid questions/);
  });

  // ─── The image-PDF (flat schema) path ───

  describe('image PDFs', () => {
    beforeEach(() => {
      // Text extraction yields page markers only ⇒ the PDF is scanned images.
      pdfParse.mockResolvedValue({ text: '\n___PAGE_START_1___\n\n___PAGE_START_2___\n' });
    });

    it('splits the PDF into 5-page sub-documents and uses the flat schema', async () => {
      const res = await request(app)
        .post('/api/upload-document')
        .attach('file', Buffer.from('scanned'), { filename: 'scan.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(202);
      const job = await waitForJob(res.body.jobId);

      // 7 pages at 5 per chunk ⇒ pages 1-5 and 6-7.
      expect(job.totalChunks).toBe(2);
      expect(job.chunksMeta.map((c) => c.pageRange)).toEqual(['1-5', '6-7']);

      // Sent as inline PDF data, not as a line-numbered prompt string.
      const { contents } = __mocks.generateContent.mock.calls[0][0];
      expect(Array.isArray(contents)).toBe(true);
      expect(contents[1].inlineData.mimeType).toBe('application/pdf');

      expect(job.status).toBe('completed');
      expect(job.parsedQuestions[0].question_text).toBe('What is on the scan?');
    });
  });

  // ─── Model fallback ───

  it('falls back to the next model when one is unavailable', async () => {
    __mocks.generateContent
      .mockRejectedValueOnce({ status: 503, message: 'Service unavailable' })
      .mockImplementation(async (req) => respondPerChunkType(req));

    const res = await uploadTxt();
    const job = await waitForJob(res.body.jobId);

    expect(job.status).toBe('completed');

    const history = job.chunksMeta[0].attemptsHistory;
    expect(history[0].status).toBe('failed');
    expect(history[0].model).toBe('gemini-2.5-flash');
    expect(history[history.length - 1].status).toBe('completed');
    expect(history[history.length - 1].model).toBe('gemini-2.0-flash');
  });

  it('only offers the model ranking usable candidates', async () => {
    const res = await uploadTxt();
    await waitForJob(res.body.jobId);

    // text-embedding-004 was in the list() response but must never be called.
    const modelsTried = __mocks.generateContent.mock.calls.map(([req]) => req.model);
    expect(modelsTried).not.toContain('text-embedding-004');
    expect(modelsTried[0]).toBe('gemini-2.5-flash');
  });

  it('fails the job when every model is exhausted', async () => {
    __mocks.generateContent.mockRejectedValue({ status: 503, message: 'Service unavailable' });

    const res = await uploadTxt();
    const job = await waitForJob(res.body.jobId);

    expect(job.status).toBe('failed');
    expect(job.error).toMatch(/Rate limit exceeded or service unavailable/);
  });

  // ─── Cancellation, end to end (locks in F-01) ───

  describe('cancellation mid-parse', () => {
    /** A document long enough to chunk twice (stride is 250 - 50 = 200 lines). */
    const LONG_DOC = [DOC_TEXT, ...Array.from({ length: 300 }, (_, i) => `filler ${i}`)].join('\n');

    it('stays cancelled instead of being overwritten as completed or failed', async () => {
      const gate = deferred();
      __mocks.generateContent.mockImplementationOnce(async (req) => {
        await gate.promise;
        return respondPerChunkType(req);
      });

      const res = await uploadTxt(LONG_DOC);
      const { jobId } = res.body;

      const job = await ParsingJob.findById(jobId);
      expect(job.totalChunks).toBeGreaterThan(1);

      // Cancel while the first chunk is still in flight.
      const cancelRes = await request(app).post(`/api/jobs/${jobId}/cancel`);
      expect(cancelRes.status).toBe(200);

      // Let the in-flight chunk finish. Its success must not resurrect the job,
      // and the guard before the next chunk must abort without writing 'failed'.
      gate.resolve();
      const finished = await waitForJob(jobId);

      expect(finished.status).toBe('cancelled');
      expect(finished.error).toBe('Cancelled by user');
      expect(finished.parsedQuestions).toHaveLength(0);
    });

    it('stops calling the model once cancelled', async () => {
      const gate = deferred();
      __mocks.generateContent.mockImplementationOnce(async (req) => {
        await gate.promise;
        return respondPerChunkType(req);
      });

      const res = await uploadTxt(LONG_DOC);
      await request(app).post(`/api/jobs/${res.body.jobId}/cancel`);

      gate.resolve();
      await waitForJob(res.body.jobId);

      // Only the gated first chunk was ever sent; later chunks were skipped.
      expect(__mocks.generateContent).toHaveBeenCalledTimes(1);
    });
  });
});
