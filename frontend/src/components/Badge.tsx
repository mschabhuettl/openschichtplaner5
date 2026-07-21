/**
 * Badge — einheitliche Inline-Badge-Komponente als Taktwerk-Status-Pille
 * (docs/design-system.md §6): Outline-Pille mit Punkt, Vorder-/Randfarbe
 * nach der Status-Schiene (fg light hsl(h,55%,32%) / dark hsl(h,45%,70%),
 * Rand light hsl(h,40%,84%) / dark hsl(h,35%,28%)). `gray` ist bewusst
 * neutral (Schrift-2/Kontur) statt der blaustichigen #7a8090-Schiene.
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
  green:  'text-[#257e3e] border-[#c6e7cf] dark:text-[#90d5a4] dark:border-[#2e603d]',
  blue:   'text-[#25527e] border-[#c6d6e7] dark:text-[#90b3d5] dark:border-[#2e4760]',
  red:    'text-[#7e2525] border-[#e7c6c6] dark:text-[#d59090] dark:border-[#602e2e]',
  yellow: 'text-[#7e6e25] border-[#e7e1c6] dark:text-[#d5c890] dark:border-[#60572e]',
  orange: 'text-[#7e5f25] border-[#e7dbc6] dark:text-[#d5bd90] dark:border-[#604f2e]',
  purple: 'text-[#52257e] border-[#d6c6e7] dark:text-[#b390d5] dark:border-[#472e60]',
  gray:   'text-schrift-2 border-kontur',
  teal:   'text-[#257e7e] border-[#c6e7e7] dark:text-[#90d5d5] dark:border-[#2e6060]',
  indigo: 'text-[#25257e] border-[#c6c6e7] dark:text-[#9090d5] dark:border-[#2e2e60]',
};

export function Badge({ children, variant = 'gray', shape = 'pill', className = '' }: BadgeProps) {
  const rounded = shape === 'pill' ? 'rounded-full' : 'rounded';
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold border whitespace-nowrap bg-transparent ${rounded} ${variantMap[variant]} ${className}`}
    >
      <span className="w-[5px] h-[5px] rounded-full bg-current flex-shrink-0" aria-hidden="true" />
      {children}
    </span>
  );
}
