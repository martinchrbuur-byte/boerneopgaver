import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG, isSupabaseConfigured } from '../config/supabaseConfig.js';

let supabaseClient = null;

function toAppChore(chore) {
  return {
    id: chore.id,
    name: chore.name,
    createdAt: chore.created_at,
    assignedTo: chore.assigned_to
  };
}

function toAppRecord(record) {
  return {
    id: record.id,
    choreId: record.chore_id,
    completedAt: record.completed_at,
    undoneAt: record.undone_at
  };
}

export function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Please set SUPABASE_ANON_KEY.');
  }

  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
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

    return {
      chores: (chores || []).map(toAppChore),
      records: (records || []).map(toAppRecord),
      ui: uiStateData ? { activeRole: uiStateData.active_role } : { activeRole: 'parent' },
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
        user_id: userId
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
        user_id: userId
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
