# QuizMaster

A modern, full-stack Quiz Application powered by AI that can automatically generate quizzes from uploaded documents (PDF, DOCX, TXT) and allows users to manage, edit, and take quizzes with a beautiful, dynamic UI.

## 🎥 Full Application Flow
Below is a real-time recording of the complete application flow, validated by our automated End-to-End (E2E) testing framework:

<video src="https://github.com/shshwtkhr/quiz-app/raw/main/e2e-test/quiz_app_demo.mp4" width="100%" controls autoplay loop></video>

*(If the video does not play inline, [download it here](e2e-test/quiz_app_demo.mp4).)*

## ✨ Features

- **Document Upload**: Upload raw text files.
- **AI-Powered Parsing**: Uses Google Gemini to parse content, extract topics, and generate questions, correct answers, and explanations.
- **Context & Source Preservation**: Retains the specific source passage associated with each question and allows custom `source` tagging to provide grounded explanations.
- **Dynamic Quiz Engine**: Test your knowledge on specific topics with randomized questions and a timer.
- **Global & Topic Manager**: Easily search, inline-edit, categorize, and delete your questions across the entire database or within specific topics.
- **Multi-Select Bulk Edit**: Select multiple questions at once to easily bulk-update their topic, subtopic, source, context, or explanation.
- **E2E Testing**: Comprehensive end-to-end testing with **Playwright**, validating the full user flow from upload to quiz results.

## 🧪 Testing

The application includes a comprehensive End-to-End (E2E) testing suite powered by Playwright. The E2E tests validate the complete user journey:
1. Uploading a document
2. AI Question parsing
3. Inline editing and Topic tagging
4. Global Manager search and verification
5. Playing a generated quiz and validating the Results page

You can run the tests by navigating to the `e2e-test` directory and executing:
```bash
npm run test
```
To clean up the test-generated database records:
```bash
cd backend && npm run db:cleanup
```

## 🛠️ Tech Stack

### Frontend
- **Framework**: Next.js 15 (React 19)
- **Styling**: Tailwind CSS 4 with custom UI components
- **State Management**: Zustand
- **Icons**: Lucide React
- **Markdown Parsing**: React Markdown

### Backend
- **Runtime**: Node.js & Express
- **Database**: MongoDB (Mongoose)
- **AI Integration**: Google Generative AI (Gemini 1.5 Flash)
- **Document Processing**: `pdf-parse` for PDFs and `mammoth` for DOCX

## 📦 Project Structure

The project is structured as a monorepo:
- `/frontend`: Next.js web application
- `/backend`: Node.js Express server API

## 🚦 Getting Started

### 1. Backend Setup
```bash
cd backend
npm install
```
Create a `.env` file in the `backend` directory:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/quiz-app
CORS_ORIGIN=http://localhost:3000
GEMINI_API_KEY=your_gemini_api_key
```
Start the backend server:
```bash
npm run dev
```

### 2. Frontend Setup
```bash
cd frontend
npm install
```
Start the frontend development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

## 🧪 Testing

The project includes an End-to-End testing suite built with Playwright which covers the full user flow from uploading a document to taking the quiz and reviewing the results.

### Full App Flow Testing Video

A recording of the automated E2E test running through the entire application
flow is at the [top of this README](#-full-application-flow); the file itself is
[e2e-test/quiz_app_demo.mp4](e2e-test/quiz_app_demo.mp4).

To run the tests locally:

```bash
cd e2e-test
npm install
npm run test
```

To view the HTML report and recorded videos after a test run:
```bash
cd e2e-test
npm run report
```

### Database Cleanup

The E2E tests will create mock topics (e.g. `E2E-TEST-TOPIC-...`) in the database. A cleanup script is provided to remove these test artifacts.

To clean the database of all E2E test data:
```bash
cd e2e-test
npm run cleanup
```
