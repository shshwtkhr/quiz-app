'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchTopics, generateQuiz } from '@/lib/api';
import { TopicSelection } from '@/types';
import { useQuizStore } from '@/stores/quiz-store-provider';
import UploadDocumentModal from './UploadDocumentModal';
import ManageTopicModal from './ManageTopicModal';
import { Pencil, Settings } from 'lucide-react';

export default function QuizConfig() {
  const router = useRouter();
  const setQuizData = useQuizStore((s) => s.setQuizData);

  const [topics, setTopics] = useState<TopicSelection[]>([]);
  const [timeLimit, setTimeLimit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [manageTopicOpen, setManageTopicOpen] = useState<string | null>(null);

  const loadTopics = () => {
    setLoading(true);
    fetchTopics()
      .then((data) =>
        setTopics(
          data.map((t) => ({
            topic: t._id,
            count: Math.min(5, t.count),
            maxCount: t.count,
            selected: false,
          }))
        )
      )
      .catch(() => setError('Failed to load topics. Is the backend running?'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTopics();
  }, []);

  const handleUploadSuccess = () => {
    loadTopics();
  };

  const handleManageTopicClose = () => {
    setManageTopicOpen(null);
    loadTopics();
  };

  const toggleTopic = (index: number) => {
    setTopics((prev) =>
      prev.map((t, i) => (i === index ? { ...t, selected: !t.selected } : t))
    );
  };

  const updateCount = (index: number, count: number) => {
    setTopics((prev) =>
      prev.map((t, i) =>
        i === index ? { ...t, count: Math.max(1, Math.min(count, t.maxCount)) } : t
      )
    );
  };

  const selectedTopics = topics.filter((t) => t.selected);
  const totalQuestions = selectedTopics.reduce((sum, t) => sum + t.count, 0);

  const handleStartQuiz = async () => {
    if (selectedTopics.length === 0) return;
    setGenerating(true);
    setError(null);
    try {
      const payload = selectedTopics.map((t) => ({ topic: t.topic, count: t.count }));
      const data = await generateQuiz(payload);
      setQuizData(data.questions, data.answerKey, timeLimit * 60);
      router.push('/quiz');
    } catch {
      setError('Failed to generate quiz. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-12 animate-fade-in">
        <h1 className="text-5xl md:text-6xl font-bold gradient-text mb-4">QuizMaster</h1>
        <p className="text-text-secondary text-lg md:text-xl max-w-2xl mx-auto">
          Select your topics, set your challenge, and test your knowledge
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="glass-card p-4 mb-8 border-danger/30 text-danger text-center animate-fade-in">
          {error}
        </div>
      )}

      {/* Topics Grid */}
      <section className="mb-10 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-semibold text-text-primary">Choose Topics</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/manage')}
              className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-surface-light border border-glass-border hover:border-primary/50 hover:text-primary transition-colors"
            >
              <Settings className="w-4 h-4" />
              Global Manager
            </button>
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-surface-light border border-glass-border hover:border-primary/50 hover:text-primary transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Upload Document
            </button>
          </div>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton h-28 rounded-2xl" />
            ))}
          </div>
        ) : topics.length === 0 ? (
          <div className="glass-card p-8 text-center text-text-muted">
            No topics available. Upload questions to the database first.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {topics.map((t, i) => (
              <div
                key={t.topic}
                onClick={() => toggleTopic(i)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleTopic(i);
                  }
                }}
                className={`glass-card p-5 text-left transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  t.selected
                    ? 'border-primary/50 bg-primary/10 shadow-[0_0_20px_oklch(0.55_0.2_270_/_0.15)]'
                    : ''
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-text-primary">{t.topic}</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setManageTopicOpen(t.topic); }}
                      className="p-1.5 rounded-md hover:bg-surface-dark text-text-muted hover:text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                      title="Manage questions in this topic"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <span
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        t.selected
                          ? 'border-primary bg-primary'
                          : 'border-text-muted'
                      }`}
                    >
                      {t.selected && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-text-muted">
                  {t.maxCount} question{t.maxCount !== 1 ? 's' : ''} available
                </p>
                {t.selected && (
                  <div
                    className="mt-3 flex items-center gap-3 animate-fade-in"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <label className="text-sm text-text-secondary">Questions:</label>
                    <input
                      type="number"
                      min={1}
                      max={t.maxCount}
                      value={t.count}
                      onChange={(e) => updateCount(i, parseInt(e.target.value) || 1)}
                      className="w-20 px-3 py-1.5 rounded-lg bg-surface-light border border-glass-border text-text-primary text-center text-sm focus:outline-none focus:border-primary transition-colors"
                    />
                    <span className="text-xs text-text-muted">/ {t.maxCount}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Time Limit */}
      <section className="mb-10 animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <h2 className="text-xl font-semibold text-text-primary mb-5">Time Limit</h2>
        <div className="glass-card p-6">
          <div className="flex items-center gap-6">
            <input
              type="range"
              min={1}
              max={60}
              value={timeLimit}
              onChange={(e) => setTimeLimit(parseInt(e.target.value))}
              className="flex-1 h-2 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, oklch(0.55 0.2 270) 0%, oklch(0.55 0.2 270) ${(timeLimit / 60) * 100}%, oklch(0.22 0.02 270) ${(timeLimit / 60) * 100}%, oklch(0.22 0.02 270) 100%)`,
              }}
            />
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={60}
                value={timeLimit}
                onChange={(e) => setTimeLimit(Math.max(1, Math.min(60, parseInt(e.target.value) || 1)))}
                className="w-16 px-3 py-2 rounded-lg bg-surface-light border border-glass-border text-text-primary text-center focus:outline-none focus:border-primary transition-colors"
              />
              <span className="text-text-secondary text-sm">min</span>
            </div>
          </div>
        </div>
      </section>

      {/* Start Button */}
      <div className="animate-slide-up" style={{ animationDelay: '0.3s' }}>
        <div className="glass-card p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-text-secondary text-sm">
            {selectedTopics.length > 0 ? (
              <>
                <span className="text-text-primary font-semibold">{totalQuestions}</span> question{totalQuestions !== 1 ? 's' : ''} across{' '}
                <span className="text-text-primary font-semibold">{selectedTopics.length}</span> topic{selectedTopics.length !== 1 ? 's' : ''}{' '}
                · <span className="text-text-primary font-semibold">{timeLimit}</span> min
              </>
            ) : (
              'Select at least one topic to begin'
            )}
          </div>
          <button
            onClick={handleStartQuiz}
            disabled={selectedTopics.length === 0 || generating}
            className="btn-primary text-lg px-10 py-3 min-w-[180px]"
          >
            {generating ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating...
              </span>
            ) : (
              'Start Quiz'
            )}
          </button>
        </div>
      </div>

      <UploadDocumentModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={handleUploadSuccess}
      />
      
      <ManageTopicModal 
        isOpen={!!manageTopicOpen}
        onClose={handleManageTopicClose}
        topic={manageTopicOpen || ''}
      />
    </div>
  );
}
