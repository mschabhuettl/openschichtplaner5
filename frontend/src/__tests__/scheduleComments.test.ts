/**
 * Unit tests for schedule comments logic (Q069)
 * Tests comment map building, filtering, and UI state helpers.
 */
import { describe, it, expect } from 'vitest';

// ── Types (mirrored from api/client.ts) ──────────────────────────────────────

interface ScheduleComment {
  id: number;
  date: string;
  group_id: number;
  text: string;
  author: string;
  created_at: string;
}

// ── Helpers (replicated from Schedule.tsx logic) ──────────────────────────────

function buildScheduleCommentsMap(comments: ScheduleComment[]): Map<string, ScheduleComment> {
  const m = new Map<string, ScheduleComment>();
  for (const c of comments) {
    m.set(`${c.date}-${c.group_id}`, c);
  }
  return m;
}

function getCommentForDay(
  map: Map<string, ScheduleComment>,
  dateStr: string,
  activeGroupId: number,
): ScheduleComment | undefined {
  return map.get(`${dateStr}-${activeGroupId}`) ?? map.get(`${dateStr}-0`);
}

function buildCommentDateRange(
  year: number,
  month: number,
): { from: string; to: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const daysInMonth = new Date(year, month, 0).getDate();
  return {
    from: `${year}-${pad(month)}-01`,
    to: `${year}-${pad(month)}-${pad(daysInMonth)}`,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('buildScheduleCommentsMap', () => {
  it('builds empty map from empty array', () => {
    const m = buildScheduleCommentsMap([]);
    expect(m.size).toBe(0);
  });

  it('creates correct key format "date-groupId"', () => {
    const comments: ScheduleComment[] = [
      { id: 1, date: '2025-03-15', group_id: 5, text: 'Test', author: 'admin', created_at: '' },
    ];
    const m = buildScheduleCommentsMap(comments);
    expect(m.has('2025-03-15-5')).toBe(true);
  });

  it('handles multiple comments for different days', () => {
    const comments: ScheduleComment[] = [
      { id: 1, date: '2025-03-01', group_id: 1, text: 'Day 1', author: '', created_at: '' },
      { id: 2, date: '2025-03-15', group_id: 1, text: 'Day 15', author: '', created_at: '' },
      { id: 3, date: '2025-03-28', group_id: 2, text: 'Day 28', author: '', created_at: '' },
    ];
    const m = buildScheduleCommentsMap(comments);
    expect(m.size).toBe(3);
  });

  it('later comment overwrites earlier for same key (one-per-day rule)', () => {
    const comments: ScheduleComment[] = [
      { id: 1, date: '2025-04-10', group_id: 0, text: 'Old', author: '', created_at: '' },
      { id: 2, date: '2025-04-10', group_id: 0, text: 'New', author: '', created_at: '' },
    ];
    const m = buildScheduleCommentsMap(comments);
    expect(m.get('2025-04-10-0')?.text).toBe('New');
  });
});

describe('getCommentForDay', () => {
  const comments: ScheduleComment[] = [
    { id: 1, date: '2025-05-01', group_id: 3, text: 'Group 3 note', author: '', created_at: '' },
    { id: 2, date: '2025-05-02', group_id: 0, text: 'All groups note', author: '', created_at: '' },
  ];
  const m = buildScheduleCommentsMap(comments);

  it('returns group-specific comment when available', () => {
    const result = getCommentForDay(m, '2025-05-01', 3);
    expect(result?.text).toBe('Group 3 note');
  });

  it('falls back to group_id=0 (all groups) comment', () => {
    const result = getCommentForDay(m, '2025-05-02', 5);
    expect(result?.text).toBe('All groups note');
  });

  it('returns undefined when no comment exists', () => {
    const result = getCommentForDay(m, '2025-05-10', 99);
    expect(result).toBeUndefined();
  });

  it('prefers group-specific over all-groups comment', () => {
    const mixed: ScheduleComment[] = [
      { id: 10, date: '2025-06-01', group_id: 0, text: 'All groups', author: '', created_at: '' },
      { id: 11, date: '2025-06-01', group_id: 7, text: 'Group 7 specific', author: '', created_at: '' },
    ];
    const mm = buildScheduleCommentsMap(mixed);
    const result = getCommentForDay(mm, '2025-06-01', 7);
    expect(result?.text).toBe('Group 7 specific');
  });
});

describe('buildCommentDateRange', () => {
  it('builds correct range for January', () => {
    const { from, to } = buildCommentDateRange(2025, 1);
    expect(from).toBe('2025-01-01');
    expect(to).toBe('2025-01-31');
  });

  it('builds correct range for February (non-leap year)', () => {
    const { from, to } = buildCommentDateRange(2025, 2);
    expect(from).toBe('2025-02-01');
    expect(to).toBe('2025-02-28');
  });

  it('builds correct range for February (leap year)', () => {
    const { from, to } = buildCommentDateRange(2024, 2);
    expect(from).toBe('2024-02-01');
    expect(to).toBe('2024-02-29');
  });

  it('builds correct range for December', () => {
    const { from, to } = buildCommentDateRange(2025, 12);
    expect(from).toBe('2025-12-01');
    expect(to).toBe('2025-12-31');
  });

  it('builds correct range for 30-day month', () => {
    const { from, to } = buildCommentDateRange(2025, 4); // April
    expect(from).toBe('2025-04-01');
    expect(to).toBe('2025-04-30');
  });
});

describe('comment text validation', () => {
  it('rejects empty text', () => {
    const isValid = (text: string) => text.trim().length > 0;
    expect(isValid('')).toBe(false);
    expect(isValid('  ')).toBe(false);
  });

  it('accepts non-empty text', () => {
    const isValid = (text: string) => text.trim().length > 0;
    expect(isValid('Hello world')).toBe(true);
    expect(isValid(' Note ')).toBe(true);
  });

  it('enforces max length of 500 chars', () => {
    const isValid = (text: string) => text.trim().length > 0 && text.length <= 500;
    expect(isValid('A'.repeat(500))).toBe(true);
    expect(isValid('A'.repeat(501))).toBe(false);
  });
});
