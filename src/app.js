import { resolveAppConfig } from './config/appConfig.js';
import { isSupabaseConfigured } from './config/supabaseConfig.js';
import { createChoreService } from './services/choreService.js';
import { createSprintService } from './services/sprintService.js';
import { createStorageService, KIDS } from './services/storageService.js';
import { initializeSupabaseData } from './services/supabaseService.js';
import { createMainView } from './ui/mainView.js';
import { renderFeedback, renderState, showMascot } from './ui/choreView.js';

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
      daysLeft: activeSprint ? calculateDaysLeft(activeSprint.endDate) : 0
    };

    renderState(viewRefs, choreService.getState({ activeSprintId }), { activeRole, activeTab, sprintUi });
    renderFeedback(viewRefs, message);
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

    if (action === 'delete') {
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
}

document.addEventListener('DOMContentLoaded', init);
