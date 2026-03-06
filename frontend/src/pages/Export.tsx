import { useState, useEffect } from 'react';
import { api } from '../api/client';

const API = import.meta.env.VITE_API_URL ?? '';


interface Group {
  ID: number;
  NAME: string;
  SHORTNAME?: string;
}

const MONTH_NAMES = [
  '', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

function DownloadButton({
  url,
  label,
  icon,
  disabled,
}: {
  url: string;
  label: string;
  icon: string;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (disabled || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        let msg = `Fehler ${res.status}`;
        try { const j = await res.json(); msg = j.detail ?? msg; } catch {}
        throw new Error(msg);
      }
      const blob = await res.blob();
      // Extract filename from Content-Disposition header if available
      const cd = res.headers.get('content-disposition') ?? '';
      const match = cd.match(/filename="?([^";\n]+)"?/);
      const filename = match ? match[1] : label.replace(/\s+/g, '_');
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(objUrl);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || loading}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
          disabled || loading
            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
            : 'bg-slate-700 text-white hover:bg-slate-600 active:bg-slate-800'
        }`}
      >
        {loading ? (
          <span className="w-4 h-4 border-2 border-gray-400 border-t-white rounded-full animate-spin inline-block" />
        ) : (
          <span>{icon}</span>
        )}
        {loading ? 'Wird exportiert…' : label}
      </button>
      {error && (
        <p className="text-xs text-red-600">⚠️ {error}</p>
      )}
    </div>
  );
}

interface ExportCardProps {
  title: string;
  icon: string;
  children: React.ReactNode;
}
function ExportCard({ title, icon, children }: ExportCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <h2 className="text-base font-bold text-slate-700 mb-4 flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        {title}
      </h2>
      {children}
    </div>
  );
}

export default function Export() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  // Schedule export state
  const [scheduleYear, setScheduleYear] = useState(currentYear);
  const [scheduleMonth, setScheduleMonth] = useState(currentMonth);
  const [scheduleGroup, setScheduleGroup] = useState<string>('');
  const [scheduleFormat, setScheduleFormat] = useState<'csv' | 'html' | 'xlsx'>('xlsx');

  // Statistics export state
  const [statsYear, setStatsYear] = useState(currentYear);
  const [statsGroup, setStatsGroup] = useState<string>('');
  const [statsFormat, setStatsFormat] = useState<'csv' | 'html'>('csv');

  // Employees export state
  const [employeesFormat, setEmployeesFormat] = useState<'csv' | 'html' | 'xlsx'>('xlsx');

  // Absences export state
  const [absYear, setAbsYear] = useState(currentYear);
  const [absGroup, setAbsGroup] = useState<string>('');
  const [absFormat, setAbsFormat] = useState<'csv' | 'html'>('csv');

  useEffect(() => {
    setLoading(true);
    api.getGroups()
      .then(setGroups)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const scheduleMonthStr = `${scheduleYear}-${String(scheduleMonth).padStart(2, '0')}`;
  const scheduleUrl = (() => {
    const params = new URLSearchParams({
      month: scheduleMonthStr,
      format: scheduleFormat,
    });
    if (scheduleGroup) params.set('group_id', scheduleGroup);
    return `${API}/api/export/schedule?${params}`;
  })();

  const statsUrl = (() => {
    const params = new URLSearchParams({
      year: String(statsYear),
      format: statsFormat,
    });
    if (statsGroup) params.set('group_id', statsGroup);
    return `${API}/api/export/statistics?${params}`;
  })();

  const employeesUrl = `${API}/api/export/employees?format=${employeesFormat}`;

  const absUrl = (() => {
    const params = new URLSearchParams({ year: String(absYear) });
    if (absGroup) params.set('group_id', absGroup);
    params.set('format', absFormat);
    return `${API}/api/export/absences?${params}`;
  })();

  const years = Array.from({ length: 6 }, (_, i) => currentYear - 2 + i);

  const selectCls =
    'border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400';
  const labelCls = 'text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1';

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[200px]">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
          <span className="text-sm">Export wird geladen…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-4 lg:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Export</h1>
        <p className="text-sm text-slate-500 mt-1">
          Daten als CSV, Excel (XLSX) oder HTML exportieren und herunterladen.
        </p>
      </div>

      <div className="flex flex-col gap-5">
        {/* ── Dienstplan-Export ── */}
        <ExportCard title="Dienstplan-Export" icon="📅">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div className="flex flex-col">
              <span className={labelCls}>Jahr</span>
              <select
                className={selectCls}
                value={scheduleYear}
                onChange={(e) => setScheduleYear(Number(e.target.value))}
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <span className={labelCls}>Monat</span>
              <select
                className={selectCls}
                value={scheduleMonth}
                onChange={(e) => setScheduleMonth(Number(e.target.value))}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>{MONTH_NAMES[m]}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <span className={labelCls}>Gruppe</span>
              <select
                className={selectCls}
                value={scheduleGroup}
                onChange={(e) => setScheduleGroup(e.target.value)}
              >
                <option value="">Alle Gruppen</option>
                {groups.map((g) => (
                  <option key={g.ID} value={g.ID}>{g.NAME}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <span className={labelCls}>Format</span>
              <select
                className={selectCls}
                value={scheduleFormat}
                onChange={(e) => setScheduleFormat(e.target.value as 'csv' | 'html' | 'xlsx')}
              >
                <option value="xlsx">Excel (XLSX)</option>
                <option value="csv">CSV</option>
                <option value="html">HTML (druckfertig)</option>
              </select>
            </div>
          </div>
          <DownloadButton
            url={scheduleUrl}
            label={`Dienstplan ${MONTH_NAMES[scheduleMonth]} ${scheduleYear} herunterladen`}
            icon={scheduleFormat === 'xlsx' ? '📊' : scheduleFormat === 'html' ? '🖨️' : '⬇️'}
          />
        </ExportCard>

        {/* ── Statistiken-Export ── */}
        <ExportCard title="Statistiken-Export" icon="📈">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
            <div className="flex flex-col">
              <span className={labelCls}>Jahr</span>
              <select
                className={selectCls}
                value={statsYear}
                onChange={(e) => setStatsYear(Number(e.target.value))}
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <span className={labelCls}>Gruppe</span>
              <select
                className={selectCls}
                value={statsGroup}
                onChange={(e) => setStatsGroup(e.target.value)}
              >
                <option value="">Alle Gruppen</option>
                {groups.map((g) => (
                  <option key={g.ID} value={g.ID}>{g.NAME}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <span className={labelCls}>Format</span>
              <select
                className={selectCls}
                value={statsFormat}
                onChange={(e) => setStatsFormat(e.target.value as 'csv' | 'html')}
              >
                <option value="csv">CSV</option>
                <option value="html">HTML (druckfertig)</option>
              </select>
            </div>
          </div>
          <DownloadButton
            url={statsUrl}
            label={`Statistiken ${statsYear} herunterladen`}
            icon={statsFormat === 'html' ? '🖨️' : '⬇️'}
          />
        </ExportCard>

        {/* ── Mitarbeiter-Export ── */}
        <ExportCard title="Mitarbeiter-Export" icon="👥">
          <div className="grid grid-cols-2 sm:grid-cols-2 gap-4 mb-4">
            <div className="flex flex-col">
              <span className={labelCls}>Format</span>
              <select
                className={selectCls}
                value={employeesFormat}
                onChange={(e) => setEmployeesFormat(e.target.value as 'csv' | 'html' | 'xlsx')}
              >
                <option value="xlsx">Excel (XLSX)</option>
                <option value="csv">CSV</option>
                <option value="html">HTML (druckfertig)</option>
              </select>
            </div>
          </div>
          <DownloadButton
            url={employeesUrl}
            label={`Mitarbeiter als ${employeesFormat.toUpperCase()} herunterladen`}
            icon={employeesFormat === 'xlsx' ? '📊' : employeesFormat === 'html' ? '🖨️' : '⬇️'}
          />
        </ExportCard>

        {/* ── Abwesenheiten-Export ── */}
        <ExportCard title="Abwesenheiten-Export" icon="🏖️">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
            <div className="flex flex-col">
              <span className={labelCls}>Jahr</span>
              <select
                className={selectCls}
                value={absYear}
                onChange={(e) => setAbsYear(Number(e.target.value))}
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <span className={labelCls}>Gruppe</span>
              <select
                className={selectCls}
                value={absGroup}
                onChange={(e) => setAbsGroup(e.target.value)}
              >
                <option value="">Alle Gruppen</option>
                {groups.map((g) => (
                  <option key={g.ID} value={g.ID}>{g.NAME}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <span className={labelCls}>Format</span>
              <select
                className={selectCls}
                value={absFormat}
                onChange={(e) => setAbsFormat(e.target.value as 'csv' | 'html')}
              >
                <option value="csv">CSV</option>
                <option value="html">HTML (druckfertig)</option>
              </select>
            </div>
          </div>
          <DownloadButton
            url={absUrl}
            label={`Abwesenheiten ${absYear} als ${absFormat.toUpperCase()} herunterladen`}
            icon={absFormat === 'html' ? '🖨️' : '⬇️'}
          />
        </ExportCard>
      </div>
    </div>
  );
}
