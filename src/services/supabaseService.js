import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG, isSupabaseConfigured, getPublishableKey } from '../config/supabaseConfig.js';
import { nowIsoTimestamp } from '../shared/dateTime.js';

let supabaseClient = null;
const NOT_FOUND_CODE = 'PGRST116';
const schemaCapabilities = {
  choresMaxPerPeriod: true,
  choresMaxPerSprint: true,
  choresUnlimitedDailyCap: true,
  recordsPeriodFields: true,
  recordsSprintFields: true,
  feedbackTable: true,
  appSettingsTable: true,
  periodsTable: true,
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

export function findMissingEntityIds(existingRows, nextRows) {
  const nextIds = new Set(
    (nextRows || [])
      .map(row => row?.id)
      .filter(id => typeof id === 'string' && id.length > 0)
  );

  return (existingRows || [])
    .map(row => row?.id)
    .filter(id => typeof id === 'string' && id.length > 0 && !nextIds.has(id));
}

async function pruneMissingRows(client, table, userId, nextRows) {
  const { data: existingRows, error: loadError } = await client
    .from(table)
    .select('id')
    .eq('user_id', userId);
  throwIfError(loadError);

  const missingIds = findMissingEntityIds(existingRows, nextRows);
  if (missingIds.length === 0) {
    return;
  }

  const { error: deleteError } = await client
    .from(table)
    .delete()
    .eq('user_id', userId)
    .in('id', missingIds);
  throwIfError(deleteError);
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
    maxPerPeriod: typeof chore.max_per_period === 'number'
      ? chore.max_per_period
      : (typeof chore.max_per_sprint === 'number' ? chore.max_per_sprint : 1),
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
    periodId: record.period_id || record.sprint_id || null,
    completedBy: record.completed_by || undefined,
    earnedValue: typeof record.earned_value === 'number' ? record.earned_value : undefined
  };
}

function toAppPeriod(period) {
  return {
    id: period.id,
    startDate: period.start_date,
    endDate: period.end_date,
    status: period.status,
    paidAt: period.paid_at || null,
    createdAt: period.created_at
  };
}

function toAppFeedback(entry) {
  return {
    id: entry.id,
    title: entry.title || '',
    message: entry.message,
    category: entry.category || 'general',
    createdAt: entry.created_at,
    createdBy: entry.created_by || 'parent',
    status: entry.status || 'open'
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

  let feedback = [];
  if (schemaCapabilities.feedbackTable) {
    const { data: feedbackData, error: feedbackError } = await client
      .from('feedback')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (feedbackError) {
      if (isMissingTableError(feedbackError, 'feedback')) {
        schemaCapabilities.feedbackTable = false;
      } else {
        throw feedbackError;
      }
    } else {
      feedback = feedbackData || [];
    }
  }

  let periods = [];
  if (schemaCapabilities.periodsTable) {
    const { data: periodsData, error: periodsError } = await client
      .from('periods')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (periodsError) {
      if (isMissingTableError(periodsError, 'periods')) {
        schemaCapabilities.periodsTable = false;
      } else {
        throw periodsError;
      }
    } else {
      periods = periodsData || [];
    }
  }

  if (periods.length === 0 && schemaCapabilities.sprintsTable) {
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
      periods = sprintsData || [];
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
    feedback: (feedback || []).map(toAppFeedback),
    periods: (periods || []).map(toAppPeriod),
    settings: settingsData
      ? {
        periodLengthDays: settingsData.period_length_days ?? settingsData.sprint_length_days ?? 7,
        updatedAt: settingsData.updated_at || null
      }
      : { periodLengthDays: 7, updatedAt: null },
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

    if (schemaCapabilities.choresMaxPerPeriod) {
      row.max_per_period = chore.maxPerPeriod ?? 1;
    } else if (schemaCapabilities.choresMaxPerSprint) {
      row.max_per_sprint = chore.maxPerPeriod ?? 1;
    }

    if (schemaCapabilities.choresUnlimitedDailyCap) {
      row.unlimited_daily_cap = chore.unlimitedDailyCap ?? 1;
    }

    return row;
  });

  const runUpsert = async () => client.from('chores').upsert(buildPayload(), { onConflict: 'id' });

  let error = null;
  if (chores.length > 0) {
    ({ error } = await runUpsert());
  }

  if (error && isMissingColumnError(error, 'chores', 'max_per_period')) {
    schemaCapabilities.choresMaxPerPeriod = false;
    ({ error } = await runUpsert());
  }

  if (error && isMissingColumnError(error, 'chores', 'max_per_sprint')) {
    schemaCapabilities.choresMaxPerSprint = false;
    ({ error } = await runUpsert());
  }

  if (error && isMissingColumnError(error, 'chores', 'unlimited_daily_cap')) {
    schemaCapabilities.choresUnlimitedDailyCap = false;
    ({ error } = await runUpsert());
  }

  throwIfError(error);

  // Before pruning deleted chores, remove any records that still reference them.
  // This prevents a foreign-key violation (records_chore_id_fkey) when the DELETE fires.
  const { data: existingChoreRows } = await client
    .from('chores')
    .select('id')
    .eq('user_id', userId);
  const choresToDelete = findMissingEntityIds(existingChoreRows ?? [], chores);
  if (choresToDelete.length > 0) {
    await client
      .from('records')
      .delete()
      .eq('user_id', userId)
      .in('chore_id', choresToDelete);
    // Ignore errors here — records may already be absent
  }

  await pruneMissingRows(client, 'chores', userId, chores);
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

    if (schemaCapabilities.recordsPeriodFields) {
      row.period_id = record.periodId || null;
      row.completed_by = record.completedBy || null;
      row.earned_value = typeof record.earnedValue === 'number' ? record.earnedValue : null;
    } else if (schemaCapabilities.recordsSprintFields) {
      row.sprint_id = record.periodId || null;
      row.completed_by = record.completedBy || null;
      row.earned_value = typeof record.earnedValue === 'number' ? record.earnedValue : null;
    }

    return row;
  });

  const runUpsert = async () => client.from('records').upsert(buildPayload(), { onConflict: 'id' });

  let error = null;
  if (records.length > 0) {
    ({ error } = await runUpsert());
  }

  if (error && (
    isMissingColumnError(error, 'records', 'period_id') ||
    isMissingColumnError(error, 'records', 'completed_by') ||
    isMissingColumnError(error, 'records', 'earned_value')
  )) {
    schemaCapabilities.recordsPeriodFields = false;
    ({ error } = await runUpsert());
  }

  if (error && (
    isMissingColumnError(error, 'records', 'sprint_id') ||
    isMissingColumnError(error, 'records', 'completed_by') ||
    isMissingColumnError(error, 'records', 'earned_value')
  )) {
    schemaCapabilities.recordsSprintFields = false;
    ({ error } = await runUpsert());
  }

  throwIfError(error);
  await pruneMissingRows(client, 'records', userId, records);
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

