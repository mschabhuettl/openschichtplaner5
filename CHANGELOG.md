# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.2.0] — 2026-02-28

### Hinzugefügt / Added

#### 🤖 Auto-Planer mit Restrictions & Optimierungs-Bericht (1e044ac)
- **Restrictions-aware Auto-Planer** — Automatische Schichtplanung respektiert Mitarbeiter-Einschränkungen (verbotene Schichten, Sperrtage, Wunsch-Schichten)
- **Optimierungs-Bericht** — Detaillierter Report nach Auto-Planung: welche Regeln angewandt, welche Konflikte aufgetreten, welche Alternativen gewählt

#### 📋 Bulk-Operationen (8282d44)
- **Massenbearbeitung** — Mehrere Schichten gleichzeitig setzen, löschen oder verschieben
- **Auswahl-Modus** — Checkboxen im Dienstplan für Mehrfachauswahl; Aktionsleiste erscheint bei aktiver Auswahl
- **Effizienter Workflow** — Ideal für wiederkehrende Planungsaufgaben über mehrere Mitarbeiter/Tage

#### 👤 Mitarbeiter Self-Service Portal (9e58ceb)
- **Leser-Rolle** — Neue Benutzerrolle mit eingeschränktem Zugriff auf eigene Daten
- **Mein Profil** — Mitarbeiter sehen eigene Schichten, Urlaubs-Saldo, Zeitkonto und Abwesenheiten
- **Schichtwünsche einreichen** — Self-Service Wunsch-/Sperrtag-Einreichung ohne Planer-Eingriff

#### 🔍 Command Palette / Schnellsuche (8819999)
- **`Ctrl+K` öffnet Palette** — Floating-Suchfeld mit Sofortnavigation zu allen Seiten und Aktionen
- **Fuzzy-Suche** — Findet Seiten, Mitarbeiter und Aktionen bei Tipp-Fehlern
- **Tastaturnavigation** — Pfeiltasten + Enter; `Esc` schließt Palette

#### 📡 SSE Echtzeit-Updates (52da614)
- **Server-Sent Events** — Browser empfängt Live-Updates ohne Polling
- **Dienstplan-Sync** — Änderungen anderer Planer erscheinen sofort bei allen offenen Clients
- **Verbindungs-Indicator** — Grüner/roter Punkt zeigt SSE-Verbindungsstatus an

#### 📲 Progressive Web App (PWA) Support (432012d)
- **Installierbar** — OpenSchichtplaner5 kann als App auf Desktop und Mobile installiert werden
- **Offline-Grundfunktion** — Service Worker ermöglicht eingeschränkten Betrieb ohne Netzwerk
- **App-Manifest** — Icons, Splash-Screen, Themecolor für nativen App-Look

#### 🌍 DE/EN Sprachumschalter (a759942)
- **Zweisprachige UI** — Komplette Benutzeroberfläche auf Deutsch und Englisch verfügbar
- **Sprachwahl persistent** — Einstellung wird im Browser gespeichert
- **Sprachumschalter** — DE/EN-Toggle in der Navigation

#### 🛡️ Security Hardening Round 3 (deacfbb)
- **Erweiterte CSP** — Content Security Policy weiter verschärft
- **Input-Sanitization** — Zusätzliche serverseitige Validierung aller Eingaben
- **Rate Limiting** — Login-Endpunkt und kritische API-Routen gegen Brute-Force geschützt

#### 📊 Qualifikations-/Kompetenz-Matrix (a5515bf)
- **Matrix-Ansicht** — Mitarbeiter × Qualifikationen als interaktive Tabelle
- **Gap-Analyse** — Fehlende Qualifikationen pro Stelle/Gruppe farblich markiert
- **Check-Modus** — Qualifikationsnachweise direkt in der Matrix abhaken

---

## [Unreleased] — 2026-02-28 (qa-pass-2)

### 🐛 Fixes
- **HealthDashboard Cache-Einträge** — Zeigt jetzt korrekte Anzahl (0) statt rohem `{}` JSON-Objekt

