import { TopicInfo, Question, AnswerKey, QuestionData } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

/** Fetch all available topics with question counts */
export async function fetchTopics(): Promise<{ _id: string; count: number }[]> {
  const res = await fetch(`${API_BASE}/topics`);
  if (!res.ok) throw new Error('Failed to fetch topics');
  return res.json();
}

export async function fetchQuestionsByTopic(topic: string): Promise<QuestionData[]> {
  const res = await fetch(`${API_BASE}/topics/${encodeURIComponent(topic)}/questions`);
  if (!res.ok) throw new Error('Failed to fetch questions for topic');
  return res.json();
}

export async function searchQuestions(query: string): Promise<QuestionData[]> {
  const res = await fetch(`${API_BASE}/questions/search?q=${encodeURIComponent(query)}`);
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
  if (!res.ok) throw new Error('Failed to upload questions');
  return res.json();
}
