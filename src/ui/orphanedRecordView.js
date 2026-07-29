import { renderIcon, renderIconText } from '../shared/iconRegistry.js';

export function renderCleanupWarning(orphanSummary) {
  if (!orphanSummary || orphanSummary.count === 0) return '';

  const byKidList = Object.entries(orphanSummary.byKid)
    .map(([kid, value]) => `${kid}: ${value.toFixed(2)} kr`)
    .join(', ');

  return `
    <div id="orphaned-warning" style="background:#fff3cd;border:1px solid #ffc107;border-radius:4px;padding:12px;margin:12px 0;color:#856404;">
      <strong>${renderIcon('warning')} Data Issue Detected</strong>
      <p style="margin:8px 0 0;font-size:13px;">
        Found ${orphanSummary.count} records for deleted chores (${orphanSummary.orphanedValue.toFixed(2)} kr):
        ${byKidList}
      </p>
      <button type="button" data-app-action="cleanup-orphaned-records" style="padding:6px 12px;background:#ffc107;color:#333;border:none;border-radius:3px;cursor:pointer;font-size:12px;font-weight:bold;margin-top:8px;">
        ${renderIconText('cleanup', 'Clean Up Now')}
      </button>
    </div>
  `;
}
