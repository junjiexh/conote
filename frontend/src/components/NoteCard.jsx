import React from 'react';
import { Star, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

const MOCK_USERS = [
  { id: 1, name: 'Alex Rivera', color: 'bg-blue-500', initials: 'AR' },
  { id: 2, name: 'Sarah Chen', color: 'bg-emerald-500', initials: 'SC' },
  { id: 3, name: 'Jordan Smith', color: 'bg-amber-500', initials: 'JS' },
  { id: 4, name: 'Mike Johnson', color: 'bg-purple-500', initials: 'MJ' },
];

const NoteCard = ({ note, isActive, onClick, level = 0 }) => {
  // Generate preview from content (first 100 chars)
  const getPreview = (content) => {
    if (!content) return null;
    // Remove HTML tags and get first 100 chars
    const text = content.replace(/<[^>]*>/g, '').trim();
    return text.substring(0, 100);
  };

  const preview = getPreview(note.content);
  const collaborators = note.collaborators || [];

  return (
    <div
      onClick={onClick}
      style={{ marginLeft: level > 0 ? `${level * 12}px` : '0' }}
      className={cn(
        "group relative p-3 rounded-xl cursor-pointer transition-all duration-200 border",
        isActive
          ? "bg-white border-primary/20 shadow-md ring-1 ring-primary/10"
          : "bg-transparent border-transparent hover:bg-white hover:border-slate-100 hover:shadow-sm"
      )}
    >
      <h4 className={cn(
        "font-medium text-sm mb-1 truncate",
        isActive ? "text-primary" : "text-slate-700"
      )}>
        {note.title || 'Untitled Note'}
      </h4>
      <p className="text-xs text-slate-500 line-clamp-2 mb-2 h-8 leading-relaxed">
        {preview || <span className="italic opacity-50">No additional text</span>}
      </p>
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-slate-400 font-medium">
          {note.lastModified || 'Just now'}
        </span>
        {collaborators.length > 0 && (
          <div className="flex -space-x-1.5">
            {collaborators.map(uid => {
              const user = MOCK_USERS.find(u => u.id === uid);
              if (!user) return null;
              return (
                <div
                  key={uid}
                  className={cn(
                    "w-4 h-4 rounded-full text-[8px] text-white flex items-center justify-center ring-1 ring-white",
                    user.color
                  )}
                  title={user.name}
                >
                  {user.initials}
                </div>
              );
            })}
          </div>
        )}
      </div>
      {note.starred && (
        <Star size={12} className="absolute top-3 right-3 text-amber-400 fill-current" />
      )}
    </div>
  );
};

export default NoteCard;
