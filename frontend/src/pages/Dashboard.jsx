import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { documentAPI } from '../services/api';
import LeftPanel from '../components/LeftPanel';
import Editor from '../components/Editor';
import SearchDialog from '../components/SearchDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const Dashboard = () => {
  const [tree, setTree] = useState([]);
  const [activeDocId, setActiveDocId] = useState(null);
  const [activeDocument, setActiveDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [createParentId, setCreateParentId] = useState(null);
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const { logout } = useAuth();

  useEffect(() => {
    loadDocumentTree();
  }, []);

  const loadDocumentTree = async () => {
    try {
      const response = await documentAPI.getAll();
      setTree(response.data);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDocument = async (id) => {
    try {
      const response = await documentAPI.getById(id);
      setActiveDocument(response.data);
      setActiveDocId(id);
    } catch (error) {
      console.error('Error loading document:', error);
      alert('Failed to load document');
    }
  };

  const openCreateDialog = (parentId = null) => {
    setCreateParentId(parentId);
    setNewDocTitle('');
    setShowCreateDialog(true);
  };

  const handleCreateDocument = async () => {
    if (!newDocTitle.trim()) return;

    try {
      const response = await documentAPI.create(newDocTitle, createParentId);
      await loadDocumentTree();
      handleSelectDocument(response.data.id);
      setShowCreateDialog(false);
      setNewDocTitle('');
    } catch (error) {
      console.error('Error creating document:', error);
      alert('Failed to create document');
    }
  };

  const handleCreateRoot = () => {
    openCreateDialog(null);
  };

  const handleCreateChild = (parentId) => {
    openCreateDialog(parentId);
  };

  const handleRename = async (id, newTitle) => {
    try {
      await documentAPI.update(id, newTitle, undefined);
      await loadDocumentTree();
      if (activeDocId === id) {
        setActiveDocument((prev) => ({ ...prev, title: newTitle }));
      }
    } catch (error) {
      console.error('Error renaming document:', error);
      alert('Failed to rename document');
    }
  };

  const handleDelete = async (id) => {
    try {
      await documentAPI.delete(id);
      await loadDocumentTree();
      if (activeDocId === id) {
        setActiveDocId(null);
        setActiveDocument(null);
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete document');
    }
  };

  const handleSaveDocument = async (id, title, content) => {
    try {
      await documentAPI.update(id, title, content);
      await loadDocumentTree();
      if (activeDocId === id) {
        setActiveDocument((prev) => ({...prev, title, content}))
      }
    } catch (error) {
      console.error('Error saving document:', error);
      throw error;
    }
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  const handleSearchResultSelect = (document) => {
    handleSelectDocument(document.id);
  };

  return (
    <div className="h-screen flex bg-background">
      {/* Left Panel */}
      <LeftPanel
        tree={tree}
        activeDocId={activeDocId}
        onSelect={handleSelectDocument}
        onCreateRoot={handleCreateRoot}
        onSearchClick={() => setShowSearchDialog(true)}
        loading={loading}
      />

      {/* Right Panel - Editor */}
      <main className="flex-1 overflow-hidden relative isolate">
        <Editor document={activeDocument} onSave={handleSaveDocument} />
      </main>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Document</DialogTitle>
            <DialogDescription>
              {createParentId ? 'Enter a title for the child document.' : 'Enter a title for the new document.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="title">Document Title</Label>
            <Input
              id="title"
              placeholder="Enter document title"
              value={newDocTitle}
              onChange={(e) => setNewDocTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateDocument();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateDocument} disabled={!newDocTitle.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SearchDialog
        open={showSearchDialog}
        onOpenChange={setShowSearchDialog}
        onSelectDocument={handleSearchResultSelect}
      />
    </div>
  );
};

export default Dashboard;
