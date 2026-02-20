import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import Schedule from './pages/Schedule';
import Employees from './pages/Employees';
import Groups from './pages/Groups';
import Shifts from './pages/Shifts';
import LeaveTypes from './pages/LeaveTypes';
import Holidays from './pages/Holidays';
import Workplaces from './pages/Workplaces';
import Extracharges from './pages/Extracharges';
import Einsatzplan from './pages/Einsatzplan';
import Jahresuebersicht from './pages/Jahresuebersicht';
import Statistiken from './pages/Statistiken';
import Schichtmodell from './pages/Schichtmodell';
import Urlaub from './pages/Urlaub';
import Personalbedarf from './pages/Personalbedarf';
import Jahresabschluss from './pages/Jahresabschluss';
import Zeitkonto from './pages/Zeitkonto';
import Export from './pages/Export';
import Import from './pages/Import';
import Berichte from './pages/Berichte';
import Benutzerverwaltung from './pages/Benutzerverwaltung';
import Notizen from './pages/Notizen';
import Backup from './pages/Backup';
import Perioden from './pages/Perioden';
import Einstellungen from './pages/Einstellungen';
import Kontobuchungen from './pages/Kontobuchungen';

type Page =
  | 'dashboard'
  | 'schedule'
  | 'einsatzplan'
  | 'jahresuebersicht'
  | 'statistiken'
  | 'urlaub'
  | 'schichtmodell'
  | 'personalbedarf'
  | 'employees'
  | 'groups'
  | 'shifts'
  | 'leave-types'
  | 'holidays'
  | 'workplaces'
  | 'extracharges'
  | 'jahresabschluss'
  | 'zeitkonto'
  | 'notizen'
  | 'export'
  | 'import'
  | 'berichte'
  | 'benutzerverwaltung'
  | 'backup'
  | 'perioden'
  | 'kontobuchungen'
  | 'einstellungen';

const navItems: { id: Page; label: string; icon: string; group?: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  // Planning views
  { id: 'schedule', label: 'Dienstplan', icon: '📅', group: 'Planung' },
  { id: 'einsatzplan', label: 'Einsatzplan', icon: '📋', group: 'Planung' },
  { id: 'jahresuebersicht', label: 'Jahresübersicht', icon: '📆', group: 'Planung' },
  { id: 'statistiken', label: 'Statistiken', icon: '📈', group: 'Planung' },
  { id: 'urlaub', label: 'Urlaubsverwaltung', icon: '🏖️', group: 'Planung' },
  { id: 'schichtmodell', label: 'Schichtmodelle', icon: '🔄', group: 'Planung' },
  { id: 'personalbedarf', label: 'Personalbedarf', icon: '👥', group: 'Planung' },
  { id: 'jahresabschluss', label: 'Jahresabschluss', icon: '📅', group: 'Planung' },
  { id: 'zeitkonto', label: 'Zeitkonto', icon: '⏱️', group: 'Planung' },
  { id: 'kontobuchungen', label: 'Kontobuchungen', icon: '💰', group: 'Planung' },
  { id: 'notizen', label: 'Notizen', icon: '📝', group: 'Planung' },
  // Reports
  { id: 'berichte', label: 'Berichte', icon: '📊', group: 'Berichte' },
  { id: 'export', label: 'Export', icon: '⬇️', group: 'Berichte' },
  { id: 'import', label: 'Import', icon: '⬆️', group: 'Berichte' },
  // Settings / data
  { id: 'employees', label: 'Mitarbeiter', icon: '👥', group: 'Stammdaten' },
  { id: 'groups', label: 'Gruppen', icon: '🏢', group: 'Stammdaten' },
  { id: 'shifts', label: 'Schichtarten', icon: '🕐', group: 'Stammdaten' },
  { id: 'leave-types', label: 'Abwesenheitsarten', icon: '📋', group: 'Stammdaten' },
  { id: 'holidays', label: 'Feiertage', icon: '🎉', group: 'Stammdaten' },
  { id: 'workplaces', label: 'Arbeitsplätze', icon: '🏭', group: 'Stammdaten' },
  { id: 'extracharges', label: 'Zeitzuschläge', icon: '⏱️', group: 'Stammdaten' },
  // Administration
  { id: 'benutzerverwaltung', label: 'Benutzerverwaltung', icon: '👤', group: 'Administration' },
  { id: 'backup', label: 'Backup & Restore', icon: '💾', group: 'Administration' },
  { id: 'perioden', label: 'Abrechnungszeiträume', icon: '📅', group: 'Administration' },
  { id: 'einstellungen', label: 'Einstellungen', icon: '⚙️', group: 'Administration' },
];

