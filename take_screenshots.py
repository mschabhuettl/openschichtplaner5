#!/usr/bin/env python3
"""
Playwright screenshot script for OpenSchichtplaner5.
Takes screenshots of all app pages and saves them to docs/screenshots/.
Bypasses login via localStorage injection (Dev-Mode session).

Routes verified from App.tsx:
- Routes are the actual React Router paths, NOT the display names
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

# PAGES: (filename_base, actual_route_in_app)
# Routes verified from frontend/src/App.tsx Route declarations
PAGES = [
    ("dashboard",           "/"),
    ("dienstplan",          "/schedule"),          # Dienstplan = /schedule in React Router
    ("jahresuebersicht",    "/jahresuebersicht"),
    ("mitarbeiter",         "/employees"),          # Mitarbeiter = /employees
    ("schichtarten",        "/shifts"),             # Schichtarten = /shifts
    ("schichtmodelle",      "/schichtmodell"),      # Schichtmodelle = /schichtmodell (singular)
    ("arbeitsplaetze",      "/workplaces"),         # Arbeitsplätze = /workplaces
    ("gruppen",             "/groups"),             # Gruppen = /groups
    ("abwesenheitsarten",   "/leave-types"),        # Abwesenheitsarten = /leave-types
    ("personalbedarf",      "/personalbedarf"),
    ("feiertage",           "/holidays"),           # Feiertage = /holidays
    ("einschraenkungen",    "/einschraenkungen"),   # Schichteinschränkungen = /einschraenkungen
    ("perioden",            "/perioden"),
    ("zeitzuschlaege",      "/extracharges"),       # Zeitzuschläge = /extracharges
    ("kontobuchungen",      "/kontobuchungen"),
    ("zeitkonto",           "/zeitkonto"),
    ("ueberstunden",        "/ueberstunden"),
    ("urlaub",              "/urlaub"),             # Urlaubsverwaltung = /urlaub
    ("statistiken",         "/statistiken"),
    ("berichte",            "/berichte"),
    ("jahresabschluss",     "/jahresabschluss"),
    ("einsatzplan",         "/einsatzplan"),
    ("notizen",             "/notizen"),
    ("protokoll",           "/protokoll"),
    ("personaltabelle",     "/personaltabelle"),
    ("export",              "/export"),
    ("import",              "/import"),
    ("backup",              "/backup"),
    ("einstellungen",       "/einstellungen"),
    ("benutzerverwaltung",  "/benutzerverwaltung"),
    ("konflikte",           "/konflikte"),          # Additional: Konflikte page
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
                    print(f"  [!] Got login page, re-injecting session...", flush=True)
                    inject_devmode_session(page)
                    page.goto(url, timeout=30000)
                    page.wait_for_load_state("networkidle", timeout=15000)
                    page.wait_for_timeout(2500)

                # Check for route match warnings
                console_errors = []
                page.on("console", lambda msg: console_errors.append(msg.text) if "No routes matched" in msg.text else None)
                
                out_path = os.path.join(SCREENSHOT_DIR, f"{name}.png")
                page.screenshot(path=out_path, full_page=False)
                print(f"  [✓] Saved: {out_path}", flush=True)

            except Exception as e:
                print(f"  [✗] Error on {name}: {e}", flush=True)
                try:
                    out_path = os.path.join(SCREENSHOT_DIR, f"{name}.png")
                    page.screenshot(path=out_path, full_page=False)
                    print(f"  [✓] Saved fallback: {out_path}", flush=True)
                except Exception as e2:
                    print(f"  [✗] Fallback also failed: {e2}", flush=True)

        browser.close()
    print("\n[✓] All screenshots done!", flush=True)


if __name__ == "__main__":
    screenshot_all()
