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
  green:  'bg-green-100 text-green-800 border-green-200',
  blue:   'bg-blue-100 text-blue-800 border-blue-200',
  red:    'bg-red-100 text-red-800 border-red-200',
  yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  orange: 'bg-orange-100 text-orange-800 border-orange-200',
  purple: 'bg-purple-100 text-purple-800 border-purple-200',
  gray:   'bg-gray-100 text-gray-700 border-gray-200',
  teal:   'bg-teal-100 text-teal-800 border-teal-200',
  indigo: 'bg-indigo-100 text-indigo-800 border-indigo-200',
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
