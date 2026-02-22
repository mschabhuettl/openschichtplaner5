<div align="center">

# 🧸 OpenSchichtplaner5

**Open-source web replacement for Schichtplaner5**

*Reads and writes the original DBF database files directly — no migration needed.*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.8+-3776AB?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3+-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

</div>

---

## Was ist OpenSchichtplaner5?

OpenSchichtplaner5 ist eine moderne, browserbasierte Anwendung zur Dienstplanung — entwickelt als vollwertiger Open-Source-Ersatz für die proprietäre Windows-Software **Schichtplaner5**.

Das Besondere: OpenSchichtplaner5 liest und schreibt die **originalen `.DBF`-Datenbankdateien** direkt im FoxPro-Format. Es ist keine Datenmigration nötig — beide Programme können gleichzeitig auf denselben Daten laufen.

---

## Screenshots

<table>
  <tr>
    <td><img src="docs/screenshots/dashboard.png" alt="Dashboard" width="480"/><br/><sub><b>Dashboard</b></sub></td>
    <td><img src="docs/screenshots/dienstplan.png" alt="Dienstplan" width="480"/><br/><sub><b>Dienstplan mit Suche & Sortierung</b></sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/statistiken.png" alt="Statistiken" width="480"/><br/><sub><b>Statistiken</b></sub></td>
    <td><img src="docs/screenshots/jahresuebersicht.png" alt="Jahresübersicht" width="480"/><br/><sub><b>Jahresübersicht</b></sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/zeitkonto.png" alt="Zeitkonto" width="480"/><br/><sub><b>Zeitkonto mit Monatsdetails</b></sub></td>
    <td><img src="docs/screenshots/ueberstunden.png" alt="Überstunden" width="480"/><br/><sub><b>Überstunden-Übersicht</b></sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/mitarbeiter.png" alt="Mitarbeiter" width="480"/><br/><sub><b>Mitarbeiterverwaltung mit Sortierung</b></sub></td>
    <td><img src="docs/screenshots/urlaubsverwaltung.png" alt="Urlaubsverwaltung" width="480"/><br/><sub><b>Urlaubsverwaltung</b></sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/berichte.png" alt="Berichte" width="480"/><br/><sub><b>Berichte & Reports</b></sub></td>
    <td><img src="docs/screenshots/protokoll.png" alt="Protokoll" width="480"/><br/><sub><b>Aktivitätsprotokoll</b></sub></td>
  </tr>
</table>

---

## Features

### 📅 Planung
- ✅ **Dienstplan** — Monatsansicht, Schichten & Abwesenheiten per Rechtsklick; Echtzeit-Suche (Ctrl+F) + Sortierung nach Name/Nummer
- ✅ **Einsatzplan** — Tages- und Wochenansicht mit Abweichungen
- ✅ **Jahresübersicht** — 12 Monate pro Mitarbeiter auf einen Blick
- ✅ **Personaltabelle** — Kompakte tabellarische Planansicht
- ✅ **Statistiken** — Soll/Ist-Vergleich, Fehlzeiten pro Gruppe/Monat
- ✅ **Urlaubsverwaltung** — Anspruch, Saldo, Sperrtage, Genehmigungs-Workflow, PDF-Druck
- ✅ **Schichtmodelle** — Wiederkehrende Schichtmuster (Wochen-/Tagesrhythmus) definieren & zuordnen
- ✅ **Personalbedarf** — Mindest- und Maximalbesetzung pro Schicht/Tag; datumsspezifische Sonderbedarfe
- ✅ **Jahresabschluss** — Automatische Übertrag-Berechnung und -Buchung
- ✅ **Zeitkonto** — Soll/Ist/Saldo-Übersicht mit Monatsdetail-Modal und Jahresabschluss
- ✅ **Überstunden** *(neu)* — Dedizierte Überstunden-Seite: Soll/Ist/Differenz-Tabelle mit Balken-Visualisierung, Jahr- und Gruppenfilter
- ✅ **Kontobuchungen** — Manuelle Buchungen auf Zeitkonten
- ✅ **Notizen** — Tages- und mitarbeiterbezogene Notizen

