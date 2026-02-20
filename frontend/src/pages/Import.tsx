import { useState, useRef } from 'react';
import type { DragEvent, ChangeEvent } from 'react';

const API = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';

// ── CSV parsing ────────────────────────────────────────────────────────────

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const nonEmpty = lines.filter(l => l.trim());
  if (nonEmpty.length === 0) return { headers: [], rows: [] };

  const splitLine = (line: string): string[] => {
    // Simple CSV split — handles quoted fields
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

// ── CSV template download ──────────────────────────────────────────────────

function downloadTemplate(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const TEMPLATES: Record<string, { filename: string; content: string }> = {
  employees: {
    filename: 'mitarbeiter_vorlage.csv',
    content: `NAME,FIRSTNAME,SHORTNAME,NUMBER,SEX,HRSDAY,HRSWEEK,HRSMONTH,WORKDAYS
Mustermann,Max,MM,001,0,8,40,173.33,1 1 1 1 1 0 0 0
Musterfrau,Maria,MF,002,1,6,30,130,1 1 1 0 1 0 0 0
`,
  },
  shifts: {
    filename: 'schichtarten_vorlage.csv',
    content: `NAME,KURZZEICHEN,FARBE,TEXTFARBE,DURATION0
Frühschicht,F,#4A90D9,#FFFFFF,8
Spätschicht,S,#E8A12A,#000000,8
Nachtschicht,N,#2C3E50,#FFFFFF,8
Tagesdienst,T,#27AE60,#FFFFFF,8
`,
  },
  absences: {
    filename: 'abwesenheiten_vorlage.csv',
    content: `EMPLOYEE_ID,DATE,LEAVE_TYPE_ID
1,2025-01-15,2
1,2025-01-16,2
2,2025-02-10,1
`,
  },
  holidays: {
    filename: 'feiertage_vorlage.csv',
    content: `DATE,NAME,INTERVAL,REGION
2025-01-01,Neujahr,1,AT
2025-12-25,1. Weihnachtstag,1,AT
2025-12-26,2. Weihnachtstag,1,AT
2025-04-18,Karfreitag,1,AT
`,
  },
};

// ── Drop zone component ────────────────────────────────────────────────────

interface DropZoneProps {
  onFile: (file: File) => void;
  accepted?: string;
}

function DropZone({ onFile, accepted = '.csv' }: DropZoneProps) {
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
    // Reset so same file can be reselected
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
        dragging
          ? 'border-blue-400 bg-blue-50'
          : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
      }`}
    >
      <div className="text-3xl mb-2">📁</div>
      <div className="text-sm text-gray-600">
        CSV-Datei hierher ziehen oder <span className="text-blue-600 font-medium">auswählen</span>
      </div>
      <div className="text-xs text-gray-400 mt-1">Nur .csv Dateien (UTF-8 oder latin-1)</div>
      <input ref={inputRef} type="file" accept={accepted} className="hidden" onChange={handleChange} />
    </div>
  );
}

// ── Preview table ─────────────────────────────────────────────────────────

function PreviewTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  if (headers.length === 0) return null;
  const preview = rows.slice(0, 5);
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200">
      <table className="text-xs w-full">
        <thead>
          <tr className="bg-slate-100">
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left font-semibold text-slate-700 whitespace-nowrap">
                {h}
              </th>
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

// ── Result banner ─────────────────────────────────────────────────────────

function ResultBanner({ result }: { result: ImportResult }) {
  const hasErrors = result.errors.length > 0;
  return (
    <div className={`mt-3 rounded-lg p-3 text-sm ${hasErrors ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
      <div className="flex items-center gap-2 font-semibold">
        <span>{result.imported > 0 ? '✅' : '⚠️'}</span>
        <span>
          {result.imported} importiert
          {result.skipped > 0 && <>, {result.skipped} übersprungen</>}
        </span>
      </div>
      {hasErrors && (
        <ul className="mt-2 space-y-0.5 max-h-40 overflow-y-auto">
          {result.errors.map((e, i) => (
            <li key={i} className="text-yellow-800 text-xs">⚠ {e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Import section component ───────────────────────────────────────────────

interface ImportSectionProps {
  title: string;
  icon: string;
  endpoint: string;
  templateKey: string;
  description: string;
}

function ImportSection({ title, icon, endpoint, templateKey, description }: ImportSectionProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

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

      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(detail.detail || res.statusText);
      }

      const data: ImportResult = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Unbekannter Fehler');
    } finally {
      setLoading(false);
    }
  };

  const tpl = TEMPLATES[templateKey];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-start justify-between mb-3">
        <h2 className="text-base font-bold text-slate-700 flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          {title}
        </h2>
        <button
          onClick={() => downloadTemplate(tpl.filename, tpl.content)}
          className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 border border-slate-200 rounded-lg px-2 py-1 hover:bg-slate-50 transition-colors"
        >
          ⬇️ Vorlage herunterladen
        </button>
      </div>

      <p className="text-xs text-gray-500 mb-3">{description}</p>

      <DropZone onFile={handleFile} />

      {file && (
        <div className="mt-2 text-xs text-gray-500 flex items-center gap-2">
          <span>📄</span>
          <span className="font-medium">{file.name}</span>
          <span className="text-gray-400">({(file.size / 1024).toFixed(1)} KB)</span>
        </div>
      )}

      {preview && preview.headers.length > 0 && (
        <>
          <div className="mt-3 text-xs font-medium text-gray-600">
            Vorschau ({preview.rows.length} Zeile{preview.rows.length !== 1 ? 'n' : ''}):
          </div>
          <PreviewTable headers={preview.headers} rows={preview.rows} />
        </>
      )}

      {preview && preview.headers.length > 0 && (
        <div className="mt-4">
          <button
            onClick={handleImport}
            disabled={loading || !file}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              loading || !file
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
            }`}
          >
            {loading ? (
              <>
                <span className="animate-spin">⏳</span>
                Importiere…
              </>
            ) : (
              <>
                <span>⬆️</span>
                Jetzt importieren ({preview.rows.length} Zeile{preview.rows.length !== 1 ? 'n' : ''})
              </>
            )}
          </button>
        </div>
      )}

      {error && (
        <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          ❌ Fehler: {error}
        </div>
      )}

      {result && <ResultBanner result={result} />}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function Import() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <span>⬆️</span> Daten-Import
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Importiere Stammdaten und Planungsdaten aus CSV-Dateien.
          Lade zuerst die Vorlage herunter, fülle sie aus und lade sie hoch.
        </p>
      </div>

      <div className="space-y-6">
        <ImportSection
          title="Mitarbeiter importieren"
          icon="👥"
          endpoint="/api/import/employees"
          templateKey="employees"
          description="Pflichtfelder: NAME (Nachname). Optional: FIRSTNAME, SHORTNAME (Kürzel), NUMBER (Personalnummer), HRSDAY, HRSWEEK, HRSMONTH, SEX (0=m, 1=w), WORKDAYS."
        />

        <ImportSection
          title="Schichtarten importieren"
          icon="🕐"
          endpoint="/api/import/shifts"
          templateKey="shifts"
          description="Pflichtfelder: NAME. Optional: KURZZEICHEN, FARBE (#RRGGBB), TEXTFARBE, DURATION0 (Stunden)."
        />

        <ImportSection
          title="Abwesenheiten importieren"
          icon="📋"
          endpoint="/api/import/absences"
          templateKey="absences"
          description="Pflichtfelder: EMPLOYEE_ID (Mitarbeiter-ID), DATE (YYYY-MM-DD), LEAVE_TYPE_ID (Abwesenheitsart-ID). IDs findest du in den Stammdaten."
        />

        <ImportSection
          title="Feiertage importieren"
          icon="🎉"
          endpoint="/api/import/holidays"
          templateKey="holidays"
          description="Pflichtfelder: DATE (YYYY-MM-DD), NAME. Optional: INTERVAL (0=einmalig, 1=jährlich wiederkehrend), REGION (nur zur Info)."
        />
      </div>
    </div>
  );
}
