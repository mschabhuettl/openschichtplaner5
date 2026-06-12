# ROADMAP — OpenSchichtplaner5

Priorisierte Weiterentwicklung nach dem 1.2.0-Release (Stand: Juni 2026).

## A. Offene Paritäts-Verfeinerungen (Original-Features, bewusst vertagt)

> **Erledigt:** Die Tagindex-Kodierung der Schichtrestriktionen (5RESTR.WEEKDAY)
> ist auf den Original-Index (0=Mo..6=So, 7=Feiertag) umgestellt — Backend,
> Auto-Planung und Frontend sind konsistent, die manuelle Eintragung prüft
> Restriktionen korrekt. (Hinweis: vor dem Fix per Web-UI angelegte Sätze
> nutzten „0=alle, 1=Mo..7=So" — diese sollten nach dem Upgrade überprüft
> werden; eine automatische Migration ist nicht eindeutig möglich, da ein
> gespeichertes WEEKDAY=0 zwischen „Montag" und altem „alle" mehrdeutig ist.)

Priorität 1 (fachlich relevant, klar umrissen):
1. **Soll-/Istplan-Modus** (Original 4.12): bleibt blockiert — erfordert die
   Klärung der `TYPE`/`schedule_type`-Enum-Kodierung in 5MASHI/5SPSHI (Spec
   D-58 markiert die Werte als unsicher, „aus dem Datenmodell allein nicht
   auflösbar"). Die Referenz-Beispiel-DB enthält keinerlei Plandaten, der
   Wert ist also weder dort noch über den Wine-Harness ohne umfangreiche
   GUI-Automation eindeutig beobachtbar. Erst nach Klärung: Plan-Umschalter +
   "Unterschiede"-Zeile. Nicht gefakt.
2. **Abwesenheits-Anonymisierung** (SHOWABS + 5USETT ANOA*): Render-Pfad in
   Dienstplan/Einsatzplan/Berichten, api-seitige Filterung für Benutzer mit
   eingeschränktem SHOWABS.
3. **5GRACC/5EMACC-Sichtbarkeits-Scopes** (Benutzer sieht nur "seine" Gruppen/
   Mitarbeiter inkl. Vererbung): api-Filterung + Frontend-Gruppenauswahl.
4. **Einschränkungen vertiefen**: Bestätigungszustand "?" (RESTRICT-Grad; Spec
   dort unsicher). Die Prüfung bei manueller Eintragung ist umgesetzt (Konflikt-
   Check mit korrektem Tagindex, s. o.).
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

1. ~~**PG-Backend-Berechnungsparität**~~ — **erledigt:** das PostgreSQL-Backend
   nutzt die zentrale Berechnungsschicht, ein CI-Job prüft die Parität gegen
   echtes PostgreSQL.
2. **CDX-Schreibsupport** (CodeBase-kompatible Indizes schreiben statt
   invalidieren) — **vertagt mit Begründung:** Die heutige Strategie (veraltete
   `.CDX` nach jedem Schreibzugriff entfernen, das Original baut sie beim
   Öffnen neu auf) ist korrekt und interop-sicher. Ein vollständiger
   FoxPro-Compound-Index-B-Baum-Schreiber wäre umfangreich und fehleranfällig,
   während der einzige Gewinn ein einmaliger Index-Rebuild beim Öffnen wäre —
   schlechtes Aufwand/Nutzen-Verhältnis (Simplicity first).
3. ~~**Differenz-Testharness gegen das Original** via Wine~~ — **Machbarkeit
   belegt, Kernnutzen umgesetzt:** Das Original läuft headless unter wine+Xvfb,
   die Berechnungsparität ist gegen die Live-Anzeige bestätigt (optionaler
   Orakeltest in der Library). Die *kontinuierliche* Voll-Automation aller
   Berichtsdialoge bleibt bewusst vertagt (läuft nicht in CI, hoher
   GUI-/OCR-Pflegeaufwand, geringer Grenznutzen).
4. **Mehrschicht-Wünsche/Verfügbarkeits-Workflow** ausbauen (Self-Service-
   Planung mit Genehmigungsketten).
5. **Mobile-PWA-Vertiefung**: Offline-Eintragung mit Sync-Queue.
6. **SSO/OIDC** (Keycloak/Entra) zusätzlich zum 5USER-Login.
7. **Mandantenfähigkeit** (mehrere DBF-Datenbanken parallel, Umschalter).
8. **Webhooks/API-Erweiterung** für Lohn-Export-Integrationen (DATEV & Co.).

## C. Infrastruktur & Tooling (vertagt, mit Begründung)

1. **Release-Automatisierung** (Version-Bump + CHANGELOG + Tag aus Conventional
   Commits, z. B. release-please): aktueller Tag-Flow funktioniert; Umstellung
   ist Geschmacks-/Prozessfrage des Maintainers.
2. **Redis-Session-Store** für Multi-Worker-Betrieb: neue Infrastruktur-
   Abhängigkeit; bis dahin gilt die dokumentierte Single-Worker-Empfehlung.
3. **Laufzeit-State konsolidieren** (backend/data + backend/api/data → ein
   injizierbares Datenverzeichnis): ändert das Volume-Layout bestehender
   Deployments und braucht einen Migrationspfad.
4. **CodeQL/SAST**: pip-/npm-audit decken die Dependency-Seite bereits ab;
   statische Analyse bei Bedarf nachrüsten.