---

## [Unreleased] — 2026-02-28 (settings-monitoring-ui)

### ➕ Hinzugefügt / Added

#### ⚙️ Konfigurations-Management & App-Settings (68229d6)
- **Settings-Page `/einstellungen`** — Vollständige Einstellungsseite für Arbeitszeiten, Überstunden-Schwellenwerte, Anzeigeoptionen und Benachrichtigungen
- **Persistente Einstellungen** — Settings werden im Backend gespeichert und beim App-Start geladen
- **API `GET/PUT /api/settings`** — Settings-Endpunkt für Lesen und Aktualisieren

#### 📊 Error Monitoring & Structured JSON Logging (aa08496)
- **Frontend Error Boundary** — Globales Fehler-Capturing mit Stack-Trace und automatischem API-Report
- **Structured JSON Logging** — Backend-Logs im JSON-Format für einfache Auswertung und Log-Aggregation
- **Admin API `GET /api/admin/frontend-errors`** — Einsicht in alle gemeldeten Frontend-Fehler
- **Health-Dashboard** erweitert: zeigt Frontend-Fehler-Count und Backend-Fehler-Log

#### 🎨 UX Improvements Round 3 (87ce73d)
- **Extracharges-Page** — Zuschläge und Prämien-Verwaltung mit CRUD-Operationen
- **Jahresuebersicht verbessert** — Jahres-Kalender mit Feiertagen und Schicht-Übersicht
- **MeinProfil verfeinert** — Persönliche Profil-Ansicht mit Schicht-Historie und Saldo

#### 🧩 UI-Komponenten-Bibliothek (e0d8c5b)
- **StatCard** — Wiederverwendbare Statistik-Karte mit Trend-Indikator
- **Badge** — Status-Badges für Schichten, Rollen und Zustände
- **PageHeader** — Einheitlicher Seitenheader mit Titel, Untertitel und Aktions-Bereich
- **DataTable** — Sortierbare Datentabelle mit Pagination

---

## [Unreleased] — 2026-02-28 (full-feature-day)

### 🧹 Final Polish & Konsistenz-Check
- **Keyboard Shortcuts erweitert** — `g a` (Analytics), `g q` (Kompetenz-Matrix), `g t` (Tauschbörse) hinzugefügt; Shortcut-Modal aktualisiert
- **TauschBörse Datenfehler behoben** — Swap-Requests mit ungültigen Employee-IDs korrigiert; Backend-Fallback zeigt jetzt "Gelöschter MA (ID X)" statt "?"
- **Screenshots aller 12 Hauptseiten** — Playwright-Screenshots in docs/screenshots/ für Dokumentation
- **604 Backend-Tests bestehen** — Vollständige Test-Suite grün nach allen heutigen Feature-Implementierungen
- **Frontend-Build erfolgreich** — Production-Build kompiliert ohne Fehler (2.91s)

### Hinzugefügt / Added

#### 📊 Kapazitäts-Forecast: Wochentag-Analyse + Jahres-Heatmap (a5a264e)
- **Wochentag-Analyse-Tab** — Besetzungstrends nach Wochentag aggregiert; ideale Planungsgrundlage
- **Jahres-Heatmap-Tab** — Farbkodierter Jahresüberblick aller 365 Tage als Heatmap
- **API: `/api/capacity-year`** — Neuer Backend-Endpunkt liefert Jahres-Kapazitätsdaten pro Monat

#### 📁 Excel/XLSX Export (6dd0044)
- **Dienstplan als XLSX** — Vollständiger Monatsdienstplan als Excel-Datei exportierbar
- **Mitarbeiterliste als XLSX** — Stammdaten-Export in Excel-Format
- **Serverseiter Export** — Backend generiert echte XLSX-Dateien mit openpyxl; kein Client-Side-Workaround

