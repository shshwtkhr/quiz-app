# AI Document Upload Complete!

The Quiz Application is now equipped with cutting-edge AI capabilities! You can now upload raw, unstructured documents and let the app automatically generate fully structured quizzes.

## What Was Added

- **Drag-and-Drop Modal**: A beautiful new glassmorphic modal on the home screen allows you to drag in `.pdf`, `.docx`, or `.txt` files.
- **Smart Parsing Pipeline**: The backend routes the uploaded file through an extraction engine (`pdf-parse`, `mammoth`) to pull raw text natively without storing files on disk.
- **Resilient Background Processing**: The heavy AI extraction is offloaded to a background job. If you close the modal or even refresh the app, the job will continue, and the app will resume showing you progress when you open it next time!
- **Gemini Integration**: The raw text is chunked and streamed to Google's `gemini-2.5-flash` model, which uses a strict system prompt and schema constraint to generate a perfect JSON array of `[Topic, Subtopic, Source, Context, Question, Options, Answer, Explanation]`.
- **Database Upsert**: The structured AI response is instantly validated and pushed to your MongoDB database using bulk upsert logic to avoid duplicates.
- **Reactive UI**: The moment the background job completes, the modal transitions to a powerful review screen where you can bulk edit topics, subtopics, and sources before saving!

## How to Test It

> [!WARNING]  
> **Backend Restart Required**  
> Since we installed new npm packages (`multer`, `@google/genai`, etc.) and you just added your `GEMINI_API_KEY` to the `.env`, you **MUST** restart the Node.js backend server for the changes to take effect!
> 
> ```bash
> cd backend
> npm run dev
> ```

1. Open your browser to `http://localhost:3000`.
2. Click the new **Upload Document** button next to the "Choose Topics" header.
3. Drop in a text file or PDF that contains some facts or a list of raw questions.
4. Watch the loading states transition from *Uploading* to *AI is parsing...* to *Saving*.
5. Watch the home screen magically populate with your new questions!

Let me know if you encounter any issues or want to tweak the UI!
