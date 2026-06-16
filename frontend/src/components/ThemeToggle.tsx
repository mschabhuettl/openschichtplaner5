import { useTheme } from '../contexts/ThemeContext';

/**
 * Animated dark-mode toggle — pill-style switch with sun/moon icons.
 * Two sizes: 'sm' for header bar, 'md' for sidebar / settings.
 */
export function ThemeToggle({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const { isDark, toggleTheme } = useTheme();

  const pill = size === 'md'
    ? 'w-14 h-8 rounded-full'
    : 'w-11 h-6 rounded-full';
  const knob = size === 'md'
    ? 'w-6 h-6 rounded-full'
    : 'w-4 h-4 rounded-full';
  // With the knob anchored at left-0, translate-x is measured from the left edge.
  // md: pill 56 / knob 24 → 4px and 28px give symmetric 4px gaps.
  // sm: pill 44 / knob 16 → 4px and 24px give symmetric 4px gaps.
  const translate = size === 'md'
    ? (isDark ? 'translate-x-7' : 'translate-x-1')
    : (isDark ? 'translate-x-[24px]' : 'translate-x-[4px]');
  const iconSize = size === 'md' ? 'text-xs' : 'text-[10px]';

  return (
    <button
      onClick={toggleTheme}
      title={isDark ? 'Hell-Modus aktivieren' : 'Dunkel-Modus aktivieren'}
      aria-label={isDark ? 'Hell-Modus aktivieren' : 'Dunkel-Modus aktivieren'}
      className={`
        relative ${pill} flex-shrink-0
        ${isDark
          ? 'bg-indigo-600 hover:bg-indigo-500'
          : 'bg-slate-300 hover:bg-slate-400'}
        transition-colors duration-200 ease-in-out
        focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
      `}
      style={{ minHeight: 'unset', minWidth: 'unset' }}
    >
      {/* Icons inside the track */}
      <span className={`absolute left-1 top-1/2 -translate-y-1/2 ${iconSize} leading-none transition-opacity duration-200 ${isDark ? 'opacity-100' : 'opacity-0'}`}>
        🌙
      </span>
      <span className={`absolute right-1 top-1/2 -translate-y-1/2 ${iconSize} leading-none transition-opacity duration-200 ${isDark ? 'opacity-0' : 'opacity-100'}`}>
        ☀️
      </span>
      {/* Sliding knob — anchored at the left edge (left-0) so translate-x has a
          deterministic origin. Without left-0 the browser resolves left:auto to the
          knob's static position (~pill centre), pushing the knob off the right edge
          in the "on" state (cycle 8: "torn"/broken toggle). */}
      <span
        className={`
          absolute left-0 top-1/2 -translate-y-1/2 ${knob}
          shadow-md
          transform ${translate}
          transition-transform duration-200 ease-in-out
        `}
        // Explicit white (not the `bg-white` class) so the knob stays a visible
        // white thumb in dark mode too — the global `html.dark .bg-white` override
        // would otherwise paint it dark-on-dark.
        style={{ backgroundColor: '#ffffff' }}
      />
    </button>
  );
}
