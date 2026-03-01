/**
 * GuidedTour — Schritt-für-Schritt Onboarding ohne externe Libraries.
 * Speichert „bereits gesehen" in localStorage.
 */
import { useState, useEffect, useCallback } from 'react';

export const TOUR_STORAGE_KEY = 'sp5_tour_done_v2';

export interface TourStep {
  title: string;
  description: string;
  icon: string;
  /** CSS selector of the element to highlight. null = center overlay */
  target?: string | null;
}

const STEPS: TourStep[] = [
  {
    title: 'Willkommen bei OpenSchichtplaner5! 🎉',
    description:
      'Hier planst du Dienstpläne, verwaltest Mitarbeiter, behältst Überstunden im Blick und vieles mehr. Diese kurze Tour zeigt dir die wichtigsten Funktionen.',
    icon: '🧸',
    target: null,
  },
  {
    title: 'Dashboard — Alles auf einen Blick',
    description:
      'Das Dashboard zeigt dir die wichtigsten Kennzahlen: geplante Stunden, offene Konflikte, heutige Dienste und anstehende Ereignisse. Klicke auf die KPI-Karten für Details.',
    icon: '📊',
    target: null,
  },
  {
    title: 'Dienstplan — Kern der Anwendung',
    description:
      'Unter "Dienstplan" planst du Schichten per Drag & Drop oder Klick. Wechsle zwischen Monats-, Wochen- und Jahresansicht.',
    icon: '📅',
    target: null,
  },
  {
    title: 'Konflikte — Immer im Blick',
    description:
      'Das rote Badge in der Navigation zeigt offene Konflikte (z.B. Überschneidungen, fehlende Besetzung). Klicke auf ⚠️ Konflikte um sie aufzulösen.',
    icon: '⚠️',
    target: null,
  },
  {
    title: 'Team-Übersicht & Kalender',
    description:
      'Unter "Team-Übersicht" siehst du alle Mitarbeiter auf einen Blick — mit Verfügbarkeit, Schichten und Kontaktdaten. Der Team-Kalender zeigt gemeinsame Termine und Abwesenheiten.',
    icon: '👥',
    target: null,
  },
  {
    title: 'Analytics & Trends',
    description:
      'Die Analytics-Seite zeigt Auslastungstrends, Schichtverteilung und Überstunden-Entwicklung über Zeit. Ideal für strategische Personalplanung.',
    icon: '📉',
    target: null,
  },
  {
    title: 'Mein Profil',
    description:
      'Unter "Mein Profil" siehst du deine eigenen Stunden, Schichten und Abwesenheiten. Passe deine Benachrichtigungseinstellungen und Präferenzen an.',
    icon: '👤',
    target: null,
  },
  {
    title: 'Tauschbörse — Dienste flexibel tauschen',
    description:
      'Unter "Tauschbörse" können Mitarbeiter Tauschanfragen stellen und Planer sie genehmigen oder ablehnen. Tauschanfragen lösen automatisch eine Benachrichtigung beim betroffenen Mitarbeiter aus.',
    icon: '🔄',
    target: null,
  },
  {
    title: 'Rollen-Switcher — Perspektive wechseln',
    description:
      'Oben rechts kannst du zwischen verschiedenen Rollen wechseln:\n• Admin — voller Zugriff\n• Planer — Dienstplanung & Genehmigungen\n• Leser — nur lesen (Self-Service Portal)\n\nIdeal um die App aus Mitarbeiter-Sicht zu erleben.',
    icon: '👤',
    target: null,
  },
  {
    title: 'Benachrichtigungen — Immer informiert',
    description:
      'Die Glocke 🔔 in der Kopfzeile zeigt dir Benachrichtigungen:\n• Urlaubsanträge genehmigt/abgelehnt\n• Neue Tauschanfragen\n\nBenachrichtigungen können als "gelesen" markiert oder gelöscht werden.',
    icon: '🔔',
    target: null,
  },
  {
    title: 'Tastatur-Shortcuts — Schnell navigieren',
    description:
      'Drücke ? für alle Shortcuts.\n• Ctrl+K — Schnellsuche / Command Palette\n• g d — Dashboard\n• g p — Dienstplan\n• g m — Mitarbeiter\n• Alt+T — Team · Alt+A — Analytics · Alt+H — Health',
    icon: '⌨️',
    target: null,
  },
  {
    title: 'Export & Berichte',
    description:
      'Exportiere Dienstpläne als Excel/XLSX, PDF oder CSV. Nutze Monatsberichte, Fairness-Score, und Kapazitäts-Forecast für tiefe Einblicke.',
    icon: '📊',
    target: null,
  },
  {
    title: 'Du bist startklar! 🚀',
    description:
      'Die Tour ist abgeschlossen. Du kannst sie jederzeit über den ? Button → "Tour starten" erneut aufrufen. Viel Erfolg bei der Dienstplanung!',
    icon: '✅',
    target: null,
  },
];

