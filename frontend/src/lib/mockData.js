// Mock data utilities for frontend-only features

export const MOCK_USERS = [
  { id: 1, name: 'Alex Rivera', color: 'bg-blue-500', initials: 'AR' },
  { id: 2, name: 'Sarah Chen', color: 'bg-emerald-500', initials: 'SC' },
  { id: 3, name: 'Jordan Smith', color: 'bg-amber-500', initials: 'JS' },
  { id: 4, name: 'Mike Johnson', color: 'bg-purple-500', initials: 'MJ' },
];

export const MOCK_FOLDERS = ['Work', 'Personal', 'Design', 'Projects'];

// Generate relative time string
export const getRelativeTime = (date) => {
  if (!date) return 'Just now';

  const now = new Date();
  const past = new Date(date);
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return past.toLocaleDateString();
};

// Enrich document with mock data
export const enrichDocumentWithMockData = (doc, index = 0) => {
  // Use index for deterministic mock data generation (index is always a number)
  const seed = index;

  // Generate a hash from the doc ID for deterministic but distributed values
  const hashCode = (str) => {
    let hash = 0;
    if (!str) return seed;
    const s = String(str);
    for (let i = 0; i < s.length; i++) {
      const char = s.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  };

  const docHash = hashCode(doc.id);

  // Use seed for time calculation to ensure valid dates
  const hoursAgo = (seed % 100) * 3600000; // Max 100 hours ago
  const timestamp = Date.now() - hoursAgo;

  return {
    ...doc,
    starred: docHash % 5 === 0, // Every 5th document is starred
    folder: MOCK_FOLDERS[docHash % MOCK_FOLDERS.length],
    lastModified: new Date(timestamp).toISOString(),
    collaborators: docHash % 3 === 0 ? [1, 2] : docHash % 2 === 0 ? [3] : [], // Some have collaborators
  };
};

// Flatten tree structure for display
export const flattenTree = (nodes, level = 0) => {
  let result = [];

  nodes.forEach(node => {
    result.push({ ...node, level });
    if (node.children && node.children.length > 0) {
      result = result.concat(flattenTree(node.children, level + 1));
    }
  });

  return result;
};

// Filter documents based on active filter
export const filterDocuments = (documents, filter) => {
  switch (filter) {
    case 'favorites':
      return documents.filter(doc => doc.starred);
    case 'shared':
      return documents.filter(doc => doc.collaborators && doc.collaborators.length > 0);
    case 'trash':
      return []; // Not implemented yet
    case 'all':
    default:
      return documents;
  }
};
