/**
 * StatCard — einheitliche KPI-Karte
 * Ersetzt KpiCard in Dashboard und summary cards in anderen Seiten.
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

const accentMap: Record<StatCardAccent, { bg: string; border: string; text: string; sub: string }> = {
  blue:   { bg: 'bg-blue-50 dark:bg-blue-950/40',     border: 'border-blue-200 dark:border-blue-800/60',     text: 'text-blue-700 dark:text-blue-300',     sub: 'text-blue-600 dark:text-blue-400' },
  green:  { bg: 'bg-green-50 dark:bg-green-950/40',    border: 'border-green-200 dark:border-green-800/60',   text: 'text-green-700 dark:text-green-300',   sub: 'text-green-600 dark:text-green-400' },
  orange: { bg: 'bg-orange-50 dark:bg-orange-950/40',  border: 'border-orange-200 dark:border-orange-800/60', text: 'text-orange-700 dark:text-orange-300', sub: 'text-orange-600 dark:text-orange-400' },
  red:    { bg: 'bg-red-50 dark:bg-red-950/40',        border: 'border-red-200 dark:border-red-800/60',       text: 'text-red-700 dark:text-red-300',       sub: 'text-red-600 dark:text-red-400' },
  purple: { bg: 'bg-purple-50 dark:bg-purple-950/40',  border: 'border-purple-200 dark:border-purple-800/60', text: 'text-purple-700 dark:text-purple-300', sub: 'text-purple-600 dark:text-purple-400' },
  gray:   { bg: 'bg-gray-50 dark:bg-slate-800',        border: 'border-gray-200 dark:border-slate-700',       text: 'text-gray-700 dark:text-slate-200',    sub: 'text-gray-500 dark:text-slate-400' },
  teal:   { bg: 'bg-teal-50 dark:bg-teal-950/40',      border: 'border-teal-200 dark:border-teal-800/60',     text: 'text-teal-700 dark:text-teal-300',     sub: 'text-teal-600 dark:text-teal-400' },
  yellow: { bg: 'bg-yellow-50 dark:bg-yellow-950/40',  border: 'border-yellow-200 dark:border-yellow-800/60', text: 'text-yellow-700 dark:text-yellow-300', sub: 'text-yellow-600 dark:text-yellow-400' },
  indigo: { bg: 'bg-indigo-50 dark:bg-indigo-950/40',  border: 'border-indigo-200 dark:border-indigo-800/60', text: 'text-indigo-700 dark:text-indigo-300', sub: 'text-indigo-600 dark:text-indigo-400' },
};

export function StatCard({ icon, label, value, sub, accent = 'blue', help, className = '' }: StatCardProps) {
  const ac = accentMap[accent] ?? accentMap.blue;
  return (
    <div
      className={`${ac.bg} border ${ac.border} rounded-lg p-3 text-center flex flex-col items-center gap-0.5 ${className}`}
      title={help}
    >
      {icon && <div className="text-lg leading-none mb-0.5">{icon}</div>}
      <div className={`text-2xl font-bold ${ac.text}`}>{value}</div>
      <div className={`text-xs font-medium ${ac.sub}`}>{label}</div>
      {sub && <div className="text-xs text-gray-600 dark:text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}
