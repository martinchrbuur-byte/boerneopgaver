import { createOrphanedRecordService } from './services/orphanedRecordService.js';
import { createCorruptionRecoveryService } from './services/corruptionRecoveryService.js';
import { resolveAppConfig } from './config/appConfig.js';
import { isSupabaseConfigured } from './config/supabaseConfig.js';
import { createChoreService } from './services/choreService.js';
import { createSprintService } from './services/sprintService.js';
import { createStorageService, KIDS } from './services/storageService.js';
import { initializeSupabaseData } from './services/supabaseService.js';
import { createMainView } from './ui/mainView.js';
import { renderFeedback, renderState, showMascot, showRoleSwitchWalk } from './ui/choreView.js';
import { renderLocalOnlyIndicator, renderSyncStatusIndicator } from './ui/syncStatusUI.js';

const DEFAULT_CHORES = ['Red seng', 'Børst tænder', 'Ryd legetøj op'];
const ALLOWED_ROLES = new Set(['parent', ...KIDS]);

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

async function init() {
  const appConfig = resolveAppConfig();

  const root = document.querySelector('#app');
  const viewRefs = createMainView(root);
  const storageService = createStorageService();
  const sprintService = createSprintService({ storageService });
  let activeTab = 'opgaver';
  const orphanedRecordService = createOrphanedRecordService();
  const corruptionRecoveryService = createCorruptionRecoveryService();
  let hasOrphanedRecords = false;
  let hasPendingSyncs = false;

  // Initialize Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      const supabaseData = await initializeSupabaseData();
      if (supabaseData) {
        storageService.setUserId(supabaseData.userId);
        const hasRemoteData =
          supabaseData.chores.length > 0 ||
          supabaseData.records.length > 0 ||
          supabaseData.sprints.length > 0 ||
          supabaseData.settings.sprintLengthDays !== 7;
        if (hasRemoteData) {
          const localData = storageService.loadData();
          storageService.saveData({
            ...localData,
            chores: supabaseData.chores,
            records: supabaseData.records,
            ui: supabaseData.ui,
            sprints: supabaseData.sprints,
            settings: supabaseData.settings
          });
        }
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

  renderState(viewRefs, choreState, { activeRole, activeTab, sprintUi, editState: sprintUi.editState });
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

    // Render sync status if configured
    if (isSupabaseConfigured()) {
      const syncState = storageService.getSyncState();
      if (syncState) {
        const syncStatusHtml = renderSyncStatusIndicator(syncState);
        if (syncStatusHtml && feedbackEl) {
          feedbackEl.insertAdjacentHTML('afterend', syncStatusHtml);

          // Check and display orphaned records warning (P5)
          const orphanSummary = orphanedRecordService.getOrphanedSummary(choreState.chores, choreState.records);
          if (orphanSummary && orphanSummary.count > 0) {
            hasOrphanedRecords = true;
            const warningHtml = orphanedRecordService.createCleanupWarningUI(orphanSummary);
            if (warningHtml && feedbackEl) {
              const existing = document.getElementById('orphaned-warning');
              if (!existing) {
                feedbackEl.insertAdjacentHTML('afterend', warningHtml);
              }
            }
          } else {
            hasOrphanedRecords = false;
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
    if (activeRole !== 'parent' && activeTab === 'historik') {
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
    if (nextTab === 'historik' && activeRole !== 'parent') {
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
      if (activeRole !== 'parent') {
        result = choreService.updateChore(choreId, { actorRole: activeRole });
      } else {
        const chore = latestChoreState?.chores.find(item => item.id === choreId);
        if (!chore) {
          result = choreService.updateChore(choreId, { actorRole: activeRole });
        } else {
          beginEdit(chore);
          result = { ok: true, message: 'Redigering aktiveret.' };
        }
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
      const activeSprint = sprintService.getActiveSprint() || sprintService.ensureActiveSprint();
      result = choreService.completeChore(choreId, { actorRole: activeRole, sprintId: activeSprint.id });
      if (result.ok) {
        // Check if all chores for this kid are fully done
        const kidChores = result.state.chores.filter(c => c.assignedTo?.includes(activeRole));
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
    } else if (action === 'accept-collab') {
      const activeSprint = sprintService.getActiveSprint() || sprintService.ensureActiveSprint();
      result = choreService.acceptCollaboration(collabId, { actorRole: activeRole, sprintId: activeSprint.id });
      if (result.ok) {
        showMascot(viewRefs.mascotOverlay, activeRole, 'Godt samarbejde! 🤝', { type: 'collab', duration: 3000 });
      }
    } else if (action === 'decline-collab') {
      result = choreService.declineCollaboration(collabId, { actorRole: activeRole });
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

  viewRefs.choreList.addEventListener('input', (event) => {
    const target = event.target.closest('[data-edit-field]');
    if (!target) {
      return;
    }

    updateEditDraftFromField(target);
  });

  viewRefs.choreList.addEventListener('change', (event) => {
    const target = event.target.closest('[data-edit-field]');
    if (!target) {
      return;
    }

    updateEditDraftFromField(target);
  });

  // Collab inbox delegation (collab proposals shown above the chore list)
  if (viewRefs.collabInbox) {
    viewRefs.collabInbox.addEventListener('click', (event) => {
      const actionButton = event.target.closest('button[data-action][data-collab-id]');
      if (!actionButton) return;

      const action = actionButton.getAttribute('data-action');
      const collabId = actionButton.getAttribute('data-collab-id');
      let result;

      if (action === 'accept-collab') {
        const activeSprint = sprintService.getActiveSprint() || sprintService.ensureActiveSprint();
        result = choreService.acceptCollaboration(collabId, { actorRole: activeRole, sprintId: activeSprint.id });
        if (result.ok) {
          showMascot(viewRefs.mascotOverlay, activeRole, 'Godt samarbejde! 🤝', { type: 'collab', duration: 3000 });
        }
      } else if (action === 'decline-collab') {
        result = choreService.declineCollaboration(collabId, { actorRole: activeRole });
      }

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

  // Expose syncNow globally for UI buttons
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

  // Expose cleanupOrphanedRecords globally for UI buttons (P5)
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