### 👥 Stammdaten
- ✅ **Mitarbeiter** — Vollständige Stammdatenverwaltung (Stamm-, Kontakt-, Kalkulationsdaten), Foto-Upload, Schichteinschränkungen; klickbare Sortier-Spaltenköpfe
- ✅ **Gruppen** — Hierarchische Abteilungsstruktur mit Suchfeld + Sortierung *(neu)*
- ✅ **Schichtarten** — Zeiten, Farben, Kürzel, wochentags-spezifische Schichtzeiten *(erweitert)*
- ✅ **Abwesenheitsarten** — Urlaub, Krank, Fortbildung, Sonderurlaub …
- ✅ **Feiertage** — Jahresbezogene Feiertagsverwaltung mit Import *(erweitert)*
- ✅ **Arbeitsstätten** — Standorte & Mitarbeiterzuordnung
- ✅ **Zeitzuschläge** — Lohnzuschläge inkl. wochentags-spezifischer Konfiguration
- ✅ **Schichteinschränkungen** — Verbotene Schichten pro Mitarbeiter

### 📊 Berichte & Export (20+ Berichtstypen)
- ✅ **Dienstplan-Bericht** — Monats-/Jahresbericht (CSV, HTML)
- ✅ **Mitarbeiterliste** — Vollständige Stammdaten (CSV, Druckansicht)
- ✅ **Abwesenheitsbericht** — Gesamt, pro Typ, pro Mitarbeiter, Timeline
- ✅ **Urlaubsbericht** — Saldo, Entitlement, Gruppenübersicht
- ✅ **Schichtbericht** — Schichtenverteilung, pro Mitarbeiter, pro Gruppe
- ✅ **Zeitkonto-Bericht** — Saldo-Übersicht, Monatsdetail, Jahresabschluss-Vorschau
- ✅ **Überstunden-Bericht** *(neu)* — Soll/Ist/Delta pro Mitarbeiter
- ✅ **Personalbedarf-Bericht** — Soll/Ist Besetzung pro Tag

### ⬆️ Import (7 Importtypen)
- ✅ **Mitarbeiter-Import** (CSV)
- ✅ **Schichtarten-Import** (CSV)
- ✅ **Abwesenheiten-Import** (CSV)
- ✅ **Feiertage-Import** (CSV)
- ✅ **Ist-Stunden-Import** (CSV)
- ✅ **Soll-Stunden-Import** (CSV)
- ✅ **Urlaubsanspruch-Import** (CSV)
- ✅ **Gruppen-Import** (CSV)

### 🔧 System & Administration
- ✅ **Aktivitätsprotokoll** *(neu)* — Vollständige Änderungshistorie aller API-Aktionen (Erstellt/Geändert/Gelöscht) mit Filtern nach Datum, Benutzer, Aktion, Objekt
- ✅ **Benutzerverwaltung** — Rollen, Passwort-Änderung, gruppen- und mitarbeiterbezogene Zugriffsrechte
- ✅ **Backup & Restore** — ZIP-Backup aller DBF-Dateien inkl. Wiederherstellung
- ✅ **Abrechnungszeiträume** — Perioden definieren und verwalten
- ✅ **Einstellungen** — Systemkonfiguration (USETT)
- ✅ **DB-Komprimierung** — Gelöschte Datensätze aus DBF-Dateien entfernen
- ✅ **Mobile-freundlich** — Responsive Design mit Hamburger-Menü

---

## Kompatibilität

| Eigenschaft | Original SP5 | OpenSchichtplaner5 |
|-------------|:-----------:|:-----------------:|
| Betriebssystem | Windows only | 🌐 Plattformunabhängig |
| Oberfläche | Desktop-App | 🖥️ Moderner Browser |
| Datenbankformat | DBF/FoxPro | ✅ DBF/FoxPro (kompatibel) |
| Parallelbetrieb | — | ✅ Beide laufen gleichzeitig |
| Lizenz | Proprietär | ✅ Open Source (MIT) |
| Kosten | Kostenpflichtig | ✅ Kostenlos |

> 💡 OpenSchichtplaner5 und das Original Schichtplaner5 greifen auf **dieselben Datenbankdateien** zu. Kein Export, kein Import, keine Migration.

---

## Installation

### Voraussetzungen

- Python 3.8+
- Node.js 18+
- Zugriff auf den SP5-Datenordner (`.DBF`-Dateien)

