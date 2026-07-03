import { useState, useRef, DragEvent, ChangeEvent, useEffect } from 'react';
import { X, Upload, FileText, CheckCircle2, AlertCircle, Edit2, Plus, Trash2 } from 'lucide-react';
import { uploadQuestions, uploadDocumentJob, getJobStatus } from '@/lib/api';
import { formatMarkdownText } from '@/lib/formatText';
import BulkEditModal, { EditableField } from './BulkEditModal';

interface TopicData {
  _id: string;
  count: number;
  subtopics: { name: string; count: number }[];
}

interface UploadDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function UploadDocumentModal({ isOpen, onClose, onSuccess }: UploadDocumentModalProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'parsing' | 'review' | 'saving' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [parsedQuestions, setParsedQuestions] = useState<any[]>([]);
  const [existingTopics, setExistingTopics] = useState<TopicData[]>([]);
  const [existingSources, setExistingSources] = useState<string[]>([]);
  const [parsedCount, setParsedCount] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  
  // Inline edit state
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<any>(null);
  
  // Bulk selection state
  const [selectedQuestions, setSelectedQuestions] = useState<Set<number>>(new Set());
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  
  const [isDragSelecting, setIsDragSelecting] = useState(false);
  const [dragSelectMode, setDragSelectMode] = useState<'add' | 'remove' | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleMouseUp = () => {
      setIsDragSelecting(false);
      setDragSelectMode(null);
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  // Check for active job on mount
  useEffect(() => {
    if (isOpen && typeof window !== 'undefined') {
      const activeJobId = localStorage.getItem('activeUploadJobId');
      if (activeJobId) {
        setJobId(activeJobId);
        setStatus('parsing');
      }
    }
  }, [isOpen]);

  // Polling mechanism
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;

    if (isOpen && status === 'parsing' && jobId) {
      pollInterval = setInterval(async () => {
        try {
          const job = await getJobStatus(jobId);
          setParsedCount(job.progress);

          if (job.status === 'completed') {
            clearInterval(pollInterval);
            setParsedQuestions(job.parsedQuestions || []);
            
            // Fetch topics and sources for the review screen
            try {
              const topicsRes = await fetch('http://localhost:5000/api/topics');
              if (topicsRes.ok) setExistingTopics(await topicsRes.json());
              
              const sourcesRes = await fetch('http://localhost:5000/api/sources');
              if (sourcesRes.ok) setExistingSources(await sourcesRes.json());
            } catch (e) {
              console.error('Failed to fetch topics/sources', e);
            }
            
            setStatus('review');
          } else if (job.status === 'failed') {
            clearInterval(pollInterval);
            setStatus('error');
            setErrorMessage(job.error || 'Parsing failed in background.');
            localStorage.removeItem('activeUploadJobId');
            setJobId(null);
          }
        } catch (error: any) {
          console.error('Polling error:', error);
          // Don't fail immediately on network error, keep polling until manual cancel
        }
      }, 2500);
    }

    return () => clearInterval(pollInterval);
  }, [isOpen, status, jobId]);

  if (!isOpen) return null;

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    const validExtensions = ['.txt', '.pdf', '.docx'];
    const fileExtension = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
    
    if (validExtensions.includes(fileExtension)) {
      setFile(selectedFile);
      setErrorMessage('');
    } else {
      setFile(null);
      setErrorMessage('Invalid file type. Please upload a .txt, .pdf, or .docx file.');
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setStatus('uploading');
    
    try {
      const response = await uploadDocumentJob(file);
      const newJobId = response.jobId;
      
      setJobId(newJobId);
      localStorage.setItem('activeUploadJobId', newJobId);
      setStatus('parsing');
    } catch (error: any) {
      setStatus('error');
      setErrorMessage(error.message || 'An error occurred during upload.');
    }
  };

  const handleTopicChange = (index: number, newTopic: string) => {
    const updated = [...parsedQuestions];
    updated[index].topic = newTopic;
    setParsedQuestions(updated);
  };

  const handleSubtopicChange = (index: number, newSubtopic: string) => {
    const updated = [...parsedQuestions];
    updated[index].subtopic = newSubtopic;
    setParsedQuestions(updated);
  };

  const handleSourceChange = (index: number, newSource: string) => {
    const updated = [...parsedQuestions];
    updated[index].source = newSource;
    setParsedQuestions(updated);
  };

  const handleBulkApply = (field: EditableField, value: string) => {
    const updated = [...parsedQuestions];
    selectedQuestions.forEach(index => {
      updated[index][field] = value;
    });
    setParsedQuestions(updated);
    setSelectedQuestions(new Set());
  };

  const handleDeleteSelected = () => {
    const updated = parsedQuestions.filter((_, i) => !selectedQuestions.has(i));
    setParsedQuestions(updated);
    setSelectedQuestions(new Set());
  };

  const handleSave = async () => {
    setStatus('saving');
    try {
      const response = await fetch('http://localhost:5000/api/upload-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedQuestions),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || 'Save failed');
      }

      setStatus('success');
      localStorage.removeItem('activeUploadJobId');
      
      setTimeout(() => {
        onSuccess();
        onClose();
        resetState();
      }, 1500);
    } catch (error: any) {
      setStatus('error');
      setErrorMessage(error.message || 'An error occurred during upload.');
    }
  };

  const resetState = () => {
    setFile(null);
    setStatus('idle');
    setErrorMessage('');
    setParsedQuestions([]);
    setExistingTopics([]);
    setParsedCount(0);
    setSelectedQuestions(new Set());
    setEditingIndex(null);
    setEditFormData(null);
    setJobId(null);
  };

  const handleCancelParsing = () => {
    localStorage.removeItem('activeUploadJobId');
    resetState();
  };

  const handleEditClick = (index: number, q: any) => {
    setEditingIndex(index);
    setEditFormData({
      topic: q.topic || '',
      subtopic: q.subtopic || '',
      source: q.source || '',
      context: q.context || '',
      question_text: q.question_text || '',
      options: [...(q.options || [])],
      correct_answer: q.correct_answer || '',
      explanation: q.explanation || ''
    });
  };

  const handleSaveEdit = () => {
    if (editingIndex === null || !editFormData) return;
    const updated = [...parsedQuestions];
    updated[editingIndex] = { ...updated[editingIndex], ...editFormData };
    setParsedQuestions(updated);
    setEditingIndex(null);
    setEditFormData(null);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditFormData(null);
  };

  const handleClose = () => {
    // Only clear storage if we close explicitly while not parsing
    if (status !== 'parsing') {
      localStorage.removeItem('activeUploadJobId');
    }
    resetState();
    onClose();
  };

  const getSubtopicsForTopic = (topicName: string) => {
    const topic = existingTopics.find(t => t._id === topicName);
    return topic ? topic.subtopics.map(s => s.name) : [];
  };

  const existingTopicNames = existingTopics.map(t => t._id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div 
        className="absolute inset-0 backdrop-blur-xl bg-black/80"
        onClick={handleClose}
      />
      
      <div className={`relative w-full ${status === 'review' ? 'max-w-2xl' : 'max-w-md'} bg-surface glass-card p-6 shadow-2xl animate-slide-up transition-all duration-300 border-glass-border border-2 flex flex-col max-h-[90vh]`}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-text-primary">
            {jobId && status === 'parsing' ? 'Resuming Parsing...' : 'Upload Document'}
          </h2>
          <button 
            onClick={handleClose}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {status === 'review' ? (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-text-primary mb-1">Review Topics</h3>
              <p className="text-text-muted text-sm flex justify-between items-center">
                <span>Select questions to bulk assign topics and subtopics.</span>
                <label className="flex items-center gap-2 cursor-pointer hover:text-text-primary">
                  <input 
                    type="checkbox" 
                    checked={selectedQuestions.size === parsedQuestions.length && parsedQuestions.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedQuestions(new Set(parsedQuestions.map((_, i) => i)));
                      else setSelectedQuestions(new Set());
                    }}
                    className="w-4 h-4 text-primary bg-surface border-glass-border rounded focus:ring-primary"
                  />
                  Select All
                </label>
              </p>
            </div>

            {selectedQuestions.size > 0 && (
              <div className="p-3 mb-4 rounded-xl border border-primary/30 bg-primary/10 flex flex-wrap gap-3 items-center animate-fade-in">
                <span className="text-primary font-medium text-sm whitespace-nowrap">{selectedQuestions.size} selected</span>
                
                <button 
                  onClick={() => setIsBulkEditModalOpen(true)}
                  className="px-4 py-1.5 bg-primary text-black font-medium rounded-lg text-sm hover:bg-primary-dark transition"
                >
                  Bulk Edit
                </button>
                <button 
                  onClick={handleDeleteSelected}
                  className="px-4 py-1.5 bg-red-500 text-white font-medium rounded-lg text-sm hover:bg-red-600 transition ml-auto"
                >
                  Delete Selected
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
              {parsedQuestions.map((q, index) => (
                <div key={index} className={`p-4 rounded-xl border transition-colors flex gap-4 ${selectedQuestions.has(index) ? 'border-primary/50 bg-primary/5' : 'border-glass-border bg-surface-light/30'}`}>
                  <div 
                    className="pt-1 pr-2 pb-2 pl-1 cursor-pointer flex items-start"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setIsDragSelecting(true);
                      const mode = selectedQuestions.has(index) ? 'remove' : 'add';
                      setDragSelectMode(mode);
                      const newSet = new Set(selectedQuestions);
                      if (mode === 'add') newSet.add(index);
                      else newSet.delete(index);
                      setSelectedQuestions(newSet);
                    }}
                    onMouseEnter={() => {
                      if (isDragSelecting && dragSelectMode) {
                        const newSet = new Set(selectedQuestions);
                        if (dragSelectMode === 'add') newSet.add(index);
                        else newSet.delete(index);
                        setSelectedQuestions(newSet);
                      }
                    }}
                  >
                    <input 
                      type="checkbox" 
                      checked={selectedQuestions.has(index)}
                      readOnly
                      className="w-4 h-4 text-primary bg-surface border-glass-border rounded focus:ring-primary cursor-pointer pointer-events-none"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-3 gap-2">
                      <div className="flex-1 min-w-0">
                        {q.context && (
                           <p className="text-text-secondary text-xs italic mb-2 line-clamp-2 border-l-2 border-primary/50 pl-2">
                             <span className="font-semibold not-italic">Passage: </span>{formatMarkdownText(q.context)}
                           </p>
                        )}
                        <p className="text-text-primary text-sm font-medium line-clamp-2">{formatMarkdownText(q.question_text)}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleEditClick(index, q); }}
                        className="p-1.5 text-text-muted hover:text-primary transition-colors rounded-lg hover:bg-surface-dark flex-shrink-0"
                        title="Edit parsed question"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>

                    {editingIndex === index ? (
                      <div className="space-y-4 mt-4 p-4 bg-surface-dark/50 border border-glass-border rounded-lg">
                        <div>
                          <label className="block text-xs font-medium text-text-secondary mb-1">Source</label>
                          <input
                            type="text"
                            list="upload-sources-list"
                            value={editFormData.source || ''}
                            onChange={(e) => setEditFormData({ ...editFormData, source: e.target.value })}
                            className="w-full px-3 py-2 bg-surface border border-glass-border rounded-lg text-sm focus:border-primary text-text-primary"
                            placeholder="e.g. 2024 Exam, Book Chapter 5..."
                          />
                          <datalist id="upload-sources-list">
                            {existingSources.map(s => <option key={s} value={s} />)}
                          </datalist>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-text-secondary mb-1">Passage Context</label>
                          <textarea
                            value={editFormData.context}
                            onChange={(e) => setEditFormData({ ...editFormData, context: e.target.value })}
                            className="w-full px-3 py-2 bg-surface border border-glass-border rounded-lg text-sm focus:border-primary text-text-primary min-h-[80px] custom-scrollbar"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-text-secondary mb-1">Question</label>
                          <textarea
                            value={editFormData.question_text}
                            onChange={(e) => setEditFormData({ ...editFormData, question_text: e.target.value })}
                            className="w-full px-3 py-2 bg-surface border border-glass-border rounded-lg text-sm focus:border-primary text-text-primary min-h-[60px] custom-scrollbar"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs font-medium text-text-secondary mb-2">Options</label>
                          {editFormData.options.map((opt: string, i: number) => (
                            <div key={i} className="flex gap-2 mb-2">
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => {
                                  const newOpts = [...editFormData.options];
                                  newOpts[i] = e.target.value;
                                  setEditFormData({ ...editFormData, options: newOpts });
                                }}
                                className="flex-1 px-3 py-1.5 bg-surface border border-glass-border rounded-lg text-sm focus:border-primary text-text-primary"
                              />
                              <button
                                onClick={() => {
                                  const newOpts = editFormData.options.filter((_: any, idx: number) => idx !== i);
                                  setEditFormData({ ...editFormData, options: newOpts });
                                }}
                                className="p-1.5 text-danger/70 hover:text-danger bg-surface hover:bg-surface-light rounded-lg border border-glass-border transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => setEditFormData({ ...editFormData, options: [...editFormData.options, ''] })}
                            className="text-xs flex items-center gap-1 text-primary hover:text-primary-light transition-colors mt-2 font-medium"
                          >
                            <Plus className="w-3 h-3" /> Add Option
                          </button>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-text-secondary mb-1">Correct Answer</label>
                          <select
                            value={editFormData.correct_answer}
                            onChange={(e) => setEditFormData({ ...editFormData, correct_answer: e.target.value })}
                            className="w-full px-3 py-2 bg-surface border border-glass-border rounded-lg text-sm focus:border-primary text-text-primary appearance-none cursor-pointer"
                          >
                            <option value="">Select correct answer...</option>
                            {editFormData.options.map((opt: string, i: number) => (
                              opt.trim() && <option key={i} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-text-secondary mb-1">Explanation</label>
                          <textarea
                            value={editFormData.explanation}
                            onChange={(e) => setEditFormData({ ...editFormData, explanation: e.target.value })}
                            className="w-full px-3 py-2 bg-surface border border-glass-border rounded-lg text-sm focus:border-primary text-text-primary min-h-[80px] custom-scrollbar"
                          />
                        </div>

                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={handleCancelEdit}
                            className="flex-1 py-1.5 bg-surface-light text-text-primary rounded-lg text-sm hover:bg-surface transition-colors border border-glass-border"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveEdit}
                            className="flex-1 py-1.5 bg-primary text-black font-medium rounded-lg text-sm hover:bg-primary-dark transition-colors"
                          >
                            Save Edits
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <div className="flex-1">
                          {q._isNewTopic ? (
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={q.topic}
                                onChange={(e) => handleTopicChange(index, e.target.value)}
                                className="flex-1 bg-surface-dark border border-glass-border rounded-lg px-3 py-1.5 text-text-primary focus:outline-none focus:border-primary text-sm"
                                placeholder="New topic..."
                              />
                              <button onClick={() => { const updated = [...parsedQuestions]; updated[index]._isNewTopic = false; updated[index].topic = existingTopicNames[0] || ''; setParsedQuestions(updated); }} className="px-2 bg-surface-light border border-glass-border rounded-lg text-xs">Cancel</button>
                            </div>
                          ) : (
                            <select
                              value={existingTopicNames.includes(q.topic) ? q.topic : (q.topic ? q.topic : 'NEW_TOPIC_SELECT')}
                              onChange={(e) => {
                                if (e.target.value === 'NEW_TOPIC_SELECT') {
                                   const updated = [...parsedQuestions];
                                   updated[index]._isNewTopic = true;
                                   updated[index].topic = '';
                                   setParsedQuestions(updated);
                                } else {
                                   handleTopicChange(index, e.target.value);
                                }
                              }}
                              className="w-full bg-surface-dark border border-glass-border rounded-lg px-3 py-1.5 text-text-primary text-sm appearance-none cursor-pointer"
                            >
                              {!existingTopicNames.includes(q.topic) && q.topic && <option value={q.topic} className="bg-surface text-text-primary">{q.topic} (AI)</option>}
                              {existingTopicNames.map((t) => <option key={t} value={t} className="bg-surface text-text-primary">{t}</option>)}
                              <option value="NEW_TOPIC_SELECT" className="bg-surface font-bold text-primary">+ Create New Topic</option>
                            </select>
                          )}
                        </div>
                        
                        <div className="flex-1">
                          {q._isNewSubtopic ? (
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={q.subtopic || ''}
                                onChange={(e) => handleSubtopicChange(index, e.target.value)}
                                className="flex-1 bg-surface-dark border border-glass-border rounded-lg px-3 py-1.5 text-text-primary focus:outline-none focus:border-primary text-sm"
                                placeholder="New subtopic..."
                              />
                              <button onClick={() => { const updated = [...parsedQuestions]; updated[index]._isNewSubtopic = false; updated[index].subtopic = 'General'; setParsedQuestions(updated); }} className="px-2 bg-surface-light border border-glass-border rounded-lg text-xs">Cancel</button>
                            </div>
                          ) : (
                            <select
                              value={getSubtopicsForTopic(q.topic).includes(q.subtopic) ? q.subtopic : (q.subtopic ? q.subtopic : 'NEW_SUBTOPIC_SELECT')}
                              onChange={(e) => {
                                if (e.target.value === 'NEW_SUBTOPIC_SELECT') {
                                   const updated = [...parsedQuestions];
                                   updated[index]._isNewSubtopic = true;
                                   updated[index].subtopic = '';
                                   setParsedQuestions(updated);
                                } else {
                                   handleSubtopicChange(index, e.target.value);
                                }
                              }}
                              className="w-full bg-surface-dark border border-glass-border rounded-lg px-3 py-1.5 text-text-primary text-sm appearance-none cursor-pointer"
                            >
                              {!getSubtopicsForTopic(q.topic).includes(q.subtopic) && q.subtopic && <option value={q.subtopic} className="bg-surface text-text-primary">{q.subtopic} (AI)</option>}
                              {getSubtopicsForTopic(q.topic).map((s) => <option key={s} value={s} className="bg-surface text-text-primary">{s}</option>)}
                              <option value="NEW_SUBTOPIC_SELECT" className="bg-surface font-bold text-primary">+ Create New Subtopic</option>
                            </select>
                          )}
                        </div>

                        <div className="flex-1">
                          {q._isNewSource ? (
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={q.source || ''}
                                onChange={(e) => handleSourceChange(index, e.target.value)}
                                className="flex-1 bg-surface-dark border border-glass-border rounded-lg px-3 py-1.5 text-text-primary focus:outline-none focus:border-primary text-sm"
                                placeholder="New source..."
                              />
                              <button onClick={() => { const updated = [...parsedQuestions]; updated[index]._isNewSource = false; updated[index].source = ''; setParsedQuestions(updated); }} className="px-2 bg-surface-light border border-glass-border rounded-lg text-xs">Cancel</button>
                            </div>
                          ) : (
                            <select
                              value={existingSources.includes(q.source) ? q.source : (q.source ? q.source : 'NEW_SOURCE_SELECT')}
                              onChange={(e) => {
                                if (e.target.value === 'NEW_SOURCE_SELECT') {
                                   const updated = [...parsedQuestions];
                                   updated[index]._isNewSource = true;
                                   updated[index].source = '';
                                   setParsedQuestions(updated);
                                } else {
                                   handleSourceChange(index, e.target.value);
                                }
                              }}
                              className="w-full bg-surface-dark border border-glass-border rounded-lg px-3 py-1.5 text-text-primary text-sm appearance-none cursor-pointer"
                            >
                              {!existingSources.includes(q.source) && q.source && <option value={q.source} className="bg-surface text-text-primary">{q.source} (AI)</option>}
                              <option value="" className="bg-surface text-text-muted">No Source</option>
                              {existingSources.map((s) => <option key={s} value={s} className="bg-surface text-text-primary">{s}</option>)}
                              <option value="NEW_SOURCE_SELECT" className="bg-surface font-bold text-primary">+ Create New Source</option>
                            </select>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6 pt-4 border-t border-glass-border flex gap-3 shrink-0">
              <button
                onClick={handleCancelParsing}
                className="flex-1 py-2.5 rounded-lg border border-glass-border text-text-primary hover:bg-surface-light transition-colors font-medium"
              >
                Discard & Close
              </button>
              <button
                onClick={handleSave}
                className="flex-1 btn-primary py-2.5 font-medium"
              >
                Save Questions
              </button>
            </div>
          </div>
        ) : status === 'idle' || status === 'error' ? (
          <>
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                isDragging 
                  ? 'border-primary bg-primary/10' 
                  : 'border-glass-border hover:border-primary/50 hover:bg-surface-light/50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".txt,.pdf,.docx"
                className="hidden"
              />
              
              <div className="mb-4 flex justify-center">
                <Upload className={`w-12 h-12 ${isDragging ? 'text-primary' : 'text-text-muted'}`} />
              </div>
              
              {file ? (
                <div>
                  <p className="text-text-primary font-medium truncate px-4">{file.name}</p>
                  <p className="text-text-muted text-sm mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              ) : (
                <div>
                  <p className="text-text-primary font-medium">Click or drag file to upload</p>
                  <p className="text-text-muted text-sm mt-1">Supports .TXT, .PDF, .DOCX</p>
                </div>
              )}
            </div>

            {errorMessage && (
              <div className="mt-4 p-3 bg-danger/10 border border-danger/30 rounded-lg text-danger text-sm">
                {errorMessage}
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 py-2.5 rounded-lg border border-glass-border text-text-primary hover:bg-surface-light transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!file}
                className="flex-1 btn-primary py-2.5 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Upload & Process
              </button>
            </div>
          </>
        ) : (
          <div className="py-8 text-center">
            {status === 'success' ? (
              <div className="animate-fade-in flex flex-col items-center">
                <div className="w-16 h-16 bg-success/20 text-success rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-semibold text-text-primary">Upload Complete!</h3>
                <p className="text-text-muted mt-2">Questions have been generated and saved.</p>
              </div>
            ) : (
              <div className="animate-fade-in flex flex-col items-center">
                <div className="relative w-16 h-16 mb-6">
                  <svg className="animate-spin w-full h-full text-primary" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-primary" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-text-primary">
                  {status === 'uploading' ? 'Uploading Document...' : status === 'saving' ? 'Saving Questions...' : `AI is parsing questions... (Found: ${parsedCount})`}
                </h3>
                <p className="text-text-muted mt-2 text-sm max-w-sm">
                  {status === 'parsing' ? 'You can safely close this modal or app; parsing will continue in the background.' : 'Please wait...'}
                </p>
                
                {status === 'parsing' && (
                  <button 
                    onClick={handleClose}
                    className="mt-6 px-4 py-2 border border-glass-border rounded-lg text-sm hover:bg-surface-light text-text-primary transition"
                  >
                    Hide Progress (Run in Background)
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <BulkEditModal
        isOpen={isBulkEditModalOpen}
        onClose={() => setIsBulkEditModalOpen(false)}
        onApply={handleBulkApply}
        selectedCount={selectedQuestions.size}
        existingTopics={existingTopicNames}
        existingSources={existingSources}
      />
    </div>
  );
}