#### 🔒 Security Hardening Round 2 (7706f1c)
- **Session-Invalidierung** — Logout invalidiert serverseitig gespeicherte Sessions
- **Content Security Policy (CSP)** — CSP-Header schützt vor XSS-Angriffen
- **Upload-Limit** — Maximale Request-Größe begrenzt
- **Audit Logging** — Sicherheitsrelevante Aktionen werden protokolliert

#### 📅 Wochenvorlagen im Dienstplan (c78f89f)
- **Vorlagen speichern** — Aktuelle Wochenbelegung als benannte Vorlage sichern
- **Vorlagen anwenden** — Gespeicherte Wochenvorlagen auf beliebige Wochen übertragen
- **Vorlagen-Verwaltung** — Vorlagen bearbeiten, umbenennen und löschen

#### 👥 Gruppen-Tab + Mitglieder-Verwaltung (00a1251)
- **Gruppen-Tab im MA-Modal** — Mitarbeiter direkt im Bearbeitungs-Dialog Gruppen zuweisen
- **Mitglieder-Verwaltung** — Gruppenmitglieder in der Gruppen-Verwaltung direkt hinzufügen/entfernen

#### ✨ Mitarbeiter-Hervorhebung & Vormonat kopieren (3e5280d)
- **MA-Hervorhebung im Dienstplan** — Klick auf Mitarbeiter hebt alle seine Schichten farblich hervor
- **Vormonat kopieren** — Kompletten Vormonat in den aktuellen Monat übertragen (mit Bestätigungs-Dialog)

#### 🔔 In-App Benachrichtigungs-System (92ea7eb)
- **Notification-Center** — Glocken-Symbol in der Navigation zeigt ungelesene Benachrichtigungen
- **Warnungs-Feed** — Überstunden, Konflikte, Abwesenheits-Überschreitungen als Benachrichtigungen
- **Aktivitäts-Log** — Letzte Aktionen (Schicht gesetzt, MA geändert etc.) im Notification-Panel
- **API: `/api/warnings`** — Backend-Endpunkt aggregiert aktive Warnungen mit Schweregrad

#### ⌨️ Keyboard Shortcuts (cd3bd84)
- **Globale Shortcuts** — Navigation per Tastatur durch alle Hauptbereiche
- **`?` öffnet Hilfe** — Tastaturkürzel-Overlay mit vollständiger Übersicht
- **Seiten-spezifische Shortcuts** — Kontextsensitive Kürzel je nach aktiver Seite

---

## [Unreleased] — 2026-02-28 (auth-fixes-and-improvements)

### Sicherheit / Security
- **Auth-Header-Fixes** — Fehlende Auth-Header in 6 Seiten-Komponenten nachgezogen (fetch-Aufrufe ohne Bearer-Token behoben)
- **Security Headers** — HTTP Security Headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy) im Backend aktiviert
- **Dev-Token-Schutz** — Dev-Mode-Token (`SP5_DEV_MODE=true`) wird nur noch im Entwicklungsmodus akzeptiert; automatisch gesperrt in Production
- **Auth-Lücken geschlossen** — Alle nicht-authentifizierten Endpunkte auditiert und abgesichert

### Hinzugefügt / Added

#### ⌨️ Keyboard Shortcuts & Schnellnavigation
- **Globale Tastaturkürzel** — Schnellnavigation durch die Anwendung per Tastatur
- **Shortcut-Overlay** — `?`-Taste öffnet Hilfe-Overlay mit allen verfügbaren Kürzeln
- **Seitenspezifische Shortcuts** — kontextsensitive Kurzbefehle je nach aktiver Seite

#### 🔍 Erweiterte Filter
- **Gruppenfilter Mitarbeiterliste** — Mitarbeiter nach Gruppe filtern; kombinierbar mit Textsuche
- **Volltextsuche Protokoll** — Freitext-Suche über alle Felder im Aktivitätsprotokoll

#### 📊 Dashboard-Verbesserungen
- **Besetzungs-Heatmap** — Kalender-Heatmap mit Farbkodierung des täglichen Besetzungsgrades direkt im Dashboard
- **Mitarbeiter-Ranking** — Top-Liste der meistbeschäftigten Mitarbeiter im aktuellen Monat

