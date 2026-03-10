/**
 * FirstTimeSetupWizard — Multi-step onboarding wizard for first-time admin setup.
 *
 * Shows when: admin logged in + no employees exist + not previously completed.
 * Steps: Welcome → Company Info → Shift Types → First Employee → Done
 */
import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

// ── Types ────────────────────────────────────────────────────────────────────

interface ShiftDraft {
  name: string;
  shortname: string;
  startTime: string;
  endTime: string;
  colorBk: string;
  colorText: string;
}

interface EmployeeDraft {
  lastname: string;
  firstname: string;
  shortname: string;
  role: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'sp5_onboarding_completed';

const STEP_LABELS = [
  { icon: '👋', label: 'Willkommen' },
  { icon: '🏢', label: 'Firmendaten' },
  { icon: '⏰', label: 'Schichttypen' },
  { icon: '👤', label: 'Mitarbeiter' },
  { icon: '✅', label: 'Fertig' },
];

const DEFAULT_SHIFTS: ShiftDraft[] = [
  { name: 'Frühdienst', shortname: 'F', startTime: '06:00', endTime: '14:00', colorBk: '#22c55e', colorText: '#ffffff' },
  { name: 'Spätdienst', shortname: 'S', startTime: '14:00', endTime: '22:00', colorBk: '#3b82f6', colorText: '#ffffff' },
  { name: 'Nachtdienst', shortname: 'N', startTime: '22:00', endTime: '06:00', colorBk: '#6366f1', colorText: '#ffffff' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function hexToInt(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  // BGR format as used by SP5
  return b * 65536 + g * 256 + r;
}

// ── Step Progress Bar ────────────────────────────────────────────────────────

function StepProgress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEP_LABELS.map((s, i) => (
        <div key={i} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold border-2 transition-all
                ${i < current ? 'bg-green-500 border-green-500 text-white' :
                  i === current ? 'bg-blue-600 border-blue-600 text-white shadow-lg scale-110' :
                  'bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-500 text-gray-600 dark:text-slate-300'}`}
            >
              {i < current ? '✓' : s.icon}
            </div>
            <span
              className={`text-xs mt-1 font-medium text-center whitespace-nowrap hidden sm:block
                ${i === current ? 'text-blue-600 dark:text-blue-400' : i < current ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-slate-400'}`}
            >
              {s.label}
            </span>
          </div>
          {i < total - 1 && (
            <div className={`flex-1 h-0.5 mx-2 mt-[-16px] sm:mt-0 transition-all ${i < current ? 'bg-green-400' : 'bg-gray-200 dark:bg-slate-600'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Step 0: Welcome ──────────────────────────────────────────────────────────

function StepWelcome() {
  return (
    <div className="text-center space-y-6 py-4">
      <div className="text-6xl">🧸</div>
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
        Willkommen bei OpenSchichtplaner5!
      </h2>
      <p className="text-gray-600 dark:text-slate-300 max-w-md mx-auto leading-relaxed">
        SP5 ist dein Open-Source-Werkzeug für <strong>Dienstplanung</strong>,{' '}
        <strong>Schichtmodelle</strong> und <strong>Personalverwaltung</strong>.
      </p>
      <div className="bg-blue-50 dark:bg-slate-700 border border-blue-200 dark:border-slate-600 rounded-xl p-4 max-w-md mx-auto text-sm text-blue-800 dark:text-blue-200">
        <p className="font-semibold mb-1">📋 In wenigen Schritten einrichten:</p>
        <ol className="text-left space-y-1 list-decimal list-inside">
          <li>Firmendaten hinterlegen</li>
          <li>Schichttypen anlegen</li>
          <li>Ersten Mitarbeiter erstellen</li>
        </ol>
      </div>
      <p className="text-sm text-gray-500 dark:text-slate-400">
        Das dauert nur ca. 2 Minuten. Los geht's! 🚀
      </p>
    </div>
  );
}

// ── Step 1: Company Info ─────────────────────────────────────────────────────

function StepCompanyInfo({ companyName, onChange }: { companyName: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white">🏢 Firmendaten</h3>
      <p className="text-sm text-gray-600 dark:text-slate-300">
        Wie heißt dein Unternehmen oder deine Einrichtung?
      </p>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1" htmlFor="setup-company">
          Firmenname
        </label>
        <input
          id="setup-company"
          type="text"
          value={companyName}
          onChange={e => onChange(e.target.value)}
          className="w-full border dark:border-slate-600 rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 dark:text-white text-lg"
          placeholder="z.B. Pflegeheim Sonnenschein"
          autoFocus
        />
      </div>
      <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg p-3 text-sm text-amber-700 dark:text-amber-300">
        💡 Kann jederzeit in den Einstellungen geändert werden.
      </div>
    </div>
  );
}

// ── Step 2: Shift Types ──────────────────────────────────────────────────────

function StepShiftTypes({ shifts, onChange }: { shifts: ShiftDraft[]; onChange: (s: ShiftDraft[]) => void }) {
  const updateShift = (idx: number, field: keyof ShiftDraft, value: string) => {
    const updated = [...shifts];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange(updated);
  };

  const addShift = () => {
    onChange([...shifts, { name: '', shortname: '', startTime: '08:00', endTime: '16:00', colorBk: '#64748b', colorText: '#ffffff' }]);
  };

  const removeShift = (idx: number) => {
    onChange(shifts.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white">⏰ Schichttypen anlegen</h3>
      <p className="text-sm text-gray-600 dark:text-slate-300">
        Erstelle deine typischen Schichten. Du kannst später beliebig viele hinzufügen.
      </p>

      <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
        {shifts.map((shift, idx) => (
          <div key={idx} className="border dark:border-slate-600 rounded-xl p-3 bg-gray-50 dark:bg-slate-700/50 space-y-2">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex-shrink-0 border"
                style={{ backgroundColor: shift.colorBk, color: shift.colorText, borderColor: shift.colorBk }}
              >
                <span className="flex items-center justify-center h-full text-xs font-bold">{shift.shortname || '?'}</span>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={shift.name}
                  onChange={e => updateShift(idx, 'name', e.target.value)}
                  placeholder="Schichtname"
                  className="border dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  value={shift.shortname}
                  onChange={e => updateShift(idx, 'shortname', e.target.value.toUpperCase())}
                  placeholder="Kürzel"
                  maxLength={5}
                  className="border dark:border-slate-600 rounded-lg px-2 py-1.5 text-sm font-mono bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {shifts.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeShift(idx)}
                  className="text-red-400 hover:text-red-600 p-1"
                  title="Schicht entfernen"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="block text-xs text-gray-500 dark:text-slate-400 mb-0.5">Von</label>
                <input
                  type="time"
                  value={shift.startTime}
                  onChange={e => updateShift(idx, 'startTime', e.target.value)}
                  className="w-full border dark:border-slate-600 rounded px-2 py-1 text-sm bg-white dark:bg-slate-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-slate-400 mb-0.5">Bis</label>
                <input
                  type="time"
                  value={shift.endTime}
                  onChange={e => updateShift(idx, 'endTime', e.target.value)}
                  className="w-full border dark:border-slate-600 rounded px-2 py-1 text-sm bg-white dark:bg-slate-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-slate-400 mb-0.5">Hintergrund</label>
                <input
                  type="color"
                  value={shift.colorBk}
                  onChange={e => updateShift(idx, 'colorBk', e.target.value)}
                  className="w-full h-8 rounded cursor-pointer border-0"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-slate-400 mb-0.5">Textfarbe</label>
                <input
                  type="color"
                  value={shift.colorText}
                  onChange={e => updateShift(idx, 'colorText', e.target.value)}
                  className="w-full h-8 rounded cursor-pointer border-0"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addShift}
        className="w-full border-2 border-dashed border-gray-300 dark:border-slate-500 rounded-xl py-2 text-sm text-gray-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
      >
        + Weitere Schicht hinzufügen
      </button>
    </div>
  );
}

// ── Step 3: First Employee ───────────────────────────────────────────────────

function StepFirstEmployee({ employee, onChange }: { employee: EmployeeDraft; onChange: (e: EmployeeDraft) => void }) {
  const autoShort = (ln: string, fn: string) => {
    const l = ln.trim().slice(0, 2).toUpperCase();
    const f = fn.trim().slice(0, 1).toUpperCase();
    return f + l;
  };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white">👤 Ersten Mitarbeiter anlegen</h3>
      <p className="text-sm text-gray-600 dark:text-slate-300">
        Lege deinen ersten Mitarbeiter an, damit du direkt mit der Planung starten kannst.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Nachname *</label>
          <input
            type="text"
            value={employee.lastname}
            onChange={e => {
              const v = e.target.value;
              onChange({ ...employee, lastname: v, shortname: autoShort(v, employee.firstname) });
            }}
            className="w-full border dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500"
            placeholder="Mustermann"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Vorname</label>
          <input
            type="text"
            value={employee.firstname}
            onChange={e => {
              const v = e.target.value;
              onChange({ ...employee, firstname: v, shortname: autoShort(employee.lastname, v) });
            }}
            className="w-full border dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500"
            placeholder="Max"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Kürzel</label>
          <input
            type="text"
            value={employee.shortname}
            onChange={e => onChange({ ...employee, shortname: e.target.value.toUpperCase() })}
            maxLength={5}
            className="w-full border dark:border-slate-600 rounded-lg px-3 py-2 font-mono bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500"
            placeholder="MMU"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Funktion / Rolle</label>
          <input
            type="text"
            value={employee.role}
            onChange={e => onChange({ ...employee, role: e.target.value })}
            className="w-full border dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-blue-500"
            placeholder="z.B. Pflegefachkraft"
          />
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-slate-700 border border-blue-200 dark:border-slate-600 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-300">
        💡 Weitere Mitarbeiter kannst du jederzeit über die Mitarbeiterverwaltung oder den Onboarding-Wizard hinzufügen.
      </div>
    </div>
  );
}

// ── Step 4: Done ─────────────────────────────────────────────────────────────

function StepDone({ companyName, shiftsCreated, employeeName }: { companyName: string; shiftsCreated: number; employeeName: string }) {
  return (
    <div className="text-center space-y-6 py-4">
      <div className="text-6xl">🎉</div>
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Einrichtung abgeschlossen!</h2>
      <p className="text-gray-600 dark:text-slate-300 max-w-md mx-auto">
        Dein System ist bereit. Hier eine Zusammenfassung:
      </p>

      <div className="bg-gray-50 dark:bg-slate-700 rounded-xl p-4 max-w-sm mx-auto text-left space-y-2 border dark:border-slate-600">
        {companyName && (
          <div className="flex items-center gap-2 text-sm">
            <span>🏢</span>
            <span className="text-gray-600 dark:text-slate-300">Firma:</span>
            <strong className="dark:text-white">{companyName}</strong>
          </div>
        )}
        <div className="flex items-center gap-2 text-sm">
          <span>⏰</span>
          <span className="text-gray-600 dark:text-slate-300">Schichttypen:</span>
          <strong className="dark:text-white">{shiftsCreated} erstellt</strong>
        </div>
        {employeeName && (
          <div className="flex items-center gap-2 text-sm">
            <span>👤</span>
            <span className="text-gray-600 dark:text-slate-300">Mitarbeiter:</span>
            <strong className="dark:text-white">{employeeName}</strong>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export interface FirstTimeSetupProps {
  /** Called when wizard is completed or dismissed */
  onComplete: () => void;
}

export function FirstTimeSetupWizard({ onComplete }: FirstTimeSetupProps) {
  const [step, setStep] = useState(0);
  const [companyName, setCompanyName] = useState('');
  const [shifts, setShifts] = useState<ShiftDraft[]>(DEFAULT_SHIFTS);
  const [employee, setEmployee] = useState<EmployeeDraft>({ lastname: '', firstname: '', shortname: '', role: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shiftsCreated, setShiftsCreated] = useState(0);
  const [employeeName, setEmployeeName] = useState('');

  const totalSteps = STEP_LABELS.length;
  const isDoneStep = step === totalSteps - 1;

  const canProceed = useCallback(() => {
    if (step === 3) return employee.lastname.trim().length > 0;
    return true;
  }, [step, employee.lastname]);

  const handleNext = async () => {
    if (step === totalSteps - 2) {
      // Before showing the Done step, save everything
      setSaving(true);
      setError(null);
      try {
        // 1. Save company name to localStorage (settings endpoint doesn't have company_name field)
        if (companyName.trim()) {
          localStorage.setItem('sp5_company_name', companyName.trim());
        }

        // 2. Create shift types
        let created = 0;
        for (const shift of shifts) {
          if (!shift.name.trim()) continue;
          try {
            await api.createShift({
              NAME: shift.name.trim(),
              SHORTNAME: shift.shortname.trim() || shift.name.trim().substring(0, 2).toUpperCase(),
              COLORBK: hexToInt(shift.colorBk),
              COLORBK_HEX: shift.colorBk,
              COLORTEXT: hexToInt(shift.colorText),
              COLORTEXT_HEX: shift.colorText,
            });
            created++;
          } catch (e) {
            console.warn('Shift creation failed:', shift.name, e);
          }
        }
        setShiftsCreated(created);

        // 3. Create first employee
        if (employee.lastname.trim()) {
          const empName = `${employee.firstname} ${employee.lastname}`.trim();
          await api.createEmployee({
            NAME: employee.lastname.trim(),
            FIRSTNAME: employee.firstname.trim(),
            SHORTNAME: employee.shortname.trim(),
            FUNCTION: employee.role.trim(),
            HRSDAY: 8,
            HRSWEEK: 40,
            HRSMONTH: 173,
          });
          setEmployeeName(empName);
        }

        // 4. Mark onboarding completed
        localStorage.setItem(STORAGE_KEY, 'true');

        setStep(s => s + 1);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setSaving(false);
      }
    } else {
      setStep(s => s + 1);
    }
  };

  const handleSkip = () => {
    if (step === totalSteps - 2) {
      // Skipping from employee step — save shifts but skip employee
      handleSkipToEnd();
    } else {
      setStep(s => s + 1);
    }
  };

  const handleSkipToEnd = async () => {
    setSaving(true);
    setError(null);
    try {
      if (companyName.trim()) {
        localStorage.setItem('sp5_company_name', companyName.trim());
      }

      let created = 0;
      for (const shift of shifts) {
        if (!shift.name.trim()) continue;
        try {
          await api.createShift({
            NAME: shift.name.trim(),
            SHORTNAME: shift.shortname.trim() || shift.name.trim().substring(0, 2).toUpperCase(),
            COLORBK: hexToInt(shift.colorBk),
            COLORBK_HEX: shift.colorBk,
            COLORTEXT: hexToInt(shift.colorText),
            COLORTEXT_HEX: shift.colorText,
          });
          created++;
        } catch (e) {
          console.warn('Shift creation failed:', shift.name, e);
        }
      }
      setShiftsCreated(created);

      localStorage.setItem(STORAGE_KEY, 'true');
      setStep(totalSteps - 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    onComplete();
  };

  const handleFinish = () => {
    onComplete();
  };

  // Keyboard: Escape to dismiss
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleDismiss();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  });

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Ersteinrichtungs-Assistent"
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 pb-2 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">🧭 Ersteinrichtung</h1>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            title="Später einrichten"
          >
            ✕
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-6">
          <StepProgress current={step} total={totalSteps} />
        </div>

        {/* Content */}
        <div className="px-6 pb-4 min-h-[300px]">
          {step === 0 && <StepWelcome />}
          {step === 1 && <StepCompanyInfo companyName={companyName} onChange={setCompanyName} />}
          {step === 2 && <StepShiftTypes shifts={shifts} onChange={setShifts} />}
          {step === 3 && <StepFirstEmployee employee={employee} onChange={setEmployee} />}
          {step === 4 && <StepDone companyName={companyName} shiftsCreated={shiftsCreated} employeeName={employeeName} />}

          {error && (
            <div className="mt-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 rounded-lg p-3 text-sm">
              ❌ {error}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="px-6 pb-6 pt-2 border-t dark:border-slate-700 flex justify-between items-center">
          <div>
            {step > 0 && !isDoneStep && (
              <button
                onClick={() => setStep(s => s - 1)}
                disabled={saving}
                className="px-5 py-2 rounded-xl border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-30 transition-colors font-medium"
              >
                ← Zurück
              </button>
            )}
          </div>

          <span className="text-sm text-gray-500 dark:text-slate-400">
            {step + 1} / {totalSteps}
          </span>

          <div className="flex items-center gap-2">
            {/* Skip button (not on Welcome or Done) */}
            {step > 0 && !isDoneStep && (
              <button
                onClick={handleSkip}
                disabled={saving}
                className="px-4 py-2 text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 disabled:opacity-30 transition-colors"
              >
                Überspringen
              </button>
            )}

            {isDoneStep ? (
              <button
                onClick={handleFinish}
                className="px-6 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors"
              >
                🚀 Zum Dienstplan
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={saving || !canProceed()}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Speichere…
                  </>
                ) : (
                  'Weiter →'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Hook: Should show onboarding? ────────────────────────────────────────────

/**
 * Hook that determines whether the first-time setup wizard should be shown.
 * Returns [showWizard, dismissWizard].
 */
export function useFirstTimeSetup(isAdmin: boolean): [boolean, () => void] {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;

    // Check localStorage first
    if (localStorage.getItem(STORAGE_KEY) === 'true') return;

    // Check if there are employees
    api.getEmployees()
      .then(employees => {
        if (employees.length === 0) {
          setShow(true);
        } else {
          // If employees exist, mark as completed so we don't check again
          localStorage.setItem(STORAGE_KEY, 'true');
        }
      })
      .catch(() => {
        // On error, don't show wizard
      });
  }, [isAdmin]);

  const dismiss = useCallback(() => {
    setShow(false);
    localStorage.setItem(STORAGE_KEY, 'true');
  }, []);

  return [show, dismiss];
}

export default FirstTimeSetupWizard;
