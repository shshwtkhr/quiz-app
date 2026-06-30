'use client';

import { useRouter } from 'next/navigation';
import { useQuizStore } from '@/stores/quiz-store-provider';

export default function ResultsReview() {
  const router = useRouter();
  const score = useQuizStore((s) => s.score);
  const totalQuestions = useQuizStore((s) => s.totalQuestions);
  const questions = useQuizStore((s) => s.questions);
  const answerKey = useQuizStore((s) => s.answerKey);
  const selectedAnswers = useQuizStore((s) => s.selectedAnswers);
  const resetQuiz = useQuizStore((s) => s.resetQuiz);

  const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
  const circumference = 2 * Math.PI * 60;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const getScoreColor = () => {
    if (percentage >= 80) return 'text-success';
    if (percentage >= 50) return 'text-warning';
    return 'text-danger';
  };

  const getStrokeColor = () => {
    if (percentage >= 80) return 'oklch(0.7 0.2 145)';
    if (percentage >= 50) return 'oklch(0.75 0.15 80)';
    return 'oklch(0.65 0.2 25)';
  };

  const handleNewQuiz = () => {
    resetQuiz();
    router.push('/');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Score Summary */}
      <div className="glass-card p-8 md:p-12 text-center mb-10 animate-slide-up">
        <h1 className="text-3xl font-bold gradient-text mb-8">Quiz Complete!</h1>

        {/* Circular Progress */}
        <div className="relative inline-flex items-center justify-center mb-6">
          <svg width="160" height="160" viewBox="0 0 160 160">
            <circle cx="80" cy="80" r="60" fill="none" stroke="oklch(0.22 0.02 270)" strokeWidth="10" />
            <circle
              cx="80"
              cy="80"
              r="60"
              fill="none"
              stroke={getStrokeColor()}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="progress-ring-circle"
            />
          </svg>
          <div className="absolute">
            <div className={`text-4xl font-bold ${getScoreColor()}`}>{percentage}%</div>
          </div>
        </div>

        <p className="text-xl text-text-secondary">
          You scored <span className={`font-bold ${getScoreColor()}`}>{score}</span> out of{' '}
          <span className="font-bold text-text-primary">{totalQuestions}</span>
        </p>

        <div className="mt-8">
          <button onClick={handleNewQuiz} className="btn-primary text-lg px-10 py-3">
            Take New Quiz
          </button>
        </div>
      </div>

      {/* Detailed Review */}
      <h2 className="text-2xl font-bold text-text-primary mb-6">Detailed Review</h2>
      <div className="space-y-4">
        {questions.map((q, idx) => {
          const userAnswer = selectedAnswers[q._id];
          const answer = answerKey[q._id];
          const isCorrect = userAnswer === answer?.correct_answer;
          const wasAnswered = !!userAnswer;

          return (
            <div
              key={q._id}
              className={`glass-card p-6 animate-slide-up border-l-4 ${
                isCorrect
                  ? 'border-l-success/50'
                  : 'border-l-danger/50'
              }`}
              style={{ animationDelay: `${idx * 0.05}s` }}
            >
              {/* Question Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-text-muted">Q{idx + 1}</span>
                  <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-primary/20 text-primary-light">
                    {q.topic}
                  </span>
                </div>
                <span
                  className={`text-sm font-semibold ${
                    isCorrect ? 'text-success' : 'text-danger'
                  }`}
                >
                  {isCorrect ? '✓ Correct' : '✗ Incorrect'}
                </span>
              </div>

              {/* Question Context & Text */}
              {q.context && (
                <div className="mb-4 p-3 rounded-lg bg-surface-lighter/50 border border-glass-border">
                  <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                    {q.context}
                  </p>
                </div>
              )}
              <p className="text-text-primary font-medium mb-4">{q.question_text}</p>

              {/* Options Review */}
              <div className="space-y-2 mb-4">
                {q.options.map((option, optIdx) => {
                  const isUserAnswer = option === userAnswer;
                  const isCorrectAnswer = option === answer?.correct_answer;
                  let optionClass = 'bg-surface/30 border-glass-border text-text-secondary';

                  if (isCorrectAnswer) {
                    optionClass = 'bg-success/10 border-success/40 text-success';
                  } else if (isUserAnswer && !isCorrect) {
                    optionClass = 'bg-danger/10 border-danger/40 text-danger';
                  }

                  return (
                    <div
                      key={optIdx}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${optionClass}`}
                    >
                      <span className="text-xs font-bold w-6 h-6 rounded flex items-center justify-center bg-black/20">
                        {String.fromCharCode(65 + optIdx)}
                      </span>
                      <span className="text-sm">{option}</span>
                      {isCorrectAnswer && (
                        <span className="ml-auto text-xs font-medium">✓ Correct</span>
                      )}
                      {isUserAnswer && !isCorrectAnswer && (
                        <span className="ml-auto text-xs font-medium">Your answer</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Not answered */}
              {!wasAnswered && (
                <p className="text-sm text-warning/80 mb-3 italic">You did not answer this question.</p>
              )}

              {/* Explanation */}
              {answer?.explanation && (
                <div className="mt-3 p-4 rounded-xl bg-accent/5 border border-accent/20">
                  <p className="text-sm text-accent-light font-medium mb-1">Explanation</p>
                  <p className="text-sm text-text-secondary leading-relaxed">{answer.explanation}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Bottom Action */}
      <div className="mt-10 text-center">
        <button onClick={handleNewQuiz} className="btn-primary text-lg px-10 py-3">
          Take Another Quiz
        </button>
      </div>
    </div>
  );
}
