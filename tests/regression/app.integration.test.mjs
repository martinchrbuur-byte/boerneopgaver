import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

function click(window, element) {
  element.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
}

function submit(window, form) {
  form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
}

function enterParentPin(window, value = '2107') {
  const form = document.querySelector('#parent-pin-form');
  const input = document.querySelector('#parent-pin-input');
  assert.ok(form);
  assert.ok(input);
  input.value = value;
  submit(window, form);
}

async function withBootstrappedApp(run, { unlockInitialParent = true } = {}) {
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

    const parentPinDialog = document.querySelector('#parent-pin-dialog');
    if (parentPinDialog && !parentPinDialog.hidden && unlockInitialParent) {
      enterParentPin(window);
    }

    const roleSwitch = document.querySelector('#role-switch');
    const modeSwitch = document.querySelector('#mode-switch');
    const choresWorkspace = document.querySelector('#chores-workspace');
    const addChoreForm = document.querySelector('#add-chore-form');
    const choreNameInput = document.querySelector('#chore-name-input');
    const choreValueInput = document.querySelector('#chore-value-input');
    const choreList = document.querySelector('#chore-list');
    const roulettePanel = document.querySelector('#roulette-panel');
    const kidChorePagination = document.querySelector('#kid-chore-pagination');
    const kidChorePrevButton = document.querySelector('#kid-chore-prev-btn');
    const kidChoreNextButton = document.querySelector('#kid-chore-next-btn');
    const kidChorePageLabel = document.querySelector('#kid-chore-page-label');
    const kidDashboard = document.querySelector('#kid-dashboard');
    const kidProgressLabel = document.querySelector('#kid-progress-label');
    const kidTreasureLabel = document.querySelector('#kid-treasure-label');
    const kidRoleSwitch = document.querySelector('.kid-role-switch');
    const tabNav = document.querySelector('.tab-nav');
    const feedback = document.querySelector('#feedback');
    const moneySliderCount = document.querySelector('.money-slider-count');
    const mascotOverlay = document.querySelector('#mascot-overlay');
    const screensaverOverlay = document.querySelector('#screensaver-overlay');
    const screensaverWake = document.querySelector('#screensaver-wake');
    const kidHeroesComicCanvas = document.querySelector('#kid-heroes-comic-canvas');
    const eightBitHeroQuestCanvas = document.querySelector('#eight-bit-hero-quest-canvas');
    const feedbackForm = document.querySelector('#feedback-form');
    const feedbackTitleInput = document.querySelector('#feedback-title-input');
    const feedbackMessageInput = document.querySelector('#feedback-message-input');
    const feedbackHistory = document.querySelector('#feedback-history');
    const parentPinInput = document.querySelector('#parent-pin-input');
    const parentPinError = document.querySelector('#parent-pin-error');
    const parentLockButton = document.querySelector('#parent-lock-button');

    assert.ok(roleSwitch);
    assert.ok(modeSwitch);
    assert.ok(choresWorkspace);
    assert.ok(addChoreForm);
    assert.ok(choreNameInput);
    assert.ok(choreList);
    assert.ok(roulettePanel);
    assert.ok(kidChorePagination);
    assert.ok(kidChorePrevButton);
    assert.ok(kidChoreNextButton);
    assert.ok(kidChorePageLabel);
    assert.ok(kidDashboard);
    assert.ok(kidProgressLabel);
    assert.ok(kidTreasureLabel);
    assert.ok(kidRoleSwitch);
    assert.ok(tabNav);
    assert.ok(feedback);
    assert.ok(choreValueInput);
    assert.ok(moneySliderCount);
    assert.ok(mascotOverlay);
    assert.ok(screensaverOverlay);
    assert.ok(screensaverWake);
    assert.ok(kidHeroesComicCanvas);
    assert.ok(eightBitHeroQuestCanvas);
    assert.equal(screensaverOverlay.hidden, true);
    assert.ok(feedbackForm);
    assert.ok(feedbackTitleInput);
    assert.ok(feedbackMessageInput);
    assert.ok(feedbackHistory);

    await run({
      window,
      roleSwitch,
      modeSwitch,
      choresWorkspace,
      addChoreForm,
      choreNameInput,
      choreValueInput,
      choreList,
      roulettePanel,
      kidChorePagination,
      kidChorePrevButton,
      kidChoreNextButton,
      kidChorePageLabel,
      kidDashboard,
      kidProgressLabel,
      kidTreasureLabel,
      kidRoleSwitch,
      tabNav,
      feedback,
      moneySliderCount,
      mascotOverlay,
      screensaverOverlay,
      screensaverWake,
      feedbackForm,
      feedbackTitleInput,
      feedbackMessageInput,
      feedbackHistory,
      parentPinDialog,
      parentPinInput,
      parentPinError,
      parentLockButton,
      enterParentPin: value => enterParentPin(window, value),
    });
  } finally {
    dom.window.close();
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
    globalThis.localStorage = previousLocalStorage;
    globalThis.FormData = previousFormData;
  }
}

test('locking parent mode returns to a child and requires PIN again', async () => {
  await withBootstrappedApp(async ({ window, roleSwitch, parentLockButton, enterParentPin, kidDashboard }) => {
    assert.equal(parentLockButton.hidden, false);

    click(window, parentLockButton);
    assert.equal(kidDashboard.hidden, false);

    click(window, roleSwitch.querySelector('button[data-role="parent"]'));
    assert.equal(document.querySelector('#parent-pin-dialog').hidden, false);
    enterParentPin();
    assert.equal(document.querySelector('#parent-pin-dialog').hidden, true);
    assert.equal(kidDashboard.hidden, true);
  });
});

