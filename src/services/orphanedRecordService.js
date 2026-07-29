/**
 * Orphaned Record Cleanup Service
 * 
 * Detects and removes records that reference deleted chores
 * Warns user about data inconsistencies
 */

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
    logOrphanedRecords
  };
}
