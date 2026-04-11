import test from 'node:test';
import assert from 'node:assert/strict';

import { registerServiceWorker } from '../../src/pwa/registerServiceWorker.js';

test('registerServiceWorker skips unsupported environments', () => {
  const didRegister = registerServiceWorker({
    navigatorRef: {},
    windowRef: { isSecureContext: true },
    documentRef: { readyState: 'complete' },
    onError: () => {
      throw new Error('Should not be called');
    }
  });

  assert.equal(didRegister, false);
});

test('registerServiceWorker waits for window load before registering', async () => {
  let loadHandler = null;
  let registerUrl = null;

  const didRegister = registerServiceWorker({
    navigatorRef: {
      serviceWorker: {
        register: async (url) => {
          registerUrl = String(url);
        }
      }
    },
    windowRef: {
      isSecureContext: true,
      addEventListener: (eventName, handler, options) => {
        assert.equal(eventName, 'load');
        assert.equal(options?.once, true);
        loadHandler = handler;
      }
    },
    documentRef: { readyState: 'interactive' },
    onError: () => {
      throw new Error('Should not be called');
    }
  });

  assert.equal(didRegister, true);
  assert.equal(typeof loadHandler, 'function');

  await loadHandler();
  assert.match(registerUrl, /service-worker\.js$/);
});
