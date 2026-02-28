/**
 * Lightweight i18n system for OpenSchichtplaner5
 * No external library — uses React Context + localStorage
 */
import de from './de';
import en from './en';

export type Language = 'de' | 'en';
export type Translations = typeof de;

const translations: Record<Language, Translations> = { de, en };

export const LANG_KEY = 'sp5_language';

export function getStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored === 'de' || stored === 'en') return stored;
  } catch { /* ignore */ }
  // Fallback: browser language
  const lang = navigator.language.slice(0, 2).toLowerCase();
  return lang === 'de' ? 'de' : 'en';
}

export function getTranslations(lang: Language): Translations {
  return translations[lang] ?? de;
}

// Re-export for convenience
export { de, en };

// Context & hook
export { LanguageProvider, useLanguage, useT } from './context';
