import React, { useState, useEffect } from 'react';
import { Users, Mail, Trash2, X, UserPlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { sharingAPI } from '@/services/api';

const PERMISSION_LEVELS = {
  VIEWER: { label: 'Viewer', description: 'Can view only' },
  COMMENTER: { label: 'Commenter', description: 'Can view and comment' },
  EDITOR: { label: 'Editor', description: 'Can view, comment, and edit' },
};

export default function ShareDialog({ open, onOpenChange, documentId, documentTitle }) {
  const [email, setEmail] = useState('');
  const [permissionLevel, setPermissionLevel] = useState('VIEWER');
  const [collaborators, setCollaborators] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (open && documentId) {
      loadCollaborators();
    }
  }, [open, documentId]);

  const loadCollaborators = async () => {
    try {
      const response = await sharingAPI.getCollaborators(documentId);
      setCollaborators(response.data);
    } catch (error) {
      console.error('Failed to load collaborators:', error);
      setError('Failed to load collaborators');
    }
  };

  const handleShare = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim()) {
      setError('Please enter an email address');
      return;
    }

    setLoading(true);
    try {
      await sharingAPI.shareDocument(documentId, email, permissionLevel);
      setSuccess(`Document shared with ${email}`);
      setEmail('');
      await loadCollaborators();
    } catch (error) {
      console.error('Failed to share document:', error);
      setError(
        error.response?.data?.message || 'Failed to share document'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (userId, userEmail) => {
    if (!confirm(`Remove ${userEmail} from this document?`)) {
      return;
    }

    try {
      await sharingAPI.revokePermission(documentId, userId);
      setSuccess(`Removed ${userEmail}`);
      await loadCollaborators();
    } catch (error) {
      console.error('Failed to revoke permission:', error);
      setError(
        error.response?.data?.message || 'Failed to remove user'
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Share "{documentTitle}"
          </DialogTitle>
          <DialogDescription>
            Share this document with others by entering their email address
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Share Form */}
          <form onSubmit={handleShare} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email Address</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    type="email"
                    placeholder="user@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    disabled={loading}
                  />
                </div>
                <select
                  value={permissionLevel}
                  onChange={(e) => setPermissionLevel(e.target.value)}
                  className="px-3 py-2 border rounded-md bg-white"
                  disabled={loading}
                >
                  {Object.entries(PERMISSION_LEVELS).map(([key, { label }]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
                <Button type="submit" disabled={loading}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Share
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                {PERMISSION_LEVELS[permissionLevel].description}
              </p>
            </div>

            {/* Error/Success Messages */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-md text-sm">
                <X className="w-4 h-4" />
                {error}
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-md text-sm">
                {success}
              </div>
            )}
          </form>

          {/* Collaborators List */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">
              People with access
            </h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {collaborators.map((collab) => (
                <Card key={collab.userId} className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{collab.email}</p>
                        {collab.isOwner && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                            Owner
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-gray-500">
                          {PERMISSION_LEVELS[collab.permissionLevel]?.label || collab.permissionLevel}
                        </p>
                        {collab.isInherited && (
                          <span className="text-xs text-gray-400">
                            • Inherited
                          </span>
                        )}
                      </div>
                    </div>
                    {!collab.isOwner && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevoke(collab.userId, collab.email)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
              {collaborators.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">
                  No collaborators yet
                </p>
              )}
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 p-3 rounded-md space-y-2 text-sm">
            <p className="font-medium text-blue-900">Permission Levels:</p>
            <ul className="space-y-1 text-blue-700">
              <li>• <strong>Viewer:</strong> Can only read the document</li>
              <li>• <strong>Commenter:</strong> Can read and add comments</li>
              <li>• <strong>Editor:</strong> Can read, comment, and edit content</li>
            </ul>
            <p className="text-xs text-blue-600 mt-2">
              Permissions automatically apply to all child documents.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
