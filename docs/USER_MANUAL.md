# QuizMaster — User Manual

> **Version:** 1.1.0  
> **Last Updated:** July 2026

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Installation & Setup](#2-installation--setup)
3. [Quick Start](#3-quick-start)
4. [Feature Guide](#4-feature-guide)
   - [AI Document Upload](#41-ai-document-upload)
   - [Question Management](#42-question-management)
   - [Quiz Configuration](#43-quiz-configuration)
   - [Taking a Quiz](#44-taking-a-quiz)
   - [Reviewing Results](#45-reviewing-results)
5. [Screen-by-Screen Reference](#5-screen-by-screen-reference)
6. [Troubleshooting](#6-troubleshooting)
7. [FAQ](#7-faq)
8. [Keyboard Shortcuts & Accessibility](#8-keyboard-shortcuts--accessibility)
9. [Glossary](#9-glossary)

---

## 1. Introduction

### What is QuizMaster?

QuizMaster is an AI-powered quiz application that lets you:

- **Upload any document** (PDF, DOCX, or TXT) and have artificial intelligence automatically generate quiz questions from it
- **Manage a question bank** — organize, edit, search, and curate questions across topics, subtopics, and sources
- **Bulk edit questions** — select multiple questions and update their topic, subtopic, source, or other fields in one operation
- **Take customized quizzes** — select topics, set question counts, configure time limits, and test your knowledge
- **Review detailed results** — see your score, review every question with explanations, and identify areas for improvement

### Who Is This Manual For?

This manual is for end users of the QuizMaster application. It assumes:
- Basic familiarity with web browsers and web applications
- For the installation section: basic command-line knowledge

### Conventions Used

| Convention | Meaning |
|---|---|
| **Bold text** | UI elements, buttons, and labels |
| `Monospace text` | Commands, file names, URLs, and code |
| > **Note** blocks | Important tips and information |
| > **Warning** blocks | Cautions and potential pitfalls |

### System Requirements

| Requirement | Minimum |
|---|---|
| Web Browser | Chrome, Firefox, Edge, or Safari (latest 2 versions) |
| Screen Resolution | 768px width minimum (responsive design) |
| Network | Internet connection required for AI document parsing |

For **self-hosted installation**, additionally:

| Requirement | Minimum |
|---|---|
| Node.js | Version 18 or higher |
| MongoDB | Version 6.0 or higher (local or cloud) |
| Google Gemini API Key | Free tier available |

---

## 2. Installation & Setup

### Step 1: Install Prerequisites

#### Node.js
Download and install Node.js (v18+) from [nodejs.org](https://nodejs.org). Verify installation:
```bash
node --version
npm --version
```

#### MongoDB
Choose one option:
- **Local:** Install from [mongodb.com/try/download](https://www.mongodb.com/try/download/community) and start the service
- **Cloud:** Create a free cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)

Verify local MongoDB is running:
```bash
mongosh --eval "db.version()"
```

#### Google Gemini API Key
1. Visit [ai.google.dev](https://ai.google.dev)
2. Sign in with your Google account
3. Navigate to **API Keys** and create a new key
4. Copy the key — you'll need it in Step 3

### Step 2: Download QuizMaster

```bash
git clone <repository-url>
cd quiz-app
```

### Step 3: Configure the Backend

```bash
cd backend
npm install
```

Create a `.env` file by copying the example:
```bash
cp .env.example .env
```

Edit `.env` with your settings:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/quiz-app
CORS_ORIGIN=http://localhost:3000
GEMINI_API_KEY=your_actual_gemini_api_key_here
```

> [!IMPORTANT]
> Replace `your_actual_gemini_api_key_here` with the API key you obtained in Step 1. Without this key, AI document parsing will not work.

> [!TIP]
> If using MongoDB Atlas, your `MONGODB_URI` will look like:
> `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/quiz-app`

### Step 4: Configure the Frontend

```bash
cd ../frontend
npm install
```

The frontend defaults to connecting to `http://localhost:5000/api`. If your backend runs on a different URL, create a `.env.local` file:
```env
NEXT_PUBLIC_API_URL=http://your-backend-host:5000/api
```

### Step 5: Start the Application

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
```
You should see:
```
MongoDB Connected: localhost
Server running on port 5000 — Health check: http://localhost:5000/health
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```
You should see:
```
  ▲ Next.js 15.1.0
  - Local:   http://localhost:3000
```

### Step 6: Open QuizMaster

Open your browser and navigate to **http://localhost:3000**. You should see the QuizMaster home screen.

> [!TIP]
> Verify the backend is running by visiting `http://localhost:5000/health` — you should see `{"status":"ok","timestamp":"..."}`.

---

## 3. Quick Start

This walkthrough takes you from an empty database to taking your first quiz in about 2 minutes.

### 3.1. Upload Your First Document

1. Open **http://localhost:3000** in your browser
2. Click the **Upload Document** button (cloud upload icon) at the top of the page
3. A modal window appears with a drop zone
4. Either **drag and drop** a PDF, DOCX, or TXT file into the zone, or click **Browse** to select a file
5. Click **Upload & Parse**
6. Watch the progress indicator as the AI processes your document in the background:
   - *Uploading...* → *AI is parsing your document... X questions found* → *Review*
7. Review the extracted questions — the AI has automatically identified:
   - Topics and subtopics
   - Questions with multiple-choice options
   - Correct answers and explanations
   - Source context passages
8. (Optional) Use **Bulk Edit** to assign all questions to a custom topic, or edit individual questions inline
9. Click **Save Questions**
10. The modal closes and your home screen now shows the new topics!

> [!TIP]
> You can close the upload modal while the AI is still parsing. The background job continues running and you'll see the results when you reopen the upload modal.

### 3.2. Take Your First Quiz

1. On the home screen, you'll see topic cards for each topic with question counts
2. **Click** on one or more topic cards to select them (they'll highlight when selected)
3. Adjust the **question count** for each selected topic using the number input
4. Set your desired **time limit** using the slider (1-60 minutes, default is 10)
5. Click **Start Quiz**
6. Answer each question by clicking your chosen option
7. Use **Next** and **Previous** to navigate between questions
8. When you're ready, click **Submit Quiz** on the last question
9. Review your score and detailed results!

---

## 4. Feature Guide

### 4.1. AI Document Upload

The AI document upload feature is the heart of QuizMaster. It uses Google's Gemini AI to read your documents and automatically generate structured quiz questions.

#### Supported File Formats

| Format | Extension | Notes |
|---|---|---|
| **PDF** | `.pdf` | Supports both text-based and scanned/image-based PDFs |
| **Word Document** | `.docx` | Microsoft Word format |
| **Plain Text** | `.txt` | Simple text files |

#### How to Upload

1. Click the **Upload Document** button on the home screen
2. The upload modal appears with a drag-and-drop zone

**Option A — Drag and Drop:**
- Drag a file from your computer and drop it onto the drop zone
- The zone highlights in blue when a file is hovering over it

**Option B — File Browser:**
- Click **Browse** (or click anywhere in the drop zone) to open the file browser
- Select your file

3. After selecting a file, you'll see the file name, size, and type displayed
4. Click **Upload & Parse** to start processing

#### Background Processing

When you upload a document, the AI processes it as a **background job**:

1. The upload returns immediately and parsing begins on the server
2. The modal shows a progress indicator with the count of questions found so far
3. The progress updates automatically every 2.5 seconds
4. You can click **"Hide Progress (Run in Background)"** to close the modal while parsing continues
5. When you reopen the upload modal, it automatically detects the in-progress job and resumes showing the progress
6. Once complete, you transition to the Review screen

> [!NOTE]
> The background job ID is saved in your browser's localStorage. This means parsing survives modal close and even page refreshes. If you close the browser entirely, the job still runs on the server — just reopen the app and the upload modal to check its status.

#### Background Jobs Panel

Anywhere in the upload modal (the initial drop-zone screen, the parsing spinner screen, or the Review screen), you may see a **Background Jobs** panel listing every document currently being parsed on the server — not just the one you started:

- Each job shows its **file name**, upload time, questions parsed so far, and a **chunk counter** (e.g. "3 / 8 chunks")
- Click a job to **expand** it and see a **live, per-chunk progress list**: which page range it covers, whether it's pending/processing/completed/failed/rate-limited, which AI model is currently handling it, and the current attempt number
- Expand an individual chunk further to see its full **attempt history** — every model tried, whether it succeeded, was rate-limited, or failed, and when
- Click the **✕ (Stop)** button on any job to cancel it — this immediately stops that job from processing further chunks

> [!TIP]
> This is useful if you accidentally start parsing a large document and want to stop it, or if you're curious why a document is taking a while (e.g. it's automatically retrying a rate-limited AI model).

#### Reviewing Parsed Questions

After the AI finishes, you enter the **Review** screen where you can:

**For each question:**
- View the parsed question text, options, correct answer, and explanation
- **Edit inline:** Click the pencil icon to edit any field (source, context, question, options with add/remove, correct answer, explanation)
- **Assign topics:** Use the topic dropdown to change the topic, or click **+ Create New Topic**
- **Assign subtopics:** Similarly, assign or create subtopics for finer organization
- **Assign sources:** Use the source dropdown to tag where a question came from, or click **+ Create New Source**

**Bulk Operations:**
1. Select multiple questions using checkboxes (or drag to select)
2. A bulk actions bar appears at the top with:
   - **Bulk Edit** — opens the Bulk Edit Modal (see below)
   - **Delete Selected** — remove unwanted questions

3. Click **Save Questions** when you're satisfied with the results

#### Bulk Edit Modal

The Bulk Edit Modal lets you update a single field across all selected questions at once:

1. Select questions using checkboxes (or use **Select All**)
2. Click the **Bulk Edit** button
3. Choose the **field** to edit from the dropdown:
   - Topic, Subtopic, Source, Context, Explanation, Question Text, Correct Answer
4. Enter the new **value** (with autocomplete suggestions for Topic and Source fields)
5. Click **Apply to All**

This is especially useful for:
- Assigning a consistent topic to all questions from a document
- Tagging all questions with the same source
- Updating subtopics in bulk

#### Tips for Better AI Results

> [!TIP]
> **Best practices for document content:**
> - Documents with clearly structured content (textbooks, study guides, fact sheets) yield the best results
> - The AI can handle unstructured text too — it will identify key facts and create questions about them
> - Bold and italic formatting in PDFs is preserved and displayed in questions
> - Very short documents may produce few questions — aim for at least 1-2 pages of content

---

### 4.2. Question Management

QuizMaster provides two ways to manage your question bank:

#### Global Question Manager

Access via the **Global Manager** button on the home screen, or navigate to `/manage`.

**Features:**
- **View all questions** across all topics in a single, searchable list
- **Search** — type in the search box to instantly filter questions by any field (question text, options, answers, topics, subtopics, sources, explanations)
- **Group by topic** — questions are organized under collapsible topic and subtopic headers
- **Select & bulk delete** — check individual questions or use **Select All**, then click **Delete Selected**
- **Bulk Edit** — select questions and click **Bulk Edit** to update a field across all selected questions
- **Inline edit** — click the pencil icon on any question to edit all fields in place (including the Source field)
- **Expand/collapse** — click a question to see its full details (context, options, correct answer, explanation)
- **Source badges** — questions display their source as a badge for easy identification

#### Per-Topic Manager

On the home screen, each topic card has a pencil icon. Click it to open the **Manage Topic** modal:

- Shows only questions for that specific topic
- Supports the same search, edit, bulk edit, and delete features
- Questions are organized by subtopic within the topic

#### Editing a Question

1. Click the **pencil icon** (✏️) next to any question
2. The question expands into edit mode with form fields:
   - **Topic** — text input
   - **Subtopic** — text input
   - **Source** — text input with autocomplete from existing sources
   - **Context** — textarea for background passage
   - **Question Text** — textarea
   - **Options** — one option per line (textarea)
   - **Correct Answer** — text input (must match one of the options)
   - **Explanation** — textarea
3. Click **Save** to apply changes, or **Cancel** to discard

#### Bulk Editing Questions

1. Select questions using checkboxes (or **Select All**)
2. Click **Bulk Edit** (appears when items are selected)
3. In the Bulk Edit Modal:
   - Choose which field to update (topic, subtopic, source, context, explanation, question_text, correct_answer)
   - Enter the new value
   - Click **Apply to All**
4. All selected questions are updated at once

#### Deleting Questions

**Bulk delete:**
1. Select questions using the checkboxes
2. Click **Delete Selected** (appears when items are selected)
3. Confirm the deletion in the confirmation dialog

> [!WARNING]
> Deletion is permanent. Deleted questions cannot be recovered.

---

### 4.3. Quiz Configuration

The home screen (`/`) is where you configure your quiz before starting.

#### Selecting Topics

- Available topics appear as **cards** in a responsive grid
- Each card shows the **topic name** and **question count**
- **Click** a card to select it (the card highlights with a blue border)
- **Click again** to deselect it
- Select as many topics as you want

> [!TIP]
> You can also use the keyboard: focus a topic card and press **Enter** or **Space** to toggle selection.

#### Setting Question Counts

For each selected topic, a **question count** input appears:
- Enter the number of questions you want from that topic
- Minimum: **1** question
- Maximum: the total number of questions available for that topic
- Default: **5** (or the total available, whichever is smaller)

#### Setting the Time Limit

Below the topic grid, you'll find the **Time Limit** control:
- **Slider:** Drag to set the time (1-60 minutes)
- **Number input:** Type an exact value
- **Default:** 10 minutes
- The time limit applies to the **entire quiz**, not per question

#### Starting the Quiz

1. Ensure at least one topic is selected
2. Review your configuration:
   - The summary shows the total number of questions and time limit
3. Click **Start Quiz**
4. The quiz generates with randomized questions and you're navigated to the quiz page

---

### 4.4. Taking a Quiz

The quiz page (`/quiz`) presents questions one at a time in a focused, distraction-free interface.

#### Quiz Interface Elements

| Element | Location | Purpose |
|---|---|---|
| **Question counter** | Top left | Shows "Question X of Y" |
| **Timer** | Top right | Countdown in MM:SS format |
| **Progress bar** | Below header | Visual progress through the quiz |
| **Topic badge** | Above question | Shows the topic for the current question |
| **Context passage** | Below topic badge | Background text relevant to the question (if available) |
| **Question text** | Center | The question being asked |
| **Option buttons** | Below question | Lettered options (A, B, C, D...) |
| **Navigation dots** | Bottom | Visual indicator of question positions |
| **Previous / Next** | Bottom corners | Navigate between questions |
| **Submit Quiz** | Bottom right (last question) | Submits the quiz for grading |

#### Answering Questions

1. Read the question and any context passage carefully
2. Click your chosen **option button** — it highlights to confirm your selection
3. You can **change your answer** at any time before submitting by clicking a different option
4. Click **Next** to proceed to the next question

#### Navigating Questions

- **Next →** — Move to the next question
- **← Previous** — Go back to the previous question
- You can **revisit any question** and change your answer before submitting
- The navigation dots at the bottom show your overall position

#### Timer Behavior

The countdown timer shows the remaining time in **MM:SS** format:

| Time Remaining | Visual Indicator |
|---|---|
| > 60 seconds | White text (normal) |
| ≤ 60 seconds | **Amber text** (warning) |
| ≤ 30 seconds | **Red pulsing text** (critical) |
| 0 seconds | **Auto-submit** — quiz is automatically submitted |

> [!WARNING]
> When the timer reaches zero, the quiz is automatically submitted with whatever answers you've provided. Unanswered questions are marked as incorrect.

#### Submitting the Quiz

**On the last question**, the **Next** button changes to **Submit Quiz**.

- If you've answered **all questions**, clicking Submit immediately submits the quiz
- If you have **unanswered questions**, a confirmation dialog appears:
  - It tells you how many questions remain unanswered
  - Choose **Go Back** to continue answering, or **Submit Anyway** to submit as-is

After submission, you're automatically taken to the Results page.

---

### 4.5. Reviewing Results

The results page (`/results`) provides a comprehensive review of your quiz performance.

#### Score Summary

At the top, you'll see:
- A **circular progress ring** showing your score percentage
- Your **score** in "X / Y correct" format
- The score is **color-coded**:
  - 🟢 **Green** — 80% or above (Excellent!)
  - 🟡 **Amber** — 50-79% (Good, room for improvement)
  - 🔴 **Red** — Below 50% (Keep practicing!)

#### Detailed Question Review

Below the score summary, every question is listed with:

- **Left border color:** Green = you answered correctly, Red = you answered incorrectly
- **Question number** and **topic badge**
- **Context passage** (if the question had one)
- **Question text**
- **All options** with color coding:
  - ✅ **Green background** — the correct answer
  - ❌ **Red background** — your incorrect answer (if applicable)
  - Neutral — other options
- **"You did not answer this question"** — warning shown for unanswered questions
- **Explanation card** — detailed explanation of the correct answer

#### After Reviewing

- Click **Take New Quiz** (at the top or bottom of the page) to return to the home screen
- Your quiz state is reset — you can configure and start a new quiz

---

## 5. Screen-by-Screen Reference

### Home Screen (`/`)

The main landing page where you configure quizzes and access all features.

| Section | UI Elements |
|---|---|
| **Header** | "QuizMaster" gradient title |
| **Action buttons** | Upload Document, Global Manager |
| **Topic grid** | Selectable topic cards with counts and manage icons |
| **Question count** | Per-topic number inputs (visible when topic selected) |
| **Time limit** | Range slider + number input (1-60 min) |
| **Summary** | Total questions × time limit text |
| **Start button** | "Start Quiz" primary button |

### Upload Modal

| Section | UI Elements |
|---|---|
| **Drop zone** | Drag-and-drop area with file type labels |
| **File info** | Selected file name, size, and type |
| **Progress** | Status text + question counter + "Hide Progress" button |
| **Background Jobs** | Expandable list of all in-progress jobs, with live per-chunk status and a Stop (cancel) button per job |
| **Job Summary** (Review screen) | Live per-chunk progress card for the job just completed |
| **Review list** | Scrollable, paginated question list with inline edit, topic/subtopic/source dropdowns |
| **Bulk bar** | Appears when questions selected — Bulk Edit button + Delete Selected |
| **Bulk Edit Modal** | Field selector dropdown + value input + Apply to All |
| **Action buttons** | Discard & Close, Save Questions |

### Quiz Page (`/quiz`)

| Section | UI Elements |
|---|---|
| **Header card** | Question counter, timer, progress bar |
| **Question card** | Topic badge, context, question text, option buttons |
| **Footer** | Previous/Next/Submit buttons, navigation dots |
| **Submit modal** | Confirmation dialog for incomplete quizzes |

### Results Page (`/results`)

| Section | UI Elements |
|---|---|
| **Score card** | SVG circular progress ring, score text, "Take New Quiz" button |
| **Question list** | Per-question review cards with color coding and explanations |
| **Bottom button** | "Take Another Quiz" button |

### Global Manager (`/manage`)

| Section | UI Elements |
|---|---|
| **Header** | Back arrow, "Global Manager" title with question count |
| **Content card** | QuestionListManager with search, select, bulk edit, inline edit, delete |
| **Bulk Edit Modal** | Field selector + value input (appears when Bulk Edit clicked) |

---

## 6. Troubleshooting

### Cannot Connect to the Application

| Symptom | Solution |
|---|---|
| `localhost:3000` shows nothing | Ensure the frontend is running: `cd frontend && npm run dev` |
| Backend health check fails | Ensure the backend is running: `cd backend && npm run dev` |
| "Failed to fetch" errors in the browser | Verify backend is on port 5000 and CORS is configured correctly |
| MongoDB connection error on startup | Check that MongoDB is running and `MONGODB_URI` is correct in `.env` |

### Document Upload Issues

| Symptom | Solution |
|---|---|
| "Missing Gemini API key" error | Verify `GEMINI_API_KEY` is set in `backend/.env` and restart the backend |
| Upload appears stuck | The parsing runs as a background job — check the progress counter. For very large documents, it may take up to 60 seconds |
| "Unsupported file type" | Only `.pdf`, `.docx`, and `.txt` files are supported |
| "No questions could be extracted" | The document may not contain quiz-appropriate content. Try a document with factual, educational content |
| Image-based PDF returns no results | Image PDFs are supported — the AI processes them page by page. Ensure the scanned text is legible |
| AI generates low-quality questions | Review and edit questions before saving. The AI works best with structured educational content |
| Reopening modal doesn't show progress | The job ID is stored in localStorage — try clearing localStorage if the job has already completed |
| Parsing seems to hang on one chunk | Expand the chunk in the Background Jobs panel — it may be retrying a rate-limited AI model (up to 2 retries with backoff before it automatically falls back to the next model) |
| Need to stop an upload that's taking too long | Open the Background Jobs panel and click the **✕ (Stop)** button on that job — it cancels within a chunk or two |

### Quiz Issues

| Symptom | Solution |
|---|---|
| "Start Quiz" button is disabled | You must select at least one topic |
| Redirected to home page when opening `/quiz` | You must generate a quiz from the home screen first — direct URL access is blocked |
| Timer shows 00:00 immediately | Verify the time limit was set before starting the quiz |
| No questions appear for a topic | Check that the topic has questions in the database (visible on the home screen cards) |

### General Issues

| Symptom | Solution |
|---|---|
| Changes not appearing | Hard refresh the browser (Ctrl+Shift+R / Cmd+Shift+R) |
| Backend crashes on startup | Check all `.env` variables are set correctly. Ensure MongoDB is accessible |
| "Internal server error" responses | Check the backend terminal for error details (more verbose in development mode) |

---

## 7. FAQ

### General

**Q: How many questions can the AI extract from a document?**  
A: There's no hard limit. A typical 10-page document might yield 20-50 questions depending on content density.

**Q: Can I manually add questions without uploading a document?**  
A: Currently, the primary way to add questions is through document upload. The API supports direct question upload (`POST /api/upload-questions`), which could be used with external tools.

**Q: Are my uploaded documents stored on the server?**  
A: No. Documents are processed in memory and never saved to disk. Only the extracted questions are stored in the database.

**Q: What happens to my quiz data if I close the browser?**  
A: Quiz session data (current quiz, answers, timer) is stored in browser memory only. If you close the browser or navigate away, your quiz progress is lost. Your question bank in MongoDB is preserved.

**Q: Can I close the browser during document parsing?**  
A: Yes! Document parsing runs as a background job on the server. The job ID is saved in your browser's localStorage, so when you reopen the app and the upload modal, it will automatically check on the job's status and show you the results when ready.

**Q: Can I cancel a document upload that's in progress?**  
A: Yes. Open the upload modal — any in-progress job (yours or one started elsewhere) appears in the **Background Jobs** panel with a Stop button. Cancelling stops the job before its next chunk starts processing; a chunk already in flight to the AI still finishes, but its results aren't used.

### AI & Document Processing

**Q: Which AI model does QuizMaster use?**  
A: QuizMaster uses Google's Gemini AI. It automatically selects the best available model, preferring `gemini-2.5-flash` for optimal speed and quality. If a model is unavailable or rate-limited, it automatically falls back to alternative models.

**Q: Does the AI always generate correct answers?**  
A: The AI is highly accurate but not infallible. We strongly recommend reviewing AI-generated questions before saving them.

**Q: Can I use the app without an AI API key?**  
A: Yes, but you won't be able to use the document upload feature. You can still manage existing questions and take quizzes.

**Q: Is my document content sent to Google?**  
A: Yes, the text extracted from your document is sent to Google's Gemini API for processing. Do not upload sensitive or confidential documents.

### Quizzes

**Q: Are quiz questions randomized?**  
A: Yes. Questions are randomly sampled from each selected topic and then shuffled using the Fisher-Yates algorithm.

**Q: Can I retake a quiz with the same questions?**  
A: Each quiz generation creates a fresh randomized selection. The questions may differ due to random sampling.

**Q: What happens if I don't answer all questions?**  
A: Unanswered questions are counted as incorrect. You'll see a confirmation dialog before submitting.

**Q: Can I pause a quiz and resume later?**  
A: No. The timer runs continuously once a quiz starts.

### Question Management

**Q: What is the "source" field?**  
A: The source field lets you tag where a question came from (e.g., "Chapter 3 — Biology Textbook"). It's optional and helps you organize questions by their origin.

**Q: How does Bulk Edit work?**  
A: Select multiple questions using checkboxes, click "Bulk Edit", choose a field to update (topic, subtopic, source, etc.), enter the new value, and click "Apply to All". All selected questions are updated simultaneously.

---

## 8. Keyboard Shortcuts & Accessibility

### Topic Selection (Home Screen)

| Key | Action |
|---|---|
| `Tab` | Move focus between topic cards |
| `Enter` / `Space` | Toggle topic selection |

### Quiz Navigation

| Key | Action |
|---|---|
| `Tab` | Move focus between option buttons |
| `Enter` / `Space` | Select the focused option |
| Click **Previous** | Go to previous question |
| Click **Next** | Go to next question |

### Accessibility Features

- All interactive elements are keyboard-navigable
- Buttons include descriptive `aria-label` attributes where applicable
- Color is never the sole indicator — text labels accompany color-coded elements
- High contrast ratios maintained against the dark theme background
- Focus indicators visible on all interactive elements
- Timer has `data-testid` attribute for testing tools

---

## 9. Glossary

| Term | Definition |
|---|---|
| **Topic** | A broad subject category for questions (e.g., "Mathematics", "Science") |
| **Subtopic** | A subdivision within a topic (e.g., "Algebra" within "Mathematics") |
| **Source** | An optional tag indicating where a question originated (e.g., "Chapter 5", "Lecture Notes") |
| **Context** | A passage or additional information provided alongside a question to give background |
| **Explanation** | A detailed explanation of why the correct answer is correct, shown after quiz submission |
| **Answer Key** | The set of correct answers for a quiz, kept separate from questions during quiz-taking |
| **Bulk Edit** | An operation that updates a single field across multiple selected questions at once |
| **Background Job** | A server-side process that runs asynchronously — used for AI document parsing so the user doesn't need to wait |
| **Gemini AI** | Google's large language model used for document parsing and question generation |
| **Glassmorphism** | A UI design trend using translucent backgrounds with backdrop blur effects |
| **Fisher-Yates Shuffle** | An algorithm for generating a random permutation of a sequence — used for quiz randomization |
| **Question Bank** | The complete collection of all questions stored in the database |
