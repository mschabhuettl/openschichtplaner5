# PostgreSQL Support

> 📖 Full documentation and guides: [GitHub Wiki](https://github.com/mschabhuettl/openschichtplaner5/wiki)

OpenSchichtplaner5 supports PostgreSQL as an alternative database backend alongside the legacy DBF files.

## Quick Start

### 1. Install PostgreSQL (if not already installed)

```bash
sudo apt install postgresql postgresql-client
```

### 2. Create Database

```bash
sudo -u postgres createuser sp5 --createdb
sudo -u postgres createdb sp5 -O sp5
sudo -u postgres psql -c "ALTER USER sp5 PASSWORD 'sp5';"
```

### 3. Configure Environment

```bash
# In your .env file or environment:
DB_BACKEND=postgresql
DATABASE_URL=postgresql://sp5:sp5@localhost:5432/sp5
```

### 4. Migrate Data from DBF

```bash
cd backend
DB_BACKEND=postgresql \
DATABASE_URL=postgresql://sp5:sp5@localhost:5432/sp5 \
SP5_DB_PATH=/path/to/sp5_db/Daten \
python3 -m scripts.seed_postgresql
```

### 5. Run with PostgreSQL

```bash
DB_BACKEND=postgresql \
DATABASE_URL=postgresql://sp5:sp5@localhost:5432/sp5 \
SP5_BACKEND_DIR="$(pwd)" \
python3 -m uvicorn sp5api.main:app --host 0.0.0.0 --port 8000
```

## Docker (Stack-Compose)

`docker-compose.stack.yml` ships an optional `postgres` profile that starts a
PostgreSQL 16 container alongside app and API (set `DB_BACKEND=postgresql` in
`.env`):

```bash
docker compose -f docker-compose.stack.yml --profile postgres up -d --build
```

The one-time DBF → PostgreSQL seed via the app image is documented in the
header comment of `docker-compose.stack.yml`.

## Configuration

| Environment Variable | Default | Description |
|---|---|---|
| `DB_BACKEND` | `dbf` | Database backend: `dbf` or `postgresql` |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `SP5_DB_PATH` | `../sp5_db/Daten` | Path to DBF files (for DBF backend) |

## Architecture

```
┌─────────────┐     ┌──────────────┐
│  API Layer  │────▶│  get_db()    │
│  (routers)  │     │  (factory)   │
└─────────────┘     └──────┬───────┘
                           │
                    ┌──────┴───────┐
                    │              │
              ┌─────▼─────┐ ┌─────▼──────┐
              │ SP5Database│ │SP5Postgres │
              │  (DBF)     │ │ Database   │
              └─────┬──────┘ └─────┬──────┘
                    │              │
              ┌─────▼─────┐ ┌─────▼──────┐
              │ .DBF files│ │ PostgreSQL │
              └───────────┘ └────────────┘
```

Both backends implement the same public API (method names and return formats),
so the API routers work identically regardless of backend.

## Alembic Migrations

For schema changes after initial setup:

```bash
# Generate a new migration
DATABASE_URL=postgresql://sp5:sp5@localhost:5432/sp5 \
python3 -m alembic revision --autogenerate -m "description"

# Apply migrations
DATABASE_URL=postgresql://sp5:sp5@localhost:5432/sp5 \
python3 -m alembic upgrade head
```

## Running Tests

The backend test suite lives in the
[openschichtplaner5-api](https://github.com/mschabhuettl/openschichtplaner5-api) repo:

```bash
cd ../openschichtplaner5-api
# PostgreSQL backend tests (uses SQLite in-memory, no PG required)
python3 -m pytest tests/test_postgresql_backend.py -v

# All tests (DBF backend remains default)
python3 -m pytest
```

## Notes

- **DBF remains the default backend.** PostgreSQL is opt-in via `DB_BACKEND=postgresql`.
- **Data is not synced** between backends. Choose one and stick with it.
- **The seed script is a one-time migration.** Run it once to copy DBF → PostgreSQL.
- **All JSON sidecar files** (wishes, swap requests, changelog, etc.) are stored in PostgreSQL tables when using the PG backend.
