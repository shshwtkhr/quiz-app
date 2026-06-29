# QuizMaster

A modern, dynamic, and premium Quiz Application built with Next.js and Node.js.

## Tech Stack
* **Frontend**: Next.js 15, React, Tailwind CSS (with extensive custom Vanilla CSS for glassmorphism styling)
* **Backend**: Node.js, Express, MongoDB (Mongoose)
* **Testing & Automation**: Jest, Supertest, Puppeteer (with automated video recording script)

## Features
- **Dynamic Topic Selection**: Users can choose from multiple topics and specify the number of questions they want to tackle.
- **Adjustable Time Limits**: A sleek slider to set a custom time limit for the quiz.
- **Real-time Quiz Engine**: Interactive quiz interface with smooth transitions, progress tracking, and instant validation.
- **Detailed Results Review**: View score breakdowns, review correct answers, and read detailed explanations for every question.
- **AI Document Upload**: Upload unstructured PDFs, DOCX, or TXT files and have Google's Gemini AI automatically parse and convert them into structured quiz questions!
- **Premium Aesthetics**: Features a highly polished dark-mode UI with glassmorphism effects, dynamic gradients, and custom animations.
- **E2E Test Automation**: Includes a Puppeteer script that fully automates testing the app (including AI uploads) and records a visual demo video with simulated click ripples.

## Prerequisites
- Node.js (v18+)
- MongoDB (running locally on `mongodb://localhost:27017` or configured via `.env`)
- **Google Gemini API Key**: Required for the AI Document Upload feature. Add this to `backend/.env` as `GEMINI_API_KEY`.

## Getting Started

### 1. Start the Backend
```bash
cd backend
npm install
npm run dev
```
The backend will run on `http://localhost:5000`. 
*(Note: You can seed questions by sending a POST request to `/api/upload-questions`)*

### 2. Start the Frontend
```bash
cd frontend
npm install
npm run dev
```
The frontend will be available at `http://localhost:3000`.

### 3. E2E Recording (Optional)
To run the automated Puppeteer script that navigates the app and records a demo video:
```bash
cd e2e-test
npm install
node record.js
```
The resulting video will be saved in the specified output directory.

## License
MIT
