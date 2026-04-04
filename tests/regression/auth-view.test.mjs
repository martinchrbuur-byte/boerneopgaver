import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createAuthView, createMainView } from '../../src/ui/mainView.js';

function setupDom() {
  const dom = new JSDOM('<!doctype html><html><body><main id="app"></main></body></html>');
  const { window } = dom;
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;

  globalThis.window = window;
  globalThis.document = window.document;

  return {
    dom,
    root: window.document.querySelector('#app'),
    restore() {
      dom.window.close();
      globalThis.window = previousWindow;
      globalThis.document = previousDocument;
    }
  };
}

test('auth view renders welcome landing with signup and login actions', () => {
  const env = setupDom();

  try {
    const refs = createAuthView(env.root, { page: 'welcome' });

    const heading = env.root.querySelector('.section-title');
    assert.ok(heading);
    assert.match(heading.textContent, /Velkommen/i);

    const signupBtn = env.root.querySelector('button[data-auth-nav="signup"]');
    const loginBtn = env.root.querySelector('button[data-auth-nav="login"]');
    assert.ok(signupBtn);
    assert.ok(loginBtn);
    assert.equal(refs.page, 'welcome');
  } finally {
    env.restore();
  }
});

test('auth view renders reset password form', () => {
  const env = setupDom();

  try {
    const refs = createAuthView(env.root, { page: 'reset-password', message: 'Test' });

    assert.ok(refs.resetForm);
    assert.equal(refs.loginForm, null);
    assert.equal(refs.signupForm, null);

    const passwordInput = env.root.querySelector('#reset-password');
    const confirmInput = env.root.querySelector('#reset-password-confirm');
    assert.ok(passwordInput);
    assert.ok(confirmInput);

    const feedback = env.root.querySelector('#auth-feedback');
    assert.match(feedback.textContent, /Test/);
  } finally {
    env.restore();
  }
});

test('main view renders hidden account controls for authenticated mode', () => {
  const env = setupDom();

  try {
    const refs = createMainView(env.root);

    assert.ok(refs.accountSection);
    assert.equal(refs.accountSection.hidden, true);
    assert.ok(refs.accountEmail);
    assert.ok(refs.switchAccountButton);
    assert.match(refs.switchAccountButton.textContent, /Skift konto/i);
    assert.ok(refs.logoutButton);
    assert.match(refs.logoutButton.textContent, /Log ud/i);
  } finally {
    env.restore();
  }
});

test('main view stacks recent completions below chores and marks sprint tab as parent-only', () => {
  const env = setupDom();

  try {
    createMainView(env.root);

    const choreGrid = env.root.querySelector('.chore-content-grid');
    const choreList = env.root.querySelector('#chore-list');
    const recentCompletions = env.root.querySelector('#recent-completions');
    const sprintTab = env.root.querySelector('button[data-tab="sprint"]');

    assert.ok(choreGrid);
    assert.ok(choreList);
    assert.ok(recentCompletions);
    assert.ok(sprintTab);
    assert.ok(sprintTab.classList.contains('tab-parent-only'));
    assert.equal(choreGrid.children.length, 3);
    assert.equal(choreGrid.children[1]?.querySelector('#chore-list'), choreList);
    assert.equal(choreGrid.children[2]?.querySelector('#recent-completions'), recentCompletions);
  } finally {
    env.restore();
  }
});
