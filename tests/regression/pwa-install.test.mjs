import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import {
  applyDisplayMode,
  bindInstallPromptUi,
  createInstallPromptManager,
  isStandaloneMode
} from '../../src/pwa/installPrompt.js';

function createFakeWindow({ standalone = false } = {}) {
  const listeners = new Map();

  return {
    addEventListener(eventName, handler) {
      const handlers = listeners.get(eventName) || new Set();
      handlers.add(handler);
      listeners.set(eventName, handlers);
    },
    removeEventListener(eventName, handler) {
      listeners.get(eventName)?.delete(handler);
    },
    dispatch(eventName, event = {}) {
      for (const handler of listeners.get(eventName) || []) {
        handler(event);
      }
    },
    matchMedia(query) {
      return {
        matches: standalone && query === '(display-mode: standalone)'
      };
    }
  };
}

test('isStandaloneMode detects display-mode standalone', () => {
  const result = isStandaloneMode({
    windowRef: createFakeWindow({ standalone: true }),
    navigatorRef: {}
  });

  assert.equal(result, true);
});

test('install manager captures beforeinstallprompt and accepted install', async () => {
  const windowRef = createFakeWindow();
  const manager = createInstallPromptManager({ windowRef, navigatorRef: {} });
  const states = [];
  const unsubscribe = manager.subscribe(state => states.push(state));

  let prevented = false;
  let prompted = false;
  windowRef.dispatch('beforeinstallprompt', {
    preventDefault() {
      prevented = true;
    },
    async prompt() {
      prompted = true;
    },
    userChoice: Promise.resolve({ outcome: 'accepted' })
  });

  assert.equal(prevented, true);
  assert.equal(manager.getState().canInstall, true);

  const result = await manager.promptInstall();
  assert.equal(prompted, true);
  assert.equal(result.outcome, 'accepted');
  assert.equal(manager.getState().isInstalled, true);
  assert.equal(states.at(-1)?.isInstalled, true);

  unsubscribe();
  manager.dispose();
});

test('applyDisplayMode marks standalone and pwa launch on document root', () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: 'https://example.com/?source=pwa'
  });

  const result = applyDisplayMode({
    documentRef: dom.window.document,
    windowRef: dom.window,
    navigatorRef: { standalone: false }
  });

  assert.equal(result.launchSource, 'pwa');
  assert.equal(result.isStandalone, false);
  assert.equal(dom.window.document.documentElement.dataset.launchSource, 'pwa');
  assert.equal(dom.window.document.documentElement.dataset.displayMode, 'browser');
  assert.equal(dom.window.document.documentElement.classList.contains('launch-source-pwa'), true);

  dom.window.close();
});

test('bindInstallPromptUi toggles install and installed states', async () => {
  const dom = new JSDOM('<!doctype html><html><body><section id="wrap" hidden><p id="status"></p><p id="hint"></p><button id="install" hidden>Installer</button></section></body></html>');
  const windowRef = createFakeWindow();
  const manager = createInstallPromptManager({ windowRef, navigatorRef: {} });
  const section = dom.window.document.querySelector('#wrap');
  const status = dom.window.document.querySelector('#status');
  const hint = dom.window.document.querySelector('#hint');
  const button = dom.window.document.querySelector('#install');

  const cleanup = bindInstallPromptUi({ manager, section, button, status, hint });
  assert.equal(section.hidden, true);

  windowRef.dispatch('beforeinstallprompt', {
    preventDefault() {},
    async prompt() {},
    userChoice: Promise.resolve({ outcome: 'dismissed' })
  });

  assert.equal(section.hidden, false);
  assert.equal(button.hidden, false);
  assert.match(status.textContent, /Installer Opgavehelte/i);

  button.click();
  await new Promise(resolve => setTimeout(resolve, 0));

  assert.match(status.textContent, /Installationen blev lukket/i);
  assert.equal(button.hidden, true);

  windowRef.dispatch('appinstalled');
  assert.match(status.textContent, /installeret app/i);
  assert.equal(button.hidden, true);

  cleanup();
  manager.dispose();
  dom.window.close();
});