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
  const translate = size === 'md'
    ? (isDark ? 'translate-x-7' : 'translate-x-1')
    : (isDark ? 'translate-x-[22px]' : 'translate-x-[3px]');
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
      {/* Sliding knob */}
      <span
        className={`
          absolute top-1/2 -translate-y-1/2 ${knob}
          bg-white shadow-md
          transform ${translate}
          transition-transform duration-200 ease-in-out
        `}
      />
    </button>
  );
}
