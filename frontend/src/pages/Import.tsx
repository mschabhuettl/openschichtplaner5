import { useState, useRef, useCallback, useMemo } from 'react';
import type { DragEvent, ChangeEvent } from 'react';

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

// ── CSV parsing ────────────────────────────────────────────────────────────

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const nonEmpty = lines.filter(l => l.trim());
  if (nonEmpty.length === 0) return { headers: [], rows: [] };

  const splitLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuote = !inQuote; }
      } else if (ch === ',' && !inQuote) {
        result.push(cur); cur = '';
      } else {
        cur += ch;
      }
    }
    result.push(cur);
    return result.map(v => v.trim());
  };

  const headers = splitLine(nonEmpty[0]);
  const rows = nonEmpty.slice(1).map(splitLine);
  return { headers, rows };
}

// ── Types ──────────────────────────────────────────────────────────────────

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

interface ImportType {
  key: string;
  label: string;
  icon: string;
  endpoint: string;
  description: string;
  columns: string;
  requiredColumns: string[];
  templateFilename: string;
  templateContent: string;
}

interface RowValidation {
  rowIndex: number;
  valid: boolean;
  errors: string[];
}

type ImportPhase = 'idle' | 'uploading' | 'processing' | 'done';

// ── Validation logic ───────────────────────────────────────────────────────

function validateRow(
  row: string[],
  headers: string[],
  rowIndex: number,
  importType: ImportType,
): RowValidation {
  const errors: string[] = [];
  const headerMap = new Map(headers.map((h, i) => [h.toUpperCase(), i]));

  for (const col of importType.requiredColumns) {
    const idx = headerMap.get(col.toUpperCase());
    if (idx === undefined) {
      errors.push(`Spalte "${col}" fehlt`);
    } else if (!row[idx] || row[idx].trim() === '') {
      errors.push(`"${col}" ist leer`);
    }
  }

  if (importType.key === 'employees') {
    const sexIdx = headerMap.get('SEX');
    if (sexIdx !== undefined && row[sexIdx] && !['0', '1', ''].includes(row[sexIdx])) {
      errors.push(`SEX muss 0 oder 1 sein (ist: "${row[sexIdx]}")`);
    }
    for (const numCol of ['HRSDAY', 'HRSWEEK', 'HRSMONTH']) {
      const idx = headerMap.get(numCol);
      if (idx !== undefined && row[idx] && isNaN(parseFloat(row[idx]))) {
        errors.push(`${numCol} muss eine Zahl sein`);
      }
    }
  }

  if (importType.key === 'shifts') {
    for (const colorCol of ['FARBE', 'TEXTFARBE']) {
      const idx = headerMap.get(colorCol);
      if (idx !== undefined && row[idx] && !/^#[0-9A-Fa-f]{6}$/.test(row[idx])) {
        errors.push(`${colorCol} muss Format #RRGGBB haben`);
      }
    }
    const durIdx = headerMap.get('DURATION0');
    if (durIdx !== undefined && row[durIdx] && isNaN(parseFloat(row[durIdx]))) {
      errors.push('DURATION0 muss eine Zahl sein');
    }
  }

  if (importType.key === 'holidays' || importType.key === 'absences' || importType.key === 'absences-csv') {
    for (const dh of ['DATE', 'DATUM']) {
      const idx = headerMap.get(dh);
      if (idx !== undefined && row[idx] && !/^\d{4}-\d{2}-\d{2}$/.test(row[idx])) {
        errors.push(`${dh} muss Format JJJJ-MM-TT haben (ist: "${row[idx]}")`);
      }
    }
  }

  if (importType.key === 'bookings-actual' || importType.key === 'bookings-nominal') {
    const datumIdx = headerMap.get('DATUM');
    if (datumIdx !== undefined && row[datumIdx] && !/^\d{4}-\d{2}-\d{2}$/.test(row[datumIdx])) {
      errors.push('Datum muss Format JJJJ-MM-TT haben');
    }
    const stundenIdx = headerMap.get('STUNDEN');
    if (stundenIdx !== undefined && row[stundenIdx] && isNaN(parseFloat(row[stundenIdx]))) {
      errors.push('Stunden muss eine Zahl sein');
    }
  }

  if (importType.key === 'entitlements') {
    const jahrIdx = headerMap.get('JAHR');
    if (jahrIdx !== undefined && row[jahrIdx] && !/^\d{4}$/.test(row[jahrIdx])) {
      errors.push('Jahr muss eine vierstellige Jahreszahl sein');
    }
    const tageIdx = headerMap.get('TAGE');
    if (tageIdx !== undefined && row[tageIdx] && isNaN(parseFloat(row[tageIdx]))) {
      errors.push('Tage muss eine Zahl sein');
    }
  }

  return { rowIndex, valid: errors.length === 0, errors };
}

