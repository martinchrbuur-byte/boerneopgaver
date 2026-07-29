import { renderLocalOnlyIndicator, renderSyncStatusIndicator } from './syncStatusUI.js';
import { renderCleanupWarning } from './orphanedRecordView.js';

export function renderRefreshStatus({ feedbackElement, syncState, orphanSummary, configured, online }) {
  if (!feedbackElement) return;

  document.getElementById('sync-status')?.remove();
  document.getElementById('local-only-status')?.remove();
  document.getElementById('orphaned-warning')?.remove();

  if (!configured) {
    feedbackElement.insertAdjacentHTML('afterend', renderLocalOnlyIndicator({ reason: 'missing-config' }));
    return;
  }
  if (!online) {
    feedbackElement.insertAdjacentHTML('afterend', renderLocalOnlyIndicator({ reason: 'offline' }));
  }
  if (!syncState) return;

  const statusHtml = renderSyncStatusIndicator(syncState);
  if (statusHtml) feedbackElement.insertAdjacentHTML('afterend', statusHtml);
  if (orphanSummary?.count > 0) {
    feedbackElement.insertAdjacentHTML('afterend', renderCleanupWarning(orphanSummary));
  }
}
