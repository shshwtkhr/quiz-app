import React, { useState, useMemo } from 'react';
import { QuestionData } from '@/types';
import { Search, Trash2, Edit2, Save, X, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { formatMarkdownText } from '@/lib/formatText';

interface QuestionListManagerProps {
  questions: QuestionData[];
  onDelete: (ids: string[]) => Promise<void>;
  onUpdate: (id: string, data: Partial<QuestionData>) => Promise<void>;
  groupByTopic: boolean;
  isLoading: boolean;
}

export default function QuestionListManager({ questions, onDelete, onUpdate, groupByTopic, isLoading }: QuestionListManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<Partial<QuestionData>>({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Filter questions based on search query
  const filteredQuestions = useMemo(() => {
    if (!searchQuery.trim()) return questions;
    const lowerQuery = searchQuery.toLowerCase();
    return questions.filter((q) => {
      return (
        q.question_text.toLowerCase().includes(lowerQuery) ||
        (q.context && q.context.toLowerCase().includes(lowerQuery)) ||
        q.options.some((opt) => opt.toLowerCase().includes(lowerQuery)) ||
        q.correct_answer.toLowerCase().includes(lowerQuery) ||
        q.explanation.toLowerCase().includes(lowerQuery) ||
        q.topic.toLowerCase().includes(lowerQuery) ||
        (q.subtopic && q.subtopic.toLowerCase().includes(lowerQuery))
      );
    });
  }, [questions, searchQuery]);

  // Group questions
  const groupedQuestions = useMemo(() => {
    const groups: Record<string, Record<string, QuestionData[]>> = {};
    
    filteredQuestions.forEach((q) => {
      const topic = groupByTopic ? q.topic : 'default';
      const subtopic = q.subtopic || 'No subtopic';
      
      if (!groups[topic]) groups[topic] = {};
      if (!groups[topic][subtopic]) groups[topic][subtopic] = [];
      
      groups[topic][subtopic].push(q);
    });
    
    return groups;
  }, [filteredQuestions, groupByTopic]);

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredQuestions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredQuestions.map((q) => q._id)));
    }
  };

  const toggleExpand = (id: string) => {
    const newSet = new Set(expandedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setExpandedIds(newSet);
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} questions?`)) return;
    
    setIsDeleting(true);
    try {
      await onDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
    } catch (err) {
      console.error(err);
      alert('Failed to delete questions');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditClick = (q: QuestionData) => {
    setEditingId(q._id);
    setEditFormData({
      topic: q.topic,
      question_text: q.question_text,
      context: q.context || '',
      options: [...q.options],
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      subtopic: q.subtopic || ''
    });
    // Ensure expanded
    setExpandedIds((prev) => new Set(prev).add(q._id));
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setIsUpdating(true);
    try {
      await onUpdate(editingId, editFormData);
      setEditingId(null);
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to update question');
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <svg className="animate-spin h-8 w-8 text-primary" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search questions, answers, explanations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface-light border border-glass-border rounded-lg text-sm focus:outline-none focus:border-primary transition-colors text-text-primary"
          />
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={toggleSelectAll}
            className="px-3 py-2 text-sm font-medium text-text-secondary bg-surface-light border border-glass-border rounded-lg hover:text-text-primary hover:border-primary/50 transition-colors whitespace-nowrap"
          >
            {selectedIds.size === filteredQuestions.length && filteredQuestions.length > 0 ? 'Deselect All' : 'Select All'}
          </button>
          {selectedIds.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              disabled={isDeleting}
              className="px-3 py-2 text-sm font-medium text-white bg-danger/80 border border-danger rounded-lg hover:bg-danger transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <Trash2 className="w-4 h-4" />
              Delete ({selectedIds.size})
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
        {filteredQuestions.length === 0 ? (
          <div className="text-center py-10 text-text-muted">
            No questions found.
          </div>
        ) : (
          Object.keys(groupedQuestions).sort().map((topic) => (
            <div key={topic} className="space-y-4">
              {groupByTopic && (
                <h2 className="text-xl font-bold text-text-primary border-b border-glass-border pb-2 sticky top-0 bg-surface z-10">
                  {topic}
                </h2>
              )}
              
              {Object.keys(groupedQuestions[topic]).sort().map((subtopic) => (
                <div key={`${topic}-${subtopic}`} className="space-y-3">
                  <h3 className={`text-sm font-semibold uppercase tracking-wider pl-1 flex items-center gap-2 ${
                    subtopic === 'No subtopic' 
                      ? 'text-warning/80' 
                      : 'text-primary/80'
                  }`}>
                    {subtopic}
                    {subtopic === 'No subtopic' && (
                      <span className="text-[10px] bg-warning/10 text-warning px-2 py-0.5 rounded-full normal-case font-medium">
                        Uncategorized in Database
                      </span>
                    )}
                  </h3>
                  
                  {groupedQuestions[topic][subtopic].map((q) => (
                    <div
                      key={q._id}
                      className={`glass-card p-4 transition-colors ${selectedIds.has(q._id) ? 'border-primary/50 bg-primary/5' : ''}`}
                    >
                      {editingId === q._id ? (
                        /* EDIT MODE */
                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs font-medium text-text-secondary mb-1">Topic</label>
                            <input
                              type="text"
                              value={editFormData.topic}
                              onChange={(e) => setEditFormData({ ...editFormData, topic: e.target.value })}
                              className="w-full px-3 py-2 bg-surface-dark border border-glass-border rounded-lg text-sm focus:border-primary text-text-primary"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-text-secondary mb-1">Subtopic</label>
                            <input
                              type="text"
                              value={editFormData.subtopic}
                              onChange={(e) => setEditFormData({ ...editFormData, subtopic: e.target.value })}
                              className="w-full px-3 py-2 bg-surface-dark border border-glass-border rounded-lg text-sm focus:border-primary text-text-primary"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-text-secondary mb-1">Context / Passage (Optional)</label>
                            <textarea
                              value={editFormData.context}
                              onChange={(e) => setEditFormData({ ...editFormData, context: e.target.value })}
                              className="w-full px-3 py-2 bg-surface-dark border border-glass-border rounded-lg text-sm min-h-[60px] focus:border-primary text-text-primary"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-text-secondary mb-1">Question</label>
                            <textarea
                              value={editFormData.question_text}
                              onChange={(e) => setEditFormData({ ...editFormData, question_text: e.target.value })}
                              className="w-full px-3 py-2 bg-surface-dark border border-glass-border rounded-lg text-sm min-h-[60px] focus:border-primary text-text-primary"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-text-secondary mb-1">Options (One per line)</label>
                            <textarea
                              value={editFormData.options?.join('\n')}
                              onChange={(e) => setEditFormData({ ...editFormData, options: e.target.value.split('\n').filter(o => o.trim()) })}
                              className="w-full px-3 py-2 bg-surface-dark border border-glass-border rounded-lg text-sm min-h-[100px] focus:border-primary text-text-primary"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-text-secondary mb-1">Correct Answer</label>
                            <input
                              type="text"
                              value={editFormData.correct_answer}
                              onChange={(e) => setEditFormData({ ...editFormData, correct_answer: e.target.value })}
                              className="w-full px-3 py-2 bg-surface-dark border border-glass-border rounded-lg text-sm focus:border-primary text-text-primary"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-text-secondary mb-1">Explanation</label>
                            <textarea
                              value={editFormData.explanation}
                              onChange={(e) => setEditFormData({ ...editFormData, explanation: e.target.value })}
                              className="w-full px-3 py-2 bg-surface-dark border border-glass-border rounded-lg text-sm min-h-[80px] focus:border-primary text-text-primary"
                            />
                          </div>
                          <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                              onClick={() => setEditingId(null)}
                              className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleSaveEdit}
                              disabled={isUpdating}
                              className="btn-primary text-sm px-4 py-2 flex items-center gap-2"
                            >
                              <Save className="w-4 h-4" />
                              {isUpdating ? 'Saving...' : 'Save Changes'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* VIEW MODE */
                        <div className="flex items-start gap-3">
                          <div className="pt-1 flex-shrink-0 cursor-pointer" onClick={() => toggleSelect(q._id)}>
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                              selectedIds.has(q._id) ? 'bg-primary border-primary text-white' : 'border-text-muted bg-surface-light hover:border-primary/50'
                            }`}>
                              {selectedIds.has(q._id) && <CheckCircle2 className="w-3.5 h-3.5" />}
                            </div>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4">
                              <div 
                                className="flex-1 cursor-pointer" 
                                onClick={() => toggleExpand(q._id)}
                              >
                                {q.context && !expandedIds.has(q._id) && (
                                  <p className="text-text-secondary text-xs italic mb-2 line-clamp-2 border-l-2 border-primary/50 pl-2">
                                    <span className="font-semibold not-italic">Passage: </span>{formatMarkdownText(q.context)}
                                  </p>
                                )}
                                <p className="text-text-primary text-sm font-medium mb-1">
                                  {formatMarkdownText(q.question_text)}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <button
                                  onClick={() => handleEditClick(q)}
                                  className="p-1.5 text-text-muted hover:text-primary transition-colors rounded-lg hover:bg-surface-light"
                                  title="Edit Question"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => toggleExpand(q._id)}
                                  className="p-1.5 text-text-muted hover:text-primary transition-colors rounded-lg hover:bg-surface-light"
                                >
                                  {expandedIds.has(q._id) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </button>
                              </div>
                            </div>

                            {/* Expanded Content */}
                            {expandedIds.has(q._id) && (
                              <div className="mt-4 space-y-4 animate-fade-in text-sm border-t border-glass-border pt-4">
                                {q.context && (
                                  <div className="bg-surface-dark border border-glass-border rounded-lg p-3">
                                    <span className="font-medium text-text-secondary block mb-2">Passage Context:</span>
                                    <div className="max-h-48 overflow-y-auto custom-scrollbar text-text-secondary italic pr-2">
                                      {formatMarkdownText(q.context)}
                                    </div>
                                  </div>
                                )}
                                <div>
                                  <span className="font-medium text-text-secondary block mb-1">Options:</span>
                                  <ul className="space-y-1">
                                    {q.options.map((opt, i) => (
                                      <li key={i} className="flex items-start gap-2">
                                        <span className="text-text-muted">{String.fromCharCode(65 + i)}.</span>
                                        <span className={opt === q.correct_answer ? 'text-success font-medium' : 'text-text-secondary'}>
                                          {formatMarkdownText(opt)}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                <div className="bg-success/10 border border-success/20 rounded-lg p-3">
                                  <span className="font-medium text-success block mb-1">Correct Answer:</span>
                                  <span className="text-success/90">{formatMarkdownText(q.correct_answer)}</span>
                                </div>
                                <div className="bg-accent/10 border border-accent/20 rounded-lg p-3">
                                  <span className="font-medium text-accent-light block mb-1">Explanation:</span>
                                  <span className="text-accent-light/90 leading-relaxed">{formatMarkdownText(q.explanation)}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
