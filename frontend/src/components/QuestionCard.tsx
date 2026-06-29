'use client';

import { useQuizStore } from '@/stores/quiz-store-provider';

export default function QuestionCard() {
  const currentIndex = useQuizStore((s) => s.currentIndex);
  const questions = useQuizStore((s) => s.questions);
  const selectedAnswers = useQuizStore((s) => s.selectedAnswers);
  const selectAnswer = useQuizStore((s) => s.selectAnswer);

  const question = questions[currentIndex];
  if (!question) return null;

  const selectedAnswer = selectedAnswers[question._id];

  return (
    <div className="animate-fade-in" key={question._id}>
      {/* Topic Badge */}
      <div className="mb-4">
        <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-primary/20 text-primary-light border border-primary/30">
          {question.topic}
        </span>
      </div>

      {/* Question Text */}
      <h2 className="text-xl md:text-2xl font-semibold text-text-primary mb-8 leading-relaxed">
        {question.question_text}
      </h2>

      {/* Options */}
      <div className="space-y-3">
        {question.options.map((option, idx) => {
          const isSelected = selectedAnswer === option;
          const letter = String.fromCharCode(65 + idx); // A, B, C, D

          return (
            <button
              key={`${question._id}-${idx}`}
              onClick={() => selectAnswer(question._id, option)}
              className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer flex items-center gap-4 group ${
                isSelected
                  ? 'bg-primary/15 border-primary/50 shadow-[0_0_15px_oklch(0.55_0.2_270_/_0.1)]'
                  : 'bg-surface/50 border-glass-border hover:bg-surface-light hover:border-text-muted/30'
              }`}
            >
              <span
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 transition-all ${
                  isSelected
                    ? 'bg-primary text-white'
                    : 'bg-surface-lighter text-text-muted group-hover:bg-surface-lighter group-hover:text-text-secondary'
                }`}
              >
                {letter}
              </span>
              <span className={`text-base ${ isSelected ? 'text-text-primary font-medium' : 'text-text-secondary' }`}>
                {option}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
