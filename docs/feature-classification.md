# Feature-Klassifikation — CORE vs. EXTRA

Stand: Juli 2026. Grundlage für `SP5_CORE_ONLY` (Betrieb im Original-Umfang).

**Kriterium CORE:** Die Funktion existiert im originalen Schichtplaner5
(Handbuch-/Menü-Beleg, Spec-Kapitel) bzw. ergibt sich direkt aus dessen
DBF-Tabellen (30-Tabellen-Schema). **Kriterium EXTRA:** von osp5 hinzugefügt —
kein Original-Pendant; hartes Indiz: Persistenz in JSON-Sidecars statt DBF
oder reine Zusatz-Auswertung/Integration.

Beleg-Kürzel: Spec-Kapitel der Original-Spezifikation (original-spec.md),
DBF-Tabellennamen, „JSON" = eigener Sidecar-Store der osp5-Erweiterung.

## CORE (bei SP5_CORE_ONLY=true VOLL verfügbar)

| Route/Funktion | Beleg |
|---|---|
| /schedule (Dienstplan inkl. Soll-/Istplan, Kontextmenü) | Spec 4.2/4.12; 5MASHI |
| /einsatzplan (inkl. Sonderdienste) | Spec 4.3; 5SPSHI |
| /jahresuebersicht | Spec 4.4 |
| /personaltabelle | Spec 4.5, 3.9.2 |
| /statistiken (Anspruchs-/Auslastungs-Statistik) | Spec 3.7.1, 3.9 |
| /employees, /mitarbeiter (Stammdaten, Foto) | Spec 5; 5EMPL |
| /groups (inkl. Baum/Vererbung) | 5GROUP, 5GRASG, 5GRACC |
| /shifts | 5SHIFT |
| /leave-types | 5LEAVT |
| /workplaces | 5WOPL |
| /holidays | 5HOLID |
| /einschraenkungen (inkl. Grad „?"/„nie") | Spec 4.11; 5RESTR |
| /schichtmodell (Zyklen + Zuweisung) | 5CYCLE, 5CYENT, 5CYASS |
| /perioden (gekennzeichnete Zeiträume) | 5PERIO |
| /extracharges (Zeitzuschläge) | Spec 3.8; 5EXTRA, 5MAEXC |
| /urlaub (Verwaltung, Ansprüche, Sperren) | Spec 7; 5LEAEN, 5ABSEN, 5HOBAN |
| /zeitkonto, /kontobuchungen, /ueberstunden | Spec 3.6/8; 5BOOK, 5OVER |
| /jahresabschluss | Spec 3.7.2 |
| /personalbedarf | Spec 3.9.4; 5SHDEM, 5SPDEM |
| /berichte, /druckvorschau (Berichte/Druck) | Spec 4.13 |
| /benutzerverwaltung (Rollen/Rechte/Scopes) | Spec 9; 5USER, 5EMACC |
| /notizen (Tages-/MA-Notizen) | 5NOTE |
| /import, /export (Datenimport/-export als Funktion) | Handbuch „Datenimport"; CSV-Formate sind Web-Ausprägung |
| /backup (Datensicherung inkl. Wiederherstellen) | Handbuch „Datensicherung" |
| /einstellungen (Programmoptionen) | 5USETT |
| Login/Session (5USER-Konten) | Spec 9; 5USER.DIGEST |

## EXTRA (bei SP5_CORE_ONLY=true deaktiviert)

| Route/Funktion | Indiz/Beleg |
|---|---|
| /tauschboerse (inkl. Self-Service-Tausch) | JSON swap_requests; kein Original-Pendant |
| /schichtwuensche (Wünsche/Sperrungen) | JSON wishes |
| /mein-profil, /mein-kalender | Self-Service; Original kennt keine Benutzer-Selbstansicht |
| /analytics, /absence-stats, /overtime-dashboard, /jahresrueckblick, /rotations-analyse, /kapazitaets-forecast, /mitarbeiter-vergleich, /qualitaets-bericht, /fairness, /kompetenz-matrix | Analytics-/Auswertungsaufsätze ohne Original-Pendant (api-Erweiterungen, tlw. in OpenAPI so markiert) |
| /auditlog, /protokoll | JSON-Audit-Log; Original hat keinen Protokoll-Viewer (−L-Journale sind interne Sync-Daten) |
| /changelog („Was ist neu") | Web-App-Eigenschaft |
| /companies (Mandanten/ORM) , /orm-mirror | osp5-Zusatz (ORM-Spiegel) |
| /webhooks, /health, /rate-limits, /email-settings, /notification-settings, /export-scheduler | Betrieb/Integration der Web-App |
| /dienst-board, /leitwand, /teamkalender, /geburtstagkalender, /team, /urlaubs-timeline, /employee-timeline, /wochenansicht | Zusatz-Ansichten (ROADMAP „bewusste Web-Abweichungen") |
| /notfall-plan (Einspringer-Suche) | eigene Eignungs-/Scoring-Logik; Original hat keine automatische Suche |
| /konflikte, /conflict-report | Original hat KEINE Cross-Layer-Konfliktprüfung (belegt: meta conflict-semantics) |
| /uebergabe, /schichtbriefing (inkl. Wetter) | JSON-Stores, externe Wetter-API |
| /simulation, /schicht-kalibrator, /onboarding, /recurring-shifts, /work-time-rules | Zusatz-Werkzeuge (Pattern-/Regel-Stores ohne DBF-Pendant) |
| Benachrichtigungen/SSE, E-Mail-Versand, iCal-Feed, PWA/Offline | Integrations-Schicht der Web-App |

## Grenzfälle (Begründung)

- **/statistiken** bleibt CORE: Anspruchsstatistik (3.7.1) und Auslastung
  (3.9) sind Original-Funktionalität, auch wenn die Darstellung webig ist.
- **/import, /export, /backup** bleiben CORE: die FUNKTION existiert im
  Original (Handbuch); Formatdetails sind Ausprägung, kein Zusatzfeature.
- **/wochenansicht** ist EXTRA, obwohl sie nur 5MASHI zeigt: das Original hat
  diese Ansicht nicht (ROADMAP-Eintrag „bewusste Web-Abweichung").
- **Impersonation** („als Benutzer ansehen") ist EXTRA (Betriebs-/Support-
  Werkzeug), bleibt aber auch im Core-Modus aktiv, da reine Session-Steuerung
  ohne Datenwirkung — konsistent mit SP5_READONLY-Ausnahmen.

## Umsetzungsnotiz für das Flag

- **api:** Deaktivierung über eine Router-Präfixliste in der Middleware
  (analog SP5_READONLY): EXTRA-Präfixe → 404 „Diese Funktion ist im
  Core-Modus deaktiviert (SP5_CORE_ONLY)."; `/api/health` meldet
  `core_only: bool`.
- **Frontend:** Nav-Filter + Routen-Guard über dieselbe Klassifikationsliste
  (eine gemeinsame Konstante, kein toter Menüeintrag).
- Kombinierbar mit SP5_READONLY (unabhängige Gates).