#### 🍞 Toast-Benachrichtigungen
- **Toast-System** — Nicht-blockierende Erfolgs-/Fehler-/Info-Meldungen nach Benutzeraktionen
- **Auto-Dismiss** — Toasts verschwinden automatisch nach konfigurierbarer Zeit

#### 📱 Mobile Responsiveness
- **Responsive Tabellen** — Alle Datentabellen scrollen horizontal auf kleinen Bildschirmen
- **Touch Targets** — Vergrößerte Klick-/Tipp-Bereiche für Buttons und Links auf mobilen Geräten

#### ⚡ Error Handling & Performance
- **Retry-Logik** — Fehlgeschlagene API-Anfragen werden automatisch bis zu 3× wiederholt
- **`useApiData` Hook** — Zentraler React-Hook für datenabruf mit Loading/Error-State, Retry und Caching
- **EmptyState / ApiErrorState** — Einheitliche UI-Komponenten für leere Zustände und API-Fehler
- **API-Cache für Stammdaten** — Häufig abgerufene Stammdaten (Gruppen, MA, Schichtarten) werden gecacht; reduziert Serverlast erheblich
- **Datumsformat-Konsistenz** — Einheitliches ISO-8601-Format (`YYYY-MM-DD`) in allen API-Responses

### Behoben / Fixed
- **Login-Redirect** — Nach erfolgreichem Login wird nun korrekt zur ursprünglich angeforderten Seite weitergeleitet
- **Konflikte KPI** — Korrekte Berechnung und Anzeige der Konflikt-Kennzahlen
- **Schichtwünsche-Typfilter** — Filter nach Wunschtyp (Frei, Schicht, Urlaub …) in der Schichtwunsch-Übersicht funktioniert wieder zuverlässig

---

## [Unreleased] — 2026-02-27 (security-hardening)

### Security & Quality

#### 🔒 Security Hardening
- **Token Expiry (8h)** — Session-Token laufen nach 8 Stunden ab; automatische Abmeldung im Frontend
- **Brute-Force Protection** — Login-Sperre nach 5 Fehlversuchen (15 Minuten Lockout) mit IP-Tracking
- **CORS Hardening** — Explizite Allowlist statt Wildcard; konfigurierbar via `ALLOWED_ORIGINS` in `.env`
- **RBAC vollständig** — Alle 80+ API-Endpunkte mit Rollen-Checks (Admin/Planer/Leser) abgesichert; HTTP 403 bei Verstoß
- **Rate Limiting** — Login-Endpoint: 5 Requests/Minute; globales Limit: 200 Requests/Minute via slowapi

#### 🧪 Test Suite
- **pytest Test Suite (551 Tests)** — Vollständige Backend-Abdeckung: API, RBAC, Business Logic, Error Paths, Write Paths, Schedule, Auth
- **Cache-Invalidierung** — Bugfix: `_read_cache` wird nach Schreiboperationen korrekt invalidiert
- **Rate-Limiter Reset in Tests** — autouse-Fixture verhindert Cross-Test-Pollution durch Rate-Limiter
- **HTTP Status Codes korrigiert** — Business-Validierungsfehler liefern 400 (statt 422) für konsistente API

#### 🛡️ Frontend
- **Error Boundaries** — React Error Boundaries auf allen Haupt-Routen; verhindert kompletten App-Crash bei Komponenten-Fehlern
- **Token-Expiry-Handling** — Frontend erkennt 401-Responses und leitet automatisch zur Login-Seite weiter

---

## [Unreleased] — 2026-02-27 (feature-36)

### Hinzugefügt / Added

