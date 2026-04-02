/**
 * Sync Status Indicator UI Component
 * Displays sync state to user: syncing, failed, offline, etc.
 */

export function renderSyncStatusIndicator(syncState) {
  if (!syncState) {
    return ''; // No sync state available
  }

  const { isPending, isRetrying, queueLength, lastError, lastSuccessfulSync, failureCount } = syncState;

  // Determine status message and styling
  let html = '<div id="sync-status" class="sync-status-container" style="';
  let statusText = '';
  let statusClass = '';

  if (lastError && failureCount > 0) {
    statusClass = 'sync-failed';
    statusText = `⚠️ Sync Error (${failureCount} items failed)`;
    html += 'background-color: #fee; color: #c33; padding: 8px 12px; border-radius: 4px; font-size: 12px; margin: 8px 0;">';
    html += `${statusText}<span style="margin-left: 8px; font-size: 10px; opacity: 0.7;">${lastError}</span>`;
  } else if (isRetrying) {
    statusClass = 'sync-retrying';
    statusText = `⏳ Syncing (Retry ${queueLength})`;
    html += 'background-color: #ffa; color: #663; padding: 8px 12px; border-radius: 4px; font-size: 12px; margin: 8px 0; animation: pulse 1s infinite;">';
    html += statusText;
  } else if (isPending) {
    statusClass = 'sync-pending';
    statusText = `🔄 Syncing (${queueLength} items)`;
    html += 'background-color: #eef; color: #336; padding: 8px 12px; border-radius: 4px; font-size: 12px; margin: 8px 0; animation: pulse 1s infinite;">';
    html += statusText;
  } else if (lastSuccessfulSync) {
    statusClass = 'sync-success';
    const syncTime = new Date(lastSuccessfulSync);
    const now = new Date();
    const diffMs = now - syncTime;
    const diffMin = Math.floor(diffMs / 60000);
    let timeStr = 'just now';
    if (diffMin > 0) {
      timeStr = diffMin === 1 ? '1 min ago' : `${diffMin} mins ago`;
    }
    statusText = `✓ Synced ${timeStr}`;
    html += 'background-color: #efe; color: #363; padding: 6px 10px; border-radius: 4px; font-size: 11px; margin: 4px 0; opacity: 0.7;">';
    html += statusText;
  } else {
    html += 'display: none;">';
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
  return `<div class="offline-indicator" style="
    background-color: #333;
    color: #fff;
    padding: 10px;
    text-align: center;
    font-size: 12px;
    position: sticky;
    top: 0;
    z-index: 100;
  ">
    🔌 Offline Mode - Your changes are saved locally and will sync when online
  </div>`;
}
