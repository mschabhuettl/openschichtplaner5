/**
 * OnboardingChecklist — A non-blocking checklist card for new admins.
 *
 * Shows on the Dashboard when an admin first logs in.
 * Tracks progress via localStorage. Can be dismissed permanently.
 *
 * Steps:
 *  1. Firma einrichten (company exists)
 *  2. Schichtarten anlegen (shift types exist)
 *  3. Erste Mitarbeiter hinzufügen (employees exist)
 *  4. Ersten Dienstplan erstellen (schedule entries exist)
 */
import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

// ── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'sp5_onboarding_checklist_dismissed';
const PROGRESS_KEY = 'sp5_onboarding_checklist_progress';

interface ChecklistStep {
  id: string;
  icon: string;
  title: string;
  description: string;
  href: string;
  checkFn: () => Promise<boolean>;
}

const STEPS: ChecklistStep[] = [
  {
    id: 'company',
    icon: '🏢',
    title: 'Firma einrichten',
    description: 'Name und Grunddaten Ihrer Firma hinterlegen.',
    href: '/companies',
    checkFn: async () => {
      try {
        const companies = await api.getCompanies();
        return companies.length > 0;
      } catch {
        return false;
      }
    },
  },
  {
    id: 'shifts',
    icon: '⏰',
    title: 'Schichtarten anlegen',
    description: 'Frühdienst, Spätdienst, Nachtdienst etc. definieren.',
    href: '/shifts',
    checkFn: async () => {
      try {
        const types = await api.getShifts();
        return types.length > 0;
      } catch {
        return false;
      }
    },
  },
  {
    id: 'employees',
    icon: '👥',
    title: 'Erste Mitarbeiter hinzufügen',
    description: 'Mindestens einen Mitarbeiter anlegen.',
    href: '/employees',
    checkFn: async () => {
      try {
        const emps = await api.getEmployees();
        return emps.length > 0;
      } catch {
        return false;
      }
    },
  },
  {
    id: 'schedule',
    icon: '📅',
    title: 'Ersten Dienstplan erstellen',
    description: 'Schichten im Kalender zuweisen.',
    href: '/schedule',
    checkFn: async () => {
      try {
        const now = new Date();
        const data = await api.getSchedule(now.getFullYear(), now.getMonth() + 1);
        return Array.isArray(data) && data.length > 0;
      } catch {
        return false;
      }
    },
  },
];

// ── Component ────────────────────────────────────────────────────────────────

export function OnboardingChecklist() {
  const [dismissed, setDismissed] = useState(true); // hidden by default until checked
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  // Check if already dismissed
  useEffect(() => {
    const isDismissed = localStorage.getItem(STORAGE_KEY) === 'true';
    setDismissed(isDismissed);
    if (isDismissed) {
      setLoading(false);
    }
  }, []);

  // Check progress for each step
  const checkProgress = useCallback(async () => {
    // Load cached progress first
    try {
      const cached = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
      setCompletedSteps(cached);
    } catch { /* ignore */ }

    const results: Record<string, boolean> = {};
    for (const step of STEPS) {
      results[step.id] = await step.checkFn();
    }
    setCompletedSteps(results);
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(results));
    setLoading(false);

    // Auto-dismiss if all steps complete
    const allDone = STEPS.every(s => results[s.id]);
    if (allDone) {
      // Keep showing for a moment so user sees the completion
      // They can dismiss manually
    }
  }, []);

  useEffect(() => {
    if (!dismissed) {
      checkProgress();
    }
  }, [dismissed, checkProgress]);

  // Handle dismiss
  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setDismissed(true);
  };

  // Don't render if dismissed or loading
  if (dismissed || loading) return null;

  const completedCount = STEPS.filter(s => completedSteps[s.id]).length;
  const totalSteps = STEPS.length;
  const allDone = completedCount === totalSteps;
  const progressPct = Math.round((completedCount / totalSteps) * 100);

  return (
    <div className="bg-ebene rounded-panel border border-kontur p-5 relative overflow-hidden">
      {/* Glut-Linie als oberer Akzent */}
      <div className="absolute top-0 left-0 w-full h-1 bg-glut" />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🚀</span>
          <div>
            <h2 className="font-bold text-schrift text-base">
              {allDone ? 'Setup abgeschlossen!' : 'Erste Schritte'}
            </h2>
            <p className="text-xs text-schrift-2 mt-0.5">
              {allDone
                ? 'Alle Schritte erledigt — Sie können loslegen!'
                : `${completedCount} von ${totalSteps} Schritten erledigt`}
            </p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-schrift-2 hover:text-schrift transition-colors p-1 rounded-ui hover:bg-wash"
          title={allDone ? 'Checkliste schließen' : 'Checkliste ausblenden'}
          aria-label="Checkliste schließen"
        >
          ✕
        </button>
      </div>

      {/* Fortschrittsbalken */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-schrift-2 mb-1">
          <span>Fortschritt</span>
          <span className="font-bold font-mono">{progressPct}%</span>
        </div>
        <div className="w-full bg-wash rounded-full h-2">
          <div
            className="h-2 rounded-full bg-glut transition-all duration-[140ms] ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-2">
        {STEPS.map((step) => {
          const done = !!completedSteps[step.id];
          return (
            <a
              key={step.id}
              href={step.href}
              className={`flex items-center gap-3 rounded-ui px-3 py-2.5 transition-all duration-150 group border ${
                done
                  ? 'border-transparent'
                  : 'border-kontur hover:bg-wash'
              }`}
            >
              {/* Haken-Kreis bzw. Schritt-Icon */}
              <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                done
                  ? 'bg-glut text-glut-ink'
                  : 'bg-wash text-schrift-2'
              }`}>
                {done ? '✓' : step.icon}
              </span>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <span className={`text-sm font-medium block ${
                  done ? 'text-schrift-3 line-through' : 'text-schrift'
                }`}>
                  {step.title}
                </span>
                {!done && (
                  <span className="text-xs text-schrift-3 block truncate">
                    {step.description}
                  </span>
                )}
              </div>

              {/* Pfeil */}
              {!done && (
                <span className="text-schrift-3 group-hover:text-glut transition-colors flex-shrink-0">
                  →
                </span>
              )}
            </a>
          );
        })}
      </div>

      {/* All done celebration */}
      {allDone && (
        <div className="mt-4 pt-3 border-t border-kontur flex items-center justify-between">
          <span className="text-sm text-schrift-2 font-medium">
            🎉 Alles eingerichtet — viel Erfolg!
          </span>
          <button
            onClick={handleDismiss}
            className="text-xs bg-[#15171c] text-white dark:bg-[#e9ecf2] dark:text-[#0e1420] px-3 py-1.5 rounded-ui transition-colors font-semibold"
          >
            Checkliste schließen
          </button>
        </div>
      )}
    </div>
  );
}

export default OnboardingChecklist;
