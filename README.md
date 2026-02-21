# OpenSchichtplaner5

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![Node 18+](https://img.shields.io/badge/node-18+-green.svg)](https://nodejs.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688.svg)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18+-61DAFB.svg)](https://react.dev)

**Open-source replacement for Schichtplaner5** — a Windows shift planning application used in healthcare and care facilities. Reads and writes the original FoxPro/DBF database files directly, so it runs side-by-side with the original software without any data migration.

![Dienstplan Screenshot](docs/screenshots/dienstplan.png)

---

## ✨ Features

### 📅 Shift Planning (Dienstplan)
- **Monthly shift grid** with all employees and all days in view
- **Drag & drop** shift assignment — move shifts between employees and days
- **Keyboard shortcuts** for efficient scheduling
- **Undo/Redo** support (Ctrl+Z / Ctrl+Y)
- **Auto-plan** from shift cycle templates (Schichtmodelle)
- **Conflict detection** — automatic detection of double bookings, staffing violations, and restrictions
- **Bulk operations** — assign shifts to multiple employees at once
- **Notes** per day/employee with visual indicators in the grid

### 📋 Deployment View (Einsatzplan)
- **Day/week deployment view** showing who works which shift
- **Print support** — exports as landscape PDF
- Clear overview of daily staffing levels

### 📆 Annual Overview (Jahresübersicht)
- **Employee × 12-month grid** — see the whole year at a glance
- Toggle between shifts, hours, vacation, or absences view
- Instant identification of understaffed periods

### 📊 Dashboard
- **KPI cards** — active employees, planned shifts, open conflicts, absences today
- **Today's shifts** at a glance
- **Conflict overview** with quick navigation
- **Upcoming absences** widget
- **Monthly statistics** summary

### 📈 Statistics & Time Tracking
- **Soll/Ist/Überstunden** tracking per employee and period
- **Accounting periods** (Perioden) with flexible date ranges
- **Booking entries** (Kontobuchungen) for detailed time accounting
- **Annual closing** (Jahresabschluss) for vacation carry-overs

### 👥 Master Data (Stammdaten)
Full CRUD management for all reference data:
- **Employees** (Mitarbeiter) — personal data, work hours, group assignment
- **Groups** (Gruppen) — organizational structure
- **Shift types** (Schichtarten) — names, abbreviations, colors, times, calculation bases
- **Leave types** (Abwesenheitsarten) — vacation, sick, training, etc.
- **Holidays** (Feiertage) — per year and region
- **Workplaces** (Arbeitsplätze) — locations and departments
- **Extra charges** (Zeitzuschläge) — night, weekend, holiday surcharges
- **Shift cycles** (Schichtmodelle) — rotating schedule templates

### 🏖️ Vacation & Absences
- **Leave entitlements** — annual vacation days per employee
- **Lock periods** — block vacation during critical periods
- **Year-end closing** — automatic carry-over calculation

### 💾 Backup & Restore
- **ZIP download** of the full database directory
- **ZIP upload restore** — one-click database restore
- Works directly with the `.DBF` files

### 🔐 User Management
- **Multi-user support** with individual login credentials
- **Permission levels** — read/write access per employee and group
- Secure session management

### 📱 Mobile-Ready
- **Responsive layout** with hamburger menu + drawer navigation
- Works on tablets and smartphones

### 🔧 Additional Tools
- **CSV Export** for all main views
- **CSV Import** for employees, shifts, and absences
- **Print reports** (landscape PDF) for all main views
- **Notes** per day/employee
- **Staffing requirements** (Personalbedarf) definition
- **Anonymization** mode for privacy

---

## 📸 Screenshots

| | |
|---|---|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Dienstplan](docs/screenshots/dienstplan.png) |
| *Dashboard — KPIs, heutige Belegung, Konflikte* | *Dienstplan — Monatsansicht mit Schichtzuweisung* |
| ![Einsatzplan](docs/screenshots/einsatzplan.png) | ![Jahresübersicht](docs/screenshots/jahresuebersicht.png) |
| *Einsatzplan — Wochenansicht nach Schichten* | *Jahresübersicht — Mitarbeiter × 12 Monate* |
| ![Mitarbeiter](docs/screenshots/mitarbeiter.png) | ![Statistiken](docs/screenshots/statistiken.png) |
| *Mitarbeiterverwaltung — Stammdaten* | *Statistiken — Soll/Ist-Vergleich & Zeitkonto* |

![Backup](docs/screenshots/backup.png)
*Backup & Restore — Datenbanksicherung per ZIP-Download*

---

## 🚀 Quick Start

### Prerequisites

- **Python 3.11+**
- **Node.js 18+**
- Original **Schichtplaner5 database files** (`.DBF` + `.CDX` files from the `Daten/` directory)

### 1. Clone the repository

```bash
git clone https://github.com/mschabhuettl/openschichtplaner5.git
cd openschichtplaner5
```

### 2. Start the Backend

