import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!deferredPrompt || dismissed) return null;

  const handleInstall = async () => {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted' || outcome === 'dismissed') {
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 bg-slate-800 border border-slate-600 rounded-xl shadow-xl text-white text-sm max-w-sm w-full mx-4">
      <span className="text-xl">📅</span>
      <div className="flex-1">
        <div className="font-semibold">App installieren</div>
        <div className="text-slate-400 text-xs">OpenSchichtplaner5 als App nutzen</div>
      </div>
      <button
        onClick={handleInstall}
        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
      >
        Installieren
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="text-slate-400 hover:text-white transition-colors"
        aria-label="Schließen"
      >
        ✕
      </button>
    </div>
  );
}
