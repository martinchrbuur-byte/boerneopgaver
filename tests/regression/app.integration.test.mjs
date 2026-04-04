import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const ANDREA_EMOJIS = [
  '🦄', '💖', '👧', '🌸', '🎀', '🧚', '🌷',
  '💐', '🦋', '⭐', '💎', '🌟', '🎊', '🎁'
];

const HANS_EMOJIS = [
  '🦕', '⚽', '👦', '🚀', '🛹', '🤖', '🎮',
  '🏀', '🔧', '🛸', '🚗', '💪', '🎯', '🔥', '⚡', '🏆'
];

function click(window, element) {
  element.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}

function submit(window, form) {
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
}

async function withBootstrappedApp(run) {
  const dom = new JSDOM(
    `<!doctype html><html><body><main id="app"></main></body></html>`,
    { url: 'http://localhost' }
  );

  const { window } = dom;
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousLocalStorage = globalThis.localStorage;
  const previousFormData = globalThis.FormData;

  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.localStorage = window.localStorage;
  globalThis.FormData = window.FormData;

  try {
    const appModuleUrl = new URL('../../src/app.js', import.meta.url);
    appModuleUrl.searchParams.set('t', `${Date.now()}_${Math.random()}`);
    await import(appModuleUrl.href);
    document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));

    const roleSwitch = document.querySelector('#role-switch');
    const addChoreForm = document.querySelector('#add-chore-form');
    const choreNameInput = document.querySelector('#chore-name-input');
    const choreValueInput = document.querySelector('#chore-value-input');
    const choreList = document.querySelector('#chore-list');
    const tabNav = document.querySelector('.tab-nav');
    const feedback = document.querySelector('#feedback');
    const moneySliderCount = document.querySelector('.money-slider-count');
    const mascotOverlay = document.querySelector('#mascot-overlay');
    const feedbackForm = document.querySelector('#feedback-form');
    const feedbackTitleInput = document.querySelector('#feedback-title-input');
    const feedbackMessageInput = document.querySelector('#feedback-message-input');
    const feedbackHistory = document.querySelector('#feedback-history');

    assert.ok(roleSwitch);
    assert.ok(addChoreForm);
    assert.ok(choreNameInput);
    assert.ok(choreList);
    assert.ok(tabNav);
    assert.ok(feedback);
    assert.ok(choreValueInput);
    assert.ok(moneySliderCount);
    assert.ok(mascotOverlay);
    assert.ok(feedbackForm);
    assert.ok(feedbackTitleInput);
    assert.ok(feedbackMessageInput);
    assert.ok(feedbackHistory);

    await run({
      window,
      roleSwitch,
      addChoreForm,
      choreNameInput,
      choreValueInput,
      choreList,
      tabNav,
      feedback,
      moneySliderCount,
      mascotOverlay,
      feedbackForm,
      feedbackTitleInput,
      feedbackMessageInput,
      feedbackHistory
    });
  } finally {
    dom.window.close();
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
    globalThis.localStorage = previousLocalStorage;
    globalThis.FormData = previousFormData;
  }
}

test('application bootstraps and supports parent/kid end-to-end flow', async () => {
  await withBootstrappedApp(async ({
    window,
    roleSwitch,
    addChoreForm,
    choreNameInput,
    choreValueInput,
    choreList,
    feedback,
    moneySliderCount,
    mascotOverlay
  }) => {
    const initialChoreCount = choreList.querySelectorAll('.chore-item').length;
    assert.equal(initialChoreCount, 3);

    choreNameInput.value = 'Feed fish';
    choreValueInput.value = '12';
    submit(window, addChoreForm);
    assert.match(feedback.textContent, /Opgave tilføjet/i);

    const afterAddCount = choreList.querySelectorAll('.chore-item').length;
    assert.equal(afterAddCount, 4);

    const andreaButton = roleSwitch.querySelector('button[data-role="Andrea"]');
    assert.ok(andreaButton);
    click(window, andreaButton);
    assert.equal(mascotOverlay.hidden, false);
    assert.ok(mascotOverlay.classList.contains('mascot-role-walk'));
    const andreaEmoji = mascotOverlay.querySelector('.mascot-emoji')?.textContent;
    assert.ok(ANDREA_EMOJIS.includes(andreaEmoji), `Expected emoji from Andrea set, got: ${andreaEmoji}`);

    const feedFishItem = Array.from(choreList.querySelectorAll('.chore-item'))
      .find(item => item.textContent.includes('Feed fish'));
    const feedFishMarker = feedFishItem?.querySelector('.chore-marker');
    assert.ok(feedFishMarker);
    assert.ok((feedFishMarker.textContent ?? '').trim().length > 0);

    const completeButton = feedFishItem?.querySelector('button[data-action="complete"]');
    assert.ok(completeButton);
    click(window, completeButton);

    assert.match(feedback.textContent, /fuldført/i);
    const refreshedMoneySliderCount = document.querySelector('.money-slider-count');
    assert.ok(refreshedMoneySliderCount);
    assert.match(refreshedMoneySliderCount.textContent, /kr/);
  });
});

test('switching to Hans Jørgen triggers giant dinosaur walk animation', async () => {
  await withBootstrappedApp(async ({ window, roleSwitch, mascotOverlay }) => {
    const hansButton = roleSwitch.querySelector('button[data-role="Hans Jørgen"]');
    assert.ok(hansButton);

    click(window, hansButton);

    assert.equal(mascotOverlay.hidden, false);
    assert.ok(mascotOverlay.classList.contains('mascot-role-walk'));
    const hansEmoji = mascotOverlay.querySelector('.mascot-emoji')?.textContent;
    assert.ok(HANS_EMOJIS.includes(hansEmoji), `Expected emoji from Hans set, got: ${hansEmoji}`);
  });
});

