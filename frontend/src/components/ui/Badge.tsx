import { readableTextColor } from '../../utils/contrast';

/**
 * Badge/Chip-Primitive des Design-Systems (UX-Audit B3/B5): feste Höhe,
 * läuft NIE über (truncate + max-width), Textfarbe automatisch lesbar zur
 * Hintergrundfarbe. Für Schicht-/Abwesenheits-/MA-Farbflächen.
 */
export function Badge({
  label,
  bgColor,
  title,
  className = '',
}: {
  label: string;
  /** Hintergrund als Hex (z. B. COLORBK_HEX); ohne Angabe neutrale Fläche. */
  bgColor?: string;
  title?: string;
  className?: string;
}) {
  const style = bgColor
    ? { backgroundColor: bgColor, color: readableTextColor(bgColor) }
    : undefined;
  return (
    <span
      title={title ?? label}
      style={style}
      className={`inline-flex h-5 max-w-full items-center rounded px-1.5 text-xs font-medium leading-none ${bgColor ? '' : 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200'} ${className}`}
    >
      <span className="truncate">{label}</span>
    </span>
  );
}
