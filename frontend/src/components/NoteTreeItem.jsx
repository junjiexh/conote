import React, { useState } from 'react';
import { ChevronRight, ChevronDown, FileText, Star, MoreVertical, Plus, Edit, Trash2, Share2 } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const NoteTreeItem = ({
    note,
    activeDocId,
    onSelect,
    onToggleExpansion,
    expandedNodes = {},
    depth = 0,
    // Context menu actions
    onCreateChild,
    onRename,
    onDelete,
    onShare
}) => {
    const isSelected = activeDocId === note.id;
    const hasChildren = note.children && note.children.length > 0;
    const isExpanded = expandedNodes[note.id];

    const handleExpandClick = (e) => {
        e.stopPropagation();
        onToggleExpansion(note.id);
    };

    return (
        <div className="select-none">
            <div
                onClick={() => onSelect(note.id)}
                className={cn(
                    "group flex items-center gap-2 pr-2 py-1.5 cursor-pointer transition-all duration-200 rounded-md mx-2 relative",
                    isSelected ? 'bg-indigo-50 text-indigo-900' : 'hover:bg-slate-100 text-slate-700'
                )}
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
                <button
                    onClick={handleExpandClick}
                    className={cn(
                        "p-0.5 rounded-md hover:bg-slate-200 text-slate-400 transition-colors",
                        !hasChildren && "opacity-0 cursor-default"
                    )}
                >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>

                <FileText size={16} className={cn("shrink-0", isSelected ? 'text-indigo-600' : 'text-slate-400')} />

                <div className="flex-1 min-w-0 flex items-center justify-between">
                    <span className={cn("truncate text-sm", isSelected ? 'font-semibold' : 'font-medium')}>
                        {note.title || 'Untitled'}
                    </span>
                    {note.starred && <Star size={10} className="text-amber-400 fill-current shrink-0 ml-2" />}
                </div>

                {/* Context Menu */}
                <div className={cn(
                    "opacity-0 group-hover:opacity-100 transition-opacity",
                    isSelected && "opacity-100" // Always show on selected
                )}>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 hover:bg-slate-200"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <MoreVertical className="h-3 w-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCreateChild(note.id); }}>
                                <Plus className="mr-2 h-4 w-4" />
                                Add Child
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRename(note.id, note.title); }}>
                                <Edit className="mr-2 h-4 w-4" />
                                Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onShare(note.id, note.title); }}>
                                <Share2 className="mr-2 h-4 w-4" />
                                Share
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="text-destructive"
                                onClick={(e) => { e.stopPropagation(); onDelete(note.id, note.title); }}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Render Children */}
            {hasChildren && isExpanded && (
                <div className="relative">
                    {/* Vertical line for tree structure visualization */}
                    <div
                        className="absolute w-px bg-slate-200"
                        style={{
                            left: `${depth * 12 + 15}px`,
                            top: 0,
                            bottom: 0
                        }}
                    />
                    {note.children.map(child => (
                        <NoteTreeItem
                            key={child.id}
                            note={child}
                            depth={depth + 1}
                            activeDocId={activeDocId}
                            onSelect={onSelect}
                            onToggleExpansion={onToggleExpansion}
                            expandedNodes={expandedNodes}
                            onCreateChild={onCreateChild}
                            onRename={onRename}
                            onDelete={onDelete}
                            onShare={onShare}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default NoteTreeItem;
