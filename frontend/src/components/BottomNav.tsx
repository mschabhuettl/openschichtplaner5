import { useNavigate, useLocation } from 'react-router-dom';
import { useLanguage } from '../i18n/context';

interface BottomNavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
}

const BOTTOM_NAV_ITEMS: BottomNavItem[] = [
  { id: 'dashboard',  label: 'Dashboard', icon: '📊', path: '/' },
  { id: 'schedule',   label: 'Dienstplan', icon: '📅', path: '/schedule' },
  { id: 'team',       label: 'Team', icon: '👥', path: '/team' },
  { id: 'notizen',    label: 'Notizen', icon: '📝', path: '/notizen' },
  { id: 'mein-profil', label: 'Profil', icon: '👤', path: '/mein-profil' },
];

export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-800 border-t border-slate-700 flex"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {BOTTOM_NAV_ITEMS.map(item => {
        const active = isActive(item.path);
        return (
          <button
            key={item.id}
            onClick={() => navigate(item.path)}
            aria-current={active ? 'page' : undefined}
            aria-label={item.label}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-h-[56px] transition-colors ${
              active
                ? 'text-blue-400'
                : 'text-slate-400 hover:text-slate-200 active:bg-slate-700'
            }`}
          >
            <span className="text-xl leading-none">{item.icon}</span>
            <span className={`text-[10px] leading-tight font-medium ${active ? 'text-blue-400' : ''}`}>
              {item.label}
            </span>
            {active && (
              <span className="absolute bottom-0 h-0.5 w-8 rounded-t-full bg-blue-400" aria-hidden="true" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
