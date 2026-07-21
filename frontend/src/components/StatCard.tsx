/**
 * StatCard — einheitliche KPI-Karte nach Taktwerk: neutrale Ebene mit Kontur,
 * Wert in Monospace-Tabellenziffern, Label als UPPERCASE-Beschriftung; der
 * Akzent läuft als 3px-Spine an der linken Kante (die durchgängige
 * Farb-Spur des Design-Systems) statt als getönte Fläche.
 */

export type StatCardAccent = 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'gray' | 'teal' | 'yellow' | 'indigo';

interface StatCardProps {
  /** Emoji oder kurzes Icon-Label */
  icon?: string;
  label: string;
  value: string | number;
  sub?: string;
  accent?: StatCardAccent;
  /** Optionaler Hilfetext (Tooltip-Inhalt, ohne HelpTooltip-Dep) */
  help?: string;
  className?: string;
}

// Spine-Schiene (hsl(h,55%,42%) light / hsl(h,50%,55%) dark) je Akzent-Hue.
const spineMap: Record<StatCardAccent, string> = {
  green:  'before:bg-[#30a652] dark:before:bg-[#53c674]',
  blue:   'before:bg-[#306ba6] dark:before:bg-[#538cc6]',
  orange: 'before:bg-[#a67d30] dark:before:bg-[#c69e53]',
  red:    'before:bg-[#a63030] dark:before:bg-[#c65353]',
  purple: 'before:bg-[#6b30a6] dark:before:bg-[#8c53c6]',
  gray:   'before:bg-kontur',
  teal:   'before:bg-[#30a6a6] dark:before:bg-[#53c6c6]',
  yellow: 'before:bg-[#a69130] dark:before:bg-[#c6b153]',
  indigo: 'before:bg-[#3030a6] dark:before:bg-[#5353c6]',
};

export function StatCard({ icon, label, value, sub, accent = 'blue', help, className = '' }: StatCardProps) {
  const spine = spineMap[accent] ?? spineMap.blue;
  return (
    <div
      className={`relative overflow-hidden bg-ebene border border-kontur rounded-panel p-3 text-center flex flex-col items-center gap-0.5 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] ${spine} ${className}`}
      title={help}
    >
      {icon && <div className="text-lg leading-none mb-0.5">{icon}</div>}
      <div className="text-2xl font-bold font-mono tabular-nums text-schrift">{value}</div>
      <div className="text-[9.5px] font-bold uppercase tracking-[.08em] text-schrift-3">{label}</div>
      {sub && <div className="text-xs text-schrift-2 mt-0.5">{sub}</div>}
    </div>
  );
}
