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
1. ~~**Soll-/Istplan-Modus** (Original 4.12)~~ — **erledigt (Zyklus 5):** Die
   `TYPE`-Kodierung in **5MASHI** ist aus dem Dekompilat geklärt — **0 = Istplan**
   (Normaleintrag, Konstruktor-Default), **1 = Sollplan** (drei unabhängige
   Render-Funktionen in SP5V.dll + Helfer in SP5R.dll verzweigen identisch;
   Serialisierungs-Tag `L"Type"`; Spec D-58 nachgeführt). Umgesetzt: `get_schedule`
   trägt `schedule_type` und filtert per `plan`-Argument (`ist`/`soll`/`both`),
   Default = Istplan; `add_schedule_entry` schreibt `TYPE`, Soll- und Ist-Eintrag
   dürfen am selben Tag koexistieren; `/api/schedule?plan=…`; Plan-Umschalter im
   Dienstplan mit Soll-Kennzeichnung. **5SPSHI.TYPE** bleibt bewusst ausgenommen
   (kodiert Sonderdienst vs. Arbeitszeitabweichung, nicht Soll/Ist — D-53/3.4.4).
2. **Abwesenheits-Anonymisierung** (SHOWABS + 5USETT ANOA*): Render-Pfad in
   Dienstplan/Einsatzplan/Berichten, api-seitige Filterung für Benutzer mit
   eingeschränktem SHOWABS.
3. **5GRACC/5EMACC-Sichtbarkeits-Scopes** (Benutzer sieht nur "seine" Gruppen/
   Mitarbeiter inkl. Vererbung): api-Filterung + Frontend-Gruppenauswahl.
4. ~~**Einschränkungen vertiefen**: Bestätigungszustand "?" (RESTRICT-Grad)~~ —
   **erledigt (Zyklus 5):** 5RESTR.RESTRICT aus dem Dekompilat geklärt — **0=keine,
   1=„auf Anfrage" („?"), 2=„nie"** (Spec-Tabelle + D-58 nachgeführt). Umgesetzt:
   `set_restriction(grade=…)` (Default 2=nie), der Konflikt-Check sperrt hart nur
   bei „nie" (409), „auf Anfrage" lässt die Eintragung mit Warnung zu, „keine"
   greift nicht; UI-Auswahl des Grades in der Einschränkungs-Maske.
5. **Arbeitsplatz-Zuordnung im Dienstplan** (Kontextmenü je Dienst) +
   Arbeitsplatz-Filter in der Ansicht.

Priorität 2 (Komfort-/Dialogtiefe):
6. ~~Sonderdienst-Editor: freier Name/Farben, getrennte Arbeitsstunden,
   Mehrtages-Erfassung, nachträgliches Bearbeiten.~~ **erledigt** (Bearbeiten +
   freier Name; freie Farben + getrennte Arbeitsstunden + Mehrtages-Erfassung).
7. ~~Urlaubssperren: Geltungsbereich je Gruppe + Warnung beim Eintragen;
   "gekennzeichnete Zeiträume" (5PERIO) im Plan; Gruppen-Schnittmengen-Modus.~~
   **erledigt:** Schnittmengen-Modus; weiche Warnung beim Eintragen in einen
   5HOBAN-Sperrzeitraum; 5PERIO mit wählbarer Farbe + farbiger Hinterlegung im
   Dienstplan-Kopf + Bezeichnung beim Hover. (Geltungsbereich-Enum R5.10-7
   bewusst nicht eingeschränkt — 5HOBAN.RESTRICT material-unbestimmbar.)
8. Berichts-Optionstiefe — **weitgehend erledigt** (Listenbericht „Dienstplaneinträge"):
   Datenbasis Istplan/Sollplan/Soll-&-Istplan ✓; Untergliederung KW/Monat ✓; Nullzeilen
   (Mitarbeiter ohne Einträge) ✓. **Tagesraster-Varianten:** durch die vorhandenen
   Berichte abgedeckt — Monats- und Quartals-Dienstplan sind volle Tagesraster (MA×Tage),
   der Jahres-Dienstplan ist bewusst eine Monats-Zusammenfassung (ein 365-Spalten-
   Tagesraster ist als Druckbericht untauglich); ein Halbjahr = zwei Quartalsberichte.
   **Zeitzuschläge je Tag:** in Umsetzung — lib `extracharge_hours_by_day` (per-Tag-
   Aufschlüsselung) vorhanden; api-Endpoint + Bericht folgen.
9. ~~Manuelle POSITION-Sortierung der Stammdaten programmweit.~~ **erledigt.**
10. Undo/Redo-Detailtreue: **teilweise erledigt** — Wiederherstellen bewahrt nun
    Soll-/Istplan-Typ und Arbeitsplatz eines Schichteintrags. **Offen
    (Daten-Layer):** Teiltags-Abwesenheiten (INTERVAL/Zeit) werden beim Undo als
    ganztägig wiederhergestellt, weil die Dienstplan-Schicht-/Abwesenheits-Einträge
    (`get_schedule`) INTERVAL/Start/Ende heute nicht mit ausliefern — ein
    abgegrenzter lib→api→UI-Zusatz (würde zugleich eine reichere Teiltags-Anzeige
    im Raster ermöglichen). Kommentare bleiben eigenständige Entität (eigenes
    Edit/Delete), nicht Teil des Zell-Undo — bewusste Abgrenzung.
11. Import: Quell→Ziel-Feldzuordnungs-UI — **bewertet: bewusst nicht umgesetzt.**
    Der Import ist vorlagenbasiert (dokumentierte Spaltennamen + herunterladbare
    CSV-Vorlagen je Datentyp; „Dienstplan-Abwesenheiten" zusätzlich per
    Personalnummer/Kürzel). Eine freie Feldzuordnungs-UI brächte über die Vorlagen
    hinaus geringen Mehrwert bei deutlich höherer Komplexität (Simplicity first).
12. Backup/Restore — **bewertet:** Server-Backup-Liste mit Download und
    **Wiederherstellen** ist vorhanden. Backup-**Kommentar** (Freitext je Sicherung)
    + Migrationspfad für **SP3/4-/WF-Altsicherungen** bleiben „nur bei realem Bedarf"
    vertagt: kein belegter Bedarf, und die Altformat-Migration ist ein eigenes,
    abgegrenztes Vorhaben ohne aktuellen Auslöser.

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
