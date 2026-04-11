export function isStandaloneMode({
  windowRef = globalThis.window,
  navigatorRef = globalThis.navigator
} = {}) {
  const standaloneMatch = typeof windowRef?.matchMedia === 'function'
    ? windowRef.matchMedia('(display-mode: standalone)').matches
    : false;

  return Boolean(standaloneMatch || navigatorRef?.standalone === true);
}

export function applyDisplayMode({
  documentRef = globalThis.document,
  windowRef = globalThis.window,
  navigatorRef = globalThis.navigator
} = {}) {
  const isStandalone = isStandaloneMode({ windowRef, navigatorRef });
  const launchSource = new URLSearchParams(windowRef?.location?.search || '').get('source') || 'browser';
  const root = documentRef?.documentElement;

  if (!root) {
    return { isStandalone, launchSource };
  }

  root.classList.toggle('display-mode-standalone', isStandalone);
  root.classList.toggle('launch-source-pwa', launchSource === 'pwa');
  root.dataset.displayMode = isStandalone ? 'standalone' : 'browser';
  root.dataset.launchSource = launchSource;

  return { isStandalone, launchSource };
}

export function createInstallPromptManager({
  windowRef = globalThis.window,
  navigatorRef = globalThis.navigator
} = {}) {
  let deferredPrompt = null;
  let disposed = false;
  const listeners = new Set();
  let state = {
    canInstall: false,
    isInstalled: isStandaloneMode({ windowRef, navigatorRef })
  };

  const emitState = () => {
    state = {
      canInstall: Boolean(deferredPrompt),
      isInstalled: isStandaloneMode({ windowRef, navigatorRef }) || state.isInstalled
    };

    for (const listener of listeners) {
      listener({ ...state });
    }
  };

  const handleBeforeInstallPrompt = (event) => {
    event.preventDefault?.();
    deferredPrompt = event;
    emitState();
  };

  const handleAppInstalled = () => {
    deferredPrompt = null;
    state = { canInstall: false, isInstalled: true };
    emitState();
  };

  windowRef?.addEventListener?.('beforeinstallprompt', handleBeforeInstallPrompt);
  windowRef?.addEventListener?.('appinstalled', handleAppInstalled);

  return {
    getState() {
      return { ...state };
    },

    subscribe(listener) {
      if (typeof listener !== 'function') {
        return () => {};
      }

      listeners.add(listener);
      listener({ ...state });

      return () => {
        listeners.delete(listener);
      };
    },

    async promptInstall() {
      if (!deferredPrompt) {
        return { outcome: 'unavailable' };
      }

      const promptEvent = deferredPrompt;
      deferredPrompt = null;
      emitState();

      await promptEvent.prompt?.();
      const choice = await promptEvent.userChoice?.catch(() => null);
      if (choice?.outcome === 'accepted') {
        state = { canInstall: false, isInstalled: true };
        emitState();
      }

      return {
        outcome: typeof choice?.outcome === 'string' ? choice.outcome : 'unknown'
      };
    },

    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;
      listeners.clear();
      deferredPrompt = null;
      windowRef?.removeEventListener?.('beforeinstallprompt', handleBeforeInstallPrompt);
      windowRef?.removeEventListener?.('appinstalled', handleAppInstalled);
    }
  };
}

export function bindInstallPromptUi({ manager, section, button, status, hint }) {
  if (!manager || !section || !button || !status || !hint) {
    return () => {};
  }

  let transientMessage = '';

  const render = (nextState) => {
    const { canInstall, isInstalled } = nextState;
    const shouldShow = Boolean(canInstall || isInstalled || transientMessage);
    section.hidden = !shouldShow;

    if (!shouldShow) {
      button.hidden = true;
      button.disabled = false;
      status.textContent = '';
      hint.textContent = '';
      return;
    }

    if (isInstalled) {
      status.textContent = 'Opgavehelte kører som installeret app på denne enhed.';
      hint.textContent = 'Perfekt til Raspberry Pi-start og fuldskærmsbrug.';
      button.hidden = true;
      button.disabled = true;
      transientMessage = '';
      return;
    }

    status.textContent = transientMessage || 'Installer Opgavehelte på denne enhed.';
    hint.textContent = transientMessage
      ? 'Du kan prøve igen, så snart browseren tilbyder installation.'
      : 'Installer som app for hurtigere start og en mere native oplevelse på Raspberry Pi.';
    button.hidden = !canInstall;
    button.disabled = false;
  };

  const unsubscribe = manager.subscribe((nextState) => {
    if (nextState.canInstall || nextState.isInstalled) {
      transientMessage = '';
    }

    render(nextState);
  });

  const handleClick = async () => {
    button.disabled = true;
    const result = await manager.promptInstall();
    if (result.outcome === 'dismissed') {
      transientMessage = 'Installationen blev lukket uden at blive gennemført.';
    } else if (result.outcome === 'unavailable') {
      transientMessage = 'Installation er ikke tilgængelig endnu i denne browser.';
    }

    render(manager.getState());
  };

  button.addEventListener('click', handleClick);

  return () => {
    unsubscribe();
    button.removeEventListener('click', handleClick);
  };
}