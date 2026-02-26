# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased] — 2026-02-26 (feature-19)

### Hinzugefügt / Added

#### 🪪 Mitarbeiter-Profil (`/mitarbeiter/:id`)
- **Neue Seite** mit vollständiger Profil-Ansicht für jeden Mitarbeiter
- **KPI-Kacheln**: Jahres-Schichtzahl, Ist-Stunden, Urlaubsverbrauch, Wochenend-Schichten auf einen Blick
- **4 Tabs**: Übersicht | Jahres-Statistik | Nächste 7 Tage | Protokoll
- **Übersicht-Tab**: Stammdaten (Geburtsdatum mit Altersanzeige, Dienstjahre, Arbeitstage etc.), Kontaktdaten, bevorstehende Abwesenheiten, Nächste-7-Tage-Vorschau
- **Statistik-Tab**: Monatliche Stunden-Balken mit Soll/Ist-Vergleich, detaillierte Monatstabelle mit Diff, WE-/Nacht-Schichten und Urlaub
- **7-Tage-Tab**: Schichten + Abwesenheiten der nächsten 7 Tage mit Heute-Markierung
- **Protokoll-Tab**: Letzte 30 System-Einträge des Änderungs-Logs
- **MA-Wechsler**: Dropdown direkt im Header zum schnellen Wechseln zwischen Profilen
- **Profil-Button** in der Mitarbeiter-Liste (`/employees`) mit direktem Sprung zum Profil
- Navigation via Back-Button (Browser-History)

---

## [Unreleased] — 2026-02-26 (feature-18)

### Hinzugefügt / Added

#### 🖨️ Druckvorschau (`/druckvorschau`)
- **Neue Seite** für interaktive Druck-Vorbereitung des Dienstplans
- Sidebar mit vollständiger Konfiguration: Monat/Jahr, Gruppe, Ausrichtung, Schriftgröße, Farbmodus
- Druckraster: farbige Schicht-Badges, Feiertags- und Wochenend-Hervorhebung
- **Farbmodi**: Farbe / Graustufen / Minimal (tintensparend)
- **Nur-Werktage-Modus**: blendet Wochenend-Spalten aus
- **Schicht-Zähler-Spalte**: zeigt Häufigkeit pro Schichtart und Mitarbeiter
- Legende am Ende des Dokuments, Unterschriftszeile für Leitung
- `@page`-Direktive für korrektes A4-Format beim Drucken (Portrait/Landscape)
- Sidebar + Navigation werden beim Druck automatisch ausgeblendet

---

## [Unreleased] — 2026-02-26 (feature-15)

### Hinzugefügt / Added

#### 💬 Schichtwünsche & Sperrtage (`/schichtwuensche`)
- **Neue Seite** für Mitarbeiter-Wünsche und Sperrtage — Kalender- und Listenansicht
- Monatliche Kalenderansicht mit grünen (Wunsch) und roten (Sperrtag) Badges pro Tag
- Mitarbeiter-Filter, Ein-Klick-Hinzufügen durch Klick auf einen Tag
- Backend-API: `GET/POST/DELETE /api/wishes` mit JSON-Persistenz
- Schicht-Wunsch kann für beliebige Mitarbeiter und Tage eingetragen werden

#### 📊 Urlaubs-Timeline — Standalone-Seite (`/urlaubs-timeline`)
- **Eigenständige Gantt-Timeline-Seite** — Jahresüberblick aller Abwesenheiten als horizontale Farbbalken
- Jahr-Selektor, Filter nach Abwesenheitsart und Gruppe
- **Überschneidungs-Heatmap** — zeigt automatisch Perioden mit vielen gleichzeitigen Abwesenheiten
- Hover-Tooltip mit Mitarbeiter, Abwesenheitsart, Datumsspanne und Dauer
- Zusammenfassungskacheln: Gesamttage, MA mit Abwesenheit, Max. gleichzeitig, Ø Tage pro MA
- Top-5 Abwesenheiten-Ranking mit Fortschrittsbalken

#### 🏖️ Urlaubsverwaltung — Jahres-Timeline (Gantt-View)
- **Neuer Tab „Jahres-Timeline"** in der Urlaubsverwaltung — Gantt-Chart-Ansicht aller Mitarbeiter-Abwesenheiten im Jahresüberblick
- Jeder Mitarbeiter als eigene Zeile, jeder Tag als Spalte (Jan–Dez), farbige Blöcke zeigen Abwesenheiten nach Abwesenheitsart
- Farbkodierung gemäß Abwesenheitsart-Farben aus der Datenbank
- Live-Tooltip beim Hover: Mitarbeiter, Datum, Abwesenheitsart
- Suchfeld + Abwesenheitsart-Filter für schnelle Orientierung
- Wochenend-Hervorhebung (grau unterlegt)
- Tageszähler pro Mitarbeiter (∑-Spalte)
- Zusammenfassungs-Kacheln für jede verwendete Abwesenheitsart

