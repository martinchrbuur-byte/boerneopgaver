/**
 * Sync Status Indicator UI Component
 * Displays sync state to user: syncing, failed, offline, etc.
 */

import { renderIcon } from '../shared/iconRegistry.js';

export function renderSyncStatusIndicator(syncState) {
  if (!syncState) {
    return ''; // No sync state available
  }

  function escapeHtml(value) {
    if (typeof value !== 'string') {
      return '';
    }

    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  const { isPending, isRetrying, queueLength, lastError, lastSuccessfulSync, failureCount } = syncState;

  // Determine status message and styling
  let html = '<div id="sync-status" class="sync-status-container';
  let statusText = '';
  let leadingIcon = '';

  if (lastError) {
    const safeError = escapeHtml(lastError);
    const failedItemsLabel = failureCount > 0 ? `${failureCount} items failed` : 'sync issue detected';
    statusText = isRetrying ? `Sync Retry (${queueLength} pending)` : `Sync Error (${failedItemsLabel})`;
    leadingIcon = renderIcon('warning');
    html += ' sync-status-error">';
    html += `${leadingIcon}<span class="sync-status-text">${statusText}</span><span class="sync-status-note">${safeError}</span>`;
    if (failureCount > 0) {
      html += '<button type="button" onclick="retryFailedSync()" class="sync-status-button sync-status-button-error">Retry failed</button>';
    }
  } else if (isRetrying) {
    statusText = `Syncing (Retry ${queueLength})`;
    leadingIcon = renderIcon('pending');
    html += ' sync-status-warning sync-status-pulse">';
    html += `${leadingIcon}<span class="sync-status-text">${statusText}</span>`;
  } else if (isPending) {
    statusText = `Syncing (${queueLength} items)`;
    leadingIcon = renderIcon('sync');
    html += ' sync-status-info sync-status-pulse">';
    html += `${leadingIcon}<span class="sync-status-text">${statusText}</span>`;
  } else if (lastSuccessfulSync) {
    const syncTime = new Date(lastSuccessfulSync);
    const now = new Date();
    const diffMs = now - syncTime;
    const diffMin = Math.floor(diffMs / 60000);
    let timeStr = 'just now';
    if (diffMin > 0) {
      timeStr = diffMin === 1 ? '1 min ago' : `${diffMin} mins ago`;
    }
    statusText = `Synced ${timeStr}`;
    leadingIcon = renderIcon('success');
    html += ' sync-status-success sync-status-muted">';
    html += `${leadingIcon}<span class="sync-status-text">${statusText}</span>`;
  } else {
    html += '" hidden>';
  }

  html += '</div>';

  // Add CSS animation if not already in style tag
  if (document.getElementById('sync-style-animation') === null) {
    const style = document.createElement('style');
    style.id = 'sync-style-animation';
    style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.7; }
      }
    `;
    document.head.appendChild(style);
  }

  return html;
}

export function renderLocalOnlyIndicator({ reason = 'missing-config' } = {}) {
  let message = 'Cloud sync is disabled. Changes are saved only on this device.';

  if (reason === 'offline') {
    message = 'You are offline. Changes are saved locally and will sync once online.';
  }

  return `<div id="local-only-status" class="sync-status-container sync-status-local-only">
    ${renderIcon('warning')} <span class="sync-status-text">${message}</span>
  </div>`;
}

/**
 * Render sync status indicator with sync/retry button
 */
export function renderSyncControlPanel(syncState, onSyncClick) {
  if (!syncState) {
    return '';
  }

  const { isPending, isRetrying, queueLength, failureCount } = syncState;

  // Only show control panel if there are issues or pending items
  if (!isPending && failureCount === 0) {
    return '';
  }

  let html = '<div class="sync-control-panel" style="padding: 12px; background: #f5f5f5; border-radius: 4px; margin: 8px 0; display: flex; justify-content: space-between; align-items: center;">';

  // Status text
  if (failureCount > 0) {
    html += `<span style="flex: 1; color: #c33; font-weight: bold;">Sync failed for ${failureCount} items</span>`;
  } else if (isPending || isRetrying) {
    html += `<span style="flex: 1; color: #666;">Syncing ${queueLength} item${queueLength > 1 ? 's' : ''}...</span>`;
  }

  // Sync button
  if (failureCount > 0 || queueLength > 0) {
    html += `<button onclick="syncNow()" style="
      padding: 8px 16px;
      background-color: ${failureCount > 0 ? '#f44' : '#4af'};
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      margin-left: 12px;
    ">${failureCount > 0 ? 'Retry Sync' : 'Sync Now'}</button>`;
  }

  html += '</div>';
  return html;
}

/**
 * Show offline mode indicator
 */
export function renderOfflineIndicator() {
  return `<div class="offline-indicator">
    ${renderIcon('offline')} Offline Mode - Your changes are saved locally and will sync when online
  </div>`;
}
