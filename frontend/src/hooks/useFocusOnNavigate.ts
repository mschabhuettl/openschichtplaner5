import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * After each route change, move focus to the main content area.
 * This ensures keyboard/screen-reader users land on relevant content
 * after navigation instead of being stuck at the top of the page.
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
