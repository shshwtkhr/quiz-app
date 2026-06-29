'use client';

import { useEffect, useCallback } from 'react';
import { useQuizStore } from '@/stores/quiz-store-provider';

export default function Timer() {
  const timeRemaining = useQuizStore((s) => s.timeRemaining);
  const tickTimer = useQuizStore((s) => s.tickTimer);
  const submitQuiz = useQuizStore((s) => s.submitQuiz);
  const isSubmitted = useQuizStore((s) => s.isSubmitted);

  const handleAutoSubmit = useCallback(() => {
    submitQuiz();
  }, [submitQuiz]);

  useEffect(() => {
    if (isSubmitted) return;

    if (timeRemaining <= 0) {
      handleAutoSubmit();
      return;
    }

    const interval = setInterval(() => {
      tickTimer();
    }, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining, isSubmitted, tickTimer, handleAutoSubmit]);

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const isWarning = timeRemaining <= 60 && timeRemaining > 0;
  const isCritical = timeRemaining <= 30 && timeRemaining > 0;

  return (
    <div
      data-testid="timer"
      className={`font-mono text-2xl font-bold tracking-wider transition-colors ${
        isCritical
          ? 'text-danger animate-pulse'
          : isWarning
          ? 'text-warning'
          : 'text-text-primary'
      }`}
    >
      {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
    </div>
  );
}
