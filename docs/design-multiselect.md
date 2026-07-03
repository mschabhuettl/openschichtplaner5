# Design: ui/MultiSelect (Mehrfachauswahl-Filter)

Stand: Juli 2026. Anhang zum Design-System-Review (docs/design-system.md);
Umsetzung erst NACH dem Review (Phase-4-Baustein). Kein Verhaltensbruch:
Alle bestehenden Einfach-Dropdowns bleiben, bis eine Ansicht migriert wird.

## Motivation

Mehrere Echt-Betrieb-Rückmeldungen wünschen Mehrfachauswahl je
Filter-Dimension (Gruppen, Mitarbeiter, Schicht- und Abwesenheitsarten),
z. B. „Team A + Team C gleichzeitig". Der Dienstplan hat dafür bereits
zwei bewährte SEITENLOKALE Eigenbauten (`GroupMultiSelect`,
`EmployeeMultiSelect` in Schedule.tsx) — genau die Fehlerklasse B4/B5 des
UX-Audits: funktioniert, aber unteilbar und driftanfällig.

## Vorschlag

`frontend/src/components/ui/MultiSelect.tsx` als Primitive, extrahiert aus
dem bewährten Schedule-Eigenbau (kein Neuentwurf):

```tsx
interface MultiSelectProps<T extends number | string> {
  options: { value: T; label: string; depth?: number }[]; // depth: Baum-Einrückung
  selected: T[];                 // [] = „Alle" (kein Filter)
  onChange: (values: T[]) => void;
  allLabel: string;              // z. B. „Alle Gruppen"
  disabled?: boolean;
}
```

Verhalten (wie heute in Schedule bewährt):
- Leere Auswahl bedeutet „Alle" (kein Filter) — Konsistenz mit Bestand.
- Button-Label: `allLabel` | Einzelname | „N Gruppen/…".
- Checkbox-Liste im Popover; „Alle"-Eintrag leert die Auswahl.
- ESC/Außenklick schließt (wie ui/Modal-Konventionen).
- Gruppen-Optionen kommen aus `utils/groupTree.ts` (`groupTreeOptions`,
  depth-Einrückung) — Baumdarstellung wie in den 41 Einzel-Dropdowns.
- Dark-Mode ausschließlich über Token/`dark:`-Klassen (Regel 6).

## Einsatzstellen (Migrationsreihenfolge nach Nutzung)

1. Dienstplan (ersetzt die zwei lokalen Eigenbauten — reine Extraktion),
2. Einsatzplan (Gruppen), 3. Urlaubs-/Jahres-Timeline (Gruppen),
4. Statistiken/Berichte (Gruppen + Arten), 5. Personaltabelle.

Ansicht für Ansicht, je ein Commit mit Screenshots light+dark
(Phase-4-Regeln); serverseitige Verträge sind unverändert (Filter bleiben
Client-seitig bzw. nutzen bestehende `group_ids`-Params, wo vorhanden).

## Offene Punkte für das Review

1. Soll „Alle" bei Teilauswahl als Reset-Eintrag oben stehen (heutiges
   Schedule-Verhalten) oder als Checkbox „Alle abwählen"?
2. Maximale Popover-Höhe/Suche: ab wie vielen Optionen ein Suchfeld
   (Vorschlag: ab 15, wie MA-Auswahl im Dienstplan)?
3. Persistenz der Auswahl je Ansicht (localStorage) — gewünscht oder
   bewusst flüchtig?
