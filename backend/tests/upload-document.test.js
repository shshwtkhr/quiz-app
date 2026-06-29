const request = require('supertest');
const app = require('../src/app');
const Question = require('../src/models/Question');

// Mock external dependencies
jest.mock('@google/genai', () => {
  return {
    GoogleGenAI: jest.fn().mockImplementation(() => {
      return {
        models: {
          generateContent: jest.fn().mockResolvedValue({
            text: JSON.stringify([
              {
                topic: 'MockTopic',
                question_text: 'What is a mock?',
                options: ['Fake', 'Real', 'Undefined', 'Null'],
                correct_answer: 'Fake',
                explanation: 'A mock is a fake object.'
              }
            ])
          })
        }
      };
    })
  };
});
jest.mock('pdf-parse', () => jest.fn().mockResolvedValue({ text: 'Mock PDF text' }));
jest.mock('mammoth', () => ({ extractRawText: jest.fn().mockResolvedValue({ value: 'Mock DOCX text' }) }));

describe('POST /api/upload-document', () => {
  beforeEach(() => {
    // Set a dummy API key for testing
    process.env.GEMINI_API_KEY = 'test_key';
  });

  afterEach(async () => {
    await Question.deleteMany({});
  });

  it('should return 400 if no file is uploaded', async () => {
    const res = await request(app).post('/api/upload-document');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('No file uploaded');
  });

  it('should return 500 if GEMINI_API_KEY is missing', async () => {
    delete process.env.GEMINI_API_KEY;
    const res = await request(app)
      .post('/api/upload-document')
      .attach('file', Buffer.from('test text'), 'test.txt');
    
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/GEMINI_API_KEY is missing/);
  });

  it('should process a TXT file and upload parsed questions', async () => {
    const res = await request(app)
      .post('/api/upload-document')
      .attach('file', Buffer.from('Here is some quiz text'), 'quiz.txt');
      
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Document processed and questions uploaded successfully');
    expect(res.body.extractedQuestions).toBe(1);
    expect(res.body.upsertedCount).toBe(1);

    // Verify DB
    const questions = await Question.find({});
    expect(questions.length).toBe(1);
    expect(questions[0].topic).toBe('MockTopic');
    expect(questions[0].question_text).toBe('What is a mock?');
  });

  it('should process a PDF file and upload parsed questions', async () => {
    const res = await request(app)
      .post('/api/upload-document')
      .attach('file', Buffer.from('fake pdf data'), { filename: 'quiz.pdf', contentType: 'application/pdf' });
      
    expect(res.status).toBe(201);
    expect(res.body.extractedQuestions).toBe(1);
  });

  it('should process a DOCX file and upload parsed questions', async () => {
    const res = await request(app)
      .post('/api/upload-document')
      .attach('file', Buffer.from('fake docx data'), { filename: 'quiz.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      
    expect(res.status).toBe(201);
    expect(res.body.extractedQuestions).toBe(1);
  });

  it('should return 400 for unsupported file types', async () => {
    const res = await request(app)
      .post('/api/upload-document')
      .attach('file', Buffer.from('fake image data'), 'image.png');
      
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Unsupported file type/);
  });
});
