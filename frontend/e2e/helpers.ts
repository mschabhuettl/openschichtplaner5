import { Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';
const SESSION_KEY = 'sp5_session';

// Inject a dev-mode session directly into localStorage (no API call needed)
export async function loginViaStorage(page: Page, role: 'admin' | 'planer' | 'leser' = 'admin') {
  const users: Record<string, object> = {
    admin: {
      ID: 251, NAME: 'Admin', DESCRIP: 'Datenbankverwalter',
      ADMIN: true, RIGHTS: 0, role: 'Admin',
      WDUTIES: true, WABSENCES: true, WOVERTIMES: true,
      WNOTES: true, WCYCLEASS: true, WPAST: true,
      WACCEMWND: true, WACCGRWND: true, BACKUP: true,
      SHOWSTATS: true, ACCADMWND: true,
    },
    planer: {
      ID: 252, NAME: 'Planer', DESCRIP: 'Dienstplaner',
      ADMIN: false, RIGHTS: 1, role: 'Planer',
      WDUTIES: true, WABSENCES: true, WOVERTIMES: true,
      WNOTES: true, WCYCLEASS: true, WPAST: true,
      WACCEMWND: true, WACCGRWND: true, BACKUP: false,
      SHOWSTATS: true, ACCADMWND: false,
    },
    leser: {
      ID: 253, NAME: 'Leser', DESCRIP: 'Nur lesen',
      ADMIN: false, RIGHTS: 2, role: 'Leser',
      WDUTIES: false, WABSENCES: false, WOVERTIMES: false,
      WNOTES: false, WCYCLEASS: false, WPAST: false,
      WACCEMWND: false, WACCGRWND: false, BACKUP: false,
      SHOWSTATS: false, ACCADMWND: false,
    },
  };

  const session = {
    token: '__dev_mode__',
    user: users[role],
    devMode: true,
  };

  // Navigate first to establish the origin, then set localStorage
  await page.goto(BASE_URL);
  await page.evaluate(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
  }, { key: SESSION_KEY, value: session });

  // Reload to pick up the session
  await page.reload();
}

export { BASE_URL };
