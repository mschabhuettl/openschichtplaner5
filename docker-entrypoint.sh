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
# ==============================================================================
set -e

DATA_DIR="${SP5_DB_PATH:-/app/data}"

if [ "$(id -u)" = "0" ]; then
  uid="$(stat -c '%u' "$DATA_DIR" 2>/dev/null || echo 1001)"
  gid="$(stat -c '%g' "$DATA_DIR" 2>/dev/null || echo 1001)"
  if [ "$uid" = "0" ]; then uid=1001; gid=1001; fi
  for d in "$DATA_DIR" /app/backend/data /app/backend/api /app/backend/backups /app/logs; do
    [ -d "$d" ] && chown -R "$uid:$gid" "$d" 2>/dev/null || true
  done
  exec gosu "$uid:$gid" "$@"
fi

exec "$@"