test('kid cannot add chores from UI submit', async () => {
  await withBootstrappedApp(async ({ window, roleSwitch, addChoreForm, choreNameInput, choreList, feedback }) => {
    const andreaButton = roleSwitch.querySelector('button[data-role="Andrea"]');
    assert.ok(andreaButton);
    click(window, andreaButton);

    const beforeCount = choreList.querySelectorAll('.chore-item').length;
    choreNameInput.value = 'Should not be added';
    submit(window, addChoreForm);

    assert.match(feedback.textContent, /Kun forældrevisning kan tilføje opgaver/i);
    const afterCount = choreList.querySelectorAll('.chore-item').length;
    assert.equal(afterCount, beforeCount);
  });
});

test('parent can save feedback and see read-only history', async () => {
  await withBootstrappedApp(async ({
    window,
    tabNav,
    feedback,
    feedbackForm,
    feedbackTitleInput,
    feedbackMessageInput,
    feedbackHistory
  }) => {
    const feedbackTab = tabNav.querySelector('button[data-tab="feedback"]');
    assert.ok(feedbackTab);

    click(window, feedbackTab);

    feedbackTitleInput.value = 'Mere fleksibel feedback';
    feedbackMessageInput.value = 'Det ville hjælpe, hvis jeg kan skrive ønsker direkte i appen.';
    submit(window, feedbackForm);

    assert.match(feedback.textContent, /Feedback gemt/i);
    assert.match(feedbackHistory.textContent, /Mere fleksibel feedback/i);
    assert.match(feedbackHistory.textContent, /skrive ønsker direkte/i);
  });
});

test('kid cannot submit parent feedback from UI submit', async () => {
  await withBootstrappedApp(async ({
    window,
    roleSwitch,
    feedbackForm,
    feedbackMessageInput,
    feedback,
    feedbackHistory
  }) => {
    const andreaButton = roleSwitch.querySelector('button[data-role="Andrea"]');
    assert.ok(andreaButton);
    click(window, andreaButton);

    feedbackMessageInput.value = 'Jeg prøver at sende feedback som barn';
    submit(window, feedbackForm);

    assert.match(feedback.textContent, /Kun forældrevisning kan sende feedback/i);
    assert.doesNotMatch(feedbackHistory.textContent, /Jeg prøver at sende feedback som barn/i);
  });
});

test('sprint tab is parent-only and falls back to chores for child view', async () => {
  await withBootstrappedApp(async ({ window, roleSwitch, tabNav }) => {
    const sprintTab = tabNav.querySelector('button[data-tab="sprint"]');
    const choresTab = tabNav.querySelector('button[data-tab="opgaver"]');
    const choresPanel = document.querySelector('#tab-opgaver');
    const sprintPanel = document.querySelector('#tab-sprint');

    assert.ok(sprintTab);
    assert.ok(choresTab);
    assert.ok(choresPanel);
    assert.ok(sprintPanel);
    assert.equal(sprintTab.hidden, false);

    click(window, sprintTab);
    assert.equal(sprintPanel.hidden, false);
    assert.equal(choresPanel.hidden, true);

    const andreaButton = roleSwitch.querySelector('button[data-role="Andrea"]');
    assert.ok(andreaButton);
    click(window, andreaButton);

    assert.equal(sprintTab.hidden, true);
    assert.equal(sprintPanel.hidden, true);
    assert.equal(choresPanel.hidden, false);
    assert.equal(choresTab.getAttribute('aria-selected'), 'true');
  });
});

test('parent cannot complete chores even if invalid action is triggered', async () => {
  await withBootstrappedApp(async ({ window, choreList, feedback }) => {
    const deleteButton = choreList.querySelector('button[data-action="delete"][data-chore-id]');
    assert.ok(deleteButton);
    const choreId = deleteButton.getAttribute('data-chore-id');

    const spoofedCompleteButton = window.document.createElement('button');
    spoofedCompleteButton.setAttribute('data-action', 'complete');
    spoofedCompleteButton.setAttribute('data-chore-id', choreId);
    choreList.appendChild(spoofedCompleteButton);

    click(window, spoofedCompleteButton);
    assert.match(feedback.textContent, /Kun børnevisning kan fuldføre eller fortryde opgaver/i);
  });
});

test('kid cannot delete chores even if invalid action is triggered', async () => {
  await withBootstrappedApp(async ({ window, roleSwitch, choreList, feedback }) => {
    const andreaButton = roleSwitch.querySelector('button[data-role="Andrea"]');
    assert.ok(andreaButton);
    click(window, andreaButton);

    const completeButton = choreList.querySelector('button[data-action="complete"][data-chore-id]');
    assert.ok(completeButton);
    const choreId = completeButton.getAttribute('data-chore-id');

    const spoofedDeleteButton = window.document.createElement('button');
    spoofedDeleteButton.setAttribute('data-action', 'delete');
    spoofedDeleteButton.setAttribute('data-chore-id', choreId);
    choreList.appendChild(spoofedDeleteButton);

    click(window, spoofedDeleteButton);
    assert.match(feedback.textContent, /Kun forældrevisning kan tilføje opgaver/i);
  });
});
