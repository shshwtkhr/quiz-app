# QuizMaster

A modern, full-stack Quiz Application powered by AI that can automatically generate quizzes from uploaded documents (PDF, DOCX, TXT) and allows users to manage, edit, and take quizzes with a beautiful, dynamic UI.

## 🚀 Features

- **AI Document Parsing**: Upload PDFs or DOCX files and let Gemini AI extract comprehensive questions, options, answers, and explanations.
- **Smart Formatting Preservation**: Automatically detects and preserves markdown formatting (like bold and italic text) from source documents.
- **Interactive Review & Inline Editing**: Review AI-generated questions and easily edit them inline before saving them to the database.
- **Global Question Manager**: View all questions across all topics, search instantly, and selectively edit or delete questions.
- **Dynamic Quiz Engine**: Build custom quizzes by selecting specific topics, adjusting question counts, and setting time limits.
- **Beautiful UI**: Built with Next.js and Tailwind CSS featuring glassmorphism, responsive design, and smooth micro-animations.

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

To run the tests:

```bash
cd frontend
npm run test:e2e
```

To view the HTML report and recorded videos after a test run:
```bash
npx playwright show-report
```

### Database Cleanup

The E2E tests will create mock topics (e.g. `E2E-TEST-TOPIC-...`) in the database. A cleanup script is provided to remove these test artifacts.

To clean the database of all E2E test data:
```bash
cd backend
npm run db:cleanup
```
