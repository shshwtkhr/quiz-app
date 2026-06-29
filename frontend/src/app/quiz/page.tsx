'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import QuizEngine from '@/components/QuizEngine';
import { useQuizStore } from '@/stores/quiz-store-provider';

export default function QuizPage() {
  const router = useRouter();
  const totalQuestions = useQuizStore((s) => s.totalQuestions);

  useEffect(() => {
    if (totalQuestions === 0) {
      router.replace('/');
    }
  }, [totalQuestions, router]);

  if (totalQuestions === 0) return null;

  return <QuizEngine />;
}
