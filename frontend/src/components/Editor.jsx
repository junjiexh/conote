import React, { useState, useEffect } from 'react';

const Editor = ({ document, onSave }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (document) {
      setTitle(document.title || '');
      setContent(document.content || '');
      setHasChanges(false);
    }
  }, [document]);

  useEffect(() => {
    if (document && (title !== document.title || content !== document.content)) {
      setHasChanges(true);
    } else {
      setHasChanges(false);
    }
  }, [title, content, document]);

  const handleSave = async () => {
    if (!document || !hasChanges) return;

    setIsSaving(true);
    try {
      await onSave(document.id, title, content);
      setLastSaved(new Date());
      setHasChanges(false);
    } catch (error) {
      console.error('Error saving document:', error);
      alert('Failed to save document');
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  };

  if (!document) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="mt-4 text-lg">Select a document to start editing</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" onKeyDown={handleKeyDown}>
      <div className="bg-white border-b p-4 flex items-center justify-between">
        <input
          type="text"
          className="text-2xl font-bold flex-1 outline-none"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Document Title"
        />
        <div className="flex items-center gap-4">
          {lastSaved && (
            <span className="text-sm text-gray-500">
              Last saved: {lastSaved.toLocaleTimeString()}
            </span>
          )}
          <button
            className={`px-4 py-2 rounded font-medium ${
              hasChanges
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : 'bg-gray-300 text-gray-600 cursor-not-allowed'
            }`}
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
          >
            {isSaving ? 'Saving...' : hasChanges ? 'Save (Ctrl+S)' : 'Saved'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <textarea
          className="w-full h-full p-6 resize-none outline-none text-lg"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Start typing..."
        />
      </div>
    </div>
  );
};

export default Editor;
