import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG, isSupabaseConfigured } from '../config/supabaseConfig.js';

let supabaseClient = null;

function toAppChore(chore) {
  return {
    id: chore.id,
    name: chore.name,
    createdAt: chore.created_at,
    assignedTo: chore.assigned_to,
    value: typeof chore.value === 'number' ? chore.value : 0,
    maxPerSprint: typeof chore.max_per_sprint === 'number' ? chore.max_per_sprint : 1
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
    supabaseClient = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.publishableKey);
  }

  return supabaseClient;
}

export async function initializeSupabaseData() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const client = getSupabaseClient();

    // Get the authenticated user (for multi-user support)
    const { data: { user } } = await client.auth.getUser();
    const userId = user?.id || 'anonymous';

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
    const { data: sprints, error: sprintsError } = await client
      .from('sprints')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (sprintsError) throw sprintsError;

    // Load settings
    const { data: settingsData, error: settingsError } = await client
      .from('app_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (settingsError && settingsError.code !== 'PGRST116') throw settingsError;

    return {
      chores: (chores || []).map(toAppChore),
      records: (records || []).map(toAppRecord),
      ui: uiStateData ? { activeRole: uiStateData.active_role } : { activeRole: 'parent' },
      sprints: (sprints || []).map(toAppSprint),
      settings: settingsData
        ? { sprintLengthDays: settingsData.sprint_length_days }
        : { sprintLengthDays: 7 },
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
    // Delete existing chores and insert new ones
    await client.from('chores').delete().eq('user_id', userId);
    
    const { error } = await client.from('chores').insert(
      chores.map(chore => ({
        id: chore.id,
        name: chore.name,
        created_at: chore.createdAt,
        assigned_to: chore.assignedTo,
        user_id: userId,
        value: chore.value ?? 0,
        max_per_sprint: chore.maxPerSprint ?? 1
      }))
    );

    if (error) throw error;
  } catch (error) {
    console.error('Error saving chores to Supabase:', error);
    throw error;
  }
}

export async function saveRecords(records, userId) {
  const client = getSupabaseClient();

  try {
    // Delete existing records and insert new ones
    await client.from('records').delete().eq('user_id', userId);
    
    const { error } = await client.from('records').insert(
      records.map(record => ({
        id: record.id,
        chore_id: record.choreId,
        completed_at: record.completedAt,
        undone_at: record.undoneAt,
        user_id: userId,
        sprint_id: record.sprintId || null,
        completed_by: record.completedBy || null,
        earned_value: typeof record.earnedValue === 'number' ? record.earnedValue : null
      }))
    );

    if (error) throw error;
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
      .upsert({ id: userId, active_role: activeRole, user_id: userId });

    if (error) throw error;
  } catch (error) {
    console.error('Error saving UI state to Supabase:', error);
    throw error;
  }
}

export async function saveSprints(sprints, userId) {
  const client = getSupabaseClient();

  try {
    await client.from('sprints').delete().eq('user_id', userId);

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

    if (error) throw error;
  } catch (error) {
    console.error('Error saving sprints to Supabase:', error);
    throw error;
  }
}

export async function saveSettings(settings, userId) {
  const client = getSupabaseClient();

  try {
    const { error } = await client.from('app_settings').upsert({
      user_id: userId,
      sprint_length_days: settings.sprintLengthDays,
      updated_at: new Date().toISOString()
    });

    if (error) throw error;
  } catch (error) {
    console.error('Error saving settings to Supabase:', error);
    throw error;
  }
}
