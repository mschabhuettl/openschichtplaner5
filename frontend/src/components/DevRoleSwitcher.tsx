import { useState } from 'react';
import { useAuth, type DevViewRole } from '../contexts/AuthContext';

const ROLES: { key: DevViewRole; label: string; icon: string; desc: string }[] = [
  { key: 'dev',    label: 'Dev',    icon: '🔧', desc: 'Vollzugriff' },
  { key: 'admin',  label: 'Admin',  icon: '👑', desc: 'Admin-Ansicht' },
  { key: 'planer', label: 'Planer', icon: '📅', desc: 'Planer-Ansicht' },
  { key: 'lese',   label: 'Leser',  icon: '👁️', desc: 'Nur-Lesen-Ansicht' },
];

export function DevRoleSwitcher() {
  const { isDevMode, devViewRole, setDevViewRole } = useAuth();
  const [open, setOpen] = useState(false);

  if (!isDevMode) return null;

  const current = ROLES.find(r => r.key === devViewRole) ?? ROLES[0];

  return (
    <div style={{
      position: 'fixed',
      top: '12px',
      right: '12px',
      zIndex: 9999,
      fontFamily: 'monospace',
    }}>
      {/* Badge button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Dev View-Role Simulator — Backend läuft immer als Dev"
        style={{
          background: '#1c1917',
          color: devViewRole === 'dev' ? '#fbbf24' : '#fb923c',
          border: `2px solid ${devViewRole === 'dev' ? '#f59e0b' : '#ea580c'}`,
          borderRadius: '8px',
          padding: '6px 12px',
          cursor: 'pointer',
          fontSize: '13px',
          fontFamily: 'monospace',
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          boxShadow: `0 2px 10px ${devViewRole === 'dev' ? 'rgba(245,158,11,0.35)' : 'rgba(234,88,12,0.35)'}`,
          whiteSpace: 'nowrap',
        }}
      >
        {current.icon} {devViewRole === 'dev' ? 'DEV MODE' : `Ansicht: ${current.label}`} ▾
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: -1 }}
          />
          {/* Dropdown */}
          <div style={{
            position: 'absolute',
            top: '44px',
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
