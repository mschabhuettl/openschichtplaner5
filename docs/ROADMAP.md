# ROADMAP — OpenSchichtplaner5

Priorisierte Weiterentwicklung nach dem 1.2.0-Release (Stand: Juni 2026).

## A. Offene Paritäts-Verfeinerungen (Original-Features, bewusst vertagt)

Priorität 1 (fachlich relevant, klar umrissen):
1. **Soll-/Istplan-Modus** (Original 4.12): erfordert vorab die Klärung der
   `TYPE`-Enum-Kodierung in 5MASHI/5SPSHI an einer Live-DB mit Sollplan-Daten.
   Danach: Plan-Umschalter in Dienstplan + "Unterschiede"-Zeile.
2. **Abwesenheits-Anonymisierung** (SHOWABS + 5USETT ANOA*): Render-Pfad in
   Dienstplan/Einsatzplan/Berichten, api-seitige Filterung für Benutzer mit
   eingeschränktem SHOWABS.
3. **5GRACC/5EMACC-Sichtbarkeits-Scopes** (Benutzer sieht nur "seine" Gruppen/
   Mitarbeiter inkl. Vererbung): api-Filterung + Frontend-Gruppenauswahl.
4. **Einschränkungen vertiefen**: Bestätigungszustand "?" und Prüfung auch bei
   manueller Eintragung (heute nur im Auto-Planner).
5. **Arbeitsplatz-Zuordnung im Dienstplan** (Kontextmenü je Dienst) +
   Arbeitsplatz-Filter in der Ansicht.

Priorität 2 (Komfort-/Dialogtiefe):
6. Sonderdienst-Editor: freier Name/Farben, getrennte Arbeitsstunden,
   Mehrtages-Erfassung, nachträgliches Bearbeiten.
7. Urlaubssperren: Geltungsbereich je Gruppe + Warnung beim Eintragen;
   "gekennzeichnete Zeiträume" (5PERIO) im Plan; Gruppen-Schnittmengen-Modus.
8. Berichts-Optionstiefe: Untergliederung KW/Monat, Datenbasis Soll/Ist,
   Nullzeilen, Halbjahres-/Jahres-Tagesraster-Varianten, Zeitzuschläge je Tag.
9. Manuelle POSITION-Sortierung der Stammdaten programmweit.
10. Undo/Redo mit voller Detailtreue (Teiltags-Abwesenheiten, Kommentare).
11. Import: Quell→Ziel-Feldzuordnungs-UI (Vorlagen decken den Workflow heute ab).
12. Backup-Kommentar + Restore-Anzeige; Migrationspfad für SP3/4-/WF-Altsicherungen
    (nur bei realem Bedarf).

Bewusste Web-Abweichungen (kein Handlungsbedarf, dokumentiert):
- Löschen von Stammdaten = Ausblenden statt Original-Löschkaskaden (sicherer).
- Lokale Ansichts-/Anpassen-Optionen teilweise fix (Web-UX statt Registry).
- Jahresübersicht: Eintragen direkt im Jahresraster nicht nötig (Klick führt
  zum Dienstplan).

## B. Über das Original hinaus (neue Ideen, priorisiert)

1. **PG-Backend-Berechnungsparität**: SP5PostgresDatabase auf die zentrale
   calculations-Schicht heben (heute: DBF-Backend = Referenz, PG = Teilmenge
   mit Alt-Formeln) + PG-Testinfrastruktur in CI.
2. **CDX-Schreibsupport** (CodeBase-kompatible Indizes schreiben statt
   invalidieren) — eliminiert Index-Rebuilds beim Original-Client.
3. **Differenz-Testharness gegen das Original** via Wine (Original headless
   befüttern, Berichte vergleichen) — härtet die Berechnungs-Parität ab.
4. **Mehrschicht-Wünsche/Verfügbarkeits-Workflow** ausbauen (Self-Service-
   Planung mit Genehmigungsketten).
5. **Mobile-PWA-Vertiefung**: Offline-Eintragung mit Sync-Queue.
6. **SSO/OIDC** (Keycloak/Entra) zusätzlich zum 5USER-Login.
7. **Mandantenfähigkeit** (mehrere DBF-Datenbanken parallel, Umschalter).
8. **Webhooks/API-Erweiterung** für Lohn-Export-Integrationen (DATEV & Co.).
