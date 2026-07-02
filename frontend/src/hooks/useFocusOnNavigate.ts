import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Nach jedem Routenwechsel den Fokus auf den Hauptinhalt setzen.
 * This ensures keyboard/screen-reader users land on relevant content
 * nach der Navigation weiterlesen kann, statt oben auf der Seite festzuhängen.
 */
export function useFocusOnNavigate(mainContentId = 'main-content') {
  const location = useLocation();
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const el = document.getElementById(mainContentId);
      if (el) {
        if (!el.hasAttribute('tabindex')) {
          el.setAttribute('tabindex', '-1');
        }
        el.focus({ preventScroll: false });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [location.pathname, mainContentId]);
}
