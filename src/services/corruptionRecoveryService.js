/**
 * localStorage Corruption Recovery Service
 * 
 * Detects and recovers from corrupted localStorage data
 */

export function createCorruptionRecoveryService() {
  /**
   * Validate if stored data is recoverable or corrupted
   */
  function validateStoredData(raw, storageKey) {
    if (!raw) {
      return { isValid: true, isCorrupted: false, data: null };
    }

    try {
      const parsed = JSON.parse(raw);
      
      // Check structure
      if (!parsed || typeof parsed !== 'object') {
        return { isValid: false, isCorrupted: true, reason: 'Not an object' };
      }
      
      // Check required fields
      const hasChores = Array.isArray(parsed.chores);
      const hasRecords = Array.isArray(parsed.records);
      
      if (!hasChores || !hasRecords) {
        return { isValid: false, isCorrupted: true, reason: 'Missing required arrays' };
      }
      
      return { isValid: true, isCorrupted: false, data: parsed };
    } catch (e) {
      return { 
        isValid: false, 
        isCorrupted: true, 
        reason: `JSON parse error: ${e.message}` 
      };
    }
  }

  /**
   * Show recovery UI when corruption detected
   */
  function createRecoveryUI(storageKey, onRecover, onClear) {
    const html = `
      <div id="data-corruption-recovery" style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: linear-gradient(135deg, #d32f2f, #f57c00);
        color: white;
        padding: 20px;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      ">
        <div style="max-width: 600px; margin: 0 auto;">
          <h2 style="margin: 0 0 10px 0; font-size: 18px;">⚠️ Data Recovery</h2>
          <p style="margin: 0 0 15px 0; font-size: 14px;">Your app data appears to be corrupted. You can:</p>
          <div style="display: flex; gap: 10px;">
            <button onclick="recoverData('${storageKey}')" style="
              padding: 10px 16px;
              background: #4caf50;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-weight: bold;
            ">🔄 Try to Recover</button>
            
            <button onclick="startFresh('${storageKey}')" style="
              padding: 10px 16px;
              background: #2196f3;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-weight: bold;
            ">✨ Start Fresh</button>
            
            <button onclick="downloadBackup('${storageKey}')" style="
              padding: 10px 16px;
              background: #9c27b0;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-weight: bold;
            ">📥 Download Backup</button>
          </div>
          <p style="margin: 15px 0 0 0; font-size: 12px; opacity: 0.9;">
            Your recent changes are saved locally. If you just started the app, try recovering. Otherwise, starting fresh is recommended.
          </p>
        </div>
      </div>
    `;
    
    return html;
  }

  /**
   * Attempt to recover partial data from corrupted state
   */
  function attemptRecovery(corruptedData) {
    // Try to extract salvageable parts
    const recovered = {
      chores: [],
      records: [],
      ui: { activeRole: 'parent', periodHistory: [] },
      periods: [],
      settings: { periodLengthDays: 7 },
      pendingCollaborations: []
    };

    if (corruptedData && typeof corruptedData === 'object') {
      if (Array.isArray(corruptedData.chores)) {
        recovered.chores = corruptedData.chores.filter(c => c && typeof c === 'object');
      }
      if (Array.isArray(corruptedData.records)) {
        recovered.records = corruptedData.records.filter(r => r && typeof r === 'object');
      }
      if (corruptedData.ui && typeof corruptedData.ui === 'object') {
        recovered.ui = corruptedData.ui;
      }
      if (Array.isArray(corruptedData.periods)) {
        recovered.periods = corruptedData.periods.filter(period => period && typeof period === 'object');
      } else if (Array.isArray(corruptedData.sprints)) {
        recovered.periods = corruptedData.sprints.filter(period => period && typeof period === 'object');
      }
    }

    return recovered;
  }

  /**
   * Restore from Supabase if available
   */
  async function restoreFromCloud(userId, supabaseService) {
    try {
      const cloudData = await supabaseService.loadAllData(userId);
      if (cloudData && cloudData.chores && cloudData.chores.length > 0) {
        console.log('✓ Restored data from Supabase cloud');
        return cloudData;
      }
    } catch (e) {
      console.warn('Could not restore from cloud:', e.message);
    }
    return null;
  }

  return {
    validateStoredData,
    createRecoveryUI,
    attemptRecovery,
    restoreFromCloud
  };
}
