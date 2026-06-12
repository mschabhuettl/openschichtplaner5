# Releases

Releases laufen zweistufig: `prepare-release.yml` setzt Version und CHANGELOG
und pusht das annotierte Tag; das tag-getriebene `release.yml` übernimmt das
Publish (Docker-Image nach GHCR + GitHub-Release).

## Ablauf

1. **Änderungen pflegen:** Jede release-relevante Änderung unter
   `## [Unreleased]` in `CHANGELOG.md` dokumentieren. Der Release-Workflow
   bricht ab, wenn die Sektion fehlt oder leer ist.

2. **Trockenlauf prüfen:**

   ```bash
   gh workflow run prepare-release.yml -f bump=minor -f dry_run=true
   ```

   `bump`: `patch`/`minor`/`major`; alternativ `-f version=X.Y.Z` (hat
   Vorrang). Das Step-Summary zeigt geplante Version, Changelog-Auszug und
   `git diff` — es wird nichts gepusht.

3. **Release ausführen:**

   ```bash
   gh workflow run prepare-release.yml -f bump=minor -f dry_run=false
   ```

   Der Workflow committet Version (`frontend/package.json` + Lockfile,
   README-Badge) + CHANGELOG auf `main`, pusht das annotierte Tag `vX.Y.Z`
   und stößt `release.yml` auf dem Tag-Ref an.

4. **Publish (automatisch):** `release.yml` testet, baut das
   Multi-Arch-Docker-Image, pusht es nach GHCR und legt das GitHub-Release
   mit dem Changelog-Auszug an.

5. **Eingehende Pins:** erscheinen neue Versionen von `libopenschichtplaner5`
   oder `openschichtplaner5-api` auf PyPI, zieht `update-pins.yml` die Pins
   in Dockerfile/Compose täglich automatisch nach. Direkt nach einem Release
   manuell anstoßen — `expected_lib`/`expected_api` warten die
   PyPI-CDN-Propagation ab:

   ```bash
   gh workflow run update-pins.yml -f expected_lib=X.Y.Z -f expected_api=X.Y.Z
   ```
