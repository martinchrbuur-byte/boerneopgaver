/**
 * Orphaned Record Cleanup Service
 * 
 * Detects and removes records that reference deleted chores
 * Warns user about data inconsistencies
 */

import { renderIcon, renderIconText } from '../shared/iconRegistry.js';

export function createOrphanedRecordService() {
  /**
   * Find records that reference non-existent chores
   */
  function findOrphanedRecords(chores, records) {
    const choreIds = new Set(chores.map(c => c.id));
    
    const orphaned = records.filter(record => {
      return !choreIds.has(record.choreId);
    });

    return orphaned;
  }

  /**
   * Remove orphaned records from state
   */
  function cleanOrphanedRecords(chores, records) {
    const choreIds = new Set(chores.map(c => c.id));
    
    const cleaned = records.filter(record => {
      return choreIds.has(record.choreId);
    });

    const orphanedCount = records.length - cleaned.length;
    
    return {
      cleaned,
      orphanedCount,
      hasOrphans: orphanedCount > 0
    };
  }

  /**
   * Get summary of orphaned records for UI
   */
  function getOrphanedSummary(chores, records) {
    const orphaned = findOrphanedRecords(chores, records);
    
    if (orphaned.length === 0) {
      return null;
    }

    // Group by earned value
    const orphanedValue = orphaned.reduce((sum, r) => sum + (r.earnedValue || 0), 0);
    
    // Group by kid
    const byKid = {};
    orphaned.forEach(r => {
      const kid = r.completedBy || 'unknown';
      byKid[kid] = (byKid[kid] || 0) + (r.earnedValue || 0);
    });

    return {
      count: orphaned.length,
      orphanedValue,
      byKid,
      records: orphaned
    };
  }

  /**
   * Create cleanup warning UI
   */
  function createCleanupWarningUI(orphanSummary) {
    if (!orphanSummary || orphanSummary.count === 0) {
      return '';
    }

    const byKidList = Object.entries(orphanSummary.byKid)
      .map(([kid, value]) => `${kid}: ${value.toFixed(2)} kr`)
      .join(', ');

    return `
      <div id="orphaned-warning" style="
        background: #fff3cd;
        border: 1px solid #ffc107;
        border-radius: 4px;
        padding: 12px;
        margin: 12px 0;
        color: #856404;
      ">
        <strong>${renderIcon('warning')} Data Issue Detected</strong>
        <p style="margin: 8px 0 0 0; font-size: 13px;">
          Found ${orphanSummary.count} records for deleted chores (${orphanSummary.orphanedValue.toFixed(2)} kr):
          ${byKidList}
        </p>
        <button onclick="cleanupOrphanedRecords()" style="
          padding: 6px 12px;
          background: #ffc107;
          color: #333;
          border: none;
          border-radius: 3px;
          cursor: pointer;
          font-size: 12px;
          font-weight: bold;
          margin-top: 8px;
        ">${renderIconText('cleanup', 'Clean Up Now')}</button>
      </div>
    `;
  }

  /**
   * Log orphaned records for debugging
   */
  function logOrphanedRecords(orphaned) {
    console.warn(`Found ${orphaned.length} orphaned records:`, orphaned.map(r => ({
      choreId: r.choreId,
      completedBy: r.completedBy,
      earnedValue: r.earnedValue,
      completedAt: r.completedAt
    })));
  }

  return {
    findOrphanedRecords,
    cleanOrphanedRecords,
    getOrphanedSummary,
    createCleanupWarningUI,
    logOrphanedRecords
  };
}
