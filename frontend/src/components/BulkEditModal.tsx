import React, { useState } from 'react';
import { X, Check } from 'lucide-react';

export type EditableField = 'topic' | 'subtopic' | 'source' | 'context' | 'explanation' | 'question_text' | 'correct_answer';

interface BulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (field: EditableField, value: string) => void;
  selectedCount: number;
  existingTopics: string[];
  existingSources: string[];
}

import { createPortal } from 'react-dom';

export default function BulkEditModal({
  isOpen,
  onClose,
  onApply,
  selectedCount,
  existingTopics,
  existingSources
}: BulkEditModalProps) {
  const [field, setField] = useState<EditableField>('topic');
  const [value, setValue] = useState('');

  if (!isOpen) return null;
  if (typeof window === 'undefined') return null;

  const handleApply = () => {
    onApply(field, value);
    setValue(''); // Reset for next time
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-fade-in">
      <div 
        className="absolute inset-0 backdrop-blur-xl bg-black/80"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-surface glass-card p-6 shadow-2xl animate-slide-up transition-all duration-300 border-glass-border border-2">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-text-primary">Bulk Edit Questions</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4 p-3 bg-primary/10 border border-primary/30 rounded-lg text-primary text-sm font-medium">
          Editing {selectedCount} selected {selectedCount === 1 ? 'question' : 'questions'}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Field to Edit</label>
            <select
              value={field}
              onChange={(e) => {
                setField(e.target.value as EditableField);
                setValue(''); // Reset value when changing field
              }}
              className="w-full px-3 py-2 bg-surface-dark border border-glass-border rounded-lg text-sm focus:border-primary text-text-primary appearance-none cursor-pointer"
            >
              <option className="bg-surface text-text-primary" value="topic">Topic</option>
              <option className="bg-surface text-text-primary" value="subtopic">Subtopic</option>
              <option className="bg-surface text-text-primary" value="source">Source</option>
              <option className="bg-surface text-text-primary" value="context">Context / Passage</option>
              <option className="bg-surface text-text-primary" value="explanation">Explanation</option>
              <option className="bg-surface text-text-primary" value="question_text">Question Text</option>
              <option className="bg-surface text-text-primary" value="correct_answer">Correct Answer</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">New Value</label>
            
            {(field === 'topic' || field === 'subtopic' || field === 'source' || field === 'correct_answer') ? (
              <div className="relative">
                <input
                  type="text"
                  list={`bulk-${field}-list`}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-dark border border-glass-border rounded-lg text-sm focus:border-primary text-text-primary"
                  placeholder={`Enter new ${field.replace('_', ' ')}...`}
                />
                <datalist id={`bulk-${field}-list`}>
                  {field === 'topic' && existingTopics.map(t => <option key={t} value={t} />)}
                  {field === 'source' && existingSources.map(s => <option key={s} value={s} />)}
                </datalist>
              </div>
            ) : (
              <textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-full px-3 py-2 bg-surface-dark border border-glass-border rounded-lg text-sm min-h-[100px] focus:border-primary text-text-primary custom-scrollbar"
                placeholder={`Enter new ${field.replace('_', ' ')}...`}
              />
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="btn-primary px-4 py-2 text-sm flex items-center gap-2"
          >
            <Check className="w-4 h-4" /> Apply to All
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
