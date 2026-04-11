const SERVICE_WORKER_URL = new URL('../../service-worker.js', import.meta.url);

function isSecureWindow(windowRef) {
  return Boolean(windowRef?.isSecureContext || windowRef?.location?.hostname === 'localhost');
}

export function registerServiceWorker({
  navigatorRef = globalThis.navigator,
  windowRef = globalThis.window,
  documentRef = globalThis.document,
  onError = console.warn
} = {}) {
  if (!navigatorRef?.serviceWorker || !windowRef || !documentRef || !isSecureWindow(windowRef)) {
    return false;
  }

  const register = async () => {
    try {
      await navigatorRef.serviceWorker.register(SERVICE_WORKER_URL);
    } catch (error) {
      onError('Service worker registration failed', error);
    }
  };

  if (documentRef.readyState === 'complete') {
    void register();
    return true;
  }

  windowRef.addEventListener('load', () => {
    void register();
  }, { once: true });

  return true;
}