#### ⚖️ Berichte
- **Mitarbeiter-Vergleich** — Neue Seite zum direkten Vergleich zweier Mitarbeiter im Jahresüberblick: bidirektionale Statistik-Balkendiagramme (Schichten, Ist-Stunden, Wochenend-/Nachtschichten, Urlaub, Abwesenheiten), gespiegelte Schichtarten-Verteilung mit Farbkodierung, Soll/Ist-Auswertung mit Differenz, Monat-für-Monat-Vergleich mit Schicht-Badges; Filterung nach Gruppe und Jahr

---


#### 📊 Dashboard
- **Morning-Briefing Widget** 🌅 — Tageszeit-abhängige Begrüßung mit Dienststatus und Schnellüberblick
- **Burnout-Radar Widget** 🔥 — Erkennt Überlastungsrisiken bei Mitarbeitern (lange Schichtserien, hohe Überstunden, Wochenend-/Nachthäufung); zeigt Risikostufe (hoch/mittel) mit Begründung
- **Besetzungs-Heatmap** — Kalender-Heatmap im Dashboard mit Farbkodierung des Besetzungsgrades
- **Staffing-Warnungen** — Unterbesetzungs-Warnungen für die nächsten 7 Tage
- **Zeitkonto-Defizit Widget** — Mitarbeiter mit negativem Zeitkonto auf dem Dashboard

#### 📅 Dienstplan
- **A-Z Schnellfilter** — Alphabetische Buchstabenleiste zum schnellen Filtern von Mitarbeitern
- **Mitarbeiter-Auslastungsbalken** — Fortschrittsbalken pro Mitarbeiter basierend auf Soll-/Ist-Stunden
- **Schichtfarben-Legende** — Legende am unteren Rand mit Schichtarten und Besetzungsampel
- **Schicht-Tausch Modal** — Zwei Mitarbeiter können Schichten direkt tauschen
- **Woche-Kopieren Modal** — Gesamte Woche für einen Mitarbeiter auf eine andere Woche kopieren
- **Schicht-Empfehlungen Modal** — KI-basierte Empfehlungen für freie Schichtslots

#### 🎂 Neue Seiten
- **Geburtstags-Kalender** (`/geburtstagkalender`) — Alle Mitarbeitergeburtstage nach Monat gruppiert, mit Kalender- und Listenansicht
- **Fairness-Score** (`/fairness`) — Bewertet Gleichverteilung von Wochenend-, Nacht- und Feiertagsschichten; Mitarbeiter-Ranking mit Abweichungsanzeige

#### 📆 Jahresübersicht
- **Farbige Badges** — Schichtarten und Abwesenheiten als farbige Badges (F=orange, S=pink, N=blau, T=grau, Ur=hellblau, Kr=rot)

---

## [1.0.0] — 2026-02-23

### 🎉 Erstes stabiles Release / First stable release

OpenSchichtplaner5 ist ein moderner, browserbasierter Open-Source-Ersatz für die proprietäre Windows-Software Schichtplaner5.  
Er liest und schreibt die originalen `.DBF`-Datenbankdateien direkt — keine Migration nötig.

*OpenSchichtplaner5 is a modern, browser-based open-source replacement for the proprietary Windows software Schichtplaner5.  
It reads and writes the original `.DBF` database files directly — no migration needed.*

---

### Hinzugefügt / Added

#### 🗓️ Planung / Scheduling
- **Dienstplan** — Monatsansicht mit Wochenend-Hervorhebung, heutiger Tag blau markiert, Feiertage sichtbar, Tooltips; Schichten & Abwesenheiten per Rechtsklick; Echtzeit-Suche (Ctrl+F) + Sortierung
- **Dienstplan UX** — Wochenend-Markierung, Feiertags-Anzeige, Hover-Tooltips auf Schichten
- **Keyboard Power-Mode** — Vollständige Tastatursteuerung des Dienstplans (Pfeiltasten + Kürzel)
- **Schicht-Vorlagen** — Wochen-Templates speichern und auf beliebige Zeiträume anwenden
- **Auto-Planer** — Schichtplan automatisch aus Schichtmodellen generieren
- **Konflikte-Bereinigungstool** — Schicht-/Abwesenheitskonflikte direkt erkennen und löschen
- **Einsatzplan** — Tages- und Wochenansicht mit Abweichungen
- **Jahresübersicht** — Einzelansicht als Standard (wie Original SP5), 12 Monate pro Mitarbeiter auf einen Blick
- **Personaltabelle** — Kompakte tabellarische Planansicht
- **Abwesenheits-Kalender-View** — Kalender-Ansicht für alle Abwesenheiten

#### 📊 Dashboard & Analysen / Dashboard & Analytics
- **Dashboard** — Recharts-basierte Live-Charts: Soll/Ist-Balken, Abwesenheits-Kreisdiagramm
- **Live-Dashboard Besetzungsampel** — Echtzeit-Ampel für Schichtbesetzung + Heute-Widget
- **Widgets** — Geburtstage, Feiertage, Abwesenheiten heute/diese Woche, Heute-im-Dienst
- **Globale Schnellsuche** — Spotlight-style Suche via Ctrl+K über alle Daten
- **Warnings-Center** — Zentrales Benachrichtigungszentrum mit Badge-Counter

