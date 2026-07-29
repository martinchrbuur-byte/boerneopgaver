import { createOrphanedRecordService } from './services/orphanedRecordService.js';
import { createRemoteSnapshotKey, reconcileCloudSnapshot } from './services/remoteSyncService.js';
import { resolveAppConfig } from './config/appConfig.js';
import { isSupabaseConfigured } from './config/supabaseConfig.js';
import { applyDisplayMode, bindInstallPromptUi, createInstallPromptManager } from './pwa/installPrompt.js';
import { registerServiceWorker } from './pwa/registerServiceWorker.js';
import { initializeTouchScroll } from './pwa/touchScroll.js';
import { createChoreService } from './services/choreService.js';
import { createRouletteService } from './services/rouletteService.js';
import { createPeriodService } from './services/periodService.js';
import { createFeedbackService } from './services/feedbackService.js';
import { createChecklistService } from './services/checklistService.js';
import { createStorageService, KIDS } from './services/storageService.js';
import {
  getCurrentSession,
  initializeSupabaseData,
  onAuthStateChange,
  sendPasswordResetEmail,
  signOutCurrentUser,
  signInWithEmail,
  signUpWithEmail,
  updateCurrentUserPassword
} from './services/supabaseService.js';
import { createMainView } from './ui/mainView.js';
import { renderFeedback, renderState, showCoinToWallet, showMascot, showRoleSwitchWalk, showCinematicCelebration, showHelperByTrigger, initChoreTrails } from './ui/choreView.js';
import { unlockAudio, toggleMute, isMuted, playSound } from './shared/soundManager.js';
import { renderIcon } from './shared/iconRegistry.js';
import { renderChecklistParentPanel, renderChecklistFamilyView } from './ui/checklistView.js';
import { renderRouletteView } from './ui/rouletteView.js';
import { authErrorMessage, resolveInitialAuthPage, startAuthFlow } from './modules/authFlow.js';
import { createAppState } from './state/appState.js';
import { renderRefreshStatus } from './ui/refreshView.js';

const DEFAULT_CHORES = ['Red seng', 'Børst tænder', 'Ryd legetøj op'];
const KID_CHORE_PAGE_SIZE = 6;
const ALLOWED_ROLES = new Set(['parent', ...KIDS]);
let disposeActiveApp = null;
let isAuthTransitioning = false;
const installPromptManager = createInstallPromptManager();
applyDisplayMode();
initializeTouchScroll();

function seedStarterChores(choreService) {
  const state = choreService.getState();
  if (state.totalChores > 0) {
    return;
  }

  for (const choreName of DEFAULT_CHORES) {
    choreService.addChore(choreName, { actorRole: 'parent' });
  }
}

function seedStarterChecklists(checklistService, dateIso = new Date().toISOString().slice(0, 10)) {
  if (checklistService.getChecklist(dateIso).state.checklist) return;
  // Keep the starter checklist opt-in for parents: an empty checklist is not
  // created automatically, so kids never see a misleading empty task list.
}

function seedStarterRoulette(rouletteService) {
  const wheel = rouletteService.getWheel({ actorRole: 'parent' }).state.wheel;
  if (wheel.segments.length === 0) {
    return;
  }
  rouletteService.createWheel({ actorRole: 'parent', meta: { source: 'active-chores' } });
}

function isRole(value) {
  return typeof value === 'string' && ALLOWED_ROLES.has(value);
}

function resolveInitialRole(storedRole, configuredDefaultRole) {
  if (isRole(storedRole)) {
    return storedRole;
  }

  if (configuredDefaultRole === 'kid') {
    return KIDS[0];
  }

  return isRole(configuredDefaultRole) ? configuredDefaultRole : 'parent';
}

