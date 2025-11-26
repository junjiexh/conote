import React, { useState, useEffect } from 'react';
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
import { useQuery, useQueryClient } from '@tanstack/react-query';

const Dashboard = () => {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [createParentId, setCreateParentId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { documentId: routeDocumentId } = useParams();
  const queryClient = useQueryClient();

  const { data: tree = [], isLoading: treeLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: async () => {
      const response = await documentAPI.getAll();
      return response.data;
    },
  });

  const { data: activeDocument, error: docError } = useQuery({
    queryKey: ['document', routeDocumentId],
    queryFn: async () => {
      const response = await documentAPI.getById(routeDocumentId);
      return response.data;
    },
    enabled: !!routeDocumentId,
    retry: false,
  });

  useEffect(() => {
    if (docError) {
      console.error('Error loading document:', docError);
      alert('Failed to load document');
      navigate('/documents', { replace: true });
    }
  }, [docError, navigate]);

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
      queryClient.invalidateQueries({ queryKey: ['documents'] });
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
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document', id] });
    } catch (error) {
      console.error('Error renaming document:', error);
      alert('Failed to rename document');
    }
  };

  const handleDelete = async (id) => {
    try {
      await documentAPI.delete(id);
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      if (routeDocumentId === id) {
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
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['document', id] });
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
      {treeLoading ? (
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
            activeDocId={routeDocumentId}
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
            <Editor document={activeDocument || null} onSave={handleSaveDocument} />
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