#### 🔍 Audit-Log (`/auditlog`)
- **Neues Feature: Audit-Log / Change-History UI** — vollständige Änderungshistorie mit Statistik-Kacheln, Filter und Tabelle
- Zeigt alle Änderungen: CREATE / UPDATE / DELETE mit Zeitstempel, Benutzer, Objekt-Typ und Details
- Live-Filterung nach Aktion, Objekt-Typ, Benutzer und Datumsbereich
- Volltext-Suche über alle Felder
- Auto-Refresh alle 10 Sekunden (optional)
- Farbcodierte Aktions-Badges (grün/orange/rot), relative Zeitanzeige
- Nutzt bestehendes Backend `/api/changelog`

---

## [Unreleased] — 2026-02-27 (feature-35)

### Hinzugefügt / Added

#### 🧭 Onboarding-Wizard (`/onboarding`)
- **Neues Feature: Onboarding-Wizard** — geführter 4-Schritte-Flow zum Anlegen neuer Mitarbeiter
- **Schritt 1 – Persönliche Daten**: Nachname, Vorname, Kürzel (Auto-Generate), Personalnummer, Geschlecht, Funktion, E-Mail, Telefon, Geburtsdatum, Eintrittsdatum, Adresse
- **Schritt 2 – Arbeitszeitmodell**: Schnellwahl-Presets (Vollzeit, Teilzeit, 3-Tage, Wochenenddienst), interaktive Arbeitstage-Auswahl (Mo–So), automatische Stunden-Berechnung (Tag/Woche/Monat)
- **Schritt 3 – Gruppen**: Visuelle Gruppen-Karten mit Mitarbeiteranzahl, Mehrfach-Auswahl, nachträgliche Zuweisung möglich
- **Schritt 4 – Zusammenfassung**: Übersichtliche Review aller Eingaben vor dem Speichern
- **Erfolgsmeldung**: Nach Anlage direkt zum MA-Profil navigieren oder weiteren MA anlegen
- **Auto-Kürzel**: Wird automatisch aus Vor-/Nachname generiert (editierbar)
- **Sidebar-Eintrag** unter „Administration" (sichtbar für Admin + Planer)
- **Screenshots**: `docs/screenshots/onboarding-step*.png`

---

## [Unreleased] — 2026-02-27 (feature-34)

### Hinzugefügt / Added

#### 🔄 Schicht-Tauschbörse (`/tauschboerse`)
- **Neues Feature: Schicht-Tauschbörse** — strukturierter Workflow für Schichttausch-Anfragen zwischen Mitarbeitern
- **Anfrage stellen**: Antragsteller + Datum, Tauschpartner + Datum, Begründung auswählen
- **Planergenehmigung**: Ausstehende Anfragen mit einem Klick genehmigen (= Tausch wird sofort ausgeführt) oder ablehnen
- **Ablehnungsgrund**: Optionaler Freitext bei Ablehnung
- **Status-Tracking**: 4 Status-Stufen — Ausstehend / Genehmigt / Abgelehnt / Storniert
- **KPI-Kacheln**: Live-Übersicht Gesamt / Ausstehend / Genehmigt / Abgelehnt
- **Filter-Tabs**: Nach Status filtern
- **Schicht-Anzeige**: Aktuelle Schicht beider Beteiligten sichtbar (farbiger Badge)
- **Backend**: REST-API `/api/swap-requests` (GET/POST/PATCH/DELETE), JSON-Persistenz
- **Auto-Ausführung**: Bei Genehmigung wird `POST /api/schedule/swap` automatisch aufgerufen
- **Sidebar-Eintrag** unter „Abwesenheiten"

---

## [Unreleased] — 2026-02-27 (feature-33)

### Hinzugefügt / Added

#### 📋 Übergabe-Protokoll (`/uebergabe`)
- **Neues Feature: Digitales Schicht-Übergabe-System** — ausgehende Schicht schreibt strukturierte Notizen für die eingehende Schicht
- **Prioritäts-Stufen**: Normal 📝, Wichtig ⚠️, Kritisch 🚨 — farblich hervorgehoben
- **Schnell-Tags**: Maschine, Personal, Sicherheit, Qualität, Übergabe, Wartung, Kunde
- **Filter**: Nach Datum, Schicht und Status filtern
- **Erledigt-Markierung**: Notizen als erledigt abhaken, Wiedereröffnen möglich
- **Autor-Zuordnung**: Schichtleiter kann seinen Namen eintragen
- **Backend-Endpoints**: `GET/POST /api/handover`, `PATCH/DELETE /api/handover/{id}`

