import { useState } from 'react';
import { useAuth, type DevViewRole } from '../contexts/AuthContext';

const ROLES: { key: DevViewRole; label: string; icon: string; desc: string }[] = [
  { key: 'admin',  label: 'Admin',  icon: '👑', desc: 'Admin-Ansicht (Vollzugriff)' },
  { key: 'planer', label: 'Planer', icon: '📅', desc: 'Planer-Ansicht' },
  { key: 'lese',   label: 'Leser',  icon: '👁️', desc: 'Nur-Lesen-Ansicht' },
];

export function DevRoleSwitcher() {
  const { isDevMode, devViewRole, setDevViewRole } = useAuth();
  const [open, setOpen] = useState(false);

  if (!isDevMode) return null;

  const current = ROLES.find(r => r.key === devViewRole) ?? ROLES[0];

  // Detect mobile viewport for compact styling
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div style={{
      position: 'fixed',
      // Desktop: bottom-right, out of the way of the top toolbars (the schedule
      // view-toggle Monat/Woche/Kalender sits top-right and this z-9999 badge used
      // to cover it, making those buttons unclickable in dev mode). Mobile: below
      // the header (the bottom edge is taken by the BottomNav).
      top: isMobile ? '54px' : 'auto',
      bottom: isMobile ? 'auto' : '12px',
      right: isMobile ? '6px' : '12px',
      zIndex: 9999,
      fontFamily: 'monospace',
    }}>
      {/* Badge button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Dev View-Role Simulator — Backend läuft immer als Dev"
        style={{
          background: '#1c1917',
          color: '#fb923c',
          border: '2px solid #ea580c',
          borderRadius: '8px',
          padding: isMobile ? '3px 7px' : '6px 12px',
          cursor: 'pointer',
          fontSize: isMobile ? '11px' : '13px',
          fontFamily: 'monospace',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? '4px' : '6px',
          boxShadow: '0 2px 10px rgba(234,88,12,0.35)',
          whiteSpace: 'nowrap',
          opacity: 0.85,
        }}
      >
        {current.icon} {isMobile ? current.label : `Ansicht: ${current.label}`} ▾
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: -1 }}
          />
          {/* Dropdown — opens downward on mobile (badge at top), upward on desktop
              (badge at bottom-right). */}
          <div style={{
            position: 'absolute',
            top: isMobile ? '44px' : 'auto',
            bottom: isMobile ? 'auto' : '44px',
            right: 0,
            background: '#1c1917',
            border: '2px solid #f59e0b',
            borderRadius: '10px',
            overflow: 'hidden',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            minWidth: '220px',
          }}>
            {/* Header */}
            <div style={{
              padding: '8px 14px',
              fontSize: '10px',
              color: '#78716c',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              borderBottom: '1px solid #292524',
            }}>
              🔬 UI-Simulation (Backend = Dev)
            </div>

            {ROLES.map(role => {
              const active = role.key === devViewRole;
              return (
                <button
                  key={role.key}
                  onClick={() => { setDevViewRole(role.key); setOpen(false); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '9px 14px',
                    background: active ? '#292524' : 'transparent',
                    color: active ? '#fbbf24' : '#d6d3d1',
                    border: 'none',
                    borderBottom: '1px solid #1c1917',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    textAlign: 'left',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = '#211f1e'; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                >
                  <span style={{ fontSize: '16px' }}>{role.icon}</span>
                  <span style={{ fontWeight: active ? 'bold' : 'normal', flex: 1 }}>{role.label}</span>
                  {active && <span style={{ fontSize: '11px', color: '#f59e0b' }}>● aktiv</span>}
                  {!active && <span style={{ fontSize: '11px', color: '#57534e' }}>{role.desc}</span>}
                </button>
              );
            })}

            {/* Footer note */}
            <div style={{
              padding: '6px 14px',
              fontSize: '10px',
              color: '#57534e',
              borderTop: '1px solid #292524',
            }}>
              API-Calls laufen weiterhin als Dev
            </div>
          </div>
        </>
      )}
    </div>
  );
}
