import { useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
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
import Einschraenkungen from './pages/Einschraenkungen';
import Personaltabelle from './pages/Personaltabelle';
import Protokoll from './pages/Protokoll';
import Ueberstunden from './pages/Ueberstunden';

const navItems: { id: string; label: string; icon: string; group?: string; path: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', path: '/' },
  // Planning views
  { id: 'schedule', label: 'Dienstplan', icon: '📅', group: 'Planung', path: '/schedule' },
  { id: 'einsatzplan', label: 'Einsatzplan', icon: '📋', group: 'Planung', path: '/einsatzplan' },
  { id: 'jahresuebersicht', label: 'Jahresübersicht', icon: '📆', group: 'Planung', path: '/jahresuebersicht' },
  { id: 'personaltabelle', label: 'Personaltabelle', icon: '👤', group: 'Planung', path: '/personaltabelle' },
  { id: 'statistiken', label: 'Statistiken', icon: '📈', group: 'Planung', path: '/statistiken' },
  { id: 'urlaub', label: 'Urlaubsverwaltung', icon: '🏖️', group: 'Planung', path: '/urlaub' },
  { id: 'schichtmodell', label: 'Schichtmodelle', icon: '🔄', group: 'Planung', path: '/schichtmodell' },
  { id: 'personalbedarf', label: 'Personalbedarf', icon: '👥', group: 'Planung', path: '/personalbedarf' },
  { id: 'jahresabschluss', label: 'Jahresabschluss', icon: '📅', group: 'Planung', path: '/jahresabschluss' },
  { id: 'zeitkonto', label: 'Zeitkonto', icon: '⏱️', group: 'Planung', path: '/zeitkonto' },
  { id: 'ueberstunden', label: 'Überstunden', icon: '⏰', group: 'Planung', path: '/ueberstunden' },
  { id: 'kontobuchungen', label: 'Kontobuchungen', icon: '💰', group: 'Planung', path: '/kontobuchungen' },
  { id: 'notizen', label: 'Notizen', icon: '📝', group: 'Planung', path: '/notizen' },
  // Reports
  { id: 'berichte', label: 'Berichte', icon: '📊', group: 'Berichte', path: '/berichte' },
  { id: 'export', label: 'Export', icon: '⬇️', group: 'Berichte', path: '/export' },
  { id: 'import', label: 'Import', icon: '⬆️', group: 'Berichte', path: '/import' },
  // Settings / data
  { id: 'employees', label: 'Mitarbeiter', icon: '👥', group: 'Stammdaten', path: '/employees' },
  { id: 'groups', label: 'Gruppen', icon: '🏢', group: 'Stammdaten', path: '/groups' },
  { id: 'shifts', label: 'Schichtarten', icon: '🕐', group: 'Stammdaten', path: '/shifts' },
  { id: 'leave-types', label: 'Abwesenheitsarten', icon: '📋', group: 'Stammdaten', path: '/leave-types' },
  { id: 'holidays', label: 'Feiertage', icon: '📅', group: 'Stammdaten', path: '/holidays' },
  { id: 'workplaces', label: 'Arbeitsplätze', icon: '🏭', group: 'Stammdaten', path: '/workplaces' },
  { id: 'extracharges', label: 'Zeitzuschläge', icon: '⏱️', group: 'Stammdaten', path: '/extracharges' },
  { id: 'einschraenkungen', label: 'Schichteinschränkungen', icon: '🚫', group: 'Stammdaten', path: '/einschraenkungen' },
  // Administration
  { id: 'benutzerverwaltung', label: 'Benutzerverwaltung', icon: '👤', group: 'Administration', path: '/benutzerverwaltung' },
  { id: 'backup', label: 'Backup & Restore', icon: '💾', group: 'Administration', path: '/backup' },
  { id: 'perioden', label: 'Abrechnungszeiträume', icon: '📅', group: 'Administration', path: '/perioden' },
  { id: 'einstellungen', label: 'Einstellungen', icon: '⚙️', group: 'Administration', path: '/einstellungen' },
  { id: 'protokoll', label: 'Protokoll', icon: '📋', group: 'Administration', path: '/protokoll' },
];

function AppInner() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const goTo = (path: string) => {
    navigate(path);
    setSidebarOpen(false);
  };

  const isActive = (item: typeof navItems[0]) => {
    if (item.id === 'dashboard') {
      return location.pathname === '/';
    }
    return location.pathname === item.path;
  };

  const currentItem = navItems.find(i => isActive(i));

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
          <div className="text-lg font-bold text-white">🧸 OpenSP5</div>
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
                  onClick={() => goTo(item.path)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                    isActive(item)
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
            {currentItem?.icon} {currentItem?.label}
          </span>
        </header>

        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/einsatzplan" element={<Einsatzplan />} />
            <Route path="/jahresuebersicht" element={<Jahresuebersicht />} />
            <Route path="/personaltabelle" element={<Personaltabelle />} />
            <Route path="/statistiken" element={<Statistiken />} />
            <Route path="/urlaub" element={<Urlaub />} />
            <Route path="/schichtmodell" element={<Schichtmodell />} />
            <Route path="/personalbedarf" element={<Personalbedarf />} />
            <Route path="/jahresabschluss" element={<Jahresabschluss />} />
            <Route path="/zeitkonto" element={<Zeitkonto />} />
            <Route path="/ueberstunden" element={<Ueberstunden />} />
            <Route path="/kontobuchungen" element={<Kontobuchungen />} />
            <Route path="/notizen" element={<Notizen />} />
            <Route path="/berichte" element={<Berichte />} />
            <Route path="/export" element={<Export />} />
            <Route path="/import" element={<Import />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/groups" element={<Groups />} />
            <Route path="/shifts" element={<Shifts />} />
            <Route path="/leave-types" element={<LeaveTypes />} />
            <Route path="/holidays" element={<Holidays />} />
            <Route path="/workplaces" element={<Workplaces />} />
            <Route path="/extracharges" element={<Extracharges />} />
            <Route path="/einschraenkungen" element={<Einschraenkungen />} />
            <Route path="/benutzerverwaltung" element={<Benutzerverwaltung />} />
            <Route path="/backup" element={<Backup />} />
            <Route path="/perioden" element={<Perioden />} />
            <Route path="/einstellungen" element={<Einstellungen />} />
            <Route path="/protokoll" element={<Protokoll />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}
