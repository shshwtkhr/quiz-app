'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import ResultsReview from '@/components/ResultsReview';
import { useQuizStore } from '@/stores/quiz-store-provider';

export default function ResultsPage() {
  const router = useRouter();
  const isSubmitted = useQuizStore((s) => s.isSubmitted);

  useEffect(() => {
    if (!isSubmitted) {
      router.replace('/');
    }
  }, [isSubmitted, router]);

  if (!isSubmitted) return null;

  return <ResultsReview />;
}
