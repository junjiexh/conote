import React, { useState, useMemo } from 'react';
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
import { Plus, Search, MoreVertical, Edit, Trash2, Share2, FileText, ChevronLeft, Menu } from 'lucide-react';
import NoteCard from './NoteCard';
import NavigationLinks from './NavigationLinks';
import UserProfileFooter from './UserProfileFooter';
import ShareDialog from './ShareDialog';
import { enrichDocumentWithMockData, flattenTree, filterDocuments, getRelativeTime } from '@/lib/mockData';

const NoteSidebar = ({
  tree,
  activeDocId,
  onSelect,
  onCreateRoot,
  onCreateChild,
  onRename,
  onDelete,
  onLogout,
  isOpen,
  onToggle,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareDocId, setShareDocId] = useState(null);
  const [shareDocTitle, setShareDocTitle] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteDocId, setDeleteDocId] = useState(null);
  const [deleteDocTitle, setDeleteDocTitle] = useState('');
  const [renamingDocId, setRenamingDocId] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  // Enrich tree with mock data and flatten
  const enrichedDocuments = useMemo(() => {
    const flattened = flattenTree(tree);
    return flattened.map((doc, index) => ({
      ...enrichDocumentWithMockData(doc, index),
      lastModified: getRelativeTime(enrichDocumentWithMockData(doc, index).lastModified),
    }));
  }, [tree]);

  // Filter and search
  const filteredDocuments = useMemo(() => {
    let docs = filterDocuments(enrichedDocuments, activeFilter);

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      docs = docs.filter(
        doc =>
          doc.title.toLowerCase().includes(query) ||
          (doc.content && doc.content.toLowerCase().includes(query))
      );
    }

    return docs;
  }, [enrichedDocuments, activeFilter, searchQuery]);

  const handleShare = (docId, docTitle) => {
    setShareDocId(docId);
    setShareDocTitle(docTitle);
    setShowShareDialog(true);
  };

  const handleDeletePrompt = (docId, docTitle) => {
    setDeleteDocId(docId);
    setDeleteDocTitle(docTitle);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    if (deleteDocId) {
      onDelete(deleteDocId);
      setShowDeleteDialog(false);
      setDeleteDocId(null);
      setDeleteDocTitle('');
    }
  };

  const handleRenameStart = (docId, currentTitle) => {
    setRenamingDocId(docId);
    setRenameValue(currentTitle);
  };

  const handleRenameSubmit = () => {
    if (renamingDocId && renameValue.trim() && renameValue !== filteredDocuments.find(d => d.id === renamingDocId)?.title) {
      onRename(renamingDocId, renameValue);
    }
    setRenamingDocId(null);
    setRenameValue('');
  };

  const handleRenameCancel = () => {
    setRenamingDocId(null);
    setRenameValue('');
  };

  return (
    <>
      <aside
        className={`${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed md:relative z-40 w-72 h-full bg-slate-50 border-r border-slate-200 flex flex-col transition-transform duration-300 ease-in-out shadow-xl md:shadow-none`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary font-bold text-xl">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
              <FileText size={18} fill="currentColor" />
            </div>
            Conote
          </div>
          <button
            onClick={onToggle}
            className="md:hidden p-1 hover:bg-slate-200 rounded"
          >
            <ChevronLeft size={20} />
          </button>
        </div>

        {/* Search & New Note */}
        <div className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <Input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
          <Button
            onClick={onCreateRoot}
            className="w-full py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <Plus size={16} /> New Note
          </Button>
        </div>

        {/* Navigation Links */}
        <NavigationLinks
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
        />

        {/* Note List */}
        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
          <h3 className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {activeFilter === 'all' ? 'Recent' : activeFilter}
          </h3>
          {filteredDocuments.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-400 text-sm">
              No notes found.
            </div>
          ) : (
            filteredDocuments.map((doc) => (
              <div key={doc.id} className="group relative">
                {renamingDocId === doc.id ? (
                  <div className="p-3">
                    <Input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={handleRenameSubmit}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameSubmit();
                        if (e.key === 'Escape') handleRenameCancel();
                      }}
                      autoFocus
                      className="text-sm"
                    />
                  </div>
                ) : (
                  <>
                    <NoteCard
                      note={doc}
                      isActive={activeDocId === doc.id}
                      onClick={() => onSelect(doc.id)}
                      level={doc.level}
                    />
                    {/* Context Menu Button */}
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 bg-white/90 hover:bg-white shadow-sm"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onCreateChild(doc.id)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Child
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleRenameStart(doc.id, doc.title)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleShare(doc.id, doc.title)}>
                            <Share2 className="mr-2 h-4 w-4" />
                            Share
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDeletePrompt(doc.id, doc.title)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* User Profile Footer */}
        <UserProfileFooter onLogout={onLogout} />
      </aside>

      {/* Mobile Overlay Toggle */}
      {!isOpen && (
        <div className="fixed top-4 left-4 z-50 md:hidden">
          <button
            onClick={onToggle}
            className="p-2 bg-white shadow-md rounded-lg text-slate-500 hover:text-primary transition-colors"
          >
            <Menu size={20} />
          </button>
        </div>
      )}

      {/* Dialogs */}
      <ShareDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        documentId={shareDocId}
        documentTitle={shareDocTitle}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteDocTitle}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default NoteSidebar;
