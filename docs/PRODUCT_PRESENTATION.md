# QuizMaster — Product Presentation

> **Version:** 1.3.0  
> **License:** MIT — Copyright © 2026 Shashwat Khare  
> **Last Updated:** August 2026

Internal engineering review deck — product walkthrough, the AI parsing pipeline, token spend, stack, testing, branch divergence and roadmap. The rendered deck is at [`assets/quizmaster-product-review.html`](assets/quizmaster-product-review.html) (self-contained, opens in any browser; press `P` / use the browser print dialog to export as PDF).

---

## Table of Contents

1. [Deck Overview](#1-deck-overview)
2. [Shape of the System](#2-shape-of-the-system)
3. [Product Walkthrough](#3-product-walkthrough)
4. [The AI Parsing Pipeline](#4-the-ai-parsing-pipeline)
5. [Cutting Token Spend](#5-cutting-token-spend)
6. [Tech Stack](#6-tech-stack)
7. [Testing](#7-testing)
8. [Branch Divergence](#8-branch-divergence)
9. [Open Items](#9-open-items)
10. [Roadmap](#10-roadmap)

---

## 1. Deck Overview

| | |
|---|---|
| **Audience** | Internal engineering |
| **Length** | 20 slides, ~20 minutes |
| **Format** | 1920×1080, self-contained HTML with speaker notes |
| **Source file** | `assets/quizmaster-product-review.html` |

Six parts: product walkthrough, the AI parsing pipeline, cutting token spend, stack & testing, branch divergence, open items & roadmap.

**One-line summary:** the model points at the document, the person decides what it means. The line-index prompt keeps extracted text verbatim and cheap; nothing reaches the question bank without a human tagging it.

---

## 2. Shape of the System

Monorepo, two services, one detached worker. The frontend never talks to Gemini — all AI work happens in the background worker in `documentController.js`.

| Layer | What it is | Notes |
|---|---|---|
| **Client** | Next.js 15 · React 19 | Routes `/`, `/quiz`, `/results`, `/manage`. Quiz state in a Zustand store; nothing persisted server-side. |
| **API** | Express, 12 routes | Questions CRUD, search, bulk update, quiz generation, document upload, job status/cancel. |
| **Data** | MongoDB · Mongoose | Models: `Question`, `ParsingJob`, `Config`. Unique index on topic + subtopic + question text makes re-upload idempotent. |
| **AI** | Gemini, model ladder | Models discovered at runtime and ranked, not hardcoded. API key read from the DB `Config` collection, env as fallback. |

Upload returns **202 with a job id** in milliseconds. Everything expensive happens after the response — the browser polls, and closing the tab does not kill the parse.

---

## 3. Product Walkthrough

Seven screens: Home → Upload → Parsing → Review → Quiz → Results → Global Manager. See [APPLICATION_FLOW.md](APPLICATION_FLOW.md) for the full state-and-decision diagram.

### 3.1 Configure (`components/QuizConfig.tsx`)

One screen does topic selection, per-topic question count and the time limit. Start Quiz stays disabled until something is selected.

- Counts are clamped — default 5, capped at what the topic actually has.
- Two ways into management: the Global Manager route, or the pencil on a single topic card.
- A job id in `localStorage` reopens the upload modal on mount, resuming a running parse.

### 3.2 Upload & Parse (`components/UploadDocumentModal.tsx`)

- **Nothing blocks** — the POST returns a job id in milliseconds; the worker runs detached.
- **Per-chunk telemetry** — status, page range, current model and full attempt history stored on the job document.
- **Cancellable mid-flight** — the worker re-reads job status before every chunk and aborts.
- **Survives a reload** — the job id in `localStorage` reopens the modal where it left off.

### 3.3 Review (`status === 'review'` · `BulkEditModal.tsx`)

The AI never writes straight to the bank. Parsed questions land in a review step; nothing is saved until a person has looked at the tags.

- Three taxonomies — topic, subtopic and source, each a dropdown of what exists plus "create new".
- Drag-select — press and sweep to select a run, then bulk-edit or delete it.
- Full inline edit — passage, question, options, correct answer, explanation.
- Idempotent save — upsert on a unique compound index, so a re-upload cannot duplicate.

### 3.4 Quiz & Results (`QuizEngine.tsx` · `Timer.tsx` · `ResultsReview.tsx`)

- **Answers held separately** — the rendered question payload carries no correct answer; the key is a sibling object.
- **Timer owns submission** — warning at 60s, critical at 30s, auto-submit at zero, no dialog.
- **Explanations are the point** — every question keeps its source passage, so the explanation is grounded in the document it came from.

### 3.5 Global Manager (`app/manage/page.tsx` · `ManageTopicModal.tsx`)

`QuestionListManager` is mounted globally at `/manage` and again, scoped to one topic, inside the pencil modal on a topic card.

- Grouped topic → subtopic; untagged rows are flagged "Uncategorized in Database" so gaps are visible rather than silent.
- Search hits every field: question, passage, options, answer, explanation, topic, subtopic, source.
- Bulk edit one field at a time — pick a field, type a value, apply to the whole selection.

---

## 4. The AI Parsing Pipeline

Document in, tagged questions out — six stages.

| # | Stage | What happens |
|---|---|---|
| 1 | **Extract** | A custom `pdf-parse` page renderer injects page markers and re-emits bold/italic as Markdown. DOCX via `mammoth`, TXT raw. |
| 2 | **Branch** | Text after stripping markers? Text path. Nothing? It is a scan — `pdf-lib` cuts 5-page sub-PDFs for Gemini's native vision. |
| 3 | **Chunk** | Lines numbered into a dictionary, then 250-line windows with 50 lines of overlap so a question is never cut in half. |
| 4 | **Ladder** | Models listed at runtime and scored. Rate-limited models go into a global cool-down map and are skipped, not retried. |
| 5 | **Validate** | Response schema enforced; a regex rescues fenced JSON. Questions without ≥2 options or a matching answer are dropped. |
| 6 | **Review** | Progress written per chunk to the job document. On completion the UI opens the review table — the human tags and saves. |

Failure is expected, not exceptional: chunk state, model, attempt count and a full attempt history are persisted so a bad parse can be read after the fact.

### 4.1 Two prompts, two schemas

The single biggest cost decision in the codebase — the text path never asks the model to reproduce text, only to point at line numbers.

**Text path — semantic router. Output is integers:**

```json
{
  "context_lines": [12, 13, 14],
  "question_lines": [21],
  "options": [{ "lines": [22], "is_correct": false }],
  "explanation_lines": [27, 28]
}
```

The chunk is sent as `[n] text` and the model returns only indexes. Server-side rehydration rebuilds the question. Output tokens collapse to a fraction of the passage length, and the text is guaranteed verbatim — no paraphrase, no hallucinated option.

**Scan path — vision fallback. Output is full text:**

```
topic, subtopic, context, question_text, options[], correct_answer, explanation
```

There are no lines to point at in an image, so 5-page sub-PDFs go in as inline base64 and the model writes the question out. Expensive, slower, and the only path where a shared "Directions (181–185)" block must be duplicated onto every question it governs.

---

## 5. Cutting Token Spend

**Proposed — none of these are built yet.** Ordered by effort-to-payoff. 01–03 are self-contained changes inside `documentController.js`; 05 and 06 change the shape of the worker.

| # | Where | Proposal | Rationale |
|---|---|---|---|
| 01 | Input | **Gate chunks with a regex** | Front matter, tables of contents and answer-key appendices contain no question stems. Skip them before spending a call. |
| 02 | Input | **Cut the 50-line overlap** | 20% of every chunk is re-sent today. Split on a blank line before a numbered stem instead and overlap drops to near zero. |
| 03 | Input | **Cache the instruction block** | The rules preamble is identical on every call. Move it to a cached system instruction — pay once per document, not per chunk. |
| 04 | Output | **Index the explanation too** | Where the source already prints a solution, point at it. Only generate prose when the document has none. |
| 05 | Routing | **Two-pass, cheap first** | A lite model finds question boundaries; the strong model only runs on chunks it flags as ambiguous. |
| 06 | Scans | **Local OCR before vision** | Run OCR on the scan; if it yields clean text, the document rejoins the cheap line-index path and skips vision entirely. |

---

## 6. Tech Stack

Boring on purpose.

| Layer | Choice | Why it's there |
|---|---|---|
| **Framework** | Next.js 15, React 19 | App router; three quiz routes plus `/manage`. No SSR data fetching — everything client-side against the API. |
| **Styling** | Tailwind CSS 4 | Design tokens declared as an `@theme` block in OKLCH; glass cards and gradients as hand-written utilities. |
| **State** | Zustand, provider-scoped | Quiz session lives entirely in memory — questions, answer key, selections, timer. A refresh mid-quiz loses it. |
| **API** | Express, 12 routes | One router, two controllers, a 10 MB JSON limit and multer memory storage for uploads. |
| **Data** | MongoDB · Mongoose | `Question`, `ParsingJob`, `Config`. Unique compound index gives upsert-on-re-upload for free. |
| **AI** | `@google/genai` · Gemini | Runtime model discovery, scored ladder, hourly cache, global rate-limit map. Key read from the DB with env fallback. |
| **Docs** | `pdf-parse` · `pdf-lib` · `mammoth` | Text extraction, scan splitting and DOCX respectively — chosen after pinning `pdf-parse` back to 1.1.1. |

---

## 7. Testing

One deep E2E path, thin everywhere else.

### 7.1 Playwright — the full journey

1. Upload a document
2. Wait out real AI parsing
3. Inline-edit and tag a topic
4. Drag-select and bulk-delete
5. Verify in the Global Manager
6. Play the quiz and assert the results page
7. Background Jobs modal: display and cancel (TECHDL-11)

The run is recorded to video with an injected cursor and shipped in the README. A cleanup script removes the `E2E-TEST-TOPIC-*` records it creates.

### 7.2 Unit

- **Backend:** 2 Jest suites — API routes and document upload.
- **Frontend:** 1 suite — QuizEngine.

### 7.3 Not covered

- Chunking and rehydration logic
- Model-ladder fallback and rate-limit skip
- Bulk update and search endpoints
- Every manager component

### 7.4 The real gap

There is no parse-accuracy harness. We can tell you a parse finished; we cannot tell you how much of the document it got right.

---

## 8. Branch Divergence

| Branch | State | What it carries |
|---|---|---|
| `main` <br>tag 1.0.0, 1.1.0 | **Baseline** | The whole product: AI upload, chunked streaming progress, subtopics, sources, bulk edit, resilient background parsing with polling, page tracking and chunk ordering. |
| `TECHDL-10-1.1.0` <br>1 commit ahead of its base | **Landed** | A single fix: a `ReferenceError` in the chunking loop that was silently dropping questions from long uploads. |
| `TEHCDL-10-1.2.0` <br>⚠ branch name is misspelled | **Landed** | Per-page text extraction for PDFs, smaller chunks, and pagination in both review and manager lists — including a fully custom items-per-page control. |
| `TECHDL-10-1.3.0` <br>7 commits, branched off `main` | **Live · unmerged** | Extraction rewritten; JSON truncation on large docs fixed by cutting chunk size; rate-limit safety; background job tracking UI with instant cancellation; jobs visible during the parsing spinner; regex rescue for markdown-fenced JSON; image-PDF detection fix; the TECHDL-11 E2E test. |

1.3.0 is one theme end to end — **make large, messy documents survive parsing**. It should merge as a unit, behind the E2E suite.

---

## 9. Open Items

### Blocking anything real

- **No authentication** — every route is open. Anyone who can reach the API can delete the entire bank.
- **Hardcoded `localhost:5000`** — three call sites bypass `API_BASE` and fetch the backend directly; they break outside dev.

### Correctness & throughput

- No parse-accuracy measurement — no golden document, no recall number.
- Chunk concurrency is 1 — a 60-page PDF is strictly serial.
- Failed chunks are terminal — recorded, but there is no retry-just-these action.
- Quiz state is memory-only — refresh mid-quiz and the attempt is gone.

### Polish

- Native `alert` / `confirm` — deletion in the manager uses browser dialogs.
- No attempt history — results are never stored, so there is no progress over time.
- Question dots hidden on mobile — no small-screen equivalent for jumping around.
- Dead helper in `api.ts` — `uploadQuestions` is unused; the modal fetches directly.
- Misspelled branch — `TEHCDL-10-1.2.0`.

---

## 10. Roadmap

### Horizon 1 · close out 1.3.0 — land the resilience work

- Merge 1.3.0 to `main` behind the E2E suite
- Route every fetch through `API_BASE`
- Rename the misspelled branch, delete merged ones
- Replace `confirm()` with the app's own dialog
- Retry-failed-chunks action on a finished job

### Horizon 2 · make it measurable — accuracy and cost

- Golden-document harness: recall, tagging accuracy, cost per 100 questions
- Token work 01–04 from §5
- Raise chunk concurrency with a shared rate-limit budget
- Unit tests for chunking and rehydration

### Horizon 3 · beyond one machine — multi-user

- Auth and per-user question banks
- Persisted attempts, so scores trend over time
- Weak-topic targeting from attempt history
- Two-pass routing and local OCR (§5 · 05, 06)

Horizon 1 is a day's work and unblocks the rest. Nothing in Horizon 2 is worth starting before the accuracy harness exists — otherwise we are optimising a number we cannot see.
