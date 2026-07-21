import { shiftCellColorsMemo } from '../../utils/shiftColor';

/**
 * Badge/Chip-Primitive des Design-Systems (Taktwerk-Dienst-Chip,
 * docs/design-system.md §6): feste Höhe 19px, läuft NIE über (truncate +
 * max-width), Rohfarbe wird normalisiert (Hue-treu, S/L-Schiene) und die
 * Textfarbe per Kontrast berechnet — nie gesetzt.
 */
export function Badge({
  label,
  bgColor,
  title,
  className = '',
}: {
  label: string;
  /** Hintergrund als Roh-Hex (z. B. COLORBK_HEX); ohne Angabe neutrale Fläche. */
  bgColor?: string;
  title?: string;
  className?: string;
}) {
  // Chip ist klein/statisch — Theme direkt vom Dokument (wie Menü-Chips).
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const c = bgColor ? shiftCellColorsMemo(bgColor, isDark ? 'dark' : 'light') : null;
  const style = c ? { backgroundColor: c.background, color: c.color } : undefined;
  return (
    <span
      title={title ?? label}
      style={style}
      className={`inline-flex h-[19px] max-w-full items-center rounded-cell px-1.5 text-[9.5px] font-bold leading-none ${bgColor ? '' : 'bg-wash text-schrift-2'} ${className}`}
    >
      <span className="truncate">{label}</span>
    </span>
  );
}
