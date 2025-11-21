import React, { useState, useEffect } from 'react';
import { Search, Loader2, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { documentAPI } from '@/services/api';

export default function SearchDialog({ open, onOpenChange, onSelectDocument }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalResults, setTotalResults] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const pageSize = 20;

  useEffect(() => {
    if (!open) {
      // Reset state when dialog closes
      setQuery('');
      setResults([]);
      setCurrentPage(0);
      setTotalPages(0);
      setTotalResults(0);
      setHasMore(false);
      setSearchPerformed(false);
    }
  }, [open]);

  const handleSearch = async (page = 0) => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      const response = await documentAPI.search(query, page, pageSize);
      setResults(response.data.results);
      setTotalResults(response.data.totalResults);
      setCurrentPage(response.data.currentPage);
      setTotalPages(response.data.totalPages);
      setHasMore(response.data.hasMore);
      setSearchPerformed(true);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch(0);
    }
  };

  const handleNextPage = () => {
    if (hasMore) {
      handleSearch(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 0) {
      handleSearch(currentPage - 1);
    }
  };

  const handleResultClick = (document) => {
    onSelectDocument(document);
    onOpenChange(false);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Search Documents</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by title..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              className="pl-10"
              autoFocus
            />
          </div>
          <Button
            onClick={() => handleSearch(0)}
            disabled={loading || !query.trim()}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              'Search'
            )}
          </Button>
        </div>

        {/* Results section */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && searchPerformed && results.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No results found for "{query}"</p>
              <p className="text-sm mt-1">Try different keywords</p>
            </div>
          )}

          {!loading && searchPerformed && results.length > 0 && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground mb-2">
                Found {totalResults} result{totalResults !== 1 ? 's' : ''}
              </div>
              {results.map((doc) => (
                <Card
                  key={doc.id}
                  className="cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => handleResultClick(doc)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start gap-2">
                      <FileText className="h-5 w-5 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base font-semibold mb-1">
                          {doc.title}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          Updated: {formatDate(doc.updatedAt)}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}

          {!loading && !searchPerformed && (
            <div className="text-center py-8 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Enter a search query to find documents</p>
              <p className="text-sm mt-1">Search by title</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {searchPerformed && totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              Page {currentPage + 1} of {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevPage}
                disabled={currentPage === 0 || loading}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={!hasMore || loading}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
