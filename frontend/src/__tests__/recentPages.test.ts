/**
 * Tests for the recent-pages tracker util (localStorage-backed).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { getRecentPages, trackRecentPage } from '../utils/recentPages';

const KEY = 'sp5_recent_pages';

describe('recentPages', () => {
  beforeEach(() => localStorage.clear());

  it('returns [] when nothing stored', () => {
    expect(getRecentPages()).toEqual([]);
  });

  it('returns [] on corrupt JSON', () => {
    localStorage.setItem(KEY, '{not valid json');
    expect(getRecentPages()).toEqual([]);
  });

  it('tracks a page (newest first) and defaults title to path', () => {
    trackRecentPage('/employees');
    const pages = getRecentPages();
    expect(pages).toHaveLength(1);
    expect(pages[0].path).toBe('/employees');
    expect(pages[0].title).toBe('/employees'); // title defaults to path
    expect(typeof pages[0].ts).toBe('number');
  });

  it('uses the provided title', () => {
    trackRecentPage('/schedule', 'Dienstplan');
    expect(getRecentPages()[0].title).toBe('Dienstplan');
  });

  it('dedupes a repeated path and moves it to the front', () => {
    trackRecentPage('/a', 'A');
    trackRecentPage('/b', 'B');
    trackRecentPage('/a', 'A again');
    const pages = getRecentPages();
    expect(pages.map(p => p.path)).toEqual(['/a', '/b']); // /a moved to front, no dup
    expect(pages[0].title).toBe('A again');
  });

  it('caps the list at 5 entries, keeping the newest', () => {
    for (let i = 1; i <= 7; i++) trackRecentPage(`/p${i}`, `P${i}`);
    const pages = getRecentPages();
    expect(pages).toHaveLength(5);
    expect(pages.map(p => p.path)).toEqual(['/p7', '/p6', '/p5', '/p4', '/p3']);
  });
});
