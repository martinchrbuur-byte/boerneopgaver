import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG, isSupabaseConfigured, getPublishableKey } from '../config/supabaseConfig.js';
import { nowIsoTimestamp } from '../shared/dateTime.js';

let supabaseClient = null;
const NOT_FOUND_CODE = 'PGRST116';
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

function throwIfError(error) {
  if (error) {
    throw error;
  }
}

function shouldIgnoreNotFound(error) {
  return error?.code === NOT_FOUND_CODE;
}

export async function getCurrentSession() {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.getSession();
  throwIfError(error);
  return data?.session || null;
}

export function onAuthStateChange(callback) {
  const client = getSupabaseClient();
  return client.auth.onAuthStateChange(callback);
}

export async function signUpWithEmail(email, password) {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.signUp({ email, password });
  throwIfError(error);
  return data;
}

export async function signInWithEmail(email, password) {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  throwIfError(error);
  return data;
}

export async function signOutCurrentUser() {
  const client = getSupabaseClient();
  const { error } = await client.auth.signOut({ scope: 'local' });
  throwIfError(error);
}

export async function sendPasswordResetEmail(email) {
  const client = getSupabaseClient();
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}${window.location.pathname}#reset-password`
  });
  throwIfError(error);
}

export async function updateCurrentUserPassword(password) {
  const client = getSupabaseClient();
  const { data, error } = await client.auth.updateUser({ password });
  throwIfError(error);
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

  const client = getSupabaseClient();

  const { data: { user } } = await client.auth.getUser();
  if (!user?.id) {
    return null;
  }

  const userId = user.id;

  const { data: chores, error: choresError } = await client
    .from('chores')
    .select('*')
    .eq('user_id', userId);
  throwIfError(choresError);

  const { data: records, error: recordsError } = await client
    .from('records')
    .select('*')
    .eq('user_id', userId);
  throwIfError(recordsError);

  const { data: uiStateData, error: uiError } = await client
    .from('ui_state')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (uiError && !shouldIgnoreNotFound(uiError)) throw uiError;

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
      } else {
        throw sprintsError;
      }
    } else {
      sprints = sprintsData || [];
    }
  }

  let settingsData = null;
  if (schemaCapabilities.appSettingsTable) {
    const { data: settingsRow, error: settingsError } = await client
      .from('app_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (settingsError && !shouldIgnoreNotFound(settingsError)) {
      if (isMissingTableError(settingsError, 'app_settings')) {
        schemaCapabilities.appSettingsTable = false;
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
}

export async function saveChores(chores, userId) {
  const client = getSupabaseClient();

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

  throwIfError(error);
}

export async function saveRecords(records, userId) {
  const client = getSupabaseClient();

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

  throwIfError(error);
}

export async function saveUiState(activeRole, userId) {
  const client = getSupabaseClient();

  const { error } = await client
    .from('ui_state')
    .upsert(
      { id: userId, active_role: activeRole, user_id: userId },
      { onConflict: 'id' }
    );
  throwIfError(error);
}

export async function saveSprints(sprints, userId) {
  if (!schemaCapabilities.sprintsTable) {
    return;
  }

  const client = getSupabaseClient();

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
}

export async function saveSettings(settings, userId) {
  if (!schemaCapabilities.appSettingsTable) {
    return;
  }

  const client = getSupabaseClient();

  const { error } = await client.from('app_settings').upsert({
    user_id: userId,
    sprint_length_days: settings.sprintLengthDays,
    updated_at: nowIsoTimestamp()
  }, { onConflict: 'user_id' });

  if (error) {
    if (isMissingTableError(error, 'app_settings')) {
      schemaCapabilities.appSettingsTable = false;
      return;
    }
    throw error;
  }
}
