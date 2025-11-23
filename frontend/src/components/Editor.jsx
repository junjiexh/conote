import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Star, Share2, MoreHorizontal, Plus, CheckSquare } from 'lucide-react';
import TiptapEditor from './TiptapEditor';
import ShareDialog from './ShareDialog';
import { useAuth } from '@/context/AuthContext';

const colorFromIdentifier = (identifier) => {
  if (!identifier) return '#475569';
  const hash = Math.abs(
    String(identifier)
      .split('')
      .reduce((acc, char) => acc + char.charCodeAt(0), 0),
  );
  return `#${hash.toString(16).padStart(6, '0').slice(0, 6)}`;
};

const getInitials = (name, email) => {
  const source = name?.trim() || email?.trim();
  if (!source) {
    return '??';
  }
  const parts = source.split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const formatRole = (collaborator) => {
  if (collaborator?.isOwner) {
    return 'Owner';
  }
  if (collaborator?.permissionLevel) {
    const lower = collaborator.permissionLevel.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }
  return 'Viewer';
};

const Editor = ({ document, onSave }) => {
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isStarred, setIsStarred] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const { user } = useAuth();
  const handlePresenceChange = useCallback((states = []) => {
    setOnlineUsers(Array.isArray(states) ? states : []);
  }, []);

  useEffect(() => {
    if (document) {
      setTitle(document.title || '');
      // Mock starred state
      setIsStarred(document.id % 5 === 0);
    }
  }, [document]);

  const hasTitleChanges = document && title !== (document.title || '');

  // Auto-save with debounce
  useEffect(() => {
    if (!document) return;

    if (!hasTitleChanges) {
      setIsSaving(false);
      return;
    }

    setIsSaving(true);
    const timer = setTimeout(async () => {
      try {
        await onSave(document.id, title);
      } catch (error) {
        console.error('Error saving document:', error);
      } finally {
        setIsSaving(false);
      }
    }, 1000);

    return () => {
      setIsSaving(false);
      clearTimeout(timer);
    }
  }, [title, document, hasTitleChanges, onSave]);

  useEffect(() => {
    if (!document) {
      setOnlineUsers([]);
    }
  }, [document]);

  const normalizedCurrentUserEmail = user?.email?.toLowerCase();
  const onlineCollaborators = onlineUsers
    .filter((presence) => {
      if (!presence) return false;
      if (!presence.email || !normalizedCurrentUserEmail) {
        return true;
      }
      return presence.email.toLowerCase() !== normalizedCurrentUserEmail;
    })
    .map((presence, index) => {
      const identifier = presence.clientId
        || presence.id
        || presence.email
        || presence.name
        || `presence-${index}`;
      const label = presence.name || presence.email || "Unknown user";
      const email = presence.email || "";
      const avatarColor = presence.color || colorFromIdentifier(email || label || identifier);
      const initials = getInitials(label, email);
      return {
        key: identifier,
        name: label,
        email,
        avatarColor,
        initials,
        permissionLevel: "",
        isOwner: false,
      };
    });

  if (!document) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="text-center text-slate-300">
          <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-4 mx-auto">
            <FileText size={48} />
          </div>
          <p className="text-lg font-medium text-slate-500">Select a note to view</p>
          <p className="text-sm">or create a new one to get started</p>
        </div>
      </div>
    );
  }

  // Mock folder
  const folder = ['Work', 'Personal', 'Design', 'Projects'][document.id % 4];

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Editor Header */}
      <header className="h-16 border-b border-slate-100 flex items-center justify-between px-4 md:px-8 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-xs text-slate-400 flex items-center gap-1">
              {folder}
              {isSaving ? (
                <span className="text-primary animate-pulse ml-2">Saving...</span>
              ) : (
                <span className="ml-2 flex items-center gap-1">
                  <CheckSquare size={10} /> Saved
                </span>
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Active Collaborators */}
          <div className="flex items-center gap-2 mr-4">
            {onlineCollaborators.length > 0 ? (
              <>
                <div className="flex -space-x-2">
                  {onlineCollaborators.map((collaborator) => (
                    <div key={collaborator.key} className="relative group">
                      <div
                        className="w-8 h-8 rounded-full text-xs text-white flex items-center justify-center ring-2 ring-white cursor-pointer"
                        style={{ backgroundColor: collaborator.avatarColor }}
                      >
                        {collaborator.initials}
                      </div>
                      <div className="absolute top-full mt-1 right-0 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                        {collaborator.name} • {formatRole(collaborator)}
                      </div>
                    </div>
                  ))}
                </div>
                <span className="text-xs text-slate-400">{onlineCollaborators.length} online</span>
              </>
            ) : (
              <span className="text-xs text-slate-400">Only you here</span>
            )}
            <button
              onClick={() => setShowShareDialog(true)}
              className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center ring-2 ring-white hover:bg-primary/10 hover:text-primary transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="h-6 w-px bg-slate-200 mx-1"></div>

          <button
            onClick={() => setIsStarred(!isStarred)}
            className={`p-2 rounded-full transition-colors ${isStarred ? 'text-amber-400 bg-amber-50' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
              }`}
          >
            <Star size={18} fill={isStarred ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={() => setShowShareDialog(true)}
            className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors"
          >
            <Share2 size={18} />
          </button>
          <button className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 rounded-full transition-colors">
            <MoreHorizontal size={18} />
          </button>
        </div>
      </header>

      {/* Editor Body with Title and Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-12">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Untitled Note"
            className="w-full text-4xl font-bold text-slate-900 placeholder-slate-300 border-none focus:ring-0 p-0 bg-transparent mb-6 outline-none"
          />
          <TiptapEditor
            key={document.id}
            className="w-full min-h-[500px]"
            placeholder="Start writing, or drag files here..."
            documentId={document.id}
            onPresenceChange={handlePresenceChange}
          />
        </div>
      </div>

      <ShareDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        documentId={document.id}
        documentTitle={document.title}
      />
    </div>
  );
};

export default Editor;