---

## [Unreleased] — 2026-02-27 (feature-32)

### Hinzugefügt / Added

#### 🧪 Schichtplan-Simulation (`/simulation`)
- **Neues Feature: „Was wäre wenn?"** — Szenarien für MA-Ausfälle testen
- **Szenario-Konfiguration**: Name vergeben, Monat/Jahr wählen, MA auswählen
- **Ausfall-Modi**: Ganzer Monat oder einzelne Tage pro Mitarbeiter auswählen
- **Simulation-Ergebnis**: Tagesweise Besetzung vor/nach dem Ausfall
- **Kalender-Ansicht**: Farbkodierte Monatsübersicht (🟢 OK / 🟡 Reduziert / 🔴 Kritisch)
- **KPI-Kacheln**: Kritische Tage, Reduzierte Tage, Verlorene Schichten, Normale Tage
- **Mitarbeiter-Auswirkung**: Anteil betroffener Schichten pro MA mit Fortschrittsbalken
- **Problematische Tage**: Auflistung aller Tage mit Besetzungsmangel
- **Tages-Detailansicht**: Modal mit fehlenden MA + anwesenden Kollegen als Einspringer-Kandidaten
- **Backend-Endpoint**: `POST /api/simulation` mit flexibler Absenz-Konfiguration

---

## [Unreleased] — 2026-02-26 (feature-24)

### Hinzugefügt / Added

#### 📋 Qualitätsbericht (`/qualitaets-bericht`)
- **Neuer Monatsabschluss-Check** — automatischer Qualitätsbericht für jeden Monat
- **Gesamtscore 0–100** mit Schulnoten-System: A (≥90) / B (≥75) / C (≥60) / D (<60)
- **4 Score-Ringe**: Gesamt, Besetzung (50%), Stunden (30%), Konflikte (20%)
- **Befunde-Panel** mit farbkodierten Meldungen (OK ✅ / Info ℹ️ / Warnung ⚠️ / Kritisch 🔴)
- **Stunden-Compliance-Tabelle**: Mitarbeiter mit >15% Überstunden oder starker Unterbeschäftigung
- **Tages-Besetzungskalender**: Heatmap aller Monatstage mit Status (OK/Knapp/Kritisch/Ungeplant/Wochenende)
- **KPI-Kacheln**: Soll-/Ist-Stunden, Mitarbeiter ohne/mit Abweichung
- **Gruppen-kompatibler Score** — dynamische Mindestbesetzung (1/8 der Belegschaft)
- **Neuer API-Endpunkt** `GET /api/quality-report?year=&month=` mit vollständigem Qualitätsbefund

---

## [Unreleased] — 2026-02-26 (feature-23)

### Hinzugefügt / Added

#### 📊 Kapazitäts-Forecast (`/kapazitaets-forecast`)
- **Neue Planungsseite** für monatliche Kapazitätsvorschau — kombiniert Dienstplan, Abwesenheiten & Mindestbesetzung
- **Monatskalender** mit farbkodierten Tages-Kacheln: Grün (gut besetzt), Gelb (knapp), Rot (kritisch), Grau (ungeplant)
- **Urlaubskonflikt-Erkennung**: automatische ⚠️ Warnung wenn >30% der Belegschaft gleichzeitig abwesend
- **4 KPI-Kacheln**: gut besetzte Tage, knappe Tage, kritische Tage, Urlaubskonflikte
- **Ø Tagesbesetzung** als Fortschrittsbalken (Ist-Besetzung vs. Gesamtteam)
- **Tag-Detail-Modal**: Klick auf Kalendertag zeigt exakte Besetzung, Abwesenheitsliste mit Abwesenheitstyp, Coverage-Balken
- **Handlungsbedarf-Panel**: alle Problem-Tage auf einen Blick mit Klick-Navigation zum Detail
- **Tagesbesetzungs-Balkenchart**: Top-20 geplante Tage als Mini-Balken zum Vergleich
- **Gruppenfilter**: Forecast für einzelne Teams/Gruppen einschränkbar
- **Neuer API-Endpunkt** `GET /api/capacity-forecast?year=&month=[&group_id=]` mit vollständiger Tages-Aggregation

