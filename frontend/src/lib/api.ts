import { TopicInfo, Question, AnswerKey } from '@/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

/** Fetch all available topics with question counts */
export async function fetchTopics(): Promise<TopicInfo[]> {
  const res = await fetch(`${API_BASE}/topics`);
  if (!res.ok) throw new Error('Failed to fetch topics');
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
