import React, { useState } from 'react';

const TreeNode = ({ node, activeDocId, onSelect, onCreateChild, onRename, onDelete, level = 0 }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState(node.title);

  const hasChildren = node.children && node.children.length > 0;
  const isActive = activeDocId === node.id;

  const handleRename = async () => {
    if (newTitle.trim() && newTitle !== node.title) {
      await onRename(node.id, newTitle);
    }
    setIsRenaming(false);
    setShowMenu(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      setNewTitle(node.title);
      setIsRenaming(false);
    }
  };

  return (
    <div className="select-none">
      <div
        className={`flex items-center py-1 px-2 hover:bg-gray-100 rounded cursor-pointer relative ${
          isActive ? 'bg-blue-100' : ''
        }`}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
      >
        {hasChildren && (
          <span
            className="mr-1 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              setIsCollapsed(!isCollapsed);
            }}
          >
            {isCollapsed ? '▶' : '▼'}
          </span>
        )}
        {!hasChildren && <span className="mr-1 w-4"></span>}

        {isRenaming ? (
          <input
            type="text"
            className="flex-1 px-1 border border-blue-500 rounded"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onBlur={handleRename}
            onKeyDown={handleKeyPress}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="flex-1"
            onClick={() => onSelect(node.id)}
          >
            {node.title}
          </span>
        )}

        <button
          className="ml-2 text-gray-500 hover:text-gray-700"
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
        >
          ⋮
        </button>

        {showMenu && (
          <div className="absolute right-0 top-8 bg-white border border-gray-300 rounded shadow-lg z-10 min-w-[150px]">
            <button
              className="block w-full text-left px-4 py-2 hover:bg-gray-100"
              onClick={(e) => {
                e.stopPropagation();
                onCreateChild(node.id);
                setShowMenu(false);
              }}
            >
              Add Child
            </button>
            <button
              className="block w-full text-left px-4 py-2 hover:bg-gray-100"
              onClick={(e) => {
                e.stopPropagation();
                setIsRenaming(true);
                setShowMenu(false);
              }}
            >
              Rename
            </button>
            <button
              className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-red-600"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete "${node.title}"?`)) {
                  onDelete(node.id);
                }
                setShowMenu(false);
              }}
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {!isCollapsed && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              activeDocId={activeDocId}
              onSelect={onSelect}
              onCreateChild={onCreateChild}
              onRename={onRename}
              onDelete={onDelete}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const DocumentTree = ({ tree, activeDocId, onSelect, onCreateRoot, onCreateChild, onRename, onDelete }) => {
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <button
          className="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          onClick={onCreateRoot}
        >
          + New Document
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {tree && tree.length > 0 ? (
          tree.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              activeDocId={activeDocId}
              onSelect={onSelect}
              onCreateChild={onCreateChild}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))
        ) : (
          <div className="text-center text-gray-500 mt-8">
            No documents yet. Create one to get started!
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentTree;
