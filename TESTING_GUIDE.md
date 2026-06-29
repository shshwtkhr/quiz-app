# Comprehensive Test Suite

The Quiz Application has a fully integrated test suite that covers the complete end-to-end user experience, database modeling, API functionality, and advanced AI document parsing.

## 1. Backend Unit & Integration Tests (Jest & Supertest)

The backend features rigorous automated testing using `jest` and an in-memory MongoDB instance to ensure safe, isolated, and repeatable test runs without affecting your production database.

**Core Routes Tested (`tests/api.test.js`)**:
- `POST /api/upload-questions`: Validates bulk upsert behavior, field requirements (minimum 2 options, required strings), and deduplication logic.
- `GET /api/topics`: Confirms accurate aggregation and sorting of unique topics based on current database state.
- `POST /api/generate-quiz`: Ensures the API returns the correct number of randomized questions and properly separates the `answerKey` from the user-facing `questions` payload.

**Advanced AI Routes Tested (`tests/upload-document.test.js`)**:
- Validates the `POST /api/upload-document` endpoint.
- Tests missing API keys, ensuring a graceful 500 fallback instead of crashing the server.
- Uses `jest.mock` to simulate Google Gemini API responses, ensuring the endpoint handles `.txt`, `.pdf`, and `.docx` file formats correctly.
- Confirms that unsupported file types (like images) are rejected correctly.
- Ensures the extracted JSON is validated and efficiently bulk-upserted into MongoDB.

To run the backend test suite:
```bash
cd backend
npm run test
```

## 2. Frontend Visual E2E Tests (Puppeteer)

The frontend features an automated Puppeteer script that navigates through the live application just like a real user would.

**Test Flow (`e2e-test/record.js`)**:
1. Navigates to `http://localhost:3000`.
2. Simulates a user selecting topics (e.g., "Math", "Science").
3. Adjusts the question slider and starts the quiz.
4. Answers all questions sequentially.
5. Completes the quiz and clicks "Return to Home".

**Visual Feedback**:
We've injected a custom script that renders a visual "ripple" (a green expanding circle) at the exact coordinates of every simulated mouse click, allowing you to easily trace the automated user's journey. The entire sequence is recorded and saved as an MP4 video (`quiz_app_demo.mp4`) in the artifact directory.

To run the visual E2E test and generate a new recording:
```bash
cd e2e-test
npm start
```