```bash
cd backend
pip install -r requirements.txt

SP5_DB_PATH=/path/to/your/sp5/Daten \
  uvicorn api.main:app --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`.  
Interactive API docs: `http://localhost:8000/docs`

### 3. Start the Frontend

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

Open **[http://localhost:5173](http://localhost:5173)** in your browser.

### Quick Start Script

A convenience script is provided:

```bash
SP5_DB_PATH=/path/to/your/sp5/Daten ./start.sh
```

---

## 🏗️ Architecture

```
openschichtplaner5/
├── backend/
│   ├── api/
│   │   └── main.py              # FastAPI REST API (~2800 lines)
│   │                            # Endpoints for all entities: employees, shifts,
│   │                            # absences, groups, statistics, backup, ...
│   └── sp5lib/
│       ├── dbf_reader.py        # Pure-Python DBF/FoxPro reader (UTF-16 LE support)
│       ├── dbf_writer.py        # DBF write support (append, update, soft-delete)
│       ├── database.py          # High-level DB access + business logic
│       └── color_utils.py       # BGR→RGB color conversion (FoxPro color format)
└── frontend/
    ├── src/
    │   ├── pages/               # 25 React pages (~16 000 lines TypeScript)
    │   │   ├── Schedule.tsx     # Dienstplan (monthly grid)
    │   │   ├── Dashboard.tsx    # Dashboard with KPIs
    │   │   ├── Einsatzplan.tsx  # Weekly deployment view
    │   │   ├── Jahresuebersicht.tsx  # Annual overview
    │   │   ├── Statistiken.tsx  # Statistics & time tracking
    │   │   ├── Employees.tsx    # Employee management
    │   │   ├── Backup.tsx       # Backup/Restore
    │   │   └── ...              # 18 more pages
    │   ├── api/client.ts        # Typed API client (auto-generated types)
    │   └── components/          # Shared UI components
    └── ...                      # Vite + React + TypeScript + Tailwind CSS
```

### Key Design Decisions

**Direct DBF access:** The app reads and writes the original `.DBF` files directly using a pure-Python implementation. CDX index files are intentionally left untouched — Schichtplaner5 rebuilds them on next start. This allows both applications to run **side-by-side without any data migration**.

**Pure Python DBF library:** No external DBF library is used. The custom reader/writer handles the UTF-16 LE encoding used by Schichtplaner5's FoxPro database, which standard DBF libraries do not support correctly.

**REST + React SPA:** Clean separation between backend (FastAPI) and frontend (React/TypeScript). The frontend communicates exclusively via the REST API, making it easy to replace either side.

---

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SP5_DB_PATH` | `../sp5_db/Daten` | Path to the directory containing the `.DBF` files |

### Backend Options

```bash
# Development (with auto-reload)
SP5_DB_PATH=/path/to/Daten uvicorn api.main:app --reload --port 8000

# Production (with multiple workers)
SP5_DB_PATH=/path/to/Daten uvicorn api.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Frontend Options

```bash
# Development server (with HMR)
npm run dev -- --host 0.0.0.0 --port 5173

# Production build
npm run build
npm run preview
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.11+ · FastAPI · Pydantic v2 |
| **Database** | FoxPro `.DBF` files (original Schichtplaner5 format) |
| **Frontend** | React 18 · TypeScript · Vite |
| **Styling** | Tailwind CSS |
| **API Docs** | OpenAPI (Swagger) via FastAPI |

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'feat: add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

**Areas where contributions are especially welcome:**
- Additional language support (currently German/Austrian)
- Mobile UI improvements
- Report templates
- Performance optimizations for large databases
- Additional export formats

---

## 📚 Documentation

Full documentation is available in the [GitHub Wiki](https://github.com/mschabhuettl/openschichtplaner5/wiki):

- [Installation](https://github.com/mschabhuettl/openschichtplaner5/wiki/Installation)
- [Dienstplan — Schichten planen](https://github.com/mschabhuettl/openschichtplaner5/wiki/Dienstplan)
- [Stammdaten verwalten](https://github.com/mschabhuettl/openschichtplaner5/wiki/Stammdaten)
- [Urlaub & Abwesenheiten](https://github.com/mschabhuettl/openschichtplaner5/wiki/Urlaub-und-Abwesenheiten)
- [Statistiken & Zeitkonto](https://github.com/mschabhuettl/openschichtplaner5/wiki/Zeitkonto-und-Statistiken)
- [Export & Import](https://github.com/mschabhuettl/openschichtplaner5/wiki/Export-und-Import)
- [Datenbankformat (DBF)](https://github.com/mschabhuettl/openschichtplaner5/wiki/Datenbank)

---

## 📄 License

MIT — do whatever you want, but attribution is appreciated.

---

*Built as a drop-in open-source replacement for the proprietary Windows application Schichtplaner5. All DBF file format knowledge was obtained by reverse engineering and documentation research. This project is not affiliated with the original Schichtplaner5 software or its developers.*
