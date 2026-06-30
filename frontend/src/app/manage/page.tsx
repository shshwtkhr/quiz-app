'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search as SearchIcon } from 'lucide-react';
import { searchQuestions, deleteQuestions, updateQuestion } from '@/lib/api';
import { QuestionData } from '@/types';
import QuestionListManager from '@/components/QuestionListManager';

export default function GlobalManagePage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTrigger, setSearchTrigger] = useState(0);

  // We could auto-fetch all questions, or we could require a search term.
  // For global manage, it might be better to fetch all initially (or just search "").
  // Let's search "" on mount to fetch all.
  useEffect(() => {
    handleSearch('');
  }, [searchTrigger]);

  const handleSearch = async (query: string = '') => {
    setIsLoading(true);
    try {
      const data = await searchQuestions(query);
      setQuestions(data);
    } catch (err) {
      console.error(err);
      alert('Failed to search questions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (ids: string[]) => {
    await deleteQuestions(ids);
    setSearchTrigger(prev => prev + 1); // trigger reload
  };

  const handleUpdate = async (id: string, data: Partial<QuestionData>) => {
    await updateQuestion(id, data);
    setSearchTrigger(prev => prev + 1); // trigger reload
  };

  return (
    <div className="min-h-screen pt-24 pb-12 px-4 flex flex-col max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => router.push('/')}
          className="p-2 text-text-secondary hover:text-text-primary hover:bg-surface-light rounded-full transition-colors"
          title="Go back"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-text-primary">Global Manager</h1>
          <p className="text-text-secondary">Search, edit, and manage all your questions globally</p>
        </div>
      </div>

      <div className="flex-1 glass-card p-6 flex flex-col min-h-[600px]">
        <QuestionListManager 
          questions={questions}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
          groupByTopic={true}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