// ── Import type definitions ────────────────────────────────────────────────

const IMPORT_TYPES: ImportType[] = [
  {
    key: 'employees',
    label: 'Mitarbeiter',
    icon: '👥',
    endpoint: '/api/import/employees',
    description: 'Importiert Mitarbeiterstammdaten. Pflichtfeld: NAME (Nachname).',
    columns: 'NAME, FIRSTNAME, SHORTNAME, NUMBER, SEX (0=m/1=w), HRSDAY, HRSWEEK, HRSMONTH, WORKDAYS',
    requiredColumns: ['NAME'],
    templateFilename: 'mitarbeiter_vorlage.csv',
    templateContent: `NAME,FIRSTNAME,SHORTNAME,NUMBER,SEX,HRSDAY,HRSWEEK,HRSMONTH,WORKDAYS
Mustermann,Max,MM,001,0,8,40,173.33,1 1 1 1 1 0 0 0
Musterfrau,Maria,MF,002,1,6,30,130,1 1 1 0 1 0 0 0
`,
  },
  {
    key: 'shifts',
    label: 'Schichtarten',
    icon: '🕐',
    endpoint: '/api/import/shifts',
    description: 'Importiert Schichtarten. Pflichtfeld: NAME.',
    columns: 'NAME, KURZZEICHEN (Kürzel), FARBE (#RRGGBB), TEXTFARBE (#RRGGBB), DURATION0 (Stunden)',
    requiredColumns: ['NAME'],
    templateFilename: 'schichtarten_vorlage.csv',
    templateContent: `NAME,KURZZEICHEN,FARBE,TEXTFARBE,DURATION0
Frühschicht,F,#4A90D9,#FFFFFF,8
Spätschicht,S,#E8A12A,#000000,8
Nachtschicht,N,#2C3E50,#FFFFFF,8
Tagesdienst,T,#27AE60,#FFFFFF,8
`,
  },
  {
    key: 'absences',
    label: 'Abwesenheiten (per ID)',
    icon: '📋',
    endpoint: '/api/import/absences',
    description: 'Importiert Abwesenheiten über interne IDs. Für komfortablen Import per Personalnummer/Kürzel → "Dienstplan-Abwesenheiten" wählen.',
    columns: 'EMPLOYEE_ID (Mitarbeiter-ID), DATE (JJJJ-MM-TT), LEAVE_TYPE_ID (Abwesenheitsart-ID)',
    requiredColumns: ['EMPLOYEE_ID', 'DATE', 'LEAVE_TYPE_ID'],
    templateFilename: 'abwesenheiten_vorlage.csv',
    templateContent: `EMPLOYEE_ID,DATE,LEAVE_TYPE_ID
1,2025-01-15,2
1,2025-01-16,2
2,2025-02-10,1
`,
  },
  {
    key: 'holidays',
    label: 'Feiertage',
    icon: '🎉',
    endpoint: '/api/import/holidays',
    description: 'Importiert Feiertage. Pflichtfelder: DATE und NAME. INTERVAL: 0=einmalig, 1=jährlich.',
    columns: 'DATE (JJJJ-MM-TT), NAME, INTERVAL (0=einmalig/1=jährlich), REGION (nur Info)',
    requiredColumns: ['DATE', 'NAME'],
    templateFilename: 'feiertage_vorlage.csv',
    templateContent: `DATE,NAME,INTERVAL,REGION
2025-01-01,Neujahr,1,AT
2025-12-25,1. Weihnachtstag,1,AT
2025-12-26,2. Weihnachtstag,1,AT
2025-04-18,Karfreitag,1,AT
`,
  },
  {
    key: 'bookings-actual',
    label: 'Zeitkonto: Ist-Stunden',
    icon: '⏱️',
    endpoint: '/api/import/bookings-actual',
    description: 'Importiert Ist-Stunden-Buchungen ins Zeitkonto (TYPE=0). Lookup über Personalnummer.',
    columns: 'Personalnummer, Datum (JJJJ-MM-TT), Stunden (Dezimal), Notiz (optional)',
    requiredColumns: ['PERSONALNUMMER', 'DATUM', 'STUNDEN'],
    templateFilename: 'zeitkonto_ist_vorlage.csv',
    templateContent: `Personalnummer,Datum,Stunden,Notiz
001,2025-01-06,8.5,Überstunden
001,2025-01-13,7.0,Korrekturbuchung
002,2025-01-06,8.0,
`,
  },
  {
    key: 'bookings-nominal',
    label: 'Zeitkonto: Soll-Stunden',
    icon: '📊',
    endpoint: '/api/import/bookings-nominal',
    description: 'Importiert Soll-Stunden-Buchungen ins Zeitkonto (TYPE=1). Lookup über Personalnummer.',
    columns: 'Personalnummer, Datum (JJJJ-MM-TT), Stunden (Dezimal), Notiz (optional)',
    requiredColumns: ['PERSONALNUMMER', 'DATUM', 'STUNDEN'],
    templateFilename: 'zeitkonto_soll_vorlage.csv',
    templateContent: `Personalnummer,Datum,Stunden,Notiz
001,2025-01-06,8.0,Sollzeit
001,2025-01-13,8.0,Sollzeit
002,2025-01-06,6.0,Teilzeit
`,
  },
  {
    key: 'entitlements',
    label: 'Urlaubsansprüche',
    icon: '🏖️',
    endpoint: '/api/import/entitlements',
    description: 'Importiert Urlaubsansprüche für Mitarbeiter. Lookup über Personalnummer und Abwesenheitsart-Kürzel.',
    columns: 'Personalnummer, Jahr, Abwesenheitsart-Kürzel (z.B. "U"), Tage',
    requiredColumns: ['PERSONALNUMMER', 'JAHR'],
    templateFilename: 'urlaubsansprueche_vorlage.csv',
    templateContent: `Personalnummer,Jahr,Abwesenheitsart-Kürzel,Tage
001,2025,U,25
002,2025,U,20
003,2025,U,30
`,
  },
  {
    key: 'absences-csv',
    label: 'Dienstplan-Abwesenheiten',
    icon: '📅',
    endpoint: '/api/import/absences-csv',
    description: 'Importiert Dienstplan-Abwesenheiten per Personalnummer und Abwesenheitsart-Kürzel (kein Wissen der IDs nötig).',
    columns: 'Personalnummer, Datum (JJJJ-MM-TT), Abwesenheitsart-Kürzel (z.B. "U", "K")',
    requiredColumns: ['PERSONALNUMMER', 'DATUM'],
    templateFilename: 'dienstplan_abwesenheiten_vorlage.csv',
    templateContent: `Personalnummer,Datum,Abwesenheitsart-Kürzel
001,2025-01-15,U
001,2025-01-16,U
002,2025-02-10,K
`,
  },
  {
    key: 'groups',
    label: 'Neue Gruppen',
    icon: '🏢',
    endpoint: '/api/import/groups',
    description: 'Importiert neue Gruppen. Pflichtfeld: Name. Optional: Kürzel und übergeordnete Gruppe (Name).',
    columns: 'Name, Kürzel, Übergeordnete-Gruppe-Name (Name der übergeordneten Gruppe, optional)',
    requiredColumns: ['NAME'],
    templateFilename: 'gruppen_vorlage.csv',
    templateContent: `Name,Kürzel,Übergeordnete-Gruppe-Name
Abteilung A,AA,
Abteilung B,BB,
Team A1,A1,Abteilung A
Team A2,A2,Abteilung A
`,
  },
];

