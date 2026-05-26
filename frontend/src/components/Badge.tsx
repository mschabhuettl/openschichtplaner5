/**
 * Badge — einheitliche Inline-Badge-Komponente
 * Ersetzt die vielen lokalen <span>-Implementierungen.
 */

export type BadgeVariant =
  | 'green' | 'blue' | 'red' | 'yellow' | 'orange'
  | 'purple' | 'gray' | 'teal' | 'indigo';

export type BadgeShape = 'pill' | 'square';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  shape?: BadgeShape;
  className?: string;
}

const variantMap: Record<BadgeVariant, string> = {
  green:  'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700/50',
  blue:   'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700/50',
  red:    'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700/50',
  yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-700/50',
  orange: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-700/50',
  purple: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-700/50',
  gray:   'bg-gray-100 text-gray-700 border-gray-200 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600',
  teal:   'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/40 dark:text-teal-300 dark:border-teal-700/50',
  indigo: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-700/50',
};

export function Badge({ children, variant = 'gray', shape = 'pill', className = '' }: BadgeProps) {
  const rounded = shape === 'pill' ? 'rounded-full' : 'rounded';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold border whitespace-nowrap ${rounded} ${variantMap[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
