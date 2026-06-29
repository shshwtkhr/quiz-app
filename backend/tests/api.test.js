const request = require('supertest');
const app = require('../src/app');
const Question = require('../src/models/Question');

// ─── Sample Data ───────────────────────────────────────
const sampleQuestions = [
  {
    topic: 'Physics',
    subtopic: 'Mechanics',
    question_text: 'What is the unit of force?',
    options: ['Newton', 'Joule', 'Watt', 'Pascal'],
    correct_answer: 'Newton',
    explanation: 'The SI unit of force is the Newton (N), named after Sir Isaac Newton.',
  },
  {
    topic: 'Physics',
    subtopic: 'Light',
    question_text: 'What is the speed of light?',
    options: ['3×10⁸ m/s', '3×10⁶ m/s', '3×10¹⁰ m/s', '3×10⁴ m/s'],
    correct_answer: '3×10⁸ m/s',
    explanation: 'The speed of light in vacuum is approximately 3×10⁸ meters per second.',
  },
  {
    topic: 'Chemistry',
    subtopic: 'Inorganic',
    question_text: 'What is the chemical symbol for water?',
    options: ['H2O', 'CO2', 'NaCl', 'O2'],
    correct_answer: 'H2O',
    explanation: 'Water is composed of two hydrogen atoms and one oxygen atom: H₂O.',
  },
  {
    topic: 'Chemistry',
    subtopic: 'Acids',
    question_text: 'What is the pH of pure water?',
    options: ['7', '0', '14', '1'],
    correct_answer: '7',
    explanation: 'Pure water has a neutral pH of 7.',
  },
  {
    topic: 'Math',
    subtopic: 'Arithmetic',
    question_text: 'What is 2 + 2?',
    options: ['3', '4', '5', '6'],
    correct_answer: '4',
    explanation: 'Basic arithmetic: 2 + 2 = 4.',
  },
];

// ─── POST /api/upload-questions ────────────────────────
describe('POST /api/upload-questions', () => {
  it('should upload questions and return 201', async () => {
    const res = await request(app)
      .post('/api/upload-questions')
      .send(sampleQuestions);

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Questions uploaded successfully');
    expect(res.body.upsertedCount).toBe(5);
    expect(res.body.totalProcessed).toBe(5);
  });

  it('should return 400 for an empty array', async () => {
    const res = await request(app)
      .post('/api/upload-questions')
      .send([]);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/non-empty array/);
  });

  it('should return 400 for non-array payload', async () => {
    const res = await request(app)
      .post('/api/upload-questions')
      .send({ topic: 'Physics' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/non-empty array/);
  });

  it('should return 400 for missing required fields', async () => {
    const res = await request(app)
      .post('/api/upload-questions')
      .send([{ topic: 'Physics' }]);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/missing required field/);
  });

  it('should return 400 for questions with fewer than 2 options', async () => {
    const res = await request(app)
      .post('/api/upload-questions')
      .send([
        {
          topic: 'Physics',
          question_text: 'Test?',
          options: ['Only one'],
          correct_answer: 'Only one',
          explanation: 'Test',
        },
      ]);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at least 2 options/);
  });

  it('should deduplicate on re-upload (upsert)', async () => {
    // First upload
    await request(app).post('/api/upload-questions').send(sampleQuestions);

    // Second upload with same questions (should modify, not create new)
    const res = await request(app)
      .post('/api/upload-questions')
      .send(sampleQuestions);

    expect(res.status).toBe(201);
    expect(res.body.upsertedCount).toBe(0);
    expect(res.body.modifiedCount).toBe(5);

    // Total in DB should still be 5
    const count = await Question.countDocuments();
    expect(count).toBe(5);
  });
});

// ─── GET /api/topics ───────────────────────────────────
describe('GET /api/topics', () => {
  beforeEach(async () => {
    await request(app).post('/api/upload-questions').send(sampleQuestions);
  });

  it('should return unique topics with counts', async () => {
    const res = await request(app).get('/api/topics');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(3);

    // Should be sorted alphabetically
    const topicNames = res.body.map((t) => t._id);
    expect(topicNames).toEqual(['Chemistry', 'Math', 'Physics']);

    // Verify counts
    const physics = res.body.find((t) => t._id === 'Physics');
    expect(physics.count).toBe(2);

    const chemistry = res.body.find((t) => t._id === 'Chemistry');
    expect(chemistry.count).toBe(2);

    const math = res.body.find((t) => t._id === 'Math');
    expect(math.count).toBe(1);
  });

  it('should return empty array when no questions exist', async () => {
    // Clear the database first
    await Question.deleteMany({});

    const res = await request(app).get('/api/topics');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ─── POST /api/generate-quiz ───────────────────────────
describe('POST /api/generate-quiz', () => {
  beforeEach(async () => {
    await request(app).post('/api/upload-questions').send(sampleQuestions);
  });

  it('should return questions and answerKey for selected topics', async () => {
    const res = await request(app)
      .post('/api/generate-quiz')
      .send({
        topics: [
          { topic: 'Physics', count: 2 },
          { topic: 'Chemistry', count: 1 },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.totalQuestions).toBe(3);
    expect(res.body.questions).toHaveLength(3);
    expect(Object.keys(res.body.answerKey)).toHaveLength(3);
  });

  it('should NOT include correct_answer or explanation in questions', async () => {
    const res = await request(app)
      .post('/api/generate-quiz')
      .send({ topics: [{ topic: 'Physics', count: 1 }] });

    expect(res.status).toBe(200);
    const question = res.body.questions[0];
    expect(question).not.toHaveProperty('correct_answer');
    expect(question).not.toHaveProperty('explanation');
    expect(question).toHaveProperty('topic');
    expect(question).toHaveProperty('question_text');
    expect(question).toHaveProperty('options');
  });

  it('should include correct_answer and explanation in answerKey', async () => {
    const res = await request(app)
      .post('/api/generate-quiz')
      .send({ topics: [{ topic: 'Physics', count: 1 }] });

    expect(res.status).toBe(200);
    const questionId = res.body.questions[0]._id;
    const answer = res.body.answerKey[questionId];
    expect(answer).toHaveProperty('correct_answer');
    expect(answer).toHaveProperty('explanation');
  });

  it('should return 400 for missing topics array', async () => {
    const res = await request(app)
      .post('/api/generate-quiz')
      .send({});

    expect(res.status).toBe(400);
  });

  it('should return 400 for invalid topic entry', async () => {
    const res = await request(app)
      .post('/api/generate-quiz')
      .send({ topics: [{ topic: 'Physics' }] });

    expect(res.status).toBe(400);
  });

  it('should handle requesting more questions than available gracefully', async () => {
    const res = await request(app)
      .post('/api/generate-quiz')
      .send({ topics: [{ topic: 'Math', count: 100 }] });

    expect(res.status).toBe(200);
    // Only 1 Math question exists, so should return at most 1
    expect(res.body.questions.length).toBeLessThanOrEqual(100);
    expect(res.body.questions.length).toBeGreaterThanOrEqual(1);
  });
});