interface GuidedTourProps {
  /** Force-open (e.g. from "?" button) */
  open?: boolean;
  onClose?: () => void;
}

export function GuidedTour({ open, onClose }: GuidedTourProps) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  // Auto-show on first visit — runs ONCE on mount only (empty deps).
  // Mark as seen immediately so navigation re-renders never re-trigger it.
  useEffect(() => {
    const done = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!done) {
      const t = setTimeout(() => {
        localStorage.setItem(TOUR_STORAGE_KEY, '1'); // mark seen before showing
        setStep(0);
        setVisible(true);
      }, 800);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — mount-only

  // Handle explicit open via prop (🧭 button)
  useEffect(() => {
    if (open) {
      setStep(0);
      setVisible(true);
    }
  }, [open]);

  const dismiss = useCallback(() => {
    localStorage.setItem(TOUR_STORAGE_KEY, '1');
    setVisible(false);
    onClose?.();
  }, [onClose]);

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      dismiss();
    }
  };

  const prev = () => setStep(s => Math.max(0, s - 1));

  // Keyboard navigation
  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
      if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      if (e.key === 'ArrowLeft') prev();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, step]);

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Onboarding-Tour"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={dismiss}
        aria-hidden="true"
      />

      {/* Card */}
      <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
        {/* Progress bar */}
        <div className="h-1 bg-gray-200">
          <div
            className="h-1 bg-blue-500 transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        {/* Body */}
        <div className="p-7">
          {/* Step indicator */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs text-gray-600 font-medium">
              Schritt {step + 1} von {STEPS.length}
            </span>
            <button
              onClick={dismiss}
              className="text-gray-600 hover:text-gray-600 text-xl leading-none"
              aria-label="Tour schließen"
            >
              ✕
            </button>
          </div>

          {/* Icon + Title */}
          <div className="flex items-start gap-4 mb-4">
            <span className="text-4xl">{current.icon}</span>
            <h2 className="text-xl font-bold text-gray-800 leading-snug">{current.title}</h2>
          </div>

          {/* Description */}
          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line mb-6">
            {current.description}
          </p>

          {/* Dot indicators */}
          <div className="flex items-center justify-center gap-1.5 mb-6">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                aria-label={`Schritt ${i + 1}`}
                className={`rounded-full transition-all ${
                  i === step
                    ? 'w-5 h-2 bg-blue-500'
                    : 'w-2 h-2 bg-gray-300 hover:bg-gray-400'
                }`}
              />
            ))}
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={prev}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                ← Zurück
              </button>
            )}
            <div className="flex-1" />
            <button
              onClick={dismiss}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-600 transition"
            >
              Tour überspringen
            </button>
            <button
              onClick={next}
              className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition shadow-sm"
            >
              {isLast ? '🚀 Los geht\'s!' : 'Weiter →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Hook to programmatically start the tour */
// eslint-disable-next-line react-refresh/only-export-components
export function useTour() {
  const [tourOpen, setTourOpen] = useState(false);
  const startTour = () => {
    localStorage.removeItem(TOUR_STORAGE_KEY);
    setTourOpen(true);
  };
  const closeTour = () => setTourOpen(false);
  return { tourOpen, startTour, closeTour };
}
