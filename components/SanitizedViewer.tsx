import React from 'react';
import sanitizeHtml from 'sanitize-html';

interface SanitizedViewerProps {
  content: string;
  className?: string;
}

/**
 * Sanitized note content renderer.
 * Per SECURITY.md: Content is rendered as sanitized text/Markdown only — NEVER raw HTML.
 */
export const SanitizedViewer: React.FC<SanitizedViewerProps> = ({ content, className = '' }) => {
  // Convert newlines to breaks or render plain sanitized lines
  const cleanContent = sanitizeHtml(content, {
    allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'code', 'pre'],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
  });

  return (
    <div
      className={`prose dark:prose-invert max-w-none whitespace-pre-wrap font-sans text-slate-800 dark:text-slate-200 ${className}`}
      dangerouslySetInnerHTML={{ __html: cleanContent }}
    />
  );
};
