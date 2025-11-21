import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { FileText, Clock } from 'lucide-react';
import TiptapEditor from './TiptapEditor';

const Editor = ({ document, onSave }) => {
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  useEffect(() => {
    if (document) {
      setTitle(document.title || '');
      setLastSaved(null);
    }
  }, [document]);

  const hasTitleChanges = document && title !== (document.title || '');

  const handleSave = async () => {
    if (!document || !hasTitleChanges) return;

    setIsSaving(true);
    try {
      await onSave(document.id, title);
      setLastSaved(new Date());
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
      <div className="h-full flex items-center justify-center bg-muted/30">
        <div className="text-center text-muted-foreground">
          <FileText className="mx-auto h-16 w-16 mb-4" />
          <p className="text-lg">Select a document to start editing</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background" onKeyDown={handleKeyDown}>
      <div className="p-4 space-y-3">
        <Input
          type="text"
          className="text-2xl font-bold border-none shadow-none px-0 focus-visible:ring-0"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Document Title"
        />
        <div className="flex items-center justify-between">
          {lastSaved && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Last saved: {lastSaved.toLocaleTimeString()}</span>
            </div>
          )}
          <Button
            onClick={handleSave}
            disabled={!hasTitleChanges || isSaving}
            variant={hasTitleChanges ? "default" : "secondary"}
            className="ml-auto"
          >
            {isSaving ? 'Saving...' : hasTitleChanges ? 'Save Title (Ctrl+S)' : 'Title Saved'}
          </Button>
        </div>
        <Separator />
      </div>

      <div className="flex-1 overflow-hidden px-4 pb-4">
        <TiptapEditor
          key={document.id}
          className="w-full h-full text-base"
          placeholder="Start typing..."
          documentId={document.id}
        />
      </div>
    </div>
  );
};

export default Editor;
