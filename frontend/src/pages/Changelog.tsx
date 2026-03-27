import { useState, useEffect } from 'react';
import { api } from '../api/client';

interface VersionSection {
  version: string;
  date: string;
  content: string;
}

/** Parse CHANGELOG.md into version sections */
function parseChangelog(md: string): VersionSection[] {
  const sections: VersionSection[] = [];
  // Split by ## [version] - date headers
  const lines = md.split('\n');
  let current: VersionSection | null = null;
  const contentLines: string[] = [];

  for (const line of lines) {
    const match = line.match(/^## \[([^\]]+)\]\s*-\s*(.+)$/);
    if (match) {
      if (current) {
        current.content = contentLines.join('\n').trim();
        sections.push(current);
        contentLines.length = 0;
      }
      current = { version: match[1], date: match[2].trim(), content: '' };
    } else if (current) {
      contentLines.push(line);
    }
  }
  if (current) {
    current.content = contentLines.join('\n').trim();
    sections.push(current);
  }
  return sections;
}

/** Simple markdown to HTML renderer for changelog content */
function renderMarkdown(md: string): string {
  return md
    // ### headers
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-4 mb-2 text-slate-700 dark:text-slate-200">$1</h3>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-slate-800 dark:text-slate-100">$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-sm font-mono">$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">$1</a>')
    // List items
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-slate-600 dark:text-slate-300 text-sm leading-relaxed">$1</li>')
    // Wrap consecutive <li> in <ul>
    .replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, '<ul class="space-y-1 mb-2">$1</ul>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr class="my-4 border-slate-200 dark:border-slate-600" />')
    // Paragraphs (non-empty lines that aren't already HTML)
    .replace(/^(?!<[a-z])(.+)$/gm, '<p class="text-sm text-slate-600 dark:text-slate-300 mb-1">$1</p>')
    // Clean up empty paragraphs
    .replace(/<p[^>]*>\s*<\/p>/g, '');
}

export default function Changelog() {
  const [sections, setSections] = useState<VersionSection[]>([]);
  const [rawContent, setRawContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.getReleaseNotes()
      .then(res => {
        const content = res.content || '';
        setRawContent(content);
        const parsed = parseChangelog(content);
        setSections(parsed);
        // Expand latest version by default
        if (parsed.length > 0) {
          setExpandedVersions(new Set([parsed[0].version]));
        }
      })
      .catch(() => setRawContent('Changelog konnte nicht geladen werden.'))
      .finally(() => setLoading(false));
  }, []);

  const toggleVersion = (version: string) => {
    setExpandedVersions(prev => {
      const next = new Set(prev);
      if (next.has(version)) {
        next.delete(version);
      } else {
        next.add(version);
      }
      return next;
    });
  };

  const expandAll = () => setExpandedVersions(new Set(sections.map(s => s.version)));
  const collapseAll = () => setExpandedVersions(new Set());

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600 dark:border-slate-300" />
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-4">📋 Changelog</h1>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <p className="text-slate-500 dark:text-slate-400">{rawContent || 'Kein Changelog verfügbar.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            📋 Was ist neu?
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Alle Änderungen und Verbesserungen im Überblick
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            Alle öffnen
          </button>
          <button
            onClick={collapseAll}
            className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
          >
            Alle schließen
          </button>
        </div>
      </div>

      {/* Version sections */}
      <div className="space-y-3">
        {sections.map((section) => {
          const isExpanded = expandedVersions.has(section.version);
          return (
            <div
              key={section.version}
              className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-all"
            >
              {/* Version header */}
              <button
                onClick={() => toggleVersion(section.version)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-slate-800 dark:text-white">
                    v{section.version}
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                    {section.date}
                  </span>
                </div>
                <svg
                  className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Content */}
              {isExpanded && (
                <div className="px-5 pb-5 border-t border-slate-100 dark:border-slate-700">
                  <div
                    className="pt-3 changelog-content"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(section.content) }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-8">
        {sections.length} Version{sections.length !== 1 ? 'en' : ''} dokumentiert
      </p>
    </div>
  );
}
