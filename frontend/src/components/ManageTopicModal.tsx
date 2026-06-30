import { useState, useEffect } from 'react';
import { X, Search } from 'lucide-react';
import { fetchQuestionsByTopic, deleteQuestions, updateQuestion } from '@/lib/api';
import { QuestionData } from '@/types';
import QuestionListManager from './QuestionListManager';

interface ManageTopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  topic: string;
}

export default function ManageTopicModal({ isOpen, onClose, topic }: ManageTopicModalProps) {
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && topic) {
      loadQuestions();
    }
  }, [isOpen, topic]);

  const loadQuestions = async () => {
    setIsLoading(true);
    try {
      const data = await fetchQuestionsByTopic(topic);
      setQuestions(data);
    } catch (err) {
      console.error(err);
      alert('Failed to load questions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (ids: string[]) => {
    await deleteQuestions(ids);
    // Reload immediately
    await loadQuestions();
  };

  const handleUpdate = async (id: string, data: Partial<QuestionData>) => {
    await updateQuestion(id, data);
    await loadQuestions();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-surface border border-glass-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-glass-border bg-surface-light/50">
          <div>
            <h2 className="text-xl font-bold text-text-primary">Manage Topic: {topic}</h2>
            <p className="text-sm text-text-muted mt-1">
              View, edit, or delete specific questions in this topic
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-text-muted hover:text-text-primary hover:bg-surface-dark rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-hidden flex flex-col min-h-0">
          <QuestionListManager 
            questions={questions}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
            groupByTopic={false}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
}