// ── Template download ──────────────────────────────────────────────────────

function downloadTemplate(filename: string, content: string) {
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Spinner ────────────────────────────────────────────────────────────────

function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ── Drop zone ──────────────────────────────────────────────────────────────

interface DropZoneProps { onFile: (file: File) => void; disabled?: boolean }

function DropZone({ onFile, disabled }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    setDragging(false); dragCounter.current = 0;
    if (disabled) return;
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  }, [onFile, disabled]);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onFile(f);
    if (inputRef.current) inputRef.current.value = '';
  }, [onFile]);

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${dragging
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 scale-[1.01] shadow-lg'
          : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
    >
      {dragging && (
        <div className="absolute inset-0 flex items-center justify-center bg-blue-50/80 dark:bg-blue-900/40 rounded-xl z-10">
          <div className="text-blue-600 dark:text-blue-400 font-semibold text-lg">📥 Datei hier ablegen</div>
        </div>
      )}
      <div className="text-5xl mb-3">📁</div>
      <div className="text-sm text-gray-700 dark:text-gray-300 font-medium">
        CSV-Datei hierher ziehen oder <span className="text-blue-600 dark:text-blue-400 underline">auswählen</span>
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">Unterstützt: .csv (UTF-8 oder Latin-1)</div>
      <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleChange} disabled={disabled} />
    </div>
  );
}

