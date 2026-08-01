import { TopicInfo, Question, AnswerKey, QuestionData } from '@/types';

/**
 * Every call in this module goes through API_BASE — nothing in the app should
 * build a backend URL of its own.
 *
 * In the browser we always call the same origin and let the Next.js rewrite in
 * next.config.ts proxy `/api/*` to the backend, which keeps us free of CORS.
 * On the server there is no rewrite to ride on, so we address the backend
 * directly via BACKEND_ORIGIN (the same variable the rewrite uses).
 */
const API_BASE = typeof window !== 'undefined'
  ? '/api'
  : (process.env.BACKEND_ORIGIN
      ? `${process.env.BACKEND_ORIGIN}/api`
      : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'));

/** Fetch all available topics with their subtopics and question counts */
export async function fetchTopics(): Promise<TopicInfo[]> {
  const res = await fetch(`${API_BASE}/topics`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch topics');
  return res.json();
}

/** Fetch all distinct sources currently in use */
export async function fetchSources(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/sources`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch sources');
  return res.json();
}

export async function fetchQuestionsByTopic(topic: string): Promise<QuestionData[]> {
  const res = await fetch(`${API_BASE}/topics/${encodeURIComponent(topic)}/questions`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch questions for topic');
  return res.json();
}

export async function searchQuestions(query: string): Promise<QuestionData[]> {
  const res = await fetch(`${API_BASE}/questions/search?q=${encodeURIComponent(query)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to search questions');
  return res.json();
}

export async function deleteQuestions(ids: string[]): Promise<{ message: string; deletedCount: number }> {
  const res = await fetch(`${API_BASE}/questions`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error('Failed to delete questions');
  return res.json();
}

export async function updateQuestion(id: string, data: Partial<QuestionData>): Promise<QuestionData> {
  const res = await fetch(`${API_BASE}/questions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || 'Failed to update question');
  }
  return res.json();
}

export async function bulkUpdateQuestions(ids: string[], updateData: Partial<QuestionData>): Promise<{ message: string; modifiedCount: number }> {
  const res = await fetch(`${API_BASE}/questions/bulk`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, updateData }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || 'Failed to bulk update questions');
  }
  return res.json();
}

/** Generate a quiz from selected topics */
export async function generateQuiz(
  topics: { topic: string; count: number }[]
): Promise<{ questions: Question[]; answerKey: AnswerKey; totalQuestions: number }> {
  const res = await fetch(`${API_BASE}/generate-quiz`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topics }),
  });
  if (!res.ok) throw new Error('Failed to generate quiz');
  return res.json();
}

/** Upload questions to the database */
export async function uploadQuestions(data: unknown[]): Promise<unknown> {
  const res = await fetch(`${API_BASE}/upload-questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || 'Failed to upload questions');
  }
  return res.json();
}

/** Upload document for background parsing job */
export async function uploadDocumentJob(file: File): Promise<{ jobId: string, message: string }> {
  const formData = new FormData();
  formData.append('file', file);
  
  const res = await fetch(`${API_BASE}/upload-document`, {
    method: 'POST',
    body: formData,
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to start document parsing job');
  }
  
  return res.json();
}

/** Get status of a background parsing job */
export async function getJobStatus(jobId: string): Promise<{
  _id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  totalChunks: number;
  parsedQuestions: any[];
  error: string | null;
}> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}`, { cache: 'no-store' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to get job status');
  }
  return res.json();
}

/** Get all currently active parsing jobs */
export async function getActiveJobs(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/jobs/active`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch active jobs');
  return res.json();
}

/** Cancel an active parsing job */
export async function cancelJob(jobId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}/cancel`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to cancel job');
  }
  return res.json();
}
