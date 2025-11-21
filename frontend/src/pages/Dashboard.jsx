import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { documentAPI } from '../services/api';
import NoteSidebar from '../components/NoteSidebar';
import Editor from '../components/Editor';
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
import { Loader2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

const Dashboard = () => {
  const [tree, setTree] = useState([]);
  const [activeDocId, setActiveDocId] = useState(null);
  const [activeDocument, setActiveDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [createParentId, setCreateParentId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { documentId: routeDocumentId } = useParams();

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

  const fetchDocument = useCallback(async (id) => {
    if (!id) {
      setActiveDocument(null);
      setActiveDocId(null);
      return;
    }
    try {
      const response = await documentAPI.getById(id);
      setActiveDocument(response.data);
      setActiveDocId(id);
    } catch (error) {
      console.error('Error loading document:', error);
      alert('Failed to load document');
      navigate('/documents', { replace: true });
      setActiveDocument(null);
      setActiveDocId(null);
    }
  }, [navigate]);

  useEffect(() => {
    if (routeDocumentId) {
      if (routeDocumentId !== activeDocId) {
        fetchDocument(routeDocumentId);
      }
    } else if (activeDocId) {
      setActiveDocId(null);
      setActiveDocument(null);
    }
  }, [routeDocumentId, fetchDocument, activeDocId]);

  const handleNavigateToDocument = (id) => {
    if (!id) {
      navigate('/documents');
      return;
    }
    navigate(`/documents/${id}`);
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
      handleNavigateToDocument(response.data.id);
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
      await documentAPI.update(id, { title: newTitle });
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
        handleNavigateToDocument(null);
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete document');
    }
  };

  const handleSaveDocument = async (id, title) => {
    try {
      await documentAPI.update(id, { title });
      await loadDocumentTree();
      if (activeDocId === id) {
        setActiveDocument((prev) => ({...prev, title}))
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

  return (
    <div className="h-screen flex bg-gray-50 text-slate-900 overflow-hidden">
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span>Loading...</span>
          </div>
        </div>
      ) : (
        <>
          <NoteSidebar
            tree={tree}
            activeDocId={activeDocId}
            onSelect={handleNavigateToDocument}
            onCreateRoot={handleCreateRoot}
            onCreateChild={handleCreateChild}
            onRename={handleRename}
            onDelete={handleDelete}
            onLogout={handleLogout}
            isOpen={sidebarOpen}
            onToggle={() => setSidebarOpen(!sidebarOpen)}
          />

          <main className="flex-1 min-w-0 bg-white relative">
            <Editor document={activeDocument} onSave={handleSaveDocument} />
          </main>
        </>
      )}

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
    </div>
  );
};

export default Dashboard;
