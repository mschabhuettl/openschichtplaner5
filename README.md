# OpenSchichtplaner5

**Open-source replacement for the Windows shift planning software Schichtplaner5.**

Read and write the original `.DBF` / FoxPro database files — run it alongside the original software, all changes are instantly visible to both sides.

---

## Features

- 📅 **Dienstplan** — Monthly shift grid with drag & drop, keyboard shortcuts, undo/redo, conflict detection, bulk operations, auto-plan from shift cycles
- 📋 **Einsatzplan** — Day/week deployment view with print support (landscape PDF)
- 📊 **Jahresübersicht** — Employee × 12-months overview
- 📈 **Statistiken & Zeitkonto** — Soll/Ist/Überstunden tracking, accounting periods, bookings
- 👥 **Stammdaten** — Full CRUD for employees, groups, shifts, leave types, holidays, workplaces, extra charges, shift cycles
- 🏖️ **Urlaub & Abwesenheiten** — Entitlements, lock periods, year-end closing, leave balances
- 🔔 **Konflikterkennung** — Automatic detection of scheduling conflicts (double bookings, restrictions, etc.)
- 🖨️ **Berichte & Export** — Print reports for all main views (landscape), CSV export, Stunden-Auswertung
- 💾 **Backup/Restore** — ZIP download/upload of the full database
- 📥 **Import** — CSV import for employees, shifts and absences
- 👤 **Benutzerverwaltung** — Multi-user with read/write permissions per employee and group
- 📝 **Notizen** — Notes per day/employee, indicators in the shift grid
- 📱 **Mobile-Ready** — Responsive layout with hamburger menu + drawer navigation
- ⚙️ **Einstellungen** — App settings, anonymization, special staffing requirements

---

## Architecture

```
openschichtplaner5/
├── backend/
│   ├── api/main.py          # FastAPI REST API (~2800 lines)
│   └── sp5lib/
│       ├── dbf_reader.py    # Pure-Python DBF/FoxPro reader (UTF-16 LE)
│       ├── dbf_writer.py    # DBF write support (append, update, delete)
│       ├── database.py      # High-level DB access + business logic
│       └── color_utils.py   # BGR→RGB color conversion
└── frontend/
    ├── src/
    │   ├── pages/           # 25 React pages (~16k lines TypeScript)
    │   └── lib/client.ts    # Typed API client
    └── ...                  # Vite + React + TypeScript + Tailwind CSS
```

**Key design decision:** The app reads and writes the original `.DBF` files directly. CDX index files are intentionally left untouched — Schichtplaner5 rebuilds them on next start. This allows both applications to run side-by-side.

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- Original Schichtplaner5 database files (`.DBF`)

### Backend

```bash
cd backend
pip install -r requirements.txt

SP5_DB_PATH=/path/to/sp5/Daten \
  uvicorn api.main:app --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

Then open [http://localhost:5173](http://localhost:5173).

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SP5_DB_PATH` | `../sp5_db/Daten` | Path to the `.DBF` database directory |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python · FastAPI · pure-Python DBF reader/writer |
| Frontend | React · TypeScript · Vite · Tailwind CSS |
| Database | FoxPro `.DBF` files (original Schichtplaner5 format) |

---

## License

MIT — do whatever you want, but attribution is appreciated.

---

*Built as a drop-in open-source replacement for the proprietary Windows application Schichtplaner5.*
