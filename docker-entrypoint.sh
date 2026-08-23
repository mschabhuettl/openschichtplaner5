#!/bin/sh
# ==============================================================================
# OpenSchichtplaner5 (All-in-One: SPA + API) — Entrypoint
#
# Behebt die häufigste Betriebsursache für „Interner Serverfehler" beim Speichern:
# ein vom Host gemountetes DBF-Daten-Verzeichnis gehört dem Host-Benutzer, der
# Container läuft aber als anderer (non-root) Benutzer → Schreibzugriffe scheitern
# (EACCES).
#
# Startet der Container als root (Standard), läuft die App anschließend als
# *Eigentümer des Daten-Verzeichnisses* — so kann sie die bind-gemounteten
# DBF-Dateien schreiben, OHNE deren Host-Eigentümer zu ändern. Die mutablen
# State-/Log-Verzeichnisse werden auf denselben Benutzer angeglichen. Wird der
# Container bereits als non-root gestartet (z. B. `--user`), startet die App direkt.
#
# SP5_DEMO_SEED=1: Ist das Daten-Verzeichnis LEER (kein 5EMPL.DBF), wird es vor
# dem Serverstart mit einer rein synthetischen Demo-Datenbank befüllt (Fixtures
# + SP5_DEMO_EMPLOYEES Mitarbeiter, SP5_DEMO_MONTHS Monate Dienstplan). Ein
# bereits befülltes Verzeichnis wird NIE angetastet; ein erfolgreicher Seed
# hinterlässt die Marker-Datei .demo-seeded. Schlägt der Seed fehl, wird der
# halbe Stand entfernt und der Container-Start abgebrochen.
# ==============================================================================
set -e

DATA_DIR="${SP5_DB_PATH:-/app/data}"

# Führt seine Argumente als $run_user aus (root-Start), sonst direkt.
run_as_app() {
  if [ -n "$run_user" ]; then
    gosu "$run_user" "$@"
  else
    "$@"
  fi
}

demo_seed_if_empty() {
  case "$(printf '%s' "${SP5_DEMO_SEED:-}" | tr '[:upper:]' '[:lower:]')" in
    1|true|yes|on) ;;
    *) return 0 ;;
  esac
  if [ -f "$DATA_DIR/.demo-seeded" ]; then
    echo "[demo-seed] Marker .demo-seeded vorhanden — Seed übersprungen"
    return 0
  fi
  if [ -f "$DATA_DIR/5EMPL.DBF" ]; then
    echo "[demo-seed] Daten-Verzeichnis enthält bereits eine Datenbank — Seed übersprungen (Schutz echter Daten)"
    return 0
  fi
  demo_employees="${SP5_DEMO_EMPLOYEES:-120}"
  demo_months="${SP5_DEMO_MONTHS:-13}"
  echo "[demo-seed] Befülle $DATA_DIR mit synthetischer Demo-Datenbank (${demo_employees} MA, ${demo_months} Monate)..."
  if ! (
    set -e
    run_as_app cp -a /app/backend/fixtures/. "$DATA_DIR"/
    run_as_app python /app/scripts/seed_demo_data.py --db "$DATA_DIR" \
      --employees "$demo_employees" --months "$demo_months"
    run_as_app python /app/scripts/generate_demo_schedule.py "$DATA_DIR" \
      --months "$demo_months"
  ); then
    echo "[demo-seed] FEHLER — entferne unvollständigen Seed-Stand und breche den Start ab" >&2
    rm -f "$DATA_DIR"/5* "$DATA_DIR"/wishes.json
    exit 1
  fi
  run_as_app touch "$DATA_DIR/.demo-seeded"
  echo "[demo-seed] Demo-Datenbank fertig geseedet"
}

run_user=""
if [ "$(id -u)" = "0" ]; then
  uid="$(stat -c '%u' "$DATA_DIR" 2>/dev/null || echo 1001)"
  gid="$(stat -c '%g' "$DATA_DIR" 2>/dev/null || echo 1001)"
  if [ "$uid" = "0" ]; then uid=1001; gid=1001; fi
  for d in "$DATA_DIR" /app/backend/data /app/backend/api /app/backend/backups /app/logs; do
    [ -d "$d" ] && chown -R "$uid:$gid" "$d" 2>/dev/null || true
  done
  run_user="$uid:$gid"
  demo_seed_if_empty
  exec gosu "$run_user" "$@"
fi

demo_seed_if_empty
exec "$@"
