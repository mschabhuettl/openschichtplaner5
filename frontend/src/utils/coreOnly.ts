/**
 * SP5_CORE_ONLY (docs/feature-classification.md): die EXTRA-Klassifikation
 * fürs Frontend — EINE Konstante für Nav-Filter UND Routen-Guard, damit im
 * Core-Modus kein toter Menüeintrag und keine erreichbare EXTRA-Ansicht
 * bleibt. Serverseitig gilt zusätzlich das api-Gate (404 je EXTRA-Endpunkt).
 */
export const EXTRA_ROUTE_PATHS: readonly string[] = [
  '/tauschboerse', '/schichtwuensche', '/mein-profil', '/mein-kalender',
  '/analytics', '/absence-stats', '/overtime-dashboard', '/jahresrueckblick',
  '/rotations-analyse', '/kapazitaets-forecast', '/mitarbeiter-vergleich',
  '/qualitaets-bericht', '/fairness', '/kompetenz-matrix',
  '/auditlog', '/protokoll', '/changelog', '/companies', '/orm-mirror',
  '/webhooks', '/health', '/rate-limits', '/email-settings',
  '/notification-settings', '/export-scheduler',
  '/dienst-board', '/leitwand', '/teamkalender', '/geburtstagkalender',
  '/team', '/urlaubs-timeline', '/employee-timeline', '/wochenansicht',
  '/notfall-plan', '/konflikte', '/conflict-report',
  '/uebergabe', '/schichtbriefing', '/simulation', '/schicht-kalibrator',
  '/onboarding', '/recurring-shifts', '/work-time-rules',
];

export function isExtraPath(pathname: string): boolean {
  return EXTRA_ROUTE_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));
}
