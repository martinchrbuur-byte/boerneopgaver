import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

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
    const modeSwitch = document.querySelector('#mode-switch');
    const choresWorkspace = document.querySelector('#chores-workspace');
    const spotifyWorkspace = document.querySelector('#spotify-workspace');
    const addChoreForm = document.querySelector('#add-chore-form');
    const choreNameInput = document.querySelector('#chore-name-input');
    const choreValueInput = document.querySelector('#chore-value-input');
    const choreList = document.querySelector('#chore-list');
    const kidChorePagination = document.querySelector('#kid-chore-pagination');
    const kidChorePrevButton = document.querySelector('#kid-chore-prev-btn');
    const kidChoreNextButton = document.querySelector('#kid-chore-next-btn');
    const kidChorePageLabel = document.querySelector('#kid-chore-page-label');
    const tabNav = document.querySelector('.tab-nav');
    const feedback = document.querySelector('#feedback');
    const moneySliderCount = document.querySelector('.money-slider-count');
    const mascotOverlay = document.querySelector('#mascot-overlay');
    const feedbackForm = document.querySelector('#feedback-form');
    const feedbackTitleInput = document.querySelector('#feedback-title-input');
    const feedbackMessageInput = document.querySelector('#feedback-message-input');
    const feedbackHistory = document.querySelector('#feedback-history');
    const spotifyStatus = document.querySelector('#spotify-status');
    const spotifyConnectLink = document.querySelector('#spotify-connect-link');
    const spotifyRefreshButton = document.querySelector('#spotify-refresh-btn');
    const spotifyPlaybackPreferencePanel = document.querySelector('#spotify-playback-preference-panel');
    const spotifyPlaybackPreferenceLabel = document.querySelector('#spotify-playback-preference-label');
    const spotifyList = document.querySelector('#spotify-list');
    const spotifyDevicePanel = document.querySelector('#spotify-device-panel');
    const spotifyDeviceTitle = document.querySelector('#spotify-device-title');
    const spotifyDeviceSelect = document.querySelector('#spotify-device-select');
    const spotifyDeviceStatus = document.querySelector('#spotify-device-status');
    const spotifyDeviceRefreshButton = document.querySelector('#spotify-device-refresh-btn');

    assert.ok(roleSwitch);
    assert.ok(modeSwitch);
    assert.ok(choresWorkspace);
    assert.ok(spotifyWorkspace);
    assert.ok(addChoreForm);
    assert.ok(choreNameInput);
    assert.ok(choreList);
    assert.ok(kidChorePagination);
    assert.ok(kidChorePrevButton);
    assert.ok(kidChoreNextButton);
    assert.ok(kidChorePageLabel);
    assert.ok(tabNav);
    assert.ok(feedback);
    assert.ok(choreValueInput);
    assert.ok(moneySliderCount);
    assert.ok(mascotOverlay);
    assert.ok(feedbackForm);
    assert.ok(feedbackTitleInput);
    assert.ok(feedbackMessageInput);
    assert.ok(feedbackHistory);
    assert.ok(spotifyStatus);
    assert.ok(spotifyConnectLink);
    assert.ok(spotifyRefreshButton);
    assert.ok(spotifyPlaybackPreferencePanel);
    assert.ok(spotifyPlaybackPreferenceLabel);
    assert.ok(spotifyList);
    assert.ok(spotifyDevicePanel);
    assert.ok(spotifyDeviceTitle);
    assert.ok(spotifyDeviceSelect);
    assert.ok(spotifyDeviceStatus);
    assert.ok(spotifyDeviceRefreshButton);

    await run({
      window,
      roleSwitch,
      modeSwitch,
      choresWorkspace,
      spotifyWorkspace,
      addChoreForm,
      choreNameInput,
      choreValueInput,
      choreList,
      kidChorePagination,
      kidChorePrevButton,
      kidChoreNextButton,
      kidChorePageLabel,
      tabNav,
      feedback,
      moneySliderCount,
      mascotOverlay,
      feedbackForm,
      feedbackTitleInput,
      feedbackMessageInput,
      feedbackHistory,
      spotifyStatus,
      spotifyConnectLink,
      spotifyRefreshButton,
      spotifyPlaybackPreferencePanel,
      spotifyPlaybackPreferenceLabel,
      spotifyList,
      spotifyDevicePanel,
      spotifyDeviceTitle,
      spotifyDeviceSelect,
      spotifyDeviceStatus,
      spotifyDeviceRefreshButton
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
    kidChoreNextButton,
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
    const andreaIconKey = mascotOverlay.querySelector('.mascot-emoji')?.dataset.iconKey;
    assert.match(andreaIconKey ?? '', /heart|flower|gift|diamond|rainbow|magic|kidAndrea/);

    let feedFishItem = Array.from(choreList.querySelectorAll('.chore-item'))
      .find(item => item.textContent.includes('Feed fish'));
    if (!feedFishItem && kidChoreNextButton) {
      click(window, kidChoreNextButton);
      feedFishItem = Array.from(choreList.querySelectorAll('.chore-item'))
        .find(item => item.textContent.includes('Feed fish'));
    }

    const feedFishMarker = feedFishItem?.querySelector('.chore-marker');
    assert.ok(feedFishMarker);
    assert.ok(feedFishMarker.dataset.iconKey);

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
    const hansIconKey = mascotOverlay.querySelector('.mascot-emoji')?.dataset.iconKey;
    assert.match(hansIconKey ?? '', /rocket|target|trophy|build|ball|idea|kidHans/);
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

test('period tab is parent-only and falls back to chores for child view', async () => {
  await withBootstrappedApp(async ({ window, roleSwitch, tabNav }) => {
    const periodTab = tabNav.querySelector('button[data-tab="periode"]');
    const choresTab = tabNav.querySelector('button[data-tab="opgaver"]');
    const choresPanel = document.querySelector('#tab-opgaver');
    const periodPanel = document.querySelector('#tab-periode');

    assert.ok(periodTab);
    assert.ok(choresTab);
    assert.ok(choresPanel);
    assert.ok(periodPanel);
    assert.equal(periodTab.hidden, false);

    click(window, periodTab);
    assert.equal(periodPanel.hidden, false);
    assert.equal(choresPanel.hidden, true);

    const andreaButton = roleSwitch.querySelector('button[data-role="Andrea"]');
    assert.ok(andreaButton);
    click(window, andreaButton);

    assert.equal(periodTab.hidden, true);
    assert.equal(periodPanel.hidden, true);
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

test('spotify tile shows a valid startup state', async () => {
  await withBootstrappedApp(async ({
    window,
    modeSwitch,
    choresWorkspace,
    spotifyWorkspace,
    spotifyStatus,
    spotifyConnectLink,
    spotifyRefreshButton,
    spotifyPlaybackPreferencePanel,
    spotifyPlaybackPreferenceLabel,
    spotifyList,
    spotifyDevicePanel,
    spotifyDeviceTitle,
    spotifyDeviceSelect,
    spotifyDeviceStatus,
    spotifyDeviceRefreshButton
  }) => {
    const spotifyModeButton = modeSwitch.querySelector('button[data-mode="spotify"]');
    assert.ok(spotifyModeButton);
    assert.equal(choresWorkspace.hidden, false);
    assert.equal(spotifyWorkspace.hidden, true);

    click(window, spotifyModeButton);
    assert.equal(choresWorkspace.hidden, true);
    assert.equal(spotifyWorkspace.hidden, false);

    assert.match(spotifyStatus.textContent, /spotify|henter|forbind/i);
    assert.equal(spotifyRefreshButton.hidden, true);
    assert.equal(typeof spotifyPlaybackPreferencePanel.hidden, 'boolean');
    assert.match(spotifyPlaybackPreferenceLabel.textContent, /spotify connect|airplay/i);
    assert.match(spotifyList.textContent, /forbundet|henter|anbefalinger/i);
    assert.equal(typeof spotifyConnectLink.hidden, 'boolean');
    assert.equal(typeof spotifyDevicePanel.hidden, 'boolean');
    assert.match(spotifyDeviceTitle.textContent, /afspil på|spotify connect/i);
    assert.equal(spotifyDeviceSelect.tagName, 'SELECT');
    assert.match(spotifyDeviceStatus.textContent, /enhed|højttaler/i);
    assert.equal(typeof spotifyDeviceRefreshButton.hidden, 'boolean');
  });
});

test('kid view enables no-scroll mode and paginates long chore lists', async () => {
  await withBootstrappedApp(async ({
    window,
    roleSwitch,
    addChoreForm,
    choreNameInput,
    choreValueInput,
    choreList,
    kidChorePagination,
    kidChorePrevButton,
    kidChoreNextButton,
    kidChorePageLabel
  }) => {
    for (let i = 1; i <= 4; i += 1) {
      choreNameInput.value = `Paged chore ${i}`;
      choreValueInput.value = '1';
      submit(window, addChoreForm);
    }

    const andreaButton = roleSwitch.querySelector('button[data-role="Andrea"]');
    assert.ok(andreaButton);
    click(window, andreaButton);

    assert.equal(document.body.classList.contains('kid-no-scroll'), true);
    assert.equal(document.documentElement.classList.contains('kid-no-scroll'), true);
    assert.equal(kidChorePagination.hidden, false);
    assert.match(kidChorePageLabel.textContent, /Side 1 af 3/i);
    assert.equal(choreList.querySelectorAll('.chore-item').length, 3);
    assert.equal(kidChorePrevButton.disabled, true);
    assert.equal(kidChoreNextButton.disabled, false);

    click(window, kidChoreNextButton);
    assert.match(kidChorePageLabel.textContent, /Side 2 af 3/i);
    assert.equal(choreList.querySelectorAll('.chore-item').length, 3);

    click(window, kidChoreNextButton);
    assert.match(kidChorePageLabel.textContent, /Side 3 af 3/i);
    assert.equal(choreList.querySelectorAll('.chore-item').length, 1);
    assert.equal(kidChoreNextButton.disabled, true);
  });
});