function calculateDaysLeft(endDate) {
  const now = new Date();
  const end = new Date(endDate);
  const diffMs = end.setHours(23, 59, 59, 999) - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function moveToAuthScreen(root, message = 'Session udløbet. Log ind igen.') {
  if (isAuthTransitioning) {
    return;
  }

  isAuthTransitioning = true;
  if (typeof disposeActiveApp === 'function') {
    const dispose = disposeActiveApp;
    disposeActiveApp = null;
    dispose();
  }

  await startAuthFlow({
    root,
    initialPage: 'login',
    message,
    init,
    signUpWithEmail,
    signInWithEmail,
    sendPasswordResetEmail,
    updateCurrentUserPassword
  });
  isAuthTransitioning = false;
}

async function init() {
  const appConfig = resolveAppConfig();

  const root = document.querySelector('#app');
  if (typeof disposeActiveApp === 'function') {
    const dispose = disposeActiveApp;
    disposeActiveApp = null;
    dispose();
  }

  let currentSession = null;

  if (isSupabaseConfigured()) {
    try {
      const session = await getCurrentSession();
      currentSession = session;
      if (!session?.user?.id) {
        await startAuthFlow({
          root,
          initialPage: resolveInitialAuthPage(),
          init,
          signUpWithEmail,
          signInWithEmail,
          sendPasswordResetEmail,
          updateCurrentUserPassword
        });
        return;
      }
    } catch (error) {
      await startAuthFlow({
        root,
        initialPage: 'welcome',
        message: authErrorMessage(error, 'Kunne ikke hente login-status.'),
        init,
        signUpWithEmail,
        signInWithEmail,
        sendPasswordResetEmail,
        updateCurrentUserPassword
      });
      return;
    }
  }

  const viewRefs = createMainView(root);

  // Unlock Web Audio on first gesture and initialise chore emoji trails
  document.addEventListener('pointerdown', unlockAudio, { once: true });
  document.addEventListener('keydown', unlockAudio, { once: true });

  // Wire up the mute toggle button (added in mainView)
  if (viewRefs.muteToggle) {
    viewRefs.muteToggle.setAttribute('aria-label', isMuted() ? 'Slå lyd til' : 'Slå lyd fra');
    viewRefs.muteToggle.innerHTML = isMuted()
      ? `${renderIcon('mute')}` : `${renderIcon('speaker')}`;
    viewRefs.muteToggle.addEventListener('click', () => {
      unlockAudio();
      const muted = toggleMute();
      viewRefs.muteToggle.innerHTML = muted
        ? `${renderIcon('mute')}` : `${renderIcon('speaker')}`;
      viewRefs.muteToggle.setAttribute('aria-label', muted ? 'Slå lyd til' : 'Slå lyd fra');
    });
  }
  const cleanupTasks = [];
  let isAppDisposed = false;
  disposeActiveApp = () => {
    isAppDisposed = true;
    while (cleanupTasks.length > 0) {
      const cleanup = cleanupTasks.pop();
      try {
        cleanup();
      } catch (error) {
        console.warn('Cleanup task failed:', error);
      }
    }
  };

  if (isSupabaseConfigured() && currentSession?.user?.email && viewRefs.accountSection && viewRefs.accountEmail) {
    viewRefs.accountSection.hidden = false;
    viewRefs.accountEmail.textContent = currentSession.user.email;
  }

  // Attach delegated emoji trail to the chore list (once)
  initChoreTrails(viewRefs.choreList);

  cleanupTasks.push(bindInstallPromptUi({
    manager: installPromptManager,
    section: viewRefs.pwaInstallSection,
    button: viewRefs.pwaInstallButton,
    status: viewRefs.pwaInstallStatus,
    hint: viewRefs.pwaInstallHint
  }));

  const storageService = createStorageService();
  const periodService = createPeriodService({ storageService });
  const feedbackService = createFeedbackService({ storageService });
  const checklistService = createChecklistService({ storageService });
  const appState = createAppState();
  const orphanedRecordService = createOrphanedRecordService();
  let lastRemoteSnapshotKey = null;
  let lastSyncStateSnapshot = null;

  cleanupTasks.push(() => {
    if (typeof document === 'undefined') {
      return;
    }

    document.documentElement.classList.remove('kid-no-scroll');
    document.body.classList.remove('kid-no-scroll');
  });

  function createSyncStateSnapshot(syncState) {
    if (!syncState) {
      return 'none';
    }

    return JSON.stringify({
      isPending: Boolean(syncState.isPending),
      isRetrying: Boolean(syncState.isRetrying),
      queueLength: Number(syncState.queueLength || 0),
      failureCount: Number(syncState.failureCount || 0),
      deadLetterCount: Number(syncState.deadLetterCount || 0),
      lastError: typeof syncState.lastError === 'string' ? syncState.lastError : null,
      lastSuccessfulSync: typeof syncState.lastSuccessfulSync === 'string' ? syncState.lastSuccessfulSync : null
    });
  }

  async function reconcileRemoteSnapshot(supabaseData) {
    storageService.setUserId(supabaseData.userId);

    const localData = storageService.loadData();
    const syncState = storageService.getSyncState();
    const result = reconcileCloudSnapshot({
      localData,
      syncState,
      supabaseData
    });

    if (result.action === 'claim-local') {
        storageService.updateData(data => ({ ...data }));
        await storageService.syncNow();
        return { applied: false, hasRemoteData: false, skippedReason: 'claimed-local' };
    }

    if (result.action === 'sync-pending') {
        storageService.syncNow();
      return { applied: false, hasRemoteData: false, skippedReason: null };
    }

    if (result.action === 'skip-remote') {
      console.log('Skipping remote merge because all changed sections are blocked by unsynced local changes.');
      storageService.syncNow();
      return { applied: false, hasRemoteData: true, skippedReason: 'unsynced-local' };
    }

    if (result.action !== 'apply-remote' || !result.nextData) {
      return { applied: false, hasRemoteData: true, skippedReason: 'no-change' };
    }

    if (Array.isArray(result.blockedSections) && result.blockedSections.length > 0) {
      console.log('Applying remote changes for unblocked sections only:', result.blockedSections);
    }

    storageService.saveDataWithOptions(result.nextData, {
      previousData: localData,
      source: 'remote',
      skipCloudSync: true
    });

    return { applied: true, hasRemoteData: true, skippedReason: null };
  }

  if (isSupabaseConfigured()) {
    try {
      const supabaseData = await initializeSupabaseData();
      if (supabaseData) {
        await reconcileRemoteSnapshot(supabaseData);
        lastRemoteSnapshotKey = createRemoteSnapshotKey(supabaseData);
        console.log('Connected to Supabase');
      }
    } catch (error) {
      console.warn('Failed to initialize Supabase, using localStorage:', error);
    }
  }

  const choreService = createChoreService({ storageService });
  const rouletteService = createRouletteService({ storageService, choreService });
  periodService.ensureActivePeriod();
  const storedRole = storageService.loadData().ui.activeRole;
  let activeRole = resolveInitialRole(storedRole, appConfig.defaultRole);
  let editingChoreId = null;
  let editDraft = null;
  let latestChoreState = null;

  function clearEditState() {
    editingChoreId = null;
    editDraft = null;
  }

  function beginEdit(chore) {
    editingChoreId = chore.id;
    editDraft = {
      name: chore.name,
      value: String(chore.value ?? 0),
      maxPerPeriod: String(chore.maxPerPeriod ?? 1),
      unlimitedDailyCap: String(chore.unlimitedDailyCap ?? 1),
      assignedTo: Array.isArray(chore.assignedTo) ? [...chore.assignedTo] : []
    };
  }

  function persistActiveRole() {
    if (!appConfig.persistRoleSelection) {
      return;
    }

    storageService.updateData((data) => ({
      ...data,
      ui: {
        ...data.ui,
        activeRole
      }
    }));
  }

  function refresh(message = '') {
    if (isAppDisposed || !root?.isConnected || typeof document === 'undefined') {
      return;
    }

    const isKidRole = activeRole !== 'parent';
    document.documentElement.classList.remove('kid-no-scroll');
    document.body.classList.remove('kid-no-scroll');

    const activePeriod = periodService.getActivePeriod();
    const activePeriodId = activePeriod?.id ?? null;
    const choreState = choreService.getState({ activePeriodId });
    const checklistDate = new Date().toISOString().slice(0, 10);
    if (activeRole === 'parent' && !checklistService.getChecklist(checklistDate).state.checklist) {
      checklistService.carryForwardChecklist(checklistDate, { actorRole: activeRole });
    }
    const checklistState = checklistService.getChecklist(checklistDate).state;

    if (activeRole !== 'parent') {
      clearEditState();
    }

    if (editingChoreId) {
      const exists = choreState.chores.some(chore => chore.id === editingChoreId);
      if (!exists) {
        clearEditState();
      }
    }

    latestChoreState = choreState;

    const periodUi = {
      activePeriod,
      settings: periodService.getSettings(),
      earnings: activePeriod ? periodService.getPeriodEarnings(activePeriod.id) : {},
      moneyProgress: activePeriod
        ? periodService.getPeriodMoneyProgress(activePeriod.id)
        : {
          total: { earned: 0, target: 0 },
          byKid: Object.fromEntries(KIDS.map(kid => [kid, { earned: 0, target: 0 }]))
        },
      history: periodService.getPeriodHistory(),
      daysLeft: activePeriod ? calculateDaysLeft(activePeriod.endDate) : 0,
      editState: editingChoreId && editDraft
        ? { choreId: editingChoreId, draft: editDraft }
        : null
    };

    const feedbackUi = {
      entries: feedbackService.listEntries()
    };

    const viewState = renderState(viewRefs, choreState, {
      activeRole,
      activeMode: appState.activeMode,
      activeTab: appState.activeTab,
      periodUi,
      feedbackUi,
      editState: periodUi.editState,
      kidUi: {
        page: appState.kidChorePage,
        pageSize: KID_CHORE_PAGE_SIZE
      }
    });
    const rouletteState = rouletteService.getWheel({
      actorRole: activeRole,
      targetKid: activeRole === 'parent' ? null : activeRole,
      activePeriodId
    }).state;
    renderRouletteView(viewRefs.roulettePanel, {
      state: rouletteState,
      activeRole,
      activePeriodId,
      rouletteService,
      onRefresh: refresh,
      onComplete: choreId => {
        const result = choreService.completeChore(choreId, { actorRole: activeRole, periodId: ensureActivePeriodId() });
        refresh(result.message);
      }
    });

    if (activeRole === 'parent') {
      renderChecklistParentPanel(viewRefs.checklistPanel, checklistState.checklist, {
        onCreate: () => {
          const result = checklistService.createChecklist(checklistDate, [], {}, { actorRole: activeRole });
          refresh(result.message);
        },
        onAddItem: title => {
          const result = checklistService.addItem(checklistDate, { title }, { actorRole: activeRole });
          refresh(result.message);
        },
        onReorder: orderedItemIds => {
          const result = checklistService.reorderItems(checklistDate, orderedItemIds, { actorRole: activeRole });
          refresh(result.message);
        }
      });
    } else {
      renderChecklistFamilyView(viewRefs.checklistPanel, checklistState.checklist, activeRole, {
        onToggle: itemId => {
          const result = checklistService.toggleComplete(checklistDate, itemId, activeRole, activeRole);
          if (result.ok && result.state.checklist?.items.every(item => item.completedAt)) {
            showCinematicCelebration(viewRefs.mascotOverlay, activeRole);
          }
          refresh(result.message);
        }
      });
    }

    if (isKidRole) {
      appState.kidChorePage = viewState?.kidChorePage ?? 1;
    } else {
      appState.kidChorePage = 1;
    }

    renderFeedback(viewRefs, message);

    renderRefreshStatus({
      feedbackElement: viewRefs.feedback,
      configured: isSupabaseConfigured(),
      online: navigator.onLine,
      syncState: storageService.getSyncState(),
      orphanSummary: orphanedRecordService.getOrphanedSummary(choreState.chores, choreState.records)
    });
  }

  seedStarterChores(choreService);
  seedStarterRoulette(rouletteService);
  seedStarterChecklists(checklistService);
  persistActiveRole();
  refresh();

  if (isSupabaseConfigured()) {
    lastSyncStateSnapshot = createSyncStateSnapshot(storageService.getSyncState());
    const syncStateIntervalId = setInterval(() => {
      const nextSnapshot = createSyncStateSnapshot(storageService.getSyncState());
      if (nextSnapshot !== lastSyncStateSnapshot) {
        lastSyncStateSnapshot = nextSnapshot;
        refresh();
      }
    }, 1000);
    cleanupTasks.push(() => clearInterval(syncStateIntervalId));
  }

  function handleCollabAction(action, collabId) {
    if (!collabId) {
      return null;
    }

    if (action === 'accept-collab') {
      const result = choreService.acceptCollaboration(collabId, { actorRole: activeRole, periodId: ensureActivePeriodId() });
      if (result.ok) {
        showCoinToWallet(viewRefs);
        showMascot(viewRefs.mascotOverlay, activeRole, 'Godt samarbejde!', { type: 'collab', duration: 3000 });
      }
      return result;
    }

    if (action === 'decline-collab') {
      return choreService.declineCollaboration(collabId, { actorRole: activeRole });
    }

    return null;
  }

  async function signOutAndReturnToAuth(message) {
    await moveToAuthScreen(root, message);
    Promise.race([signOutCurrentUser(), delay(1500)]).catch(() => {
    });
  }

  function ensureActivePeriodId() {
    const activePeriod = periodService.getActivePeriod() || periodService.ensureActivePeriod();
    return activePeriod.id;
  }

  if (isSupabaseConfigured()) {
    const authListener = onAuthStateChange(async (event, session) => {
      currentSession = session ?? null;
      if ((event === 'SIGNED_OUT' || !session?.user?.id) && !isAuthTransitioning) {
        await moveToAuthScreen(root, 'Session udløbet. Log ind igen.');
      }
    });
    cleanupTasks.push(() => authListener?.data?.subscription?.unsubscribe());

    const POLL_INTERVAL_MS = 15000;
    const pollIntervalId = setInterval(async () => {
      if (document.hidden || !navigator.onLine) {
        return;
      }

      try {
        const supabaseData = await initializeSupabaseData();
        if (!supabaseData) {
          return;
        }

        const nextRemoteSnapshotKey = createRemoteSnapshotKey(supabaseData);
        if (nextRemoteSnapshotKey === lastRemoteSnapshotKey) {
          return;
        }

        lastRemoteSnapshotKey = nextRemoteSnapshotKey;
        const result = await reconcileRemoteSnapshot(supabaseData);
        if (result.applied) {
          refresh('Data opdateret fra en anden enhed.');
        }
      } catch (error) {
        console.warn('Live sync poll failed:', error);
      }
    }, POLL_INTERVAL_MS);
    cleanupTasks.push(() => clearInterval(pollIntervalId));

    const onOnline = async () => {
      try {
        await storageService.syncNow();
        const supabaseData = await initializeSupabaseData();
        if (!supabaseData) {
          return;
        }

        lastRemoteSnapshotKey = createRemoteSnapshotKey(supabaseData);
        const result = await reconcileRemoteSnapshot(supabaseData);
        if (result.applied) {
          refresh('Data opdateret efter genforbindelse.');
        } else {
          refresh();
        }
      } catch (error) {
        console.warn('Failed to sync after reconnect:', error);
      }
    };
    window.addEventListener('online', onOnline);
    cleanupTasks.push(() => window.removeEventListener('online', onOnline));
  }

  if (isSupabaseConfigured() && viewRefs.logoutButton) {
    viewRefs.logoutButton.addEventListener('click', async () => {
      await signOutAndReturnToAuth('Du er logget ud.');
    });
  }

  if (isSupabaseConfigured() && viewRefs.switchAccountButton) {
    viewRefs.switchAccountButton.addEventListener('click', async () => {
      await signOutAndReturnToAuth('Log ind med en anden konto.');
    });
  }

  root.addEventListener('click', async (event) => {
    const actionElement = event.target.closest('[data-app-action]');
    if (!actionElement) {
      return;
    }

    const appAction = actionElement.getAttribute('data-app-action');
    if (appAction === 'sync-now') {
      console.log('Manual sync triggered by user');
      await storageService.syncNow();
      refresh('Syncing...');
      return;
    }

    if (appAction === 'retry-failed-sync') {
      console.log('Retry failed sync triggered by user');
      await storageService.retryFailedSync();
      refresh('Retrying failed sync items...');
      return;
    }

    if (appAction === 'cleanup-orphaned-records') {
      console.log('Cleanup orphaned records triggered');
      const choreState = choreService.getState();
      const { cleaned, orphanedCount } = orphanedRecordService.cleanOrphanedRecords(choreState.chores, choreState.records);

      if (orphanedCount > 0) {
        storageService.updateData((data) => ({
          ...data,
          records: cleaned
        }));
        refresh(`Cleaned up ${orphanedCount} orphaned records.`);
      } else {
        refresh('No orphaned records found');
      }
    }
  });

  viewRefs.roleSwitch.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-role]');
    if (!button) {
      return;
    }

    const nextRole = button.getAttribute('data-role');
    if (!isRole(nextRole) || nextRole === activeRole) {
      return;
    }

    activeRole = nextRole;
    persistActiveRole();
    if (activeRole !== 'parent') {
      appState.activeMode = 'chores';
      appState.activeTab = 'opgaver';
      appState.kidChorePage = 1;
    }
    if (activeRole !== 'parent' && (appState.activeTab === 'historik' || appState.activeTab === 'periode' || appState.activeTab === 'feedback')) {
      appState.activeTab = 'opgaver';
    }
    if (activeRole !== 'parent') {
      clearEditState();
      showRoleSwitchWalk(viewRefs.mascotOverlay, activeRole);
    }
    const message = activeRole === 'parent' ? 'Skiftet til forældrevisning.' : `Skiftet til ${activeRole}s visning.`;
    refresh(message);
  });

  if (viewRefs.kidParentExit) {
    viewRefs.kidParentExit.addEventListener('click', () => {
      activeRole = 'parent';
      appState.activeMode = 'chores';
      appState.activeTab = 'opgaver';
      appState.kidChorePage = 1;
      persistActiveRole();
      refresh('Skiftet til forældrevisning.');
    });
  }

  if (viewRefs.kidRoleSwitch) {
    viewRefs.kidRoleSwitch.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-kid-role]');
      const nextRole = button?.getAttribute('data-kid-role');
      if (!button || !isRole(nextRole) || nextRole === activeRole) {
        return;
      }

      activeRole = nextRole;
      appState.activeMode = 'chores';
      appState.activeTab = 'opgaver';
      appState.kidChorePage = 1;
      clearEditState();
      persistActiveRole();
      showRoleSwitchWalk(viewRefs.mascotOverlay, activeRole);
      refresh(`Skiftet til ${activeRole}s visning.`);
    });
  }

  if (viewRefs.modeSwitch) {
    viewRefs.modeSwitch.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-mode]');
      if (!button) {
        return;
      }

      const nextMode = button.getAttribute('data-mode');
      if (nextMode !== 'chores' || nextMode === appState.activeMode) {
        return;
      }

      appState.activeMode = nextMode;
      refresh('Opgavevisning åbnet.');
    });
  }

  viewRefs.tabNav.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-tab]');
    if (!button) {
      return;
    }

    const nextTab = button.getAttribute('data-tab');
    if ((nextTab === 'historik' || nextTab === 'periode' || nextTab === 'feedback') && activeRole !== 'parent') {
      return;
    }

    appState.activeTab = nextTab;
    // Small emoji confetti burst on tab switch
    if (typeof window.confetti === 'function' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.confetti({
        particleCount: 18,
        spread: 55,
        origin: { x: 0.5, y: 0.55 },
        gravity: 1.4,
        scalar: 0.7,
      });
    }
    playSound('pop');
    refresh();
  });

  if (viewRefs.kidChorePrevButton) {
    viewRefs.kidChorePrevButton.addEventListener('click', () => {
      if (activeRole === 'parent') {
        return;
      }

      appState.kidChorePage = Math.max(1, appState.kidChorePage - 1);
      refresh();
    });
  }

  if (viewRefs.kidChoreNextButton) {
    viewRefs.kidChoreNextButton.addEventListener('click', () => {
      if (activeRole === 'parent') {
        return;
      }

      appState.kidChorePage += 1;
      refresh();
    });
  }

  viewRefs.addChoreForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const formData = new FormData(viewRefs.addChoreForm);
    const choreName = formData.get('choreName');
    const choreValue = formData.get('choreValue');
    const choreMax = formData.get('choreMax') ?? '1';
    const choreUnlimitedCap = formData.get('choreUnlimitedCap') ?? '1';
    const assignedTo = formData.getAll('assignedTo');
    const result = choreService.addChore(choreName, {
      actorRole: activeRole,
      assignedTo,
      value: choreValue,
      maxPerPeriod: choreMax,
      unlimitedDailyCap: choreUnlimitedCap
    });
    if (result.ok) {
      viewRefs.addChoreForm.reset();
      viewRefs.choreValueInput.value = '0';
      if (viewRefs.choreMaxInput) viewRefs.choreMaxInput.value = '1';
      if (viewRefs.choreUnlimitedCapInput) viewRefs.choreUnlimitedCapInput.value = '1';
      viewRefs.choreNameInput.focus();
    }

    refresh(result.message);
  });

  if (viewRefs.feedbackForm) {
    viewRefs.feedbackForm.addEventListener('submit', (event) => {
      event.preventDefault();

      const formData = new FormData(viewRefs.feedbackForm);
      const result = feedbackService.createFeedbackEntry({
        actorRole: activeRole,
        title: formData.get('feedbackTitle'),
        category: formData.get('feedbackCategory'),
        message: formData.get('feedbackMessage')
      });

      if (result.ok) {
        viewRefs.feedbackForm.reset();
        if (viewRefs.feedbackCategoryInput) {
          viewRefs.feedbackCategoryInput.value = 'general';
        }
        viewRefs.feedbackMessageInput?.focus();
      }

      refresh(result.message);
    });
  }

  viewRefs.choreList.addEventListener('click', (event) => {
    const actionButton = event.target.closest('button[data-action][data-chore-id], button[data-action][data-collab-id]');
    if (!actionButton) {
      return;
    }

    const action = actionButton.getAttribute('data-action');
    const choreId = actionButton.getAttribute('data-chore-id');
    const collabId = actionButton.getAttribute('data-collab-id');
    let result;

    if (action === 'edit') {
      const chore = activeRole === 'parent'
        ? latestChoreState?.chores.find(item => item.id === choreId)
        : null;
      if (!chore) {
        result = choreService.updateChore(choreId, { actorRole: activeRole });
      } else {
        beginEdit(chore);
        result = { ok: true, message: 'Redigering aktiveret.' };
      }
    } else if (action === 'save-edit') {
      result = choreService.updateChore(choreId, {
        actorRole: activeRole,
        name: editDraft?.name,
        value: editDraft?.value,
        assignedTo: editDraft?.assignedTo,
        maxPerPeriod: editDraft?.maxPerPeriod,
        unlimitedDailyCap: editDraft?.unlimitedDailyCap
      });
      if (result.ok) {
        clearEditState();
      }
    } else if (action === 'cancel-edit') {
      clearEditState();
      result = { ok: true, message: 'Redigering annulleret.' };
    } else if (action === 'delete') {
      if (editingChoreId === choreId) {
        clearEditState();
      }
      result = choreService.deleteChore(choreId, { actorRole: activeRole });
    } else if (action === 'complete') {
      result = choreService.completeChore(choreId, { actorRole: activeRole, periodId: ensureActivePeriodId() });
      if (result.ok) {
        showCoinToWallet(viewRefs);
        const chores = Array.isArray(result.state?.chores) ? result.state.chores : [];
        const kidChores = chores.filter(c => c.assignedTo?.includes(activeRole));
        const allDone = kidChores.length > 0 && kidChores.every(c => c.isFullyDone || c.isCompleted);
        if (allDone) {
          showCinematicCelebration(viewRefs.mascotOverlay, activeRole);
        } else {
          showMascot(viewRefs.mascotOverlay, activeRole, 'Flot klaret!');
        }
      }
    } else if (action === 'undo') {
      const activePeriod = periodService.getActivePeriod();
      result = choreService.undoChore(choreId, { actorRole: activeRole, periodId: activePeriod?.id ?? null });
    } else if (action === 'propose-collab') {
      result = choreService.proposeCollaboration(choreId, { actorRole: activeRole });
    } else if (action === 'accept-collab' || action === 'decline-collab') {
      result = handleCollabAction(action, collabId);
    }

    if (result) refresh(result.message);
  });

  function updateEditDraftFromField(target) {
    const field = target.getAttribute('data-edit-field');
    const choreId = target.getAttribute('data-chore-id');
    if (!field || !choreId || choreId !== editingChoreId || !editDraft) {
      return;
    }

    if (field === 'assignedTo') {
      const kid = target.getAttribute('data-kid');
      if (!kid) {
        return;
      }

      const selected = new Set(Array.isArray(editDraft.assignedTo) ? editDraft.assignedTo : []);
      if (target.checked) {
        selected.add(kid);
      } else {
        selected.delete(kid);
      }
      editDraft.assignedTo = [...selected];
      return;
    }

    editDraft[field] = target.value;
  }

  function onEditDraftEvent(event) {
    const target = event.target.closest('[data-edit-field]');
    if (!target) {
      return;
    }

    updateEditDraftFromField(target);
  }

  viewRefs.choreList.addEventListener('input', onEditDraftEvent);
  viewRefs.choreList.addEventListener('change', onEditDraftEvent);

  if (viewRefs.collabInbox) {
    viewRefs.collabInbox.addEventListener('click', (event) => {
      const actionButton = event.target.closest('button[data-action][data-collab-id]');
      if (!actionButton) return;

      const action = actionButton.getAttribute('data-action');
      const collabId = actionButton.getAttribute('data-collab-id');
      const result = handleCollabAction(action, collabId);

      if (result) refresh(result.message);
    });
  }

  viewRefs.periodLengthSave.addEventListener('click', () => {
    const result = periodService.setPeriodLength(viewRefs.periodLengthInput.value, activeRole);
    refresh(result.message);
  });

  viewRefs.closePeriodBtn.addEventListener('click', () => {
    const result = periodService.closePeriod(activeRole);
    if (result.ok) {
      showMascot(viewRefs.mascotOverlay, 'parent', 'Periode betalt!', { type: 'confetti', duration: 4000 });
    }
    refresh(result.message);
  });
}

registerServiceWorker();

document.addEventListener('DOMContentLoaded', init);