// ── Validation Preview Table ───────────────────────────────────────────────

function ValidationPreviewTable({
  headers, rows, validations, showAllRows, onToggleShowAll,
}: {
  headers: string[]; rows: string[][]; validations: RowValidation[];
  showAllRows: boolean; onToggleShowAll: () => void;
}) {
  if (headers.length === 0) return null;

  const validCount = validations.filter(v => v.valid).length;
  const errorCount = validations.filter(v => !v.valid).length;
  const displayRows = showAllRows ? rows : rows.slice(0, 10);
  const displayValidations = showAllRows ? validations : validations.slice(0, 10);

  return (
    <div className="mt-4">
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">Validierungs-Vorschau</div>
        <div className="flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">
            ✓ {validCount} gültig
          </span>
          {errorCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-medium">
              ✗ {errorCount} fehlerhaft
            </span>
          )}
          <span className="text-gray-500 dark:text-gray-400">
            ({rows.length} Zeile{rows.length !== 1 ? 'n' : ''} gesamt)
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="text-xs w-full">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-700">
              <th className="px-2 py-2 text-left font-semibold text-slate-600 dark:text-slate-300 w-8">#</th>
              <th className="px-2 py-2 text-center font-semibold text-slate-600 dark:text-slate-300 w-8">Status</th>
              {headers.map((h, i) => (
                <th key={i} className="px-3 py-2 text-left font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, ri) => {
              const v = displayValidations[ri];
              const isValid = v?.valid ?? true;
              return (
                <tr key={ri}
                  className={`border-t border-gray-100 dark:border-gray-700 transition-colors ${
                    isValid ? (ri % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-750')
                    : 'bg-red-50 dark:bg-red-900/20'}`}
                  title={!isValid ? v.errors.join('; ') : undefined}
                >
                  <td className="px-2 py-1.5 text-gray-400 dark:text-gray-500 font-mono">{ri + 1}</td>
                  <td className="px-2 py-1.5 text-center">
                    {isValid
                      ? <span className="text-green-500">✓</span>
                      : <span className="text-red-500 cursor-help" title={v.errors.join('\n')}>✗</span>}
                  </td>
                  {headers.map((_, ci) => (
                    <td key={ci} className={`px-3 py-1.5 whitespace-nowrap max-w-[180px] truncate ${
                      isValid ? 'text-gray-700 dark:text-gray-300' : 'text-red-700 dark:text-red-400'}`}>
                      {row[ci] ?? <span className="text-gray-300 italic">—</span>}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length > 10 && (
        <button onClick={onToggleShowAll} className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline">
          {showAllRows ? '↑ Weniger anzeigen' : `↓ Alle ${rows.length} Zeilen anzeigen`}
        </button>
      )}

      {errorCount > 0 && (
        <div className="mt-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <div className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1.5">
            ⚠ {errorCount} Zeile{errorCount !== 1 ? 'n' : ''} mit Fehlern:
          </div>
          <ul className="space-y-0.5 max-h-32 overflow-y-auto">
            {validations.filter(v => !v.valid).slice(0, 20).map((v, i) => (
              <li key={i} className="text-xs text-red-600 dark:text-red-400">
                <span className="font-mono font-medium">Zeile {v.rowIndex + 1}:</span> {v.errors.join(', ')}
              </li>
            ))}
            {validations.filter(v => !v.valid).length > 20 && (
              <li className="text-xs text-red-500 italic">… und {validations.filter(v => !v.valid).length - 20} weitere Fehler</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Progress indicator ─────────────────────────────────────────────────────

function ProgressIndicator({ phase, progress }: { phase: ImportPhase; progress: number }) {
  if (phase === 'idle' || phase === 'done') return null;
  const labels: Record<string, string> = { uploading: 'Datei wird hochgeladen…', processing: 'Daten werden verarbeitet…' };
  return (
    <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
      <div className="flex items-center gap-3 mb-2">
        <Spinner className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">{labels[phase] || 'Verarbeitung…'}</span>
      </div>
      <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2 overflow-hidden">
        <div className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${Math.max(progress, 5)}%` }} />
      </div>
      <div className="text-xs text-blue-600 dark:text-blue-400 mt-1.5 text-right">{Math.round(progress)}%</div>
    </div>
  );
}

// ── Result banner ──────────────────────────────────────────────────────────

function ResultBanner({ result, onReset }: { result: ImportResult; onReset: () => void }) {
  const hasErrors = result.errors.length > 0;
  const allFailed = result.imported === 0 && result.errors.length > 0;

  return (
    <div className={`mt-4 rounded-lg p-4 text-sm ${
      allFailed ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
      : hasErrors ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
      : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'}`}>

      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 font-semibold">
          <span className="text-xl">{allFailed ? '❌' : result.imported > 0 ? '✅' : '⚠️'}</span>
          <div>
            <div className={allFailed ? 'text-red-800 dark:text-red-300' : hasErrors ? 'text-yellow-800 dark:text-yellow-300' : 'text-green-800 dark:text-green-300'}>
              {allFailed ? 'Import fehlgeschlagen'
                : `${result.imported} Datensatz${result.imported !== 1 ? 'e' : ''} erfolgreich importiert`}
            </div>
            {result.skipped > 0 && (
              <div className="text-xs font-normal text-gray-500 dark:text-gray-400 mt-0.5">{result.skipped} übersprungen</div>
            )}
          </div>
        </div>
        <button onClick={onReset}
          className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          🔄 Neuer Import
        </button>
      </div>

      {(result.imported > 0 || result.skipped > 0) && (
        <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 mb-3">
          {result.imported > 0 && <div className="bg-green-500 rounded-full"
            style={{ width: `${(result.imported / (result.imported + result.skipped + result.errors.length)) * 100}%` }} />}
          {result.skipped > 0 && <div className="bg-yellow-400"
            style={{ width: `${(result.skipped / (result.imported + result.skipped + result.errors.length)) * 100}%` }} />}
          {result.errors.length > 0 && <div className="bg-red-400 rounded-full"
            style={{ width: `${(result.errors.length / (result.imported + result.skipped + result.errors.length)) * 100}%` }} />}
        </div>
      )}

      {hasErrors && (
        <div className="mt-2">
          <div className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">Fehler ({result.errors.length}):</div>
          <ul className="space-y-1 max-h-48 overflow-y-auto">
            {result.errors.map((e, i) => (
              <li key={i} className="text-xs text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 rounded px-2 py-1">⚠ {e}</li>
            ))}
          </ul>
        </div>
      )}

      {!hasErrors && result.imported > 0 && (
        <div className="text-green-700 dark:text-green-400 text-xs mt-1">✨ Alle Zeilen erfolgreich importiert — keine Fehler.</div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function Import() {
  const [selectedKey, setSelectedKey] = useState<string>(IMPORT_TYPES[0].key);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAllRows, setShowAllRows] = useState(false);

  const selected = IMPORT_TYPES.find(t => t.key === selectedKey) ?? IMPORT_TYPES[0];

  const validations = useMemo<RowValidation[]>(() => {
    if (!preview || preview.headers.length === 0) return [];
    return preview.rows.map((row, idx) => validateRow(row, preview.headers, idx, selected));
  }, [preview, selected]);

  const validCount = validations.filter(v => v.valid).length;

  const handleTypeChange = useCallback((key: string) => {
    setSelectedKey(key); setFile(null); setPreview(null); setResult(null);
    setError(null); setPhase('idle'); setProgress(0); setShowAllRows(false);
  }, []);

  const handleFile = useCallback((f: File) => {
    setFile(f); setResult(null); setError(null); setPhase('idle');
    setProgress(0); setShowAllRows(false);
    const reader = new FileReader();
    reader.onload = (e) => { setPreview(parseCSV(e.target?.result as string)); };
    reader.readAsText(f, 'utf-8');
  }, []);

  const handleReset = useCallback(() => {
    setFile(null); setPreview(null); setResult(null); setError(null);
    setPhase('idle'); setProgress(0); setShowAllRows(false);
  }, []);

  const handleImport = useCallback(async () => {
    if (!file) return;
    setPhase('uploading'); setProgress(0); setResult(null); setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const progressInterval = setInterval(() => {
        setProgress(prev => { if (prev >= 40) { clearInterval(progressInterval); return 40; } return prev + 8; });
      }, 150);

      const res = await fetch(`${API}${selected.endpoint}`, { method: 'POST', body: formData, headers: getAuthHeaders() });

      clearInterval(progressInterval);
      setPhase('processing'); setProgress(60);

      const processInterval = setInterval(() => {
        setProgress(prev => { if (prev >= 90) { clearInterval(processInterval); return 90; } return prev + 10; });
      }, 200);

      if (!res.ok) {
        clearInterval(processInterval);
        const detail = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(detail.detail || res.statusText);
      }

      const data: ImportResult = await res.json();
      clearInterval(processInterval);
      setProgress(100);
      await new Promise(resolve => setTimeout(resolve, 300));
      setResult(data); setPhase('done');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
      setPhase('idle'); setProgress(0);
    }
  }, [file, selected.endpoint]);

  const isImporting = phase === 'uploading' || phase === 'processing';

  return (
    <div className="p-2 sm:p-4 lg:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <span>⬆️</span> Daten-Import
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Importiere Stammdaten und Planungsdaten aus CSV-Dateien.
          Wähle zuerst den Import-Typ, lade dann die Vorlage herunter, fülle sie aus und lade sie hoch.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 mb-5">
        <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Import-Typ wählen</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {IMPORT_TYPES.map(t => (
            <button key={t.key} onClick={() => handleTypeChange(t.key)} disabled={isImporting}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all text-left ${
                t.key === selectedKey ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
              } ${isImporting ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <span className="text-base">{t.icon}</span><span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <span className="text-2xl">{selected.icon}</span>{selected.label}
          </h2>
          <button onClick={() => downloadTemplate(selected.templateFilename, selected.templateContent)}
            className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-blue-300 transition-colors font-medium">
            ⬇️ CSV-Vorlage
          </button>
        </div>

        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 mb-4 text-sm text-slate-600 dark:text-slate-300">
          <div className="font-medium mb-1">{selected.description}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold">Spalten:</span> {selected.columns}
          </div>
        </div>

        {!result && <DropZone onFile={handleFile} disabled={isImporting} />}

        {file && !result && (
          <div className="mt-3 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2">
            <span className="text-lg">📄</span>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-700 dark:text-gray-300 truncate">{file.name}</div>
              <div className="text-gray-500 dark:text-gray-400">
                {(file.size / 1024).toFixed(1)} KB
                {preview && ` • ${preview.rows.length} Zeile${preview.rows.length !== 1 ? 'n' : ''}`}
              </div>
            </div>
            {!isImporting && (
              <button onClick={handleReset}
                className="text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-400 text-xs font-medium px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                ✕ Entfernen
              </button>
            )}
          </div>
        )}

        {preview && preview.headers.length > 0 && !result && (
          <ValidationPreviewTable headers={preview.headers} rows={preview.rows}
            validations={validations} showAllRows={showAllRows}
            onToggleShowAll={() => setShowAllRows(prev => !prev)} />
        )}

        {preview && preview.headers.length > 0 && !result && !isImporting && (
          <div className="mt-4 flex items-center gap-3">
            <button onClick={handleImport} disabled={!file || validCount === 0}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                !file || validCount === 0 ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-sm hover:shadow'}`}>
              ⬆️ Jetzt importieren
            </button>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {validCount} von {preview.rows.length} Zeile{preview.rows.length !== 1 ? 'n' : ''} gültig
            </span>
          </div>
        )}

        <ProgressIndicator phase={phase} progress={progress} />

        {error && (
          <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm">
            <div className="flex items-start gap-2">
              <span className="text-lg">❌</span>
              <div>
                <div className="font-semibold text-red-800 dark:text-red-300">Import fehlgeschlagen</div>
                <div className="text-red-700 dark:text-red-400 mt-0.5">{error}</div>
              </div>
            </div>
            <button onClick={() => setError(null)} className="mt-2 text-xs text-red-600 dark:text-red-400 hover:underline">Schließen</button>
          </div>
        )}

        {result && <ResultBanner result={result} onReset={handleReset} />}
      </div>
    </div>
  );
}
