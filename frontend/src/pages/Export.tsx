import { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL ?? '';

function getAuthHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem('sp5_session');
    if (!raw) return {};
    const session = JSON.parse(raw) as { token?: string; devMode?: boolean };
    const token = session.devMode ? '__dev_mode__' : (session.token ?? null);
    return token ? { 'X-Auth-Token': token } : {};
  } catch { return {}; }
}


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
  return (
    <a
      href={disabled ? undefined : url}
      target="_blank"
      rel="noopener noreferrer"
      download
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
        disabled
          ? 'bg-gray-200 text-gray-600 cursor-not-allowed pointer-events-none'
          : 'bg-slate-700 text-white hover:bg-slate-600 active:bg-slate-800'
      }`}
      onClick={(e) => {
        if (disabled) e.preventDefault();
        else window.open(url, '_blank');
      }}
    >
      <span>{icon}</span>
      {label}
    </a>
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
    fetch(`${API}/api/groups`, { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then(setGroups)
      .catch(() => {});
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
