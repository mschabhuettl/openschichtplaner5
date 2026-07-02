# UX-Audit — systemische Bestandsaufnahme des Frontends

Stand: Juli 2026 (nach Abschluss der Echtdaten-Befundserie, app 1.21.28).
Zweck: Die in der Befundserie einzeln behobenen UI-Fehler hatten wiederkehrende
strukturelle Ursachen. Dieses Audit benennt die Ursachen mit Zahlen aus dem
Code und leitet den Zuschnitt des Design-Systems ab (docs/design-system.md),
damit die Fehlerklassen nicht wiederkehren.

## Methode

Statische Auswertung von `frontend/src` (76 Seiten, 40 Komponenten) plus die
Fix-Historie der Befundserie (CHANGELOG 1.21.13–1.21.28).

## Befunde (systemisch)

### B1 — Vier parallele Dark-Mode-Mechanismen
Gezählt: **1.904 `dark:`-Utility-Klassen**, **65 `isDark ?`-Ternaries**,
**85 `--color-*`-Token-Deklarationen** in `index.css` und zusätzlich globale
`html.dark .bg-*`-Overrides. Vier Mechanismen für dasselbe Problem bedeuten:
jede neue Fläche kann still hell bleiben (belegte Folgen: Dark-Mode-Befunde
29/33/35, die 16 nicht existierenden Tailwind-Shades wie `slate-750`, die
Inline-Style-Flächen in Analytics/AuditLog). Der Dark-Sweep (0/72 Routen) hat
den Bestand bereinigt — der Mechanismus-Wildwuchs bleibt und produziert bei
jeder neuen Seite dieselbe Fehlerklasse nach.

### B2 — Keine gemeinsame Tabellen-/Listen-Komponente
**49 Seiten bauen `<table>` selbst; 0 nutzen eine geteilte DataTable.**
**84 lokale `.sort(...)`-Aufrufe** in den Seiten. Folge in der Befundserie:
Sortier-Inkonsistenzen (Befunde 14/19/20) mussten an mehreren Stellen einzeln
gefixt werden (Einsatzplan-Zellen, MA-Listen, Zeilenreihenfolge); die
Original-Sortierregel (Beginnzeit → alphabetisch bzw. POSITION) lebt als
Konvention statt als Code.

### B3 — Kein Frontend-Kontrast-Helfer für Farbflächen
Mitarbeiter-/Schichtfarben kommen als `COLORBK_HEX` aus den Stammdaten; die
Textfarbe darüber wird teils vom Server (`text_color`), teils gar nicht
bestimmt. Es gibt KEINE zentrale FE-Funktion „lesbare Vordergrundfarbe zu
beliebigem Hintergrund" — die Text-läuft-aus-Farbfeld-/Unlesbarkeits-Befunde
(24/30) wurden per Badge-Fixes behoben, aber jede neue farbige Fläche kann
das Problem neu einführen.

### B4 — Modal-/Karten-Eigenbau
**31 Seiten** bauen Overlays selbst (`fixed inset-0`), nur `FormModal.tsx`
existiert als Ansatz; **21 Seiten** duplizieren das Karten-Styling
(`bg-white dark:bg-gray-800 rounded-xl …`). Uneinheitliche Abstände,
Schließen-Verhalten (ESC/Backdrop) und Z-Index-Konflikte sind vorprogrammiert.

### B5 — Dropdown-/Beschriftungs-Konsistenz ist neuerdings gut, aber ungeschützt
`groupTreeOptions` (Gruppen-Baum, Befund 18) und die „Alle Gruppen"-Beschriftung
(Befund 23) sind zentralisiert — aber nichts erzwingt ihre Nutzung in neuen
Ansichten.

## Zuordnung der behobenen Befunde zu Wurzeln

| Befundklasse (behoben) | Wurzel | Struktureller Schutz fehlt noch |
|---|---|---|
| Dark-Mode-Flächen 29/33/35, Tailwind-Shades | B1 | Token-Paare als EINZIGER Mechanismus |
| Text/Farbfeld 24/30 | B3 | zentrale Kontrast-Funktion |
| Sortierung 14/19/20 | B2 | DataTable/zentrale Sortierung |
| Dropdown/Labels 18/23 | B5 | Primitive statt Konvention |
| Konsistenz 9 (Layout-Drift) | B4 | Seiten-Shell/Card/Modal-Primitives |

## Empfehlung (Zuschnitt für docs/design-system.md)

1. **Tokens als einzige Quelle** (Ausbau der bestehenden `--color-*`-Paare):
   Farbe (light/dark-Paar, WCAG-AA-geprüft), Abstände, Typo-Skala, Radius,
   Elevation, Statusfarben. `isDark ?`-Ternaries und Roh-Hex in Seiten sind
   danach Verstöße.
2. **`utils/contrast.ts`**: `readableTextColor(bgHex)` (Luminanz → schwarz/weiß)
   für ALLE farbigen Flächen (Badges, Zellen, Legenden).
3. **Primitives**: `Badge` (feste Höhe, truncate — überläuft nie), `DataTable`
   (EINE Sortierlogik: Beginnzeit → alphabetisch; POSITION wo Original-treu),
   `Select` (baumfähig via groupTreeOptions), `Modal` (ESC/Backdrop/Fokus),
   `Card`/`PageShell`, `EmptyState`/`LoadingState`/`ErrorState`.
4. **Migration inkrementell** je Ansicht (Funktion unverändert, Screenshots
   light+dark), Referenz-Ansicht zuerst (Dienstplan) als Review-Punkt.
5. **Stehende Regel**: neue/geänderte UI nutzt Tokens+Primitives; kein
   pro-Seite-Dark-Mode, kein Eigenbau von Tabellen/Modals/Badges.

Bewusst NICHT empfohlen: Big-Bang-Umbau oder Fremd-Komponentenbibliothek —
der Bestand ist funktional und frisch verifiziert; der Wert liegt im
Verhindern der Wiederkehr, nicht im Neuanstrich.
