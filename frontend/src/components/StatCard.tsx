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
  blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   sub: 'text-blue-600' },
  green:  { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-700',  sub: 'text-green-600' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', sub: 'text-orange-600' },
  red:    { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    sub: 'text-red-600' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', sub: 'text-purple-600' },
  gray:   { bg: 'bg-gray-50',   border: 'border-gray-200',   text: 'text-gray-700',   sub: 'text-gray-500' },
  teal:   { bg: 'bg-teal-50',   border: 'border-teal-200',   text: 'text-teal-700',   sub: 'text-teal-600' },
  yellow: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', sub: 'text-yellow-600' },
  indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', sub: 'text-indigo-600' },
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
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}
