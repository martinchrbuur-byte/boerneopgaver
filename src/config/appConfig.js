const DEFAULT_CONFIG = Object.freeze({
  persistenceProvider: 'localStorage',
  defaultRole: 'parent',
  persistRoleSelection: true
});

export function resolveAppConfig(runtimeConfig = globalThis.__APP_CONFIG__) {
  if (!runtimeConfig || typeof runtimeConfig !== 'object') {
    return DEFAULT_CONFIG;
  }

  const provider = runtimeConfig.persistenceProvider;
  if (provider !== 'localStorage') {
    return DEFAULT_CONFIG;
  }

  const defaultRole = runtimeConfig.defaultRole === 'kid' ? 'kid' : 'parent';
  const persistRoleSelection = runtimeConfig.persistRoleSelection !== false;

  return {
    persistenceProvider: provider,
    defaultRole,
    persistRoleSelection
  };
}
