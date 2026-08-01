# Backend utility scripts

Developer tools. None of these run as part of the app, the test suite, or CI —
they are here so it is obvious which scripts are supported and what each one is
for. Run them from the `backend/` directory.

| Script | Command | What it does |
|---|---|---|
| `seed-config.js` | `node scripts/seed-config.js` | Copies `GEMINI_API_KEY` from `backend/.env` into the MongoDB `Config` collection, which `documentController` reads in preference to the environment variable. |
| `check-gemini.js` | `node scripts/check-gemini.js` | Lists the models your key can see and makes one `generateContent` call. Tells an API-key problem apart from a parsing-pipeline problem. |
| `list-models.js` | `node scripts/list-models.js` | Shows every visible model scored and ranked **exactly as the pipeline ranks them** — the output is the fallback order a job will use, plus anything rejected by the `-50` cutoff. Imports the scoring from [`src/services/documentParsing.js`](../src/services/documentParsing.js) rather than copying it. |
| `inspect-pdf-text.js` | `node scripts/inspect-pdf-text.js <file.pdf>` | Dumps what `pdf-parse` extracts, with the same bold/italic inference the upload pipeline applies. Empty output means the PDF is image-only and will take the `pdf-lib` split path. |
| `drop-db.js` | `node scripts/drop-db.js` | **Destructive.** Drops the entire local `quiz-app` database. |

## Why `drop-db.js` ignores `MONGODB_URI`

Its connection string is hardcoded to `mongodb://127.0.0.1:27017/quiz-app`. That
is deliberate: reading `MONGODB_URI` would mean a production `.env` sitting in
the environment points a "drop the database" script at production.

## Related

E2E test data cleanup lives elsewhere and is narrower — it removes only the
sentinel topic, not the database:

```bash
cd e2e-test && npm run cleanup
```
