# QuizMaster

Turn a document into a quiz. Drop in a PDF, DOCX or TXT; Gemini extracts the
questions, you review and tag them, then take the quiz and read the explanations.

> **Version:** 1.4.0 · **License:** MIT — Copyright © 2026 Shashwat Khare

## 🎥 Full Application Flow

A real-time recording of the complete flow, validated by the automated E2E suite:

<video src="https://github.com/shshwtkhr/quiz-app/raw/main/e2e-test/quiz_app_demo.mp4" width="100%" controls autoplay loop></video>

*(If the video does not play inline, [download it here](e2e-test/quiz_app_demo.mp4).)*

## ✨ Features

- **Document upload** — PDF, DOCX and TXT. Scanned PDFs with no extractable text are split into 5-page sub-documents and read with Gemini's vision models.
- **AI-powered parsing** — models are discovered at runtime and ranked rather than hardcoded, with automatic fallback when one is rate-limited.
- **Background jobs** — upload returns immediately with a job id; parsing continues if you close the tab, and can be cancelled mid-flight.
- **Human review before saving** — nothing reaches the question bank until you have looked at the topic, subtopic and source tags.
- **Context & source preservation** — each question keeps the passage it came from, so explanations are grounded in the document.
- **Dynamic quiz engine** — randomised questions per topic, with a timer.
- **Global & topic manager** — search, inline-edit, categorise and delete across the whole bank or within one topic.
- **Multi-select bulk edit** — retag many questions at once.

## 🚦 Getting Started

**Prerequisites:** Node.js 20+, a running MongoDB, and a Google Gemini API key.

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env    # then edit: MONGODB_URI, GEMINI_API_KEY
npm run dev
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The app is then at `http://localhost:3000`.

> The browser only ever calls the frontend's own origin. Next.js proxies `/api/*`
> to the backend, so set `BACKEND_ORIGIN` (see [frontend/.env.example](frontend/.env.example))
> if your backend is not on `http://localhost:5000`.

### 3. Tests

```bash
cd backend && npm test
```

```bash
cd e2e-test && npm install && npm test
```

E2E runs create records under a sentinel topic; remove them with
`cd e2e-test && npm run cleanup`.

## 🛠️ Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 15 · React 19 · Tailwind CSS 4 · Zustand |
| Backend | Node.js · Express · MongoDB (Mongoose) |
| AI | `@google/genai` — Gemini, runtime model discovery with a scored fallback ladder |
| Documents | `pdf-parse` (text) · `pdf-lib` (scan splitting) · `mammoth` (DOCX) |
| Testing | Jest · Supertest · Playwright, with GitHub Actions CI on every PR |

## 📦 Project Structure

Three independent packages — each has its own `package.json`:

- **`frontend/`** — Next.js application
- **`backend/`** — Express API, with developer utilities in [`backend/scripts/`](backend/scripts/README.md)
- **`e2e-test/`** — Playwright suite

## 📚 Documentation

| Document | For |
|---|---|
| [Technical Documentation](docs/TECHNICAL_DOCUMENTATION.md) | Architecture, API reference, schemas, environment, testing, deployment |
| [User Manual](docs/USER_MANUAL.md) | Using the app |
| [How the AI parsing works](docs/ai_parsing_explained_simple.md) | The pipeline, explained without jargon |
| [Application Flow](docs/APPLICATION_FLOW.md) | Every screen and decision, as a diagram |
| [Product Presentation](docs/PRODUCT_PRESENTATION.md) | Internal engineering review deck |
| [Architecture & Roadmap](docs/ARCHITECTURE_AND_ROADMAP.md) | Point-in-time audit, findings register and remediation plan |

## 📄 License

MIT — see [LICENSE](LICENSE).
