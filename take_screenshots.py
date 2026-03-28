#!/usr/bin/env python3
"""
Playwright screenshot script for OpenSchichtplaner5 v1.1.0.
Takes screenshots of ALL app pages and saves them to docs/screenshots/.
Bypasses login via localStorage injection (Dev-Mode session).

Routes extracted from frontend/src/App.tsx (v1.0.0).
"""

import os
import json
from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:8000"
SCREENSHOT_DIR = "/home/claw/.openclaw/workspace/openschichtplaner5/docs/screenshots"

# Dev-Mode session payload (matches AuthContext.tsx DEV_USER + SESSION_KEY)
SESSION_KEY = "sp5_session"
DEV_SESSION = {
    "token": "",
    "devMode": True,
    "user": {
        "ID": 0,
        "NAME": "Developer",
        "DESCRIP": "Dev-Mode — Vollzugriff",
        "ADMIN": True,
        "RIGHTS": 99,
        "role": "Admin",
        "WDUTIES": True,
        "WABSENCES": True,
        "WOVERTIMES": True,
        "WNOTES": True,
        "WCYCLEASS": True,
        "WPAST": True,
        "WACCEMWND": True,
        "WACCGRWND": True,
        "BACKUP": True,
        "SHOWSTATS": True,
        "ACCADMWND": True
    }
}

# ALL pages from App.tsx — (filename_base, route)
# Skipping: /login (redirect), /mitarbeiter/:id (dynamic), /employees/:id/timeline (dynamic), /* (404)
PAGES = [
    ("dashboard",               "/"),
    ("konflikte",               "/konflikte"),
    ("geburtstagkalender",      "/geburtstagkalender"),
    ("schichtwuensche",         "/schichtwuensche"),
    ("tauschboerse",            "/tauschboerse"),
    ("dienstplan",              "/schedule"),
    ("einsatzplan",             "/einsatzplan"),
    ("jahresuebersicht",        "/jahresuebersicht"),
    ("personaltabelle",         "/personaltabelle"),
    ("statistiken",             "/statistiken"),
    ("urlaub",                  "/urlaub"),
    ("absence-stats",           "/absence-stats"),
    ("schichtmodelle",          "/schichtmodell"),
    ("recurring-shifts",        "/recurring-shifts"),
    ("personalbedarf",          "/personalbedarf"),
    ("jahresrueckblick",        "/jahresrueckblick"),
    ("jahresabschluss",         "/jahresabschluss"),
    ("zeitkonto",               "/zeitkonto"),
    ("ueberstunden",            "/ueberstunden"),
    ("overtime-dashboard",      "/overtime-dashboard"),
    ("kontobuchungen",          "/kontobuchungen"),
    ("notizen",                 "/notizen"),
    ("benachrichtigungen",      "/benachrichtigungen"),
    ("mitarbeiter-vergleich",   "/mitarbeiter-vergleich"),
    ("team-uebersicht",        "/team"),
    ("mitarbeiter-profil",      "/mitarbeiter"),
    ("mein-profil",             "/mein-profil"),
    ("notification-settings",   "/notification-settings"),
    ("mein-kalender",           "/mein-kalender"),
    ("teamkalender",            "/teamkalender"),
    ("urlaubs-timeline",        "/urlaubs-timeline"),
    ("fairness",                "/fairness"),
    ("berichte",                "/berichte"),
    ("export",                  "/export"),
    ("import",                  "/import"),
    ("mitarbeiter",             "/employees"),
    ("employee-timeline",       "/employee-timeline"),
    ("gruppen",                 "/groups"),
    ("schichtarten",            "/shifts"),
    ("abwesenheitsarten",       "/leave-types"),
    ("feiertage",               "/holidays"),
    ("arbeitsplaetze",          "/workplaces"),
    ("zeitzuschlaege",          "/extracharges"),
    ("einschraenkungen",        "/einschraenkungen"),
    ("companies",               "/companies"),
    ("benutzerverwaltung",      "/benutzerverwaltung"),
    ("backup",                  "/backup"),
    ("perioden",                "/perioden"),
    ("einstellungen",           "/einstellungen"),
    ("email-settings",          "/email-settings"),
    ("protokoll",               "/protokoll"),
    ("webhooks",                "/webhooks"),
    ("druckvorschau",           "/druckvorschau"),
    ("dienst-board",            "/dienst-board"),
    ("wochenansicht",           "/wochenansicht"),
    ("verfuegbarkeits-matrix",  "/verfuegbarkeits-matrix"),
    ("rotations-analyse",       "/rotations-analyse"),
    ("kapazitaets-forecast",    "/kapazitaets-forecast"),
    ("qualitaets-bericht",      "/qualitaets-bericht"),
    ("conflict-report",         "/conflict-report"),
    ("schicht-kalibrator",      "/schicht-kalibrator"),
    ("kompetenz-matrix",        "/kompetenz-matrix"),
    ("analytics",               "/analytics"),
    ("simulation",              "/simulation"),
    ("notfall-plan",            "/notfall-plan"),
    ("leitwand",                "/leitwand"),
    ("uebergabe",               "/uebergabe"),
    ("schichtbriefing",         "/schichtbriefing"),
    ("onboarding",              "/onboarding"),
    ("audit-log",               "/auditlog"),
    ("health",                  "/health"),
    ("export-scheduler",        "/export-scheduler"),
    ("rate-limits",             "/rate-limits"),
    ("work-time-rules",         "/work-time-rules"),
    ("changelog",               "/changelog"),
]

