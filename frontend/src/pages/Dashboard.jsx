import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { documentAPI } from '../services/api';
import DocumentTree from '../components/DocumentTree';
import Editor from '../components/Editor';
import SearchDialog from '../components/SearchDialog';
import { UserSidebar } from '../components/UserSidebar';
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
import { Separator } from '@/components/ui/separator';
import { User, Loader2, Search } from 'lucide-react';

const Dashboard = () => {
  const [tree, setTree] = useState([]);
  const [activeDocId, setActiveDocId] = useState(null);
  const [activeDocument, setActiveDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [createParentId, setCreateParentId] = useState(null);
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [showUserSidebar, setShowUserSidebar] = useState(false);
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
    <div className="h-screen flex flex-col bg-background">
      <header className="border-b bg-card">
        <div className="flex justify-between items-center p-4">
          <h1 className="text-2xl font-bold text-primary">Conote</h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSearchDialog(true)}
            >
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowUserSidebar(true)}
              aria-label="User menu"
            >
              <User className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <Separator />
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-80 border-r bg-muted/30 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : (
            <DocumentTree
              tree={tree}
              activeDocId={activeDocId}
              onSelect={handleSelectDocument}
              onCreateRoot={handleCreateRoot}
              onCreateChild={handleCreateChild}
              onRename={handleRename}
              onDelete={handleDelete}
            />
          )}
        </aside>

        <main className="flex-1 overflow-hidden">
          <Editor document={activeDocument} onSave={handleSaveDocument} />
        </main>
      </div>

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

      <UserSidebar
        open={showUserSidebar}
        onOpenChange={setShowUserSidebar}
      />
    </div>
  );
};

export default Dashboard;
