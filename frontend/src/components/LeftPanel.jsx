import React from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { User, Search, FileText, Plus, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const LeftPanel = ({
  tree,
  activeDocId,
  onSelect,
  onCreateRoot,
  onSearchClick,
  loading
}) => {
  const { user } = useAuth();

  const renderDocument = (doc) => {
    const isActive = doc.id === activeDocId;

    return (
      <div key={doc.id}>
        <button
          onClick={() => onSelect(doc.id)}
          className={`w-full text-left px-4 py-2 hover:bg-muted transition-colors flex items-center gap-2 ${
            isActive ? 'bg-muted font-semibold' : ''
          }`}
        >
          <FileText className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">{doc.title}</span>
        </button>
        {doc.children && doc.children.length > 0 && (
          <div className="ml-4">
            {doc.children.map(child => renderDocument(child))}
          </div>
        )}
      </div>
    );
  };

  const renderFlatDocuments = (docs) => {
    const flatList = [];

    const flatten = (items) => {
      items.forEach(item => {
        flatList.push(item);
        if (item.children && item.children.length > 0) {
          flatten(item.children);
        }
      });
    };

    flatten(docs);

    return flatList.map(doc => {
      const isActive = doc.id === activeDocId;
      return (
        <button
          key={doc.id}
          onClick={() => onSelect(doc.id)}
          className={`w-full text-left px-4 py-2 hover:bg-muted transition-colors flex items-center gap-2 ${
            isActive ? 'bg-muted font-semibold' : ''
          }`}
        >
          <FileText className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">{doc.title}</span>
        </button>
      );
    });
  };

  return (
    <aside className="w-80 border-r bg-background flex flex-col h-full relative z-0">
      {/* User Info Section */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold truncate">{user?.username || 'User'}</h3>
            {user?.email && (
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            )}
          </div>
        </div>

        {/* Search Button */}
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={onSearchClick}
        >
          <Search className="mr-2 h-4 w-4" />
          Search documents...
        </Button>
      </div>

      <Separator />

      {/* Private Section */}
      <div className="px-4 py-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Private
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCreateRoot}
          className="h-7 w-7 p-0"
          title="Create new document"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <Separator />

      {/* Documents List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        ) : tree.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <FileText className="mx-auto h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">No documents yet</p>
            <Button
              variant="link"
              size="sm"
              onClick={onCreateRoot}
              className="mt-2"
            >
              Create your first document
            </Button>
          </div>
        ) : (
          <div className="py-2">
            {renderFlatDocuments(tree)}
          </div>
        )}
      </div>
    </aside>
  );
};

export default LeftPanel;