---

## [Unreleased] — 2026-02-26 (feature-22)

### Hinzugefügt / Added

#### 🔄 Schicht-Rotations-Analyse (`/rotations-analyse`)
- **Neue Analyse-Seite** mit Shannon-Entropy-basiertem Rotations-Score (0–100) pro Mitarbeiter
- **Rotations-Score**: 100 = perfekte Gleichverteilung aller Schichten; 0 = immer dieselbe Schicht
- **4 KPI-Kacheln**: Analysierte MAs, Ø Score, Monoton (<40), Gut rotiert (≥70)
- **Zwei Ansichtsmodi**: Tabellen-Ansicht (detaillierte Matrix) & Balken-Ansicht (gestapelte Schicht-Balken pro MA)
- **Tabellen-Ansicht**: Schicht-Mini-Balken pro Zelle mit Farbkodierung aus Schichtdefinitionen
- **Balken-Ansicht**: Gestapelte Proportions-Balken mit Legende — sofortiger visueller Vergleich
- **Detail-Panel**: Klick auf MA zeigt vollständige Schichtverteilung mit horizontalen Balken + Handlungsempfehlung
- **Zeitraum-Filter**: 3 / 6 / 12 Monate wählbar
- **Sortieroptionen**: nach Monotonie (schlechteste zuerst), Dominanz-Anteil oder Name
- **Farbgebung** aus den Schichtdefinitionen der Datenbank (konsistent mit Dienstplan)
- **Handlungsempfehlungen**: Warnung bei Score <40 (Burnout-Risiko), Bestätigung bei Score ≥70

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

## [Unreleased] - 2026-02-26

### Added
- **Wochenansicht** (`/wochenansicht`): Kompakte Mo–So Wochenübersicht aller Mitarbeiter
  - Vollständige 7-Tage-Tabelle mit farbigen Schicht-Badges
  - Wochen-Navigation (Zurück / Heute / Vor) + Datepicker
  - Gruppen-Filter und Mitarbeiter-Suche
  - Kompakt-Modus (kleinere Zeilen)
  - Highlight-Klick auf Mitarbeiter-Zeile
  - Schichten-Zähler pro MA (S = Schichten, A = Abwesenheiten)
  - Tages-Zusammenfassung (wieviele Mitarbeiter pro Tag im Dienst)
  - Legende aller Schichtarten mit Farben
  - Heute-Hervorhebung (blauer Spaltenkopf)
  - Wochenende visuell abgesetzt

## [Unreleased] - 2026-02-27

### Added
- **Leitwand** (`/leitwand`): Fullscreen TV-Modus / Ops-Dashboard für Bildschirme im Aufenthaltsraum oder Empfang
  - Echtzeit-Uhr (HH:MM:SS) mit minütlichem Fortschritts-Ring
  - KPI-Kacheln: Aktiv jetzt, Im Dienst heute, Abwesend, Schichttypen
  - Mitarbeiter-Karten pro Schichtgruppe mit Farb-Band (Schichtfarbe)
  - Aktiv-Badge (🟢 pulsierend) + Schicht-Fortschrittsbalken für laufende Schichten
  - Restzeit-Anzeige ("noch 3h 20min")
  - Abwesenheits-Sektion mit Urlaubsart
  - Wochentag-Balken-Miniviews
  - Ticker-Leiste mit Warnungen + Abwesenheiten (rotierend)
  - Vollbild-Button (⛶) + manueller Refresh
  - Automatische Aktualisierung alle 2 Minuten
  - Dunkles UI optimiert für großformatige Displays
