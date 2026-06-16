# Releases

Releases laufen zweistufig: `prepare-release.yml` setzt Version und CHANGELOG
und pusht das annotierte Tag; das tag-getriebene `release.yml` veröffentlicht
**ein Tag auf alle Kanäle**:

| Kanal | Inhalt |
|---|---|
| **ghcr.io** | das App-Image (SPA + API in einem Container), multi-arch (amd64+arm64), Tags volle Version / Minor / `latest` |
| **GitHub-Release** | Body = die geschnittene CHANGELOG-Sektion; Assets = SBOM + Stack-Compose |

Zusätzlich verpflichtend und automatisch: **Build-Provenance-Attestation**
(`actions/attest-build-provenance`) für das Image sowie ein **SPDX-SBOM** je
Image (`anchore/sbom-action`) als Release-Asset und als SBOM-Attestation
(`actions/attest-sbom`). Verifizierbar mit
`gh attestation verify oci://ghcr.io/mschabhuettl/openschichtplaner5:<ver> --owner mschabhuettl`.

Optional (ohne neue Secrets, Default aus): **cosign keyless** (OIDC) — per
Repo-Variable `ENABLE_COSIGN=true` einschalten
(`gh variable set ENABLE_COSIGN -b true`). Begründung: die verpflichtende
Build-Provenance ist bereits Sigstore-keyless signiert; cosign ist optionales
Opt-in.

> Die App bezieht `libopenschichtplaner5`/`openschichtplaner5-api` weiterhin als
> PyPI-Pakete über die Build-Args `LIB_SOURCE`/`API_SOURCE`; `update-pins.yml`
> zieht deren Pins nach. Die ghcr-Images von lib/api sind eigenständige
> Nutz-Artefakte und **nicht** die Build-Quelle dieses Images.

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
   Multi-Arch-Docker-Image, pusht es nach **GHCR** (Tags Version/Minor/`latest`)
   und legt das **GitHub-Release** mit dem Changelog-Auszug sowie SBOM und
   Stack-Compose als Assets an — inkl. Attestation + SBOM (s. o.).

5. **Eingehende Pins:** erscheinen neue Versionen von `libopenschichtplaner5`
   oder `openschichtplaner5-api` auf PyPI, zieht `update-pins.yml` die Pins
   in Dockerfile/Compose täglich automatisch nach. Direkt nach einem Release
   manuell anstoßen — `expected_lib`/`expected_api` warten die
   PyPI-CDN-Propagation ab:

   ```bash
   gh workflow run update-pins.yml -f expected_lib=X.Y.Z -f expected_api=X.Y.Z
   ```