### Backend starten

```bash
cd backend
pip install -r requirements.txt
SP5_DB_PATH=/pfad/zu/sp5/Daten uvicorn api.main:app --host 0.0.0.0 --port 8000
```

### Frontend starten

```bash
cd frontend
npm install
npm run dev
```

Öffne dann [`http://localhost:5173`](http://localhost:5173) im Browser.

### Hintergrundbetrieb (Linux)

```bash
# Backend
nohup sh -c 'SP5_DB_PATH=/pfad/zu/Daten uvicorn api.main:app --host 0.0.0.0 --port 8000' \
  > /tmp/sp5-backend.log 2>&1 &

# Frontend (Produktion)
cd frontend && npm run build
nohup npx serve dist -p 5173 > /tmp/sp5-frontend.log 2>&1 &
```

---

## Projektstruktur

```
openschichtplaner5/
├── backend/
│   ├── api/
│   │   └── main.py          # FastAPI REST API (80+ Endpunkte)
│   ├── data/
│   │   └── changelog.json   # Aktivitätsprotokoll
│   └── sp5lib/
│       ├── dbf_reader.py    # DBF/FoxPro Reader (UTF-16 LE)
│       ├── dbf_writer.py    # DBF Writer (append/update/delete)
│       ├── database.py      # High-level DB access (40+ Methoden)
│       └── color_utils.py   # BGR→RGB Farbkonvertierung
├── frontend/
│   └── src/
│       ├── App.tsx           # Navigation & Layout (31 Seiten)
│       ├── api/client.ts     # Typisierter API-Client
│       └── pages/            # Alle Seitenkomponenten
└── docs/
    └── screenshots/          # App-Screenshots (30 Seiten)
```

---

## Tech Stack

| Bereich | Technologie |
|---------|-------------|
| Backend | Python, FastAPI, Uvicorn |
| Datenbank | DBF/FoxPro (direkt, kein ORM) |
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS |
| API | REST (OpenAPI / Swagger unter `/docs`) |

---

## Dokumentation

📖 **[GitHub Wiki](https://github.com/mschabhuettl/openschichtplaner5/wiki)** — vollständige Dokumentation orientiert am Original-Schichtplaner5-Handbuch

---

## CHANGELOG

### [Unreleased] — 2026-02-22
#### Neu
- **Suche & Sortierung im Dienstplan** (Block 2.6): Ctrl+F-Shortcut, Kürzel/Nummer-Suche, Sortier-Dropdown (Name A-Z/Z-A, Nummer ↑↓)
- **Sortierbare Spaltenköpfe** in Mitarbeiter- und Gruppen-Seite mit ↑↓-Pfeilicons
- **Aktivitätsprotokoll** (Block 3.4): Automatische Protokollierung aller API-Mutationen (POST/PUT/DELETE), Filter nach Aktion/Objekt/Benutzer/Datum, Farbkodierung
- **Überstunden-Seite** (Block 3.5): Soll/Ist/Delta-Übersicht mit Balken-Visualisierung, Jahr- und Gruppenfilter, Summenzeile

### 2026-02-22 (d213eb4)
#### Neu
- 14 neue Report-Typen (Schichtbericht, Zeitkonto-Bericht, Personalbedarf, Abwesenheits-Timeline, …)
- 6 neue Import-Typen (Ist-Stunden, Soll-Stunden, Urlaubsanspruch, Abwesenheiten, Gruppen, Feiertage)
- Berichte-Seite komplett überarbeitet

### 2026-02-21 (2f36238)
#### Neu
- Wochentags-spezifische Schichtzeiten (Montag bis Sonntag unterschiedlich)
- Foto-Upload für Mitarbeiter
- Urlaubsantrag-Druckansicht
- Passwort-Ändern in Benutzerverwaltung
- Anonyme/verdeckte Abwesenheiten

### 2026-02-20 (bf18a0f)
#### Neu
- Feiertage-Import (CSV)
- Maximalbedarf (MAX) in Personalbedarf-Planung
- Saldo-Übertrag (Jahresabschluss → nächstes Jahr buchen)

---

## Lizenz

MIT © [mschabhuettl](https://github.com/mschabhuettl)
