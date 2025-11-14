import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { documentAPI, folderAPI } from '../services/api';
import DocumentTree from '../components/DocumentTree';
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
import { Separator } from '@/components/ui/separator';
import { LogOut, Loader2, Search, Folder, FolderPlus, Pencil, Trash2 } from 'lucide-react';

const Dashboard = () => {
  const [tree, setTree] = useState([]);
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [activeDocId, setActiveDocId] = useState(null);
  const [activeDocument, setActiveDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [createParentId, setCreateParentId] = useState(null);
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolder, setEditingFolder] = useState(null);
  const { logout } = useAuth();

  useEffect(() => {
    loadFolders();
    loadDocumentTree();
  }, []);

  const loadFolders = async () => {
    try {
      const response = await folderAPI.getAll();
      setFolders(response.data);
      // Select the first folder (personal) by default
      if (response.data.length > 0 && !selectedFolder) {
        setSelectedFolder(response.data[0].id);
      }
    } catch (error) {
      console.error('Error loading folders:', error);
    }
  };

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
      const response = await documentAPI.create(newDocTitle, createParentId, selectedFolder);
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

  const openFolderDialog = (folder = null) => {
    setEditingFolder(folder);
    setNewFolderName(folder ? folder.name : '');
    setShowFolderDialog(true);
  };

  const handleCreateOrUpdateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      if (editingFolder) {
        await folderAPI.update(editingFolder.id, newFolderName);
      } else {
        await folderAPI.create(newFolderName);
      }
      await loadFolders();
      setShowFolderDialog(false);
      setNewFolderName('');
      setEditingFolder(null);
    } catch (error) {
      console.error('Error creating/updating folder:', error);
      alert(error.response?.data?.message || 'Failed to save folder');
    }
  };

  const handleDeleteFolder = async (folderId) => {
    const folder = folders.find(f => f.id === folderId);
    if (folder?.name === 'personal') {
      alert('Cannot delete the personal folder');
      return;
    }

    if (!confirm('Are you sure you want to delete this folder? Documents will not be deleted.')) {
      return;
    }

    try {
      await folderAPI.delete(folderId);
      await loadFolders();
      if (selectedFolder === folderId) {
        setSelectedFolder(folders.find(f => f.name === 'personal')?.id || null);
      }
      await loadDocumentTree();
    } catch (error) {
      console.error('Error deleting folder:', error);
      alert('Failed to delete folder');
    }
  };

  const filteredTree = selectedFolder
    ? tree.filter(doc => doc.folderId === selectedFolder)
    : tree;

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
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
        <Separator />
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-80 border-r bg-muted/30 flex flex-col">
          {/* Folder Section */}
          <div className="border-b p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">Folders</h2>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => openFolderDialog()}
                className="h-7 px-2"
              >
                <FolderPlus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-1">
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer hover:bg-accent group ${
                    selectedFolder === folder.id ? 'bg-accent' : ''
                  }`}
                  onClick={() => setSelectedFolder(folder.id)}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Folder className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm truncate">{folder.name}</span>
                  </div>
                  {folder.name !== 'personal' && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          openFolderDialog(folder);
                        }}
                        className="h-6 w-6 p-0"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFolder(folder.id);
                        }}
                        className="h-6 w-6 p-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Document Tree Section */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading...
              </div>
            ) : (
              <DocumentTree
                tree={filteredTree}
                activeDocId={activeDocId}
                onSelect={handleSelectDocument}
                onCreateRoot={handleCreateRoot}
                onCreateChild={handleCreateChild}
                onRename={handleRename}
                onDelete={handleDelete}
              />
            )}
          </div>
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

      <Dialog open={showFolderDialog} onOpenChange={setShowFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFolder ? 'Rename Folder' : 'Create New Folder'}</DialogTitle>
            <DialogDescription>
              {editingFolder ? 'Enter a new name for the folder.' : 'Enter a name for the new folder.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="folderName">Folder Name</Label>
            <Input
              id="folderName"
              placeholder="Enter folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateOrUpdateFolder();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFolderDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateOrUpdateFolder} disabled={!newFolderName.trim()}>
              {editingFolder ? 'Rename' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
