import { createOrphanedRecordService } from './services/orphanedRecordService.js';
import { resolveAppConfig } from './config/appConfig.js';
import { isSupabaseConfigured } from './config/supabaseConfig.js';
import { createChoreService } from './services/choreService.js';
import { createSprintService } from './services/sprintService.js';
import { createFeedbackService } from './services/feedbackService.js';
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
import { createAuthView, createMainView } from './ui/mainView.js';
import { renderFeedback, renderState, showCoinToWallet, showMascot, showRoleSwitchWalk } from './ui/choreView.js';
import { renderLocalOnlyIndicator, renderSyncStatusIndicator } from './ui/syncStatusUI.js';
import { hasSectionChanges } from './shared/sectionDiff.js';

const DEFAULT_CHORES = ['Red seng', 'Børst tænder', 'Ryd legetøj op'];
const ALLOWED_ROLES = new Set(['parent', ...KIDS]);
let disposeActiveApp = null;
let isAuthTransitioning = false;

function seedStarterChores(choreService) {
  const state = choreService.getState();
  if (state.totalChores > 0) {
    return;
  }

  for (const choreName of DEFAULT_CHORES) {
    choreService.addChore(choreName, { actorRole: 'parent' });
  }
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

function maxIsoTimestamp(values) {
  const validValues = values.filter(value => typeof value === 'string' && value.length > 0);
  if (validValues.length === 0) {
    return null;
  }

  return validValues.reduce((latest, value) => (value > latest ? value : latest));
}

function resolveRemoteSectionTimestamps(supabaseData) {
  const choresUpdatedAt = maxIsoTimestamp((supabaseData.chores || []).map(item => item.createdAt));
  const recordsUpdatedAt = maxIsoTimestamp((supabaseData.records || []).flatMap(item => [item.completedAt, item.undoneAt]));
  const sprintsUpdatedAt = maxIsoTimestamp((supabaseData.sprints || []).flatMap(item => [item.createdAt, item.paidAt]));

  return {
    choresUpdatedAt,
    recordsUpdatedAt,
    uiUpdatedAt: supabaseData.ui?.updatedAt || null,
    feedbackUpdatedAt: maxIsoTimestamp((supabaseData.feedback || []).map(item => item.createdAt)),
    sprintsUpdatedAt,
    settingsUpdatedAt: supabaseData.settings?.updatedAt || null
  };
}

function pickNewerSection(localValue, remoteValue, localUpdatedAt, remoteUpdatedAt) {
  if (!remoteUpdatedAt && localUpdatedAt) {
    return localValue;
  }

  if (remoteUpdatedAt && !localUpdatedAt) {
    return remoteValue;
  }

  if (!remoteUpdatedAt && !localUpdatedAt) {
    const hasRemoteValues = Array.isArray(remoteValue)
      ? remoteValue.length > 0
      : Boolean(remoteValue && Object.keys(remoteValue).length > 0);
    return hasRemoteValues ? remoteValue : localValue;
  }

  return remoteUpdatedAt >= localUpdatedAt ? remoteValue : localValue;
}

function toRemoteStorageShape(supabaseData) {
  return {
    chores: supabaseData.chores,
    records: supabaseData.records,
    ui: { activeRole: supabaseData.ui.activeRole },
    feedback: supabaseData.feedback,
    sprints: supabaseData.sprints,
    settings: { sprintLengthDays: supabaseData.settings.sprintLengthDays }
  };
}

function createRemoteSnapshotKey(supabaseData) {
  const remoteShape = toRemoteStorageShape(supabaseData);
  const remoteTimestamps = resolveRemoteSectionTimestamps(supabaseData);
  return JSON.stringify({
    remoteShape,
    remoteTimestamps,
    userId: supabaseData.userId
  });
}

function authErrorMessage(error, fallback = 'Kunne ikke gennemføre login.') {
  if (!error || typeof error !== 'object') {
    return fallback;
  }

  if (typeof error.message === 'string' && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}

function resolveInitialAuthPage() {
  return window.location.hash === '#reset-password' ? 'reset-password' : 'welcome';
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

  await startAuthFlow(root, 'login', message);
  isAuthTransitioning = false;
}

async function startAuthFlow(root, initialPage = resolveInitialAuthPage(), message = '') {
  function render(page, feedbackMessage = '') {
    const authView = createAuthView(root, { page, message: feedbackMessage });
    const readField = (formData, key, trim = true) => {
      const value = String(formData.get(key) || '');
      return trim ? value.trim() : value;
    };
    const bindSubmit = (form, handler) => {
      if (!form) {
        return;
      }

      form.addEventListener('submit', async (event) => {
        event.preventDefault();
        await handler(new FormData(form));
      });
    };

    authView.navButtons.forEach(button => {
      button.addEventListener('click', () => {
        const nextPage = button.getAttribute('data-auth-nav') || 'welcome';
        render(nextPage);
      });
    });

    bindSubmit(authView.signupForm, async (formData) => {
      const email = readField(formData, 'email');
      const password = readField(formData, 'password', false);
      const passwordConfirm = readField(formData, 'passwordConfirm', false);

      if (password !== passwordConfirm) {
        render('signup', 'Adgangskoderne matcher ikke.');
        return;
      }

      try {
        const result = await signUpWithEmail(email, password);
        if (result?.session?.user?.id) {
          window.location.hash = '';
          await init();
          return;
        }

        render('login', 'Konto oprettet. Tjek email og log derefter ind.');
      } catch (error) {
        render('signup', authErrorMessage(error, 'Kunne ikke oprette konto.'));
      }
    });

    bindSubmit(authView.loginForm, async (formData) => {
      const email = readField(formData, 'email');
      const password = readField(formData, 'password', false);

      try {
        await signInWithEmail(email, password);
        window.location.hash = '';
        await init();
      } catch (error) {
        render('login', authErrorMessage(error, 'Login mislykkedes.'));
      }
    });

    bindSubmit(authView.forgotForm, async (formData) => {
      const email = readField(formData, 'email');

      try {
        await sendPasswordResetEmail(email);
        render('login', 'Nulstillingslink sendt. Tjek din email.');
      } catch (error) {
        render('forgot-password', authErrorMessage(error, 'Kunne ikke sende nulstillingslink.'));
      }
    });

    bindSubmit(authView.resetForm, async (formData) => {
      const password = readField(formData, 'password', false);
      const passwordConfirm = readField(formData, 'passwordConfirm', false);

      if (password !== passwordConfirm) {
        render('reset-password', 'Adgangskoderne matcher ikke.');
        return;
      }

      try {
        await updateCurrentUserPassword(password);
        window.location.hash = '';
        render('login', 'Adgangskode opdateret. Log ind igen.');
      } catch (error) {
        render('reset-password', authErrorMessage(error, 'Kunne ikke opdatere adgangskode.'));
      }
    });
  }

  render(initialPage, message);
}

function hasMeaningfulLocalData(data) {
  return (
    (data.chores || []).length > 0 ||
    (data.records || []).length > 0 ||
    (data.feedback || []).length > 0 ||
    (data.sprints || []).length > 0 ||
    (data.settings?.sprintLengthDays || 7) !== 7
  );
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
        await startAuthFlow(root, resolveInitialAuthPage());
        return;
      }
    } catch (error) {
      await startAuthFlow(root, 'welcome', authErrorMessage(error, 'Kunne ikke hente login-status.'));
      return;
    }
  }

  const viewRefs = createMainView(root);
  const cleanupTasks = [];
  disposeActiveApp = () => {
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

  const storageService = createStorageService();
  const sprintService = createSprintService({ storageService });
  const feedbackService = createFeedbackService({ storageService });
  let activeTab = 'opgaver';
  const orphanedRecordService = createOrphanedRecordService();
  let lastRemoteSnapshotKey = null;
  let lastSyncStateSnapshot = null;

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
    const hasUnsyncedLocalChanges =
      (syncState?.queueLength || 0) > 0 ||
      (syncState?.deadLetterCount || 0) > 0 ||
      (syncState?.failureCount || 0) > 0;

    const hasRemoteData =
      supabaseData.chores.length > 0 ||
      supabaseData.records.length > 0 ||
      supabaseData.feedback.length > 0 ||
      supabaseData.sprints.length > 0 ||
      supabaseData.settings.sprintLengthDays !== 7;

    if (!hasRemoteData) {
      if (hasMeaningfulLocalData(localData)) {
        storageService.updateData(data => ({ ...data }));
        await storageService.syncNow();
        return { applied: false, hasRemoteData: false, skippedReason: 'claimed-local' };
      }

      if (hasUnsyncedLocalChanges) {
        storageService.syncNow();
      }
      return { applied: false, hasRemoteData: false, skippedReason: null };
    }

    if (hasUnsyncedLocalChanges) {
      console.log('Skipping remote merge because unsynced local changes are pending.');
      storageService.syncNow();
      return { applied: false, hasRemoteData: true, skippedReason: 'unsynced-local' };
    }

    const localSyncMeta = localData.syncMeta || {};
    const remoteSectionTimestamps = resolveRemoteSectionTimestamps(supabaseData);
    const remoteShape = toRemoteStorageShape(supabaseData);

    const reconciledData = {
      ...localData,
      chores: pickNewerSection(
        localData.chores,
        remoteShape.chores,
        localSyncMeta.choresUpdatedAt,
        remoteSectionTimestamps.choresUpdatedAt
      ),
      records: pickNewerSection(
        localData.records,
        remoteShape.records,
        localSyncMeta.recordsUpdatedAt,
        remoteSectionTimestamps.recordsUpdatedAt
      ),
      ui: pickNewerSection(
        localData.ui,
        remoteShape.ui,
        localSyncMeta.uiUpdatedAt,
        remoteSectionTimestamps.uiUpdatedAt
      ),
      feedback: pickNewerSection(
        localData.feedback,
        remoteShape.feedback,
        localSyncMeta.feedbackUpdatedAt,
        remoteSectionTimestamps.feedbackUpdatedAt
      ),
      sprints: pickNewerSection(
        localData.sprints,
        remoteShape.sprints,
        localSyncMeta.sprintsUpdatedAt,
        remoteSectionTimestamps.sprintsUpdatedAt
      ),
      settings: pickNewerSection(
        localData.settings,
        remoteShape.settings,
        localSyncMeta.settingsUpdatedAt,
        remoteSectionTimestamps.settingsUpdatedAt
      )
    };

    if (!hasSectionChanges(localData, reconciledData)) {
      return { applied: false, hasRemoteData: true, skippedReason: 'no-change' };
    }

    storageService.saveDataWithOptions(reconciledData, {
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
  sprintService.ensureActiveSprint();
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
      maxPerSprint: String(chore.maxPerSprint ?? 1),
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
    const activeSprint = sprintService.getActiveSprint();
    const activeSprintId = activeSprint?.id ?? null;
    const choreState = choreService.getState({ activeSprintId });

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

    const sprintUi = {
      activeSprint,
      settings: sprintService.getSettings(),
      earnings: activeSprint ? sprintService.getSprintEarnings(activeSprint.id) : {},
      moneyProgress: activeSprint
        ? sprintService.getSprintMoneyProgress(activeSprint.id)
        : {
          total: { earned: 0, target: 0 },
          byKid: Object.fromEntries(KIDS.map(kid => [kid, { earned: 0, target: 0 }]))
        },
      history: sprintService.getSprintHistory(),
      daysLeft: activeSprint ? calculateDaysLeft(activeSprint.endDate) : 0,
      editState: editingChoreId && editDraft
        ? { choreId: editingChoreId, draft: editDraft }
        : null
    };

    const feedbackUi = {
      entries: feedbackService.listEntries()
    };

  renderState(viewRefs, choreState, { activeRole, activeTab, sprintUi, feedbackUi, editState: sprintUi.editState });
    renderFeedback(viewRefs, message);

    const feedbackEl = viewRefs.feedback;
    const existingSyncStatus = document.getElementById('sync-status');
    if (existingSyncStatus) {
      existingSyncStatus.remove();
    }

    const existingLocalOnlyStatus = document.getElementById('local-only-status');
    if (existingLocalOnlyStatus) {
      existingLocalOnlyStatus.remove();
    }

    if (feedbackEl) {
      if (!isSupabaseConfigured()) {
        feedbackEl.insertAdjacentHTML('afterend', renderLocalOnlyIndicator({ reason: 'missing-config' }));
      } else if (!navigator.onLine) {
        feedbackEl.insertAdjacentHTML('afterend', renderLocalOnlyIndicator({ reason: 'offline' }));
      }
    }

    if (isSupabaseConfigured()) {
      const syncState = storageService.getSyncState();
      if (syncState) {
        const syncStatusHtml = renderSyncStatusIndicator(syncState);
        if (syncStatusHtml && feedbackEl) {
          feedbackEl.insertAdjacentHTML('afterend', syncStatusHtml);

          const orphanSummary = orphanedRecordService.getOrphanedSummary(choreState.chores, choreState.records);
          if (orphanSummary && orphanSummary.count > 0) {
            const warningHtml = orphanedRecordService.createCleanupWarningUI(orphanSummary);
            if (warningHtml && feedbackEl) {
              const existing = document.getElementById('orphaned-warning');
              if (!existing) {
                feedbackEl.insertAdjacentHTML('afterend', warningHtml);
              }
            }
          } else {
            const existing = document.getElementById('orphaned-warning');
            if (existing) existing.remove();
          }
        }
      }
    }
  }

  seedStarterChores(choreService);
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
      const result = choreService.acceptCollaboration(collabId, { actorRole: activeRole, sprintId: ensureActiveSprintId() });
      if (result.ok) {
        showCoinToWallet(viewRefs);
        showMascot(viewRefs.mascotOverlay, activeRole, 'Godt samarbejde! 🤝', { type: 'collab', duration: 3000 });
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

  function ensureActiveSprintId() {
    const activeSprint = sprintService.getActiveSprint() || sprintService.ensureActiveSprint();
    return activeSprint.id;
  }

  if (isSupabaseConfigured()) {
    const authListener = onAuthStateChange(async (event, session) => {
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
    if (activeRole !== 'parent' && (activeTab === 'historik' || activeTab === 'sprint' || activeTab === 'feedback')) {
      activeTab = 'opgaver';
    }
    if (activeRole !== 'parent') {
      clearEditState();
      showRoleSwitchWalk(viewRefs.mascotOverlay, activeRole);
    }
    const message = activeRole === 'parent' ? 'Skiftet til forældrevisning.' : `Skiftet til ${activeRole}s visning.`;
    refresh(message);
  });

  viewRefs.tabNav.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-tab]');
    if (!button) {
      return;
    }

    const nextTab = button.getAttribute('data-tab');
    if ((nextTab === 'historik' || nextTab === 'sprint' || nextTab === 'feedback') && activeRole !== 'parent') {
      return;
    }

    activeTab = nextTab;
    refresh();
  });

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
      maxPerSprint: choreMax,
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
        maxPerSprint: editDraft?.maxPerSprint,
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
      result = choreService.completeChore(choreId, { actorRole: activeRole, sprintId: ensureActiveSprintId() });
      if (result.ok) {
        showCoinToWallet(viewRefs);
        const chores = Array.isArray(result.state?.chores) ? result.state.chores : [];
        const kidChores = chores.filter(c => c.assignedTo?.includes(activeRole));
        const allDone = kidChores.length > 0 && kidChores.every(c => c.isFullyDone || c.isCompleted);
        if (allDone) {
          showMascot(viewRefs.mascotOverlay, activeRole, 'Alle opgaver klaret! 🎉', { type: 'celebrate', duration: 4000 });
        } else {
          showMascot(viewRefs.mascotOverlay, activeRole, 'Flot klaret!');
        }
      }
    } else if (action === 'undo') {
      const activeSprint = sprintService.getActiveSprint();
      result = choreService.undoChore(choreId, { actorRole: activeRole, sprintId: activeSprint?.id ?? null });
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

  viewRefs.sprintLengthSave.addEventListener('click', () => {
    const result = sprintService.setSprintLength(viewRefs.sprintLengthInput.value, activeRole);
    refresh(result.message);
  });

  viewRefs.closeSprintBtn.addEventListener('click', () => {
    const result = sprintService.closeSprint(activeRole);
    if (result.ok) {
      showMascot(viewRefs.mascotOverlay, 'parent', 'Sprint betalt! 🎉', { type: 'confetti', duration: 4000 });
    }
    refresh(result.message);
  });

  window.syncNow = async () => {
    console.log('Manual sync triggered by user');
    await storageService.syncNow();
    refresh('Syncing...');
  };

  window.retryFailedSync = async () => {
    console.log('Retry failed sync triggered by user');
    await storageService.retryFailedSync();
    refresh('Retrying failed sync items...');
  };

  window.cleanupOrphanedRecords = () => {
    console.log('Cleanup orphaned records triggered');
    const choreState = choreService.getState();
    const { cleaned, orphanedCount } = orphanedRecordService.cleanOrphanedRecords(choreState.chores, choreState.records);

    if (orphanedCount > 0) {
      storageService.updateData((data) => ({
        ...data,
        records: cleaned
      }));
      refresh(`Cleaned up ${orphanedCount} orphaned records ✓`);
    } else {
      refresh('No orphaned records found');
    }
  };
}

document.addEventListener('DOMContentLoaded', init);
