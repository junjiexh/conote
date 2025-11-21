import React from 'react';
import { FileText, Star, Users, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const NavigationLinks = ({ activeFilter, onFilterChange }) => {
  const navItems = [
    { name: 'All Notes', icon: FileText, id: 'all' },
    { name: 'Favorites', icon: Star, id: 'favorites' },
    { name: 'Shared', icon: Users, id: 'shared' },
    { name: 'Trash', icon: Trash2, id: 'trash' },
  ];

  return (
    <nav className="px-2 space-y-0.5 mb-4">
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => onFilterChange(item.id)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
            activeFilter === item.id
              ? "bg-primary/10 text-primary"
              : "text-slate-600 hover:bg-slate-100"
          )}
        >
          <item.icon
            size={16}
            className={cn(
              activeFilter === item.id ? "text-primary" : "text-slate-400"
            )}
          />
          {item.name}
        </button>
      ))}
    </nav>
  );
};

export default NavigationLinks;
