import React, { useEffect, useState } from 'react';

import {
  Download,
  RefreshCw,
  Smartphone,
  WifiOff,
  Loader2,
  X,
} from 'lucide-react';

import {
  getPwaState,
  subscribePwa,
  promptInstall,
  activatePwaUpdate,
} from '../pwa';

function PwaControls() {
  const [pwa, setPwa] = useState(getPwaState);
  const [offline, setOffline] = useState(() => !navigator.onLine);

  const [showHelp, setShowHelp] = useState(false);
  const [showUpdateConfirm, setShowUpdateConfirm] = useState(false);

  const [installing, setInstalling] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = subscribePwa(setPwa);
    setPwa(getPwaState());

    const handleOnline = () => setOffline(false);
    const handleOffline = () => setOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  async function handleInstall() {
    setError('');

    if (!pwa.installPrompt) {
      setShowHelp((previous) => !previous);
      return;
    }

    setInstalling(true);

    try {
      await promptInstall();
    } catch {
      setError('Installation could not start. Try your browser’s install menu.');
    } finally {
      setInstalling(false);
    }
  }

  function handleUpdate() {
    setError('');

    try {
      setUpdating(true);
      activatePwaUpdate();
    } catch (updateError) {
      setUpdating(false);
      setError(updateError.message);
    }
  }

  if (
    pwa.installed &&
    !pwa.updateAvailable &&
    !offline &&
    !error
  ) {
    return null;
  }

  const buttonClass =
    'inline-flex min-h-10 items-center justify-center gap-2 ' +
    'rounded-xl border px-3 py-2 text-xs font-semibold ' +
    'disabled:opacity-40 focus-visible:outline-none ' +
    'focus-visible:ring-2 focus-visible:ring-lime-300';

  return (
    <section
      className="mb-5 space-y-3"
      aria-label="App installation and connection"
    >
      {offline && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-xl border border-amber-300/20 bg-amber-300/5 p-3.5 text-xs leading-relaxed text-amber-200"
        >
          <WifiOff size={17} className="shrink-0" aria-hidden="true" />

          <p>
            Your device appears offline. Displayed balances may be
            outdated. Reconnect and refresh before recording payments.
          </p>
        </div>
      )}

      {(!pwa.installed || pwa.updateAvailable) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#14191e] p-3.5">
          <div className="flex items-center gap-2.5">
            <Smartphone
              size={20}
              className="text-lime-300"
              aria-hidden="true"
            />

            <div>
              <p className="text-xs font-semibold text-zinc-200">
                Yaseen Gym on your device
              </p>

              <p className="mt-1 text-[10px] text-zinc-500">
                Open your workspace from the home screen.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {!pwa.installed && (
              <button
                type="button"
                onClick={handleInstall}
                disabled={installing || offline}
                className={`${buttonClass} border-lime-300/20 bg-lime-300/10 text-lime-300 hover:bg-lime-300/15`}
              >
                {installing ? (
                  <Loader2
                    size={15}
                    className="animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                ) : (
                  <Download size={15} aria-hidden="true" />
                )}

                {installing
                  ? 'Opening...'
                  : pwa.installPrompt
                    ? 'Install app'
                    : 'Install guide'}
              </button>
            )}

            {pwa.updateAvailable && (
              <button
                type="button"
                onClick={() => setShowUpdateConfirm(true)}
                disabled={offline || updating}
                className={`${buttonClass} border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10`}
              >
                <RefreshCw size={15} aria-hidden="true" />
                Update available
              </button>
            )}
          </div>
        </div>
      )}

      {showHelp && !pwa.installed && (
        <div className="rounded-xl border border-white/10 bg-[#10151a] p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-white">
              Install Yaseen Gym
            </p>

            <button
              type="button"
              onClick={() => setShowHelp(false)}
              aria-label="Close installation guide"
              className={`${buttonClass} border-transparent text-zinc-400`}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="mt-3 space-y-3 text-xs leading-relaxed text-zinc-400">
            <p>
              <strong className="text-zinc-200">Android:</strong>{' '}
              Open the site in Chrome. In the browser menu, look for
              “Install app” or “Add to Home screen”.
            </p>

            <p>
              <strong className="text-zinc-200">iPhone:</strong>{' '}
              Open the site in Safari, tap Share, then “Add to Home Screen”.
              Enable “Open as Web App” if shown.
            </p>

            <p>
              Installation options depend on your browser and whether
              the app is already installed.
            </p>
          </div>
        </div>
      )}

      {showUpdateConfirm && pwa.updateAvailable && (
        <div
          role="region"
          aria-label="Confirm app update"
          className="rounded-xl border border-lime-300/20 bg-[#14191e] p-4"
        >
          <p className="text-sm font-semibold text-white">
            Ready to update?
          </p>

          <p className="mt-2 text-xs leading-relaxed text-zinc-400">
            This reloads the app. Finish or save any open form first.
          </p>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setShowUpdateConfirm(false)}
              disabled={updating}
              className={`${buttonClass} border-white/10 text-zinc-300`}
            >
              Later
            </button>

            <button
              type="button"
              onClick={handleUpdate}
              disabled={updating || offline}
              className={`${buttonClass} border-lime-300 bg-lime-300 text-zinc-950`}
            >
              {updating && (
                <Loader2
                  size={15}
                  className="animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              )}

              {updating ? 'Updating...' : 'Update & reload'}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-300/20 bg-red-300/5 p-3 text-xs text-red-200"
        >
          {error}
        </p>
      )}
    </section>
  );
}

export default PwaControls;