test('screensaver stays hidden during normal app use and role switching', async () => {
  await withBootstrappedApp(async ({ window, roleSwitch, screensaverOverlay, enterParentPin }) => {
    const andreaButton = roleSwitch.querySelector('button[data-role="Andrea"]');
    const parentButton = roleSwitch.querySelector('button[data-role="parent"]');
    assert.ok(andreaButton);
    assert.ok(parentButton);

    click(window, andreaButton);
    assert.equal(screensaverOverlay.hidden, true);

    screensaverOverlay.dispatchEvent(new window.Event('pointerdown', { bubbles: true }));
    assert.equal(screensaverOverlay.hidden, true);

    click(window, parentButton);
    enterParentPin('2106');
    assert.equal(document.querySelector('#parent-pin-dialog').hidden, false);
    enterParentPin();
    assert.equal(screensaverOverlay.hidden, true);
  });
});


test('parent mode starts locked and requires the exact PIN', async () => {
  await withBootstrappedApp(async ({
    parentPinDialog,
    kidDashboard,
    enterParentPin
  }) => {
    assert.equal(parentPinDialog.hidden, false);
    assert.equal(kidDashboard.hidden, false);

    enterParentPin('2106');
    assert.equal(parentPinDialog.hidden, false);
    assert.equal(document.querySelector('#parent-pin-error').textContent, 'PIN-koden er forkert.');

    enterParentPin();
    assert.equal(parentPinDialog.hidden, true);
    assert.equal(kidDashboard.hidden, true);
  }, { unlockInitialParent: false });
});
test('application bootstraps and supports parent/kid end-to-end flow', async () => {
  await withBootstrappedApp(async ({
    window,
    roleSwitch,
    addChoreForm,
    choreNameInput,
    choreValueInput,
    choreList,
    kidChoreNextButton,
    kidDashboard,
    kidProgressLabel,
    kidTreasureLabel,
    kidRoleSwitch,
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
    assert.equal(kidDashboard.hidden, false);
    assert.match(kidProgressLabel.textContent, /0 af 4 opgaver færdige/i);
    assert.match(kidTreasureLabel.textContent, /0\.00 kr i perioden/i);

    const hansButton = kidRoleSwitch.querySelector('button[data-kid-role="Hans Jørgen"]');
    assert.ok(hansButton);
    click(window, hansButton);
    assert.match(kidDashboard.textContent, /Hans Jørgen, er du klar/i);
    assert.equal(hansButton.getAttribute('aria-pressed'), 'true');

    const andreaFromHansButton = kidRoleSwitch.querySelector('button[data-kid-role="Andrea"]');
    assert.ok(andreaFromHansButton);
    click(window, andreaFromHansButton);
    assert.match(kidDashboard.textContent, /Andrea, er du klar/i);
    assert.equal(andreaFromHansButton.getAttribute('aria-pressed'), 'true');
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
    assert.match(kidProgressLabel.textContent, /1 af 4 opgaver færdige/i);
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

test('kid view keeps scrolling enabled and paginates long chore lists', async () => {
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
    for (let i = 1; i <= 10; i += 1) {
      choreNameInput.value = `Paged chore ${i}`;
      choreValueInput.value = '1';
      submit(window, addChoreForm);
    }

    const andreaButton = roleSwitch.querySelector('button[data-role="Andrea"]');
    assert.ok(andreaButton);
    click(window, andreaButton);

    assert.equal(document.body.classList.contains('kid-no-scroll'), false);
    assert.equal(document.documentElement.classList.contains('kid-no-scroll'), false);
    assert.equal(kidChorePagination.hidden, false);
    assert.match(kidChorePageLabel.textContent, /Side 1 af 2/i);
    assert.equal(choreList.querySelectorAll('.chore-item').length, 12);
    assert.equal(kidChorePrevButton.disabled, true);
    assert.equal(kidChoreNextButton.disabled, false);

    click(window, kidChoreNextButton);
    assert.match(kidChorePageLabel.textContent, /Side 2 af 2/i);
    assert.equal(choreList.querySelectorAll('.chore-item').length, 1);
    assert.equal(kidChoreNextButton.disabled, true);
  });
});

test('roulette modal stays open when the child view refreshes', async () => {
  await withBootstrappedApp(async ({ window, roleSwitch, roulettePanel, kidChoreNextButton }) => {
    click(window, roleSwitch.querySelector('button[data-role="Andrea"]'));

    const openButton = roulettePanel.querySelector('[data-roulette-open]');
    click(window, openButton);
    assert.equal(roulettePanel.querySelector('[data-roulette-modal]').hidden, false);

    click(window, kidChoreNextButton);
    assert.equal(roulettePanel.querySelector('[data-roulette-modal]').hidden, false);
  });
});

test('roulette wheel renders visible separators between task segments', async () => {
  await withBootstrappedApp(async ({ window, roleSwitch, roulettePanel }) => {
    click(window, roleSwitch.querySelector('button[data-role="Andrea"]'));
    click(window, roulettePanel.querySelector('[data-roulette-open]'));

    const wheel = roulettePanel.querySelector('[data-roulette-wheel]');
    assert.match(wheel.getAttribute('style'), /#ffffff/);
    assert.equal(wheel.querySelectorAll('.roulette-segment-label').length >= 1, true);
  });
});
