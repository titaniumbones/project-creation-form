// Project search component for finding existing projects
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  ArrowPathIcon,
  DocumentDuplicateIcon,
} from '@heroicons/react/24/outline';
import { searchProjects, parseAirtableUrl, getProjectById, type ProjectSearchResult } from '../../services/airtable';
import { getConnectionStatus } from '../../services/oauth';

interface ProjectSearchProps {
  onSelectProject: (projectId: string) => void;
  disabled?: boolean;
}

export default function ProjectSearch({ onSelectProject, disabled = false }: ProjectSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<ProjectSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const connectionStatus = getConnectionStatus();
  const isConnected = connectionStatus.airtable;

  // Debounced search
  const performSearch = useCallback(async (term: string) => {
    if (!term.trim()) {
      setResults([]);
      return;
    }

    // Check if it's an Airtable URL
    if (term.includes('airtable.com')) {
      const { recordId } = parseAirtableUrl(term);
      if (recordId) {
        setIsSearching(true);
        setError(null);
        try {
          const project = await getProjectById(recordId);
          if (project) {
            setResults([{
              id: project.id,
              name: project.name,
              acronym: project.acronym,
              startDate: project.startDate,
              endDate: project.endDate,
              status: project.status,
              url: project.url,
            }]);
          } else {
            setError('Project not found');
            setResults([]);
          }
        } catch (err) {
          setError('Failed to fetch project');
          setResults([]);
        } finally {
          setIsSearching(false);
        }
        return;
      }
    }

    // Regular name search
    setIsSearching(true);
    setError(null);
    try {
      const searchResults = await searchProjects(term, 8);
      setResults(searchResults);
      if (searchResults.length === 0) {
        setError('No matching projects found');
      }
    } catch (err) {
      setError('Search failed');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Handle input change with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    setError(null);

    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (value.trim()) {
      searchTimeout.current = setTimeout(() => {
        performSearch(value);
      }, 300);
    } else {
      setResults([]);
    }
  };

  // Handle project selection
  const handleSelect = (project: ProjectSearchResult) => {
    onSelectProject(project.id);
    setIsOpen(false);
    setSearchTerm('');
    setResults([]);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, []);

  if (!isConnected) {
    return null;
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Collapsed state - just a button */}
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          disabled={disabled}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <DocumentDuplicateIcon className="w-4 h-4" />
          <span>Start from existing project</span>
        </button>
      ) : (
        /* Expanded state - search input and results */
        <div className="w-full max-w-md">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              {isSearching ? (
                <ArrowPathIcon className="w-5 h-5 text-gray-400 animate-spin" />
              ) : (
                <MagnifyingGlassIcon className="w-5 h-5 text-gray-400" />
              )}
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={handleInputChange}
              placeholder="Search by name or paste Airtable URL..."
              autoFocus
              className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setSearchTerm('');
                setResults([]);
                setError(null);
              }}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Results dropdown */}
          {(results.length > 0 || error) && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
              {error && (
                <div className="px-4 py-3 text-sm text-gray-500">
                  {error}
                </div>
              )}
              {results.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => handleSelect(project)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                >
                  <div className="font-medium text-gray-900">{project.name}</div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    {project.acronym && (
                      <span className="bg-gray-100 px-1.5 py-0.5 rounded">
                        {project.acronym}
                      </span>
                    )}
                    {project.status && (
                      <span className={`px-1.5 py-0.5 rounded ${
                        project.status === 'Active' ? 'bg-green-100 text-green-700' :
                        project.status === 'Complete' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {project.status}
                      </span>
                    )}
                    {project.startDate && (
                      <span>{project.startDate}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
