// Lightweight recent-page tracker — extracted to avoid pulling SpotlightSearch into main bundle
const RECENT_KEY = 'sp5_recent_pages';
const MAX_RECENT = 5;

interface RecentPage { path: string; title: string; ts: number }

export function getRecentPages(): RecentPage[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch { return []; }
}

export function trackRecentPage(path: string, title?: string) {
  const label = title ?? path;
  const pages = getRecentPages().filter(p => p.path !== path);
  pages.unshift({ path, title: label, ts: Date.now() });
  localStorage.setItem(RECENT_KEY, JSON.stringify(pages.slice(0, MAX_RECENT)));
}
