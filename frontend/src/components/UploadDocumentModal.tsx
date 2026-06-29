import { useState, useRef, DragEvent, ChangeEvent, useEffect } from 'react';

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
  const [parsedCount, setParsedCount] = useState(0);
  
  // Bulk selection state
  const [selectedQuestions, setSelectedQuestions] = useState<Set<number>>(new Set());
  const [bulkTopic, setBulkTopic] = useState('');
  const [bulkSubtopic, setBulkSubtopic] = useState('');
  const [isBulkNewTopic, setIsBulkNewTopic] = useState(false);
  const [isBulkNewSubtopic, setIsBulkNewSubtopic] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (status === 'uploading') {
      timeout = setTimeout(() => {
        setStatus((prev) => (prev === 'uploading' ? 'parsing' : prev));
      }, 1500);
    }
    return () => clearTimeout(timeout);
  }, [status]);

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
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:5000/api/upload-document', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || 'Upload failed');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Response stream not available');
      
      const decoder = new TextDecoder();
      let partial = '';
      let finalQuestions: any[] = [];
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        partial += decoder.decode(value, { stream: true });
        
        const lines = partial.split('\n');
        partial = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim()) {
             try {
                const data = JSON.parse(line);
                if (data.type === 'error') {
                   throw new Error(data.error);
                } else if (data.type === 'progress') {
                   setParsedCount(data.parsedSoFar);
                } else if (data.type === 'complete') {
                   finalQuestions = data.questions || [];
                }
             } catch(err: any) {
                if (line.includes('"type":"error"')) {
                   const errorMatch = line.match(/"error":"([^"]+)"/);
                   if (errorMatch) throw new Error(errorMatch[1]);
                }
             }
          }
        }
      }

      setParsedQuestions(finalQuestions);

      try {
        const topicsRes = await fetch('http://localhost:5000/api/topics');
        if (topicsRes.ok) {
          const topicsData = await topicsRes.json();
          setExistingTopics(topicsData);
        }
      } catch (e) {
        console.error('Failed to fetch existing topics', e);
      }

      setStatus('review');
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

  const handleBulkApply = () => {
    const updated = [...parsedQuestions];
    selectedQuestions.forEach(index => {
      if (bulkTopic) updated[index].topic = bulkTopic;
      if (bulkSubtopic) updated[index].subtopic = bulkSubtopic;
    });
    setParsedQuestions(updated);
    setSelectedQuestions(new Set());
    setBulkTopic('');
    setBulkSubtopic('');
    setIsBulkNewTopic(false);
    setIsBulkNewSubtopic(false);
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
    setBulkTopic('');
    setBulkSubtopic('');
  };

  const handleClose = () => {
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
          <h2 className="text-xl font-bold text-text-primary">Upload Document</h2>
          <button 
            onClick={handleClose}
            className="text-text-muted hover:text-text-primary transition-colors"
            disabled={status === 'uploading' || status === 'parsing'}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
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

            {/* Bulk Action Bar */}
            {selectedQuestions.size > 0 && (
              <div className="p-3 mb-4 rounded-xl border border-primary/30 bg-primary/10 flex flex-wrap gap-3 items-center animate-fade-in">
                <span className="text-primary font-medium text-sm whitespace-nowrap">{selectedQuestions.size} selected</span>
                
                {isBulkNewTopic ? (
                  <div className="flex gap-2 flex-1 min-w-[150px]">
                    <input type="text" value={bulkTopic} onChange={(e) => setBulkTopic(e.target.value)} className="flex-1 bg-surface-dark border border-glass-border rounded-lg px-3 py-1.5 text-text-primary text-sm" placeholder="New topic..." />
                    <button onClick={() => { setIsBulkNewTopic(false); setBulkTopic(''); }} className="text-xs px-2 bg-surface-light rounded">Cancel</button>
                  </div>
                ) : (
                  <select
                    value={bulkTopic}
                    onChange={(e) => {
                      if (e.target.value === 'NEW') setIsBulkNewTopic(true);
                      else setBulkTopic(e.target.value);
                    }}
                    className="flex-1 min-w-[150px] bg-surface-dark border border-glass-border rounded-lg px-3 py-1.5 text-text-primary text-sm appearance-none"
                  >
                    <option value="" className="bg-surface text-text-muted">Select Topic...</option>
                    {existingTopicNames.map(t => <option key={t} value={t} className="bg-surface text-text-primary">{t}</option>)}
                    <option value="NEW" className="bg-surface font-bold text-primary">+ Create New</option>
                  </select>
                )}

                {isBulkNewSubtopic ? (
                  <div className="flex gap-2 flex-1 min-w-[150px]">
                    <input type="text" value={bulkSubtopic} onChange={(e) => setBulkSubtopic(e.target.value)} className="flex-1 bg-surface-dark border border-glass-border rounded-lg px-3 py-1.5 text-text-primary text-sm" placeholder="New subtopic..." />
                    <button onClick={() => { setIsBulkNewSubtopic(false); setBulkSubtopic(''); }} className="text-xs px-2 bg-surface-light rounded">Cancel</button>
                  </div>
                ) : (
                  <select
                    value={bulkSubtopic}
                    onChange={(e) => {
                      if (e.target.value === 'NEW') setIsBulkNewSubtopic(true);
                      else setBulkSubtopic(e.target.value);
                    }}
                    className="flex-1 min-w-[150px] bg-surface-dark border border-glass-border rounded-lg px-3 py-1.5 text-text-primary text-sm appearance-none"
                  >
                    <option value="" className="bg-surface text-text-muted">Select Subtopic...</option>
                    {getSubtopicsForTopic(bulkTopic).map(s => <option key={s} value={s} className="bg-surface text-text-primary">{s}</option>)}
                    <option value="NEW" className="bg-surface font-bold text-primary">+ Create New</option>
                  </select>
                )}
                
                <button 
                  onClick={handleBulkApply}
                  disabled={!bulkTopic && !bulkSubtopic}
                  className="px-4 py-1.5 bg-primary text-black font-medium rounded-lg text-sm hover:bg-primary-dark transition disabled:opacity-50"
                >
                  Apply
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
              {parsedQuestions.map((q, index) => (
                <div key={index} className={`p-4 rounded-xl border transition-colors flex gap-4 ${selectedQuestions.has(index) ? 'border-primary/50 bg-primary/5' : 'border-glass-border bg-surface-light/30'}`}>
                  <div className="pt-1">
                    <input 
                      type="checkbox" 
                      checked={selectedQuestions.has(index)}
                      onChange={(e) => {
                        const newSet = new Set(selectedQuestions);
                        if (e.target.checked) newSet.add(index);
                        else newSet.delete(index);
                        setSelectedQuestions(newSet);
                      }}
                      className="w-4 h-4 text-primary bg-surface border-glass-border rounded focus:ring-primary cursor-pointer"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-text-primary text-sm font-medium mb-3 line-clamp-2">{q.question_text}</p>
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
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6 pt-4 border-t border-glass-border flex gap-3 shrink-0">
              <button
                onClick={() => setStatus('idle')}
                className="flex-1 py-2.5 rounded-lg border border-glass-border text-text-primary hover:bg-surface-light transition-colors font-medium"
              >
                Back
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
                <svg className={`w-12 h-12 ${isDragging ? 'text-primary' : 'text-text-muted'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
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
                Upload
              </button>
            </div>
          </>
        ) : (
          <div className="py-8 text-center">
            {status === 'success' ? (
              <div className="animate-fade-in flex flex-col items-center">
                <div className="w-16 h-16 bg-success/20 text-success rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-text-primary">Upload Complete!</h3>
                <p className="text-text-muted mt-2">Questions have been generated.</p>
              </div>
            ) : (
              <div className="animate-fade-in flex flex-col items-center">
                <div className="relative w-16 h-16 mb-6">
                  <svg className="animate-spin w-full h-full text-primary" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-text-primary">
                  {status === 'uploading' ? 'Uploading Document...' : status === 'saving' ? 'Saving Questions...' : `AI is parsing questions... (Found: ${parsedCount})`}
                </h3>
                <p className="text-text-muted mt-2">This might take a few moments for large documents</p>
                
                <div className="w-full h-2 bg-surface-light rounded-full mt-6 overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-[3000ms] ease-out"
                    style={{ width: status === 'uploading' ? '40%' : status === 'saving' ? '90%' : '70%' }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

