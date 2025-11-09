import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ChevronRight, ChevronDown, MoreVertical, Plus, Edit, Trash2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

const TreeNode = ({ node, activeDocId, onSelect, onCreateChild, onRename, onDelete, level = 0 }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(node.title);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const hasChildren = node.children && node.children.length > 0;
  const isActive = activeDocId === node.id;

  const handleRename = async () => {
    if (newTitle.trim() && newTitle !== node.title) {
      await onRename(node.id, newTitle);
    }
    setIsRenaming(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      setNewTitle(node.title);
      setIsRenaming(false);
    }
  };

  const handleDelete = () => {
    onDelete(node.id);
    setShowDeleteDialog(false);
  };

  return (
    <div className="select-none">
      <div
        className={cn(
          "flex items-center py-1.5 px-2 hover:bg-accent rounded-md cursor-pointer group",
          isActive && "bg-accent"
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        <div className="flex items-center flex-1 min-w-0">
          {hasChildren ? (
            <button
              className="mr-1 p-0.5 hover:bg-accent rounded"
              onClick={(e) => {
                e.stopPropagation();
                setIsCollapsed(!isCollapsed);
              }}
            >
              {isCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          ) : (
            <span className="mr-1 w-5"></span>
          )}

          {isRenaming ? (
            <Input
              type="text"
              className="h-7 flex-1"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onBlur={handleRename}
              onKeyDown={handleKeyPress}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div
              className="flex items-center flex-1 min-w-0 gap-2"
              onClick={() => onSelect(node.id)}
            >
              <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <span className="truncate text-sm">{node.title}</span>
            </div>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 ml-1 opacity-0 group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onCreateChild(node.id);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Child
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                setIsRenaming(true);
              }}
            >
              <Edit className="mr-2 h-4 w-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteDialog(true);
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {!isCollapsed && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              activeDocId={activeDocId}
              onSelect={onSelect}
              onCreateChild={onCreateChild}
              onRename={onRename}
              onDelete={onDelete}
              level={level + 1}
            />
          ))}
        </div>
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{node.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const DocumentTree = ({ tree, activeDocId, onSelect, onCreateRoot, onCreateChild, onRename, onDelete }) => {
  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-4 border-b">
        <Button
          className="w-full"
          onClick={onCreateRoot}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Document
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {tree && tree.length > 0 ? (
          tree.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              activeDocId={activeDocId}
              onSelect={onSelect}
              onCreateChild={onCreateChild}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))
        ) : (
          <div className="text-center text-muted-foreground mt-8 px-4">
            <p className="text-sm">No documents yet. Create one to get started!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentTree;
