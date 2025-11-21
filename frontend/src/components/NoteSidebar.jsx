import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Plus, Search, FileText, ChevronLeft, Menu } from 'lucide-react';
import NoteTreeItem from './NoteTreeItem';
import NavigationLinks from './NavigationLinks';
import UserProfileFooter from './UserProfileFooter';
import ShareDialog from './ShareDialog';
import { enrichTree, filterTree } from '@/lib/mockData';

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

  // Expansion state
  const [expandedNodes, setExpandedNodes] = useState({});

  // Enrich tree with mock data recursively
  const enrichedTree = useMemo(() => {
    return enrichTree(tree);
  }, [tree]);

  // Filter and search
  const filteredTree = useMemo(() => {
    let nodes = enrichedTree;

    // 1. Filter by category (favorites, shared, etc.)
    if (activeFilter !== 'all') {
      nodes = filterTree(nodes, (doc) => {
        if (activeFilter === 'favorites') return doc.starred;
        if (activeFilter === 'shared') return doc.collaborators && doc.collaborators.length > 0;
        return true;
      });
    }

    // 2. Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      nodes = filterTree(nodes, (doc) =>
        doc.title.toLowerCase().includes(query) ||
        (doc.content && doc.content.toLowerCase().includes(query))
      );
    }

    return nodes;
  }, [enrichedTree, activeFilter, searchQuery]);

  // Auto-expand nodes when searching
  useEffect(() => {
    if (searchQuery.trim()) {
      const getAllIds = (nodes) => {
        let ids = {};
        nodes.forEach(node => {
          ids[node.id] = true;
          if (node.children) {
            ids = { ...ids, ...getAllIds(node.children) };
          }
        });
        return ids;
      };
      setExpandedNodes(getAllIds(filteredTree));
    }
  }, [searchQuery, filteredTree]);

  const toggleExpansion = (docId) => {
    setExpandedNodes(prev => ({
      ...prev,
      [docId]: !prev[docId]
    }));
  };

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

  return (
    <>
      <aside
        className={`${isOpen ? 'translate-x-0' : '-translate-x-full'
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
          {filteredTree.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-400 text-sm">
              No notes found.
            </div>
          ) : (
            filteredTree.map((doc) => (
              <NoteTreeItem
                key={doc.id}
                note={doc}
                activeDocId={activeDocId}
                onSelect={onSelect}
                onToggleExpansion={toggleExpansion}
                expandedNodes={expandedNodes}
                onCreateChild={onCreateChild}
                onRename={onRename}
                onDelete={handleDeletePrompt}
                onShare={handleShare}
              />
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

