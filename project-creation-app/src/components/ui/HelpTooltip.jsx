import { useState, useRef, useEffect } from 'react';
import { QuestionMarkCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import ReactMarkdown from 'react-markdown';
import { useHelpText } from '../../hooks/useHelpText';

export default function HelpTooltip({ helpFile }) {
  const [isOpen, setIsOpen] = useState(false);
  const { content, isLoading } = useHelpText(helpFile);
  const tooltipRef = useRef(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    function handleEscape(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  if (!helpFile) return null;

  return (
    <div className="relative inline-block" ref={tooltipRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="text-gray-400 hover:text-blue-500 focus:outline-none focus:text-blue-500 transition-colors"
        aria-label="Help"
      >
        <QuestionMarkCircleIcon className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="absolute z-50 right-0 mt-2 w-96 max-h-[70vh] overflow-y-auto bg-white rounded-xl shadow-xl border border-gray-200 p-4">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>

          {isLoading ? (
            <div className="py-8 text-center text-gray-500">Loading...</div>
          ) : (
            <div className="prose prose-sm prose-blue max-w-none">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
