import test from 'node:test';
import assert from 'node:assert/strict';

const CONFIG_MODULE_PATH = '../../src/config/supabaseConfig.js';

function createWindowWithStorage(initial = {}) {
  const storage = new Map(Object.entries(initial));

  return {
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      }
    }
  };
}

function withRuntimeEnv({ windowValue, appConfigValue }, run) {
  const previousWindow = globalThis.window;
  const previousConfig = globalThis.__APP_CONFIG__;

  globalThis.window = windowValue;
  globalThis.__APP_CONFIG__ = appConfigValue;

  try {
    run();
  } finally {
    globalThis.window = previousWindow;
    globalThis.__APP_CONFIG__ = previousConfig;
  }
}

test('isSupabaseConfigured accepts anon-key aliases from runtime config and storage', async () => {
  const mod = await import(CONFIG_MODULE_PATH);

  withRuntimeEnv(
    {
      windowValue: createWindowWithStorage({ SUPABASE_ANON_KEY: 'storage-anon-key' }),
      appConfigValue: { supabase: { anonKey: 'runtime-anon-key' } }
    },
    () => {
      assert.equal(mod.getPublishableKey(), 'runtime-anon-key');
      assert.equal(mod.isSupabaseConfigured(), true);
      assert.equal(globalThis.window.localStorage.getItem('SUPABASE_PUBLISHABLE_KEY'), 'runtime-anon-key');
    }
  );
});

test('isSupabaseConfigured remains false when only placeholder value exists', async () => {
  const mod = await import(CONFIG_MODULE_PATH);

  withRuntimeEnv(
    {
      windowValue: createWindowWithStorage(),
      appConfigValue: null
    },
    () => {
      assert.equal(mod.getPublishableKey(), '__SUPABASE_PUBLISHABLE_KEY__');
      assert.equal(mod.isSupabaseConfigured(), false);
    }
  );
});