#### 📈 Auswertungen / Reports & Statistics
- **Statistiken** — Soll/Ist-Vergleich, Fehlzeiten pro Gruppe/Monat
- **Krankenstand-Statistik** — Charts für Krankheits-Auswertungen
- **Zeitkonto** — Soll/Ist/Saldo-Übersicht mit Monatsdetail-Modal und Jahresabschluss
- **Überstunden** — Soll/Ist/Differenz-Tabelle mit Balken-Visualisierung, Jahr- und Gruppenfilter
- **Mitarbeiter-Stundenauswertung** — Detaillierte Stunden-Reports mit CSV-Export
- **14 Reports** — Umfangreiche Berichts-Bibliothek (Anwesenheit, Fehlzeiten, Schichtverteilung u.v.m.)
- **Monatsabschluss-Report** — PDF + CSV Download für monatliche Abrechnungen
- **Personalbedarf-Ampel** — Live Besetzungs-Feedback gegen definierte Mindest-/Maximalbesetzung

#### 👥 Mitarbeiterverwaltung / Employee Management
- **Mitarbeiterverwaltung** — Vollständige CRUD-Verwaltung mit Suche, Sortierung und Gruppenfilter
- **Foto-Upload** — Mitarbeiterfotos hochladen und verwalten
- **Urlaubsverwaltung** — Anspruch, Saldo, Sperrtage, Genehmigungs-Workflow, PDF-Druck
- **Urlaubsantrag** — Mitarbeiter-seitige Urlaubsantrags-Funktion
- **Aktivitätsprotokoll** — Vollständiges Audit-Log aller Aktionen
- **Geburtstage** — Geburtstags-Widget und Übersicht
- **Ausgeschiedene-Filter** — Ehemalige Mitarbeiter ausblenden/anzeigen

#### 🔧 Einstellungen & System / Settings & System
- **Schichtmodelle** — Wiederkehrende Schichtmuster definieren und Mitarbeitern zuordnen
- **Personalbedarf** — Mindest- und Maximalbesetzung pro Schicht/Tag konfigurieren
- **Feiertage** — Österreichische Feiertage automatisch + manuelle Einträge
- **Einschränkungen** — Mitarbeiterbezogene Planungs-Einschränkungen
- **Kontobuchungen** — Manuelle Buchungen auf Zeitkonten
- **Notizen** — Tages- und mitarbeiterbezogene Notizen
- **6 Import-Typen** — Datenimport für Mitarbeiter, Schichten, Abwesenheiten etc.
- **DB-Komprimieren** — FoxPro-DBF-Datenbankwartung direkt aus der App

#### 🔐 Authentifizierung / Authentication
- **Auth-System** — Login mit Rollen (Admin / Planer / Leser) + Dev-Mode für lokale Nutzung
- **Backend-Auth** — Session-Persistenz + granulare Benutzerrechte pro Rolle
- **Passwort-Ändern** — Benutzer können ihr Passwort selbst ändern

#### 🎨 UI / UX
- **Dark Mode** — Vollständiger Dark Mode via CSS Custom Properties
- **Mobile UX** — Vollständig responsive für Smartphones und Tablets
- **Print-CSS** — Druckoptimiertes CSS für alle Seiten
- **React Router** — Vollständiges URL-Routing (Deep Links funktionieren)
- **Code-Splitting + Lazy Loading** — Optimierte Ladezeiten

#### 🔌 Backend & API
- **FastAPI Backend** — Modernes Python-Backend mit automatischer OpenAPI-Dokumentation
- **DBF-Direktzugriff** — Liest und schreibt originale FoxPro-DBF-Dateien ohne Migration
- **Single-Port-Deployment** — FastAPI serviert Frontend direkt, kein separater Proxy nötig
- **TypeScript strict mode** — Vollständige Typsicherheit im Frontend, keine `any`-Typen
- **GitHub Actions CI** — Automatisierte Tests bei jedem Push/PR

#### 🧪 Tests / Testing
- **Backend-Coverage > 80%** — Pytest-basierte Test-Suite mit Coverage-Reporting
- **GitHub Actions** — CI/CD-Pipeline für automatisierte Tests

---

### Technischer Stack / Tech Stack

| Layer | Technologie |
|-------|------------|
| Frontend | React 18 + TypeScript 5 + Vite |
| Styling | Tailwind CSS 3 + CSS Custom Properties |
| Charts | Recharts |
| Routing | React Router v6 |
| Backend | FastAPI (Python 3.8+) |
| Datenbank | FoxPro DBF (originale SP5-Dateien) |
| Auth | Session-basiert mit Rollen |
| CI/CD | GitHub Actions |

---

### Bekannte Einschränkungen / Known Limitations

- Die Anwendung ist optimiert für die österreichische Schichtplanung (AT-Feiertage, Gesetze)
- DBF-Datenbankformat muss kompatibel mit dem Original Schichtplaner5 sein
- Für den produktiven Einsatz wird ein lokaler Server oder ein gesichertes Netzwerk empfohlen

---

[1.0.0]: https://github.com/mschabhuettl/openschichtplaner5/releases/tag/v1.0.0
