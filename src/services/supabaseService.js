import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG, isSupabaseConfigured, getPublishableKey } from '../config/supabaseConfig.js';

let supabaseClient = null;
const schemaCapabilities = {
  choresMaxPerSprint: true,
  choresUnlimitedDailyCap: true,
  recordsSprintFields: true,
  appSettingsTable: true,
  sprintsTable: true
};

function errorMessage(error) {
  return typeof error?.message === 'string' ? error.message : '';
}

function isMissingColumnError(error, table, column) {
  if (error?.code !== 'PGRST204') {
    return false;
  }

  const message = errorMessage(error);
  return message.includes(`'${column}'`) && message.includes(`'${table}'`);
}

function isMissingTableError(error, table) {
  if (error?.code !== 'PGRST205') {
    return false;
  }

  const message = errorMessage(error).toLowerCase();
  const tableName = String(table || '').toLowerCase();
  return message.includes(tableName);
}

export async function getCurrentSession() {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.getSession();
  if (error) {
    throw error;
  }

  return data?.session || null;
}

export function onAuthStateChange(callback) {
  const client = getSupabaseClient();
  return client.auth.onAuthStateChange(callback);
}

export async function signUpWithEmail(email, password) {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.signUp({ email, password });
  if (error) {
    throw error;
  }

  return data;
}

export async function signInWithEmail(email, password) {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw error;
  }

  return data;
}

export async function signOutCurrentUser() {
  const client = getSupabaseClient();
  const { error } = await client.auth.signOut({ scope: 'local' });
  if (error) {
    throw error;
  }
}

export async function sendPasswordResetEmail(email) {
  const client = getSupabaseClient();
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}${window.location.pathname}#reset-password`
  });

  if (error) {
    throw error;
  }
}

export async function updateCurrentUserPassword(password) {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.updateUser({ password });
  if (error) {
    throw error;
  }

  return data;
}

function toAppChore(chore) {
  return {
    id: chore.id,
    name: chore.name,
    createdAt: chore.created_at,
    assignedTo: chore.assigned_to,
    value: typeof chore.value === 'number' ? chore.value : 0,
    maxPerSprint: typeof chore.max_per_sprint === 'number' ? chore.max_per_sprint : 1,
    unlimitedDailyCap: Number.isInteger(chore.unlimited_daily_cap) && chore.unlimited_daily_cap >= 1
      ? chore.unlimited_daily_cap
      : 1
  };
}

function toAppRecord(record) {
  return {
    id: record.id,
    choreId: record.chore_id,
    completedAt: record.completed_at,
    undoneAt: record.undone_at,
    sprintId: record.sprint_id || null,
    completedBy: record.completed_by || undefined,
    earnedValue: typeof record.earned_value === 'number' ? record.earned_value : undefined
  };
}

function toAppSprint(sprint) {
  return {
    id: sprint.id,
    startDate: sprint.start_date,
    endDate: sprint.end_date,
    status: sprint.status,
    paidAt: sprint.paid_at || null,
    createdAt: sprint.created_at
  };
}
export function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Please set a publishable key.');
  }

  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_CONFIG.url, getPublishableKey());
  }

  return supabaseClient;
}

export async function initializeSupabaseData() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const client = getSupabaseClient();

    const { data: { user } } = await client.auth.getUser();
    if (!user?.id) {
      return null;
    }

    const userId = user.id;

    // Load chores
    const { data: chores, error: choresError } = await client
      .from('chores')
      .select('*')
      .eq('user_id', userId);

    if (choresError) throw choresError;

    // Load records
    const { data: records, error: recordsError } = await client
      .from('records')
      .select('*')
      .eq('user_id', userId);

    if (recordsError) throw recordsError;

    // Load UI state
    const { data: uiStateData, error: uiError } = await client
      .from('ui_state')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (uiError && uiError.code !== 'PGRST116') throw uiError; // 404 is not an error

    // Load sprints
    let sprints = [];
    if (schemaCapabilities.sprintsTable) {
      const { data: sprintsData, error: sprintsError } = await client
        .from('sprints')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (sprintsError) {
        if (isMissingTableError(sprintsError, 'sprints')) {
          schemaCapabilities.sprintsTable = false;
          sprints = [];
        } else {
          throw sprintsError;
        }
      } else {
        sprints = sprintsData || [];
      }
    }

    // Load settings
    let settingsData = null;
    if (schemaCapabilities.appSettingsTable) {
      const { data: settingsRow, error: settingsError } = await client
        .from('app_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (settingsError && settingsError.code !== 'PGRST116') {
        if (isMissingTableError(settingsError, 'app_settings')) {
          schemaCapabilities.appSettingsTable = false;
          settingsData = null;
        } else {
          throw settingsError;
        }
      } else {
        settingsData = settingsRow;
      }
    }

    return {
      chores: (chores || []).map(toAppChore),
      records: (records || []).map(toAppRecord),
      ui: uiStateData
        ? { activeRole: uiStateData.active_role, updatedAt: uiStateData.updated_at || null }
        : { activeRole: 'parent', updatedAt: null },
      sprints: (sprints || []).map(toAppSprint),
      settings: settingsData
        ? {
          sprintLengthDays: settingsData.sprint_length_days,
          updatedAt: settingsData.updated_at || null
        }
        : { sprintLengthDays: 7, updatedAt: null },
      userId
    };
  } catch (error) {
    console.error('Error loading data from Supabase:', error);
    throw error;
  }
}

