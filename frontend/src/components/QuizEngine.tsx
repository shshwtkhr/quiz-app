'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuizStore } from '@/stores/quiz-store-provider';
import Timer from './Timer';
import QuestionCard from './QuestionCard';

export default function QuizEngine() {
  const router = useRouter();
  const currentIndex = useQuizStore((s) => s.currentIndex);
  const totalQuestions = useQuizStore((s) => s.totalQuestions);
  const isSubmitted = useQuizStore((s) => s.isSubmitted);
  const nextQuestion = useQuizStore((s) => s.nextQuestion);
  const prevQuestion = useQuizStore((s) => s.prevQuestion);
  const submitQuiz = useQuizStore((s) => s.submitQuiz);
  const selectedAnswers = useQuizStore((s) => s.selectedAnswers);
  const questions = useQuizStore((s) => s.questions);

  const [showConfirm, setShowConfirm] = useState(false);

  const isFirst = currentIndex === 0;
  const isLast = currentIndex === totalQuestions - 1;
  const answeredCount = Object.keys(selectedAnswers).length;
  const progress = ((currentIndex + 1) / totalQuestions) * 100;

  // Navigate to results when submitted
  useEffect(() => {
    if (isSubmitted) {
      router.push('/results');
    }
  }, [isSubmitted, router]);

  if (isSubmitted) {
    return null;
  }

  const handleSubmit = () => {
    if (answeredCount < totalQuestions) {
      setShowConfirm(true);
    } else {
      submitQuiz();
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="glass-card p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-text-secondary">
            Question{' '}
            <span className="text-text-primary font-bold text-lg">{currentIndex + 1}</span>
            <span className="text-text-muted"> / {totalQuestions}</span>
          </div>
          <Timer />
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 rounded-full bg-surface-lighter overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${progress}%`,
              background: 'var(--gradient-primary)',
            }}
          />
        </div>
      </div>

      {/* Question Card */}
      <div className="glass-card p-6 md:p-8 mb-6">
        <QuestionCard />
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevQuestion}
          disabled={isFirst}
          className="px-6 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed bg-surface-light border border-glass-border text-text-secondary hover:bg-surface-lighter hover:text-text-primary"
        >
          ← Previous
        </button>

        {/* Question dots */}
        <div className="hidden md:flex items-center gap-1.5">
          {questions.map((q, i) => (
            <div
              key={q._id}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                i === currentIndex
                  ? 'bg-primary scale-125'
                  : selectedAnswers[q._id]
                  ? 'bg-accent/60'
                  : 'bg-surface-lighter'
              }`}
            />
          ))}
        </div>

        {isLast ? (
          <button onClick={handleSubmit} className="btn-primary px-8 py-3 text-sm">
            Submit Quiz
          </button>
        ) : (
          <button
            onClick={nextQuestion}
            className="px-6 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer bg-primary/20 border border-primary/30 text-primary-light hover:bg-primary/30"
          >
            Next →
          </button>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="glass-card p-8 max-w-md mx-4 text-center">
            <h3 className="text-xl font-bold text-text-primary mb-3">Submit Quiz?</h3>
            <p className="text-text-secondary mb-6">
              You have answered <span className="text-warning font-semibold">{answeredCount}</span> out of{' '}
              <span className="font-semibold">{totalQuestions}</span> questions.
              Unanswered questions will be marked as incorrect.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-6 py-2.5 rounded-xl bg-surface-light border border-glass-border text-text-secondary hover:bg-surface-lighter transition-all cursor-pointer"
              >
                Go Back
              </button>
              <button
                onClick={() => { setShowConfirm(false); submitQuiz(); }}
                className="btn-primary px-6 py-2.5"
              >
                Submit Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