export async function saveFeedback(entries, userId) {
  if (!schemaCapabilities.feedbackTable) {
    return;
  }

  const client = getSupabaseClient();

  let error = null;
  if (entries.length > 0) {
    ({ error } = await client.from('feedback').upsert(
      entries.map((entry) => ({
        id: entry.id,
        user_id: userId,
        title: entry.title || '',
        message: entry.message,
        category: entry.category || 'general',
        created_at: entry.createdAt,
        created_by: entry.createdBy || 'parent',
        status: entry.status || 'open'
      })),
      { onConflict: 'id' }
    ));
  }

  if (error) {
    if (isMissingTableError(error, 'feedback')) {
      schemaCapabilities.feedbackTable = false;
      return;
    }
    throw error;
  }

  await pruneMissingRows(client, 'feedback', userId, entries);
}

export async function savePeriods(periods, userId) {
  const client = getSupabaseClient();

  const payload = periods.map(period => ({
    id: period.id,
    user_id: userId,
    start_date: period.startDate,
    end_date: period.endDate,
    status: period.status,
    paid_at: period.paidAt || null,
    created_at: period.createdAt
  }));

  if (schemaCapabilities.periodsTable) {
    let error = null;
    if (payload.length > 0) {
      ({ error } = await client.from('periods').upsert(payload, { onConflict: 'id' }));
    }
    if (!error) {
      await pruneMissingRows(client, 'periods', userId, periods);
      return;
    }
    if (!isMissingTableError(error, 'periods')) {
      throw error;
    }
    schemaCapabilities.periodsTable = false;
  }

  if (!schemaCapabilities.sprintsTable) {
    return;
  }

  let error = null;
  if (payload.length > 0) {
    ({ error } = await client.from('sprints').upsert(payload, { onConflict: 'id' }));
  }

  if (error) {
    if (isMissingTableError(error, 'sprints')) {
      schemaCapabilities.sprintsTable = false;
      return;
    }
    throw error;
  }

  await pruneMissingRows(client, 'sprints', userId, periods);
}

export async function saveSprints(sprints, userId) {
  return savePeriods(sprints, userId);
}

export async function saveSettings(settings, userId) {
  if (!schemaCapabilities.appSettingsTable) {
    return;
  }

  const client = getSupabaseClient();

  const basePayload = {
    user_id: userId,
    updated_at: nowIsoTimestamp()
  };

  let payload = {
    ...basePayload,
    period_length_days: settings.periodLengthDays
  };

  async function saveByUpdateThenInsert(nextPayload) {
    let { data: updatedRows, error: updateError } = await client
      .from('app_settings')
      .update(nextPayload)
      .eq('user_id', userId)
      .select('user_id');

    if (updateError) {
      return { error: updateError };
    }

    if (!Array.isArray(updatedRows) || updatedRows.length === 0) {
      const { error: insertError } = await client
        .from('app_settings')
        .insert(nextPayload);
      return { error: insertError || null };
    }

    return { error: null };
  }

  let { error } = await saveByUpdateThenInsert(payload);

  if (error && isMissingColumnError(error, 'app_settings', 'period_length_days')) {
    payload = {
      ...basePayload,
      sprint_length_days: settings.periodLengthDays
    };
    ({ error } = await saveByUpdateThenInsert(payload));
  }

  if (error) {
    if (isMissingTableError(error, 'app_settings')) {
      schemaCapabilities.appSettingsTable = false;
      return;
    }
    throw error;
  }
}