export async function saveChores(chores, userId) {
  const client = getSupabaseClient();

  try {
    const buildPayload = () => chores.map(chore => {
      const row = {
        id: chore.id,
        name: chore.name,
        created_at: chore.createdAt,
        assigned_to: chore.assignedTo,
        user_id: userId,
        value: chore.value ?? 0
      };

      if (schemaCapabilities.choresMaxPerSprint) {
        row.max_per_sprint = chore.maxPerSprint ?? 1;
      }

      if (schemaCapabilities.choresUnlimitedDailyCap) {
        row.unlimited_daily_cap = chore.unlimitedDailyCap ?? 1;
      }

      return row;
    });

    const runUpsert = async () => client.from('chores').upsert(buildPayload(), { onConflict: 'id' });

    let { error } = await runUpsert();

    if (error && isMissingColumnError(error, 'chores', 'max_per_sprint')) {
      schemaCapabilities.choresMaxPerSprint = false;
      ({ error } = await runUpsert());
    }

    if (error && isMissingColumnError(error, 'chores', 'unlimited_daily_cap')) {
      schemaCapabilities.choresUnlimitedDailyCap = false;
      ({ error } = await runUpsert());
    }

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error saving chores to Supabase:', error);
    throw error;
  }
}

export async function saveRecords(records, userId) {
  const client = getSupabaseClient();

  try {
    const buildPayload = () => records.map(record => {
      const row = {
        id: record.id,
        chore_id: record.choreId,
        completed_at: record.completedAt,
        undone_at: record.undoneAt,
        user_id: userId
      };

      if (schemaCapabilities.recordsSprintFields) {
        row.sprint_id = record.sprintId || null;
        row.completed_by = record.completedBy || null;
        row.earned_value = typeof record.earnedValue === 'number' ? record.earnedValue : null;
      }

      return row;
    });

    const runUpsert = async () => client.from('records').upsert(buildPayload(), { onConflict: 'id' });

    let { error } = await runUpsert();

    if (error && (
      isMissingColumnError(error, 'records', 'sprint_id') ||
      isMissingColumnError(error, 'records', 'completed_by') ||
      isMissingColumnError(error, 'records', 'earned_value')
    )) {
      schemaCapabilities.recordsSprintFields = false;
      ({ error } = await runUpsert());
    }

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error saving records to Supabase:', error);
    throw error;
  }
}

export async function saveUiState(activeRole, userId) {
  const client = getSupabaseClient();

  try {
    const { error } = await client
      .from('ui_state')
      .upsert(
        { id: userId, active_role: activeRole, user_id: userId },
        { onConflict: 'id' }
      );

    if (error) throw error;
  } catch (error) {
    console.error('Error saving UI state to Supabase:', error);
    throw error;
  }
}

export async function saveSprints(sprints, userId) {
  if (!schemaCapabilities.sprintsTable) {
    return;
  }

  const client = getSupabaseClient();

  try {
    const { error: deleteError } = await client.from('sprints').delete().eq('user_id', userId);
    if (deleteError) {
      if (isMissingTableError(deleteError, 'sprints')) {
        schemaCapabilities.sprintsTable = false;
        return;
      }
      throw deleteError;
    }

    if (sprints.length === 0) return;

    const { error } = await client.from('sprints').insert(
      sprints.map(sprint => ({
        id: sprint.id,
        user_id: userId,
        start_date: sprint.startDate,
        end_date: sprint.endDate,
        status: sprint.status,
        paid_at: sprint.paidAt || null,
        created_at: sprint.createdAt
      }))
    );

    if (error) {
      if (isMissingTableError(error, 'sprints')) {
        schemaCapabilities.sprintsTable = false;
        return;
      }
      throw error;
    }
  } catch (error) {
    console.error('Error saving sprints to Supabase:', error);
    throw error;
  }
}

export async function saveSettings(settings, userId) {
  if (!schemaCapabilities.appSettingsTable) {
    return;
  }

  const client = getSupabaseClient();

  try {
    const { error } = await client.from('app_settings').upsert({
      user_id: userId,
      sprint_length_days: settings.sprintLengthDays,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

    if (error) {
      if (isMissingTableError(error, 'app_settings')) {
        schemaCapabilities.appSettingsTable = false;
        return;
      }
      throw error;
    }
  } catch (error) {
    console.error('Error saving settings to Supabase:', error);
    throw error;
  }
}
