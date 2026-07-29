const DEFAULT_STATE = Object.freeze({
  activeMode: 'chores',
  activeTab: 'opgaver',
  kidChorePage: 1
});

export function createAppState(initialState = {}) {
  const state = { ...DEFAULT_STATE, ...initialState };

  return {
    get activeMode() { return state.activeMode; },
    set activeMode(value) { state.activeMode = value; },
    get activeTab() { return state.activeTab; },
    set activeTab(value) { state.activeTab = value; },
    get kidChorePage() { return state.kidChorePage; },
    set kidChorePage(value) { state.kidChorePage = Math.max(1, Number(value) || 1); },
    reset() {
      Object.assign(state, DEFAULT_STATE);
    },
    snapshot() {
      return { ...state };
    }
  };
}
