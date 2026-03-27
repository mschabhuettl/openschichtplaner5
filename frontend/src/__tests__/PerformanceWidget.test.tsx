/**
 * Unit tests for PerformanceWidget component.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import PerformanceWidget from '../components/PerformanceWidget';

// ── Mock health response ──────────────────────────────────────────────────────

const MOCK_HEALTH = {
  status: 'healthy',
  checks: { db: 'ok', disk: 'ok', memory: 'ok' },
  version: '1.5.0',
  uptime: '2h 15m',
  uptime_seconds: 8100,
  started_at: '2026-03-27T02:00:00+00:00',
  db: { status: 'ok', dbf_ok: 5, dbf_missing: [] as string[], last_modified: '2026-03-27T03:00:00+00:00' },
  disk: { free_mb: 5000, total_mb: 20000, used_percent: 75.0, db_dir_size_mb: 12.5 },
  memory: { rss_mb: 128.5, system_used_percent: 45.2, system_available_mb: 8000 },
  sessions: { active: 3 },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockFetchSuccess(data = MOCK_HEALTH) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

function mockFetchError(status = 500) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({}),
  });
}

function mockFetchNetworkError() {
  global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
}

function mockFetchHang() {
  global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PerformanceWidget', () => {
  it('renders loading skeleton initially', () => {
    mockFetchHang();
    const { container } = render(<PerformanceWidget />);
    expect(container.querySelector('[data-testid="performance-widget-skeleton"]')).toBeTruthy();
  });

  it('renders health data after successful fetch', async () => {
    mockFetchSuccess();
    const { container } = render(<PerformanceWidget />);

    await waitFor(() => {
      expect(container.querySelector('[data-testid="performance-widget"]')).toBeTruthy();
    });

    // Check header
    expect(screen.getByText('System-Performance')).toBeTruthy();
    expect(screen.getByText('healthy')).toBeTruthy();

    // Check response time section exists
    expect(container.querySelector('[data-testid="metric-response-time"]')).toBeTruthy();
    // Response time value contains "ms"
    const rtValue = container.querySelector('[data-testid="response-time-value"]');
    expect(rtValue?.textContent).toMatch(/\d+ ms/);

    // Check DB status
    expect(container.querySelector('[data-testid="metric-db-status"]')).toBeTruthy();

    // Check uptime
    expect(container.querySelector('[data-testid="metric-uptime"]')).toBeTruthy();
    expect(screen.getByText('2h 15m')).toBeTruthy();

    // Check memory
    expect(container.querySelector('[data-testid="metric-memory"]')).toBeTruthy();
    expect(screen.getByText('129 MB')).toBeTruthy();

    // Check disk
    expect(container.querySelector('[data-testid="metric-disk"]')).toBeTruthy();

    // Check sessions
    expect(container.querySelector('[data-testid="metric-sessions"]')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('shows error state on network failure', async () => {
    mockFetchNetworkError();
    const { container } = render(<PerformanceWidget />);

    await waitFor(() => {
      expect(container.querySelector('[data-testid="performance-widget-error"]')).toBeTruthy();
    });

    expect(screen.getByText(/Network error/)).toBeTruthy();
    expect(screen.getByText('Erneut versuchen')).toBeTruthy();
  });

  it('shows error state on HTTP error', async () => {
    mockFetchError(500);
    const { container } = render(<PerformanceWidget />);

    await waitFor(() => {
      expect(container.querySelector('[data-testid="performance-widget-error"]')).toBeTruthy();
    });

    expect(screen.getByText(/HTTP 500/)).toBeTruthy();
  });

  it('retry button works after error', async () => {
    mockFetchError(500);
    const { container } = render(<PerformanceWidget />);

    await waitFor(() => {
      expect(container.querySelector('[data-testid="performance-widget-error"]')).toBeTruthy();
    });

    // Now mock success and click retry
    mockFetchSuccess();
    fireEvent.click(screen.getByText('Erneut versuchen'));

    await waitFor(() => {
      expect(container.querySelector('[data-testid="performance-widget"]')).toBeTruthy();
    });
  });

  it('manual refresh button triggers fetch', async () => {
    mockFetchSuccess();
    const { container } = render(<PerformanceWidget />);

    await waitFor(() => {
      expect(container.querySelector('[data-testid="performance-widget"]')).toBeTruthy();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);

    // Click refresh
    fireEvent.click(screen.getByTestId('performance-refresh-btn'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  it('calls /api/health endpoint', async () => {
    mockFetchSuccess();
    render(<PerformanceWidget />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/health');
    });
  });

  it('shows degraded status correctly', async () => {
    mockFetchSuccess({
      ...MOCK_HEALTH,
      status: 'degraded',
      checks: { ...MOCK_HEALTH.checks, memory: 'warning' },
    });
    render(<PerformanceWidget />);

    await waitFor(() => {
      expect(screen.getByText('degraded')).toBeTruthy();
    });
  });

  it('shows unhealthy status with missing DBFs', async () => {
    mockFetchSuccess({
      ...MOCK_HEALTH,
      status: 'unhealthy',
      checks: { ...MOCK_HEALTH.checks, db: 'error' },
      db: { ...MOCK_HEALTH.db, dbf_missing: ['5SHIFT.DBF'], dbf_ok: 4 },
    });
    const { container } = render(<PerformanceWidget />);

    await waitFor(() => {
      expect(screen.getByText('unhealthy')).toBeTruthy();
    });

    // DB shows error indicator
    const dbMetric = container.querySelector('[data-testid="metric-db-status"]');
    expect(dbMetric?.textContent).toContain('4');
    expect(dbMetric?.textContent).toContain('1 fehlt');
  });

  it('displays auto-refresh indicator', async () => {
    mockFetchSuccess();
    render(<PerformanceWidget />);

    await waitFor(() => {
      expect(screen.getByText('Auto-Refresh 30s')).toBeTruthy();
    });
  });

  it('formats large memory values as GB', async () => {
    mockFetchSuccess({
      ...MOCK_HEALTH,
      memory: { ...MOCK_HEALTH.memory, rss_mb: 2048 },
    });
    render(<PerformanceWidget />);

    await waitFor(() => {
      expect(screen.getByText('2.0 GB')).toBeTruthy();
    });
  });

  it('shows version in uptime section', async () => {
    mockFetchSuccess();
    const { container } = render(<PerformanceWidget />);

    await waitFor(() => {
      const uptimeMetric = container.querySelector('[data-testid="metric-uptime"]');
      expect(uptimeMetric?.textContent).toContain('1.5.0');
    });
  });

  it('shows system memory percentage', async () => {
    mockFetchSuccess();
    const { container } = render(<PerformanceWidget />);

    await waitFor(() => {
      const memMetric = container.querySelector('[data-testid="metric-memory"]');
      expect(memMetric?.textContent).toContain('45.2');
      expect(memMetric?.textContent).toContain('belegt');
    });
  });
});
