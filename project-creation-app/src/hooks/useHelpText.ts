// Hook for loading markdown help files
import { useState, useEffect } from 'react';

// Import all help files
const helpFiles = import.meta.glob<string>('../content/help/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

// Map filenames to content
const helpContent: Record<string, string> = {};
Object.entries(helpFiles).forEach(([path, content]) => {
  const filename = path.split('/').pop();
  if (filename) {
    helpContent[filename] = content;
  }
});

interface HelpTextResult {
  content: string;
  isLoading: boolean;
}

export function useHelpText(helpFile: string | undefined): HelpTextResult {
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!helpFile) {
      setContent('');
      setIsLoading(false);
      return;
    }

    const text = helpContent[helpFile];
    if (text) {
      setContent(text);
    } else {
      setContent(`Help file not found: ${helpFile}`);
    }
    setIsLoading(false);
  }, [helpFile]);

  return { content, isLoading };
}

export default useHelpText;