export default function App() {
  const [page, setPage] = useState<Page>('schedule');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigate = (p: Page) => {
    setPage(p);
    setSidebarOpen(false); // close drawer on mobile after selection
  };

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard />;
      case 'schedule': return <Schedule />;
      case 'einsatzplan': return <Einsatzplan />;
      case 'jahresuebersicht': return <Jahresuebersicht />;
      case 'statistiken': return <Statistiken />;
      case 'urlaub': return <Urlaub />;
      case 'schichtmodell': return <Schichtmodell />;
      case 'personalbedarf': return <Personalbedarf />;
      case 'jahresabschluss': return <Jahresabschluss />;
      case 'zeitkonto': return <Zeitkonto />;
      case 'kontobuchungen': return <Kontobuchungen />;
      case 'notizen': return <Notizen />;
      case 'berichte': return <Berichte />;
      case 'export': return <Export />;
      case 'import': return <Import />;
      case 'employees': return <Employees />;
      case 'groups': return <Groups />;
      case 'shifts': return <Shifts />;
      case 'leave-types': return <LeaveTypes />;
      case 'holidays': return <Holidays />;
      case 'workplaces': return <Workplaces />;
      case 'extracharges': return <Extracharges />;
      case 'benutzerverwaltung': return <Benutzerverwaltung />;
      case 'backup': return <Backup />;
      case 'perioden': return <Perioden />;
      case 'einstellungen': return <Einstellungen />;
    }
  };

  // Group nav items
  const grouped: { group: string; items: typeof navItems }[] = [
    { group: '', items: navItems.filter(i => !i.group) },
    { group: 'Planung', items: navItems.filter(i => i.group === 'Planung') },
    { group: 'Berichte', items: navItems.filter(i => i.group === 'Berichte') },
    { group: 'Stammdaten', items: navItems.filter(i => i.group === 'Stammdaten') },
    { group: 'Administration', items: navItems.filter(i => i.group === 'Administration') },
  ];

  const sidebarContent = (
    <>
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <div>
          <div className="text-lg font-bold text-white">🦞 OpenSP5</div>
          <div className="text-xs text-slate-400 mt-0.5">Dienstplanung</div>
        </div>
        {/* Close button — only visible on mobile */}
        <button
          className="md:hidden text-slate-400 hover:text-white p-1"
          onClick={() => setSidebarOpen(false)}
          aria-label="Menü schließen"
        >
          ✕
        </button>
      </div>
      <nav className="flex-1 py-2 overflow-y-auto">
        {grouped.map(({ group, items }) => (
          items.length > 0 && (
            <div key={group || '_root'}>
              {group && (
                <div className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-widest text-slate-500 font-semibold">
                  {group}
                </div>
              )}
              {items.map(item => (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                    page === item.id
                      ? 'bg-slate-600 text-white font-semibold'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          )
        ))}
      </nav>
      <div className="p-4 border-t border-slate-700 text-xs text-slate-500">
        OpenSchichtplaner5 v0.2
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">

      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — desktop: always visible | mobile: slide-in drawer */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-56 bg-slate-800 text-white flex flex-col shadow-xl
        transform transition-transform duration-200 ease-in-out
        md:relative md:translate-x-0 md:flex-shrink-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {sidebarContent}
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar with hamburger */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-slate-800 text-white shadow">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Menü öffnen"
            className="text-xl leading-none"
          >
            ☰
          </button>
          <span className="font-semibold text-sm">
            {navItems.find(i => i.id === page)?.icon} {navItems.find(i => i.id === page)?.label}
          </span>
        </header>

        <main className="flex-1 overflow-auto">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}
