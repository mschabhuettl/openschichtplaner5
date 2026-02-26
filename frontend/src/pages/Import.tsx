import { useState, useRef } from 'react';
import type { DragEvent, ChangeEvent } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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
  templateFilename: string;
  templateContent: string;
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
  const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Drop zone ──────────────────────────────────────────────────────────────

interface DropZoneProps { onFile: (file: File) => void }

function DropZone({ onFile }: DropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onFile(f);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
        dragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
      }`}
    >
      <div className="text-4xl mb-2">📁</div>
      <div className="text-sm text-gray-600 font-medium">
        CSV-Datei hierher ziehen oder <span className="text-blue-600">auswählen</span>
      </div>
      <div className="text-xs text-gray-400 mt-1">Nur .csv Dateien (UTF-8 oder latin-1)</div>
      <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleChange} />
    </div>
  );
}

// ── Preview table ──────────────────────────────────────────────────────────

function PreviewTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  if (headers.length === 0) return null;
  const preview = rows.slice(0, 5);
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200">
      <table className="text-xs w-full">
        <thead>
          <tr className="bg-slate-100">
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left font-semibold text-slate-700 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.map((row, ri) => (
            <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              {headers.map((_, ci) => (
                <td key={ci} className="px-3 py-1.5 text-gray-700 whitespace-nowrap max-w-[180px] truncate">
                  {row[ci] ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 5 && (
        <div className="px-3 py-1.5 text-xs text-gray-400 border-t border-gray-200 bg-gray-50">
          … und {rows.length - 5} weitere Zeile{rows.length - 5 !== 1 ? 'n' : ''}
        </div>
      )}
    </div>
  );
}

// ── Result banner ──────────────────────────────────────────────────────────

function ResultBanner({ result }: { result: ImportResult }) {
  const hasErrors = result.errors.length > 0;
  return (
    <div className={`mt-4 rounded-lg p-4 text-sm ${hasErrors ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
      <div className="flex items-center gap-2 font-semibold mb-1">
        <span>{result.imported > 0 ? '✅' : '⚠️'}</span>
        <span>
          <strong>{result.imported}</strong> importiert
          {result.skipped > 0 && <>, <strong>{result.skipped}</strong> übersprungen</>}
        </span>
      </div>
      {hasErrors && (
        <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto">
          {result.errors.map((e, i) => (
            <li key={i} className="text-yellow-800 text-xs bg-yellow-100 rounded px-2 py-0.5">⚠ {e}</li>
          ))}
        </ul>
      )}
      {!hasErrors && result.imported > 0 && (
        <div className="text-green-700 text-xs mt-1">Alle Zeilen erfolgreich importiert.</div>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function Import() {
  const [selectedKey, setSelectedKey] = useState<string>(IMPORT_TYPES[0].key);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = IMPORT_TYPES.find(t => t.key === selectedKey) ?? IMPORT_TYPES[0];

  const handleTypeChange = (key: string) => {
    setSelectedKey(key);
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
  };

  const handleFile = (f: File) => {
    setFile(f);
    setResult(null);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setPreview(parseCSV(text));
    };
    reader.readAsText(f, 'utf-8');
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API}${selected.endpoint}`, { method: 'POST', body: formData });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(detail.detail || res.statusText);
      }
      const data: ImportResult = await res.json();
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-2 sm:p-4 lg:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <span>⬆️</span> Daten-Import
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Importiere Stammdaten und Planungsdaten aus CSV-Dateien.
          Wähle zuerst den Import-Typ, lade dann die Vorlage herunter, fülle sie aus und lade sie hoch.
        </p>
      </div>

      {/* Type selector */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-5">
        <label className="block text-sm font-semibold text-slate-700 mb-2">Import-Typ wählen</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {IMPORT_TYPES.map(t => (
            <button
              key={t.key}
              onClick={() => handleTypeChange(t.key)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all text-left ${
                t.key === selectedKey
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-blue-400 hover:bg-blue-50'
              }`}
            >
              <span className="text-base">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Import panel */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-700 flex items-center gap-2">
            <span className="text-2xl">{selected.icon}</span>
            {selected.label}
          </h2>
          <button
            onClick={() => downloadTemplate(selected.templateFilename, selected.templateContent)}
            className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-blue-700 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50 hover:border-blue-300 transition-colors font-medium"
          >
            ⬇️ CSV-Vorlage herunterladen
          </button>
        </div>

        {/* Description */}
        <div className="bg-slate-50 rounded-lg p-3 mb-4 text-sm text-slate-600">
          <div className="font-medium mb-1">{selected.description}</div>
          <div className="text-xs text-slate-500">
            <span className="font-semibold">Spalten:</span> {selected.columns}
          </div>
        </div>

        {/* Drop zone */}
        <DropZone onFile={handleFile} />

        {/* File info */}
        {file && (
          <div className="mt-2 text-xs text-gray-500 flex items-center gap-2">
            <span>📄</span>
            <span className="font-medium">{file.name}</span>
            <span className="text-gray-400">({(file.size / 1024).toFixed(1)} KB)</span>
            <button
              onClick={() => { setFile(null); setPreview(null); setResult(null); setError(null); }}
              className="ml-auto text-red-400 hover:text-red-600 text-xs"
            >✕ Entfernen</button>
          </div>
        )}

        {/* Preview */}
        {preview && preview.headers.length > 0 && (
          <>
            <div className="mt-3 text-xs font-semibold text-gray-600">
              Vorschau ({preview.rows.length} Zeile{preview.rows.length !== 1 ? 'n' : ''}):
            </div>
            <PreviewTable headers={preview.headers} rows={preview.rows} />
          </>
        )}

        {/* Import button */}
        {preview && preview.headers.length > 0 && (
          <div className="mt-4">
            <button
              onClick={handleImport}
              disabled={loading || !file}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                loading || !file
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
              }`}
            >
              {loading ? (
                <><span className="animate-spin">⏳</span> Importiere…</>
              ) : (
                <><span>⬆️</span> Jetzt importieren ({preview.rows.length} Zeile{preview.rows.length !== 1 ? 'n' : ''})</>
              )}
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            ❌ Fehler: {error}
          </div>
        )}

        {/* Result */}
        {result && <ResultBanner result={result} />}
      </div>
    </div>
  );
}
