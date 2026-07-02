# ADR 0003 — SSO über OpenID Connect (Design-Vorschlag, nicht umgesetzt)

- **Status:** Proposed (nur Design; Umsetzung erst bei konkretem Bedarf)
- **Date:** 2026-07-02
- **Scope:** Docs-only.

---

## Ziel

Anmeldung über einen bestehenden Identitätsanbieter (Keycloak, Entra ID,
Authentik, …) per OIDC Authorization-Code-Flow — zusätzlich zum lokalen
5USER-Login, nicht als Ersatz.

## Abgrenzung

- **Optional und standardmäßig AUS**: ohne `SP5_OIDC_ISSUER` ändert sich nichts;
  der lokale Login (5USER.DIGEST, Multi-Encoding-Verify) bleibt der Default und
  der Rückfallweg.
- **Kein User-Provisioning aus dem IdP:** ein OIDC-Login wird über ein
  Mapping-Attribut (bevorzugt `preferred_username` ↔ 5USER.NAME) einem
  **vorhandenen** 5USER-Konto zugeordnet; unbekannte Nutzer werden abgewiesen.
  Rollen/Rechte bleiben ausschließlich in 5USER (RIGHTS/Modus, P0-2-Semantik) —
  keine zweite Rechtequelle.
- Session-Handling bleibt UNVERÄNDERT: nach erfolgreichem OIDC-Callback wird
  dieselbe HttpOnly-Cookie-Session erzeugt wie beim lokalen Login
  (`_session_store`); Logout invalidiert nur die lokale Session (kein
  IdP-Single-Logout in v1).

## Design-Skizze

1. **Endpunkte:** `GET /api/auth/oidc/login` (Redirect mit state+PKCE) und
   `GET /api/auth/oidc/callback` (Code-Tausch, ID-Token-Validierung via
   Issuer-JWKS, Mapping auf 5USER, Session + Cookie wie `login()`).
2. **Konfiguration:** `SP5_OIDC_ISSUER`, `SP5_OIDC_CLIENT_ID`,
   `SP5_OIDC_CLIENT_SECRET`, optional `SP5_OIDC_USERNAME_CLAIM`
   (Default `preferred_username`).
3. **Frontend:** Login-Seite zeigt zusätzlich „Mit SSO anmelden", wenn
   `GET /api/auth/oidc/enabled` true liefert; sonst unverändert.
4. **Abhängigkeit:** eine schlanke OIDC-Client-Bibliothek (z. B. `authlib`) —
   als Extra (`openschichtplaner5-api[oidc]`), damit der Default-Install
   abhängigkeitsfrei bleibt.
5. **Tests:** Callback-Validierung gegen einen lokalen Fake-IdP (signierte
   Tokens), Mapping-Abweisung unbekannter Nutzer, Read-only-Semantik der
   gemappten Leser-Konten (P0-2-Regression).

## Risiken / Abhängigkeiten

- **Sicherheits-Overhead:** Token-Validierung (Signatur, aud, exp, nonce) muss
  vollständig sein — deshalb Bibliothek statt Eigenbau.
- **Betrieb:** Uhrzeit-Drift und Issuer-Erreichbarkeit werden zu
  Login-Abhängigkeiten; der lokale Login bleibt deshalb immer aktiv.
- **Original-Parität:** SP5 kennt kein SSO — reines Zusatz-Feature, das die
  5USER-Semantik nicht verändert.

## Entscheidung

Vorgeschlagen, aber **nicht umgesetzt**: kein aktueller Bedarfsträger; die
Skizze hält den Eingriff klein (ein Router-Modul + Extra-Dependency,
Session-Layer unangetastet).
