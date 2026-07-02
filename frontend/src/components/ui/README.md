# Design-System-Primitives — verbindliche Regeln

Herleitung: docs/ux-audit.md (Wurzelklassen der Befundserie). Für JEDE neue
oder geänderte UI gilt:

1. **Farbige Flächen** (Schicht-/Abwesenheits-/MA-Farben): Textfarbe NIE
   manuell wählen — `readableTextColor()` aus `utils/contrast.ts` (identische
   Formel wie die Server-Seite) bzw. direkt `<Badge>`.
2. **Badges/Chips**: nur `<Badge>` — feste Höhe, truncate, läuft nie über.
3. **Sortierung**: nur über `utils/sortOrder.ts` (byNameFirstname, byPosition,
   byStartTimeThenName). Keine lokalen `localeCompare`-Eigenbauten.
4. **Modals**: `<FormModal>` (Formulare) oder `<Modal>` (Anzeige/Bestätigung).
   Kein `fixed inset-0`-Eigenbau; ESC/Backdrop/Fokus kommen aus der Primitive.
5. **Dark-Mode**: über Tailwind-`dark:`-Paare bzw. die `--color-*`-Tokens aus
   `index.css`. KEINE `isDark ?`-Ternaries in neuen Komponenten, keine
   Inline-Hex-Farben für Flächen, keine nicht existierenden Tailwind-Shades
   (slate-750 u. ä. scheitern still).
6. **Gruppen-Dropdowns**: baumfähig über `utils/groupTree.ts`
   (`groupTreeOptions`), Beschriftung „Alle Gruppen".
