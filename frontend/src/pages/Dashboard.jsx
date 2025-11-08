import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { documentAPI } from '../services/api';
import DocumentTree from '../components/DocumentTree';
import Editor from '../components/Editor';

const Dashboard = () => {
  const [tree, setTree] = useState([]);
  const [activeDocId, setActiveDocId] = useState(null);
  const [activeDocument, setActiveDocument] = useState(null);
  const [loading, setLoading] = useState(true);
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

  const handleCreateRoot = async () => {
    const title = prompt('Enter document title:');
    if (!title) return;

    try {
      const response = await documentAPI.create(title, null);
      await loadDocumentTree();
      handleSelectDocument(response.data.id);
    } catch (error) {
      console.error('Error creating document:', error);
      alert('Failed to create document');
    }
  };

  const handleCreateChild = async (parentId) => {
    const title = prompt('Enter document title:');
    if (!title) return;

    try {
      const response = await documentAPI.create(title, parentId);
      await loadDocumentTree();
      handleSelectDocument(response.data.id);
    } catch (error) {
      console.error('Error creating document:', error);
      alert('Failed to create document');
    }
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
    <div className="h-screen flex flex-col">
      <header className="bg-blue-600 text-white p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Conote</h1>
        <button
          className="bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded"
          onClick={handleLogout}
        >
          Logout
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-80 bg-gray-50 border-r overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500">Loading...</div>
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
    </div>
  );
};

export default Dashboard;