os.makedirs(SCREENSHOT_DIR, exist_ok=True)


def inject_devmode_session(page):
    """Inject Dev-Mode session into localStorage."""
    page.evaluate(
        f"localStorage.setItem({json.dumps(SESSION_KEY)}, {json.dumps(json.dumps(DEV_SESSION))})"
    )


def screenshot_all():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": 1280, "height": 900},
            locale="de-DE",
        )
        page = context.new_page()

        # First load the page to establish the origin, then inject session
        print("[→] Setting up Dev-Mode session...", flush=True)
        page.goto(BASE_URL + "/", timeout=15000)
        page.wait_for_load_state("domcontentloaded", timeout=10000)
        inject_devmode_session(page)
        # Reload to pick up the session
        page.reload()
        page.wait_for_load_state("networkidle", timeout=10000)
        page.wait_for_timeout(2000)
        print(f"  [→] Session set. Current URL: {page.url}", flush=True)

        success = 0
        failed = 0
        for name, route in PAGES:
            url = BASE_URL + route
            print(f"[→] {name}: {url}", flush=True)
            try:
                page.goto(url, timeout=30000)
                page.wait_for_load_state("networkidle", timeout=15000)
                page.wait_for_timeout(2500)

                # Check if we got redirected to login
                login_check = page.query_selector("input[type='password']")
                if login_check:
                    print("  [!] Got login page, re-injecting session...", flush=True)
                    inject_devmode_session(page)
                    page.goto(url, timeout=30000)
                    page.wait_for_load_state("networkidle", timeout=15000)
                    page.wait_for_timeout(2500)

                out_path = os.path.join(SCREENSHOT_DIR, f"{name}.png")
                page.screenshot(path=out_path, full_page=False)
                print(f"  [✓] Saved: {out_path}", flush=True)
                success += 1

            except Exception as e:
                print(f"  [✗] Error on {name}: {e}", flush=True)
                try:
                    out_path = os.path.join(SCREENSHOT_DIR, f"{name}.png")
                    page.screenshot(path=out_path, full_page=False)
                    print(f"  [✓] Saved fallback: {out_path}", flush=True)
                    success += 1
                except Exception as e2:
                    print(f"  [✗] Fallback also failed: {e2}", flush=True)
                    failed += 1

        browser.close()
    print(f"\n[✓] Done! {success} screenshots saved, {failed} failed.", flush=True)


if __name__ == "__main__":
    screenshot_all()
