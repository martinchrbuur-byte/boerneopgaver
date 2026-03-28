import { resolveAppConfig } from './config/appConfig.js';
import { createChoreService } from './services/choreService.js';
import { createStorageService, KIDS } from './services/storageService.js';
import { isSupabaseConfigured, initializeSupabaseData } from './services/supabaseService.js';
import { createMainView } from './ui/mainView.js';
import { renderFeedback, renderState } from './ui/choreView.js';

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

function init() {
  const appConfig = resolveAppConfig();

  const root = document.querySelector('#app');
  const viewRefs = createMainView(root);
  const storageService = createStorageService();

  // Initialize Supabase if configured
  if (isSupabaseConfigured()) {
    initializeSupabaseData()
      .then((supabaseData) => {
        if (supabaseData && supabaseData.userId) {
          storageService.setUserId(supabaseData.userId);
          console.log('Connected to Supabase');
        }
      })
      .catch((error) => {
        console.warn('Failed to initialize Supabase, using localStorage:', error);
      });
  }

  const choreService = createChoreService({ storageService });
  const storedRole = storageService.loadData().ui.activeRole;
  let activeRole = resolveInitialRole(storedRole, appConfig.defaultRole);

  function persistActiveRole() {
    if (!appConfig.persistRoleSelection) {
      return;
    }

    storageService.updateData((data) => ({
      chores: data.chores,
      records: data.records,
      ui: {
        ...data.ui,
        activeRole
      }
    }));
  }

  function refresh(message = '') {
    renderState(viewRefs, choreService.getState(), { activeRole });
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
    const message = activeRole === 'parent' ? 'Skiftet til forældrevisning.' : `Skiftet til ${activeRole}s visning.`;
    refresh(message);
  });

  viewRefs.addChoreForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const formData = new FormData(viewRefs.addChoreForm);
    const choreName = formData.get('choreName');
    const assignedTo = formData.getAll('assignedTo');
    const result = choreService.addChore(choreName, { actorRole: activeRole, assignedTo });
    if (result.ok) {
      viewRefs.addChoreForm.reset();
      viewRefs.choreNameInput.focus();
    }

    refresh(result.message);
  });

  viewRefs.choreList.addEventListener('click', (event) => {
    const actionButton = event.target.closest('button[data-action][data-chore-id]');
    if (!actionButton) {
      return;
    }

    const action = actionButton.getAttribute('data-action');
    const choreId = actionButton.getAttribute('data-chore-id');
    let result;

    if (action === 'delete') {
      result = choreService.deleteChore(choreId, { actorRole: activeRole });
    } else if (action === 'complete') {
      result = choreService.completeChore(choreId, { actorRole: activeRole });
    } else if (action === 'undo') {
      result = choreService.undoChore(choreId, { actorRole: activeRole });
    }

    refresh(result.message);
  });
}

document.addEventListener('DOMContentLoaded', init);
