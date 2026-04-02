/**
 * Sync Queue Service - Serializes Supabase saves with retry logic
 * 
 * Ensures:
 * - Saves processed ONE AT A TIME (not parallel)
 * - Correct ordering (complete before edit before delete)
 * - Retry on network failure (exponential backoff)
 * - Tracking of pending syncs
 * - User visibility into sync status
 */

export function createSyncQueue() {
  let queue = [];
  let processing = false;
  let syncState = {
    isPending: false,
    isRetrying: false,
    lastSuccessfulSync: null,
    lastError: null,
    failureCount: 0
  };

  const MAX_RETRIES = 3;
  const INITIAL_BACKOFF_MS = 1000;
  const MAX_BACKOFF_MS = 30000;

  /**
   * Add a save operation to the queue
   * @param {string} type - 'chores', 'records', 'ui', 'sprints', 'settings'
   * @param {*} data - Data to save
   * @param {Function} saveFunc - Async function that performs the save
   */
  async function enqueue(type, data, saveFunc) {
    const item = {
      id: crypto.getRandomValues(new Uint8Array(8)).join(''),
      type,
      data,
      saveFunc,
      retries: 0,
      createdAt: new Date().toISOString(),
      processedAt: null
    };

    queue.push(item);
    syncState.isPending = true;
    
    // Start processing if not already running
    processQueue();
  }

  /**
   * Process queue items one at a time
   */
  async function processQueue() {
    if (processing || queue.length === 0) {
      if (queue.length === 0) {
        syncState.isPending = false;
      }
      return;
    }

    processing = true;
    
    while (queue.length > 0) {
      const item = queue[0];
      
      try {
        // Attempt save with retry logic
        await attemptSave(item);
        
        // Success - move to next
        item.processedAt = new Date().toISOString();
        queue.shift();
        syncState.lastSuccessfulSync = new Date().toISOString();
        syncState.failureCount = 0;
        syncState.lastError = null;
        
        // Log success for debugging
        console.log(`✓ Sync ${item.type}:`, {
          retries: item.retries,
          duration: Date.now() - new Date(item.createdAt).getTime() + 'ms'
        });
        
      } catch (error) {
        // Failure - handle retry logic
        console.error(`✗ Sync ${item.type} failed:`, error.message);
        
        if (item.retries < MAX_RETRIES) {
          // Retry with exponential backoff
          const backoff = Math.min(
            INITIAL_BACKOFF_MS * Math.pow(2, item.retries),
            MAX_BACKOFF_MS
          );
          
          item.retries++;
          syncState.isRetrying = true;
          syncState.lastError = error.message;
          
          console.log(`⏳ Retrying ${item.type} (attempt ${item.retries}/${MAX_RETRIES}) in ${backoff}ms`);
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, backoff));
          // Continue loop to retry this item
          
        } else {
          // Max retries exceeded - move to next but mark error
          console.error(`❌ Max retries exceeded for ${item.type}`);
          syncState.failureCount++;
          syncState.lastError = `Failed after ${MAX_RETRIES} retries: ${error.message}`;
          syncState.isRetrying = false;
          
          // Move item to end of queue to try again later (don't lose it)
          const failedItem = queue.shift();
          failedItem.retries = 0; // Reset retries for future attempt
          queue.push(failedItem);
        }
      }
    }

    syncState.isPending = false;
    syncState.isRetrying = false;
    processing = false;
  }

  /**
   * Attempt to save with error handling
   */
  async function attemptSave(item) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Sync timeout (30s)'));
      }, 30000);

      item.saveFunc(item.data)
        .then(() => {
          clearTimeout(timeout);
          resolve();
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Get current sync state for UI
   */
  function getSyncState() {
    return {
      ...syncState,
      queueLength: queue.length,
      pendingItems: queue.map(item => ({ 
        type: item.type, 
        retries: item.retries, 
        createdAt: item.createdAt 
      }))
    };
  }

  /**
   * Manually trigger sync (e.g., when coming online)
   */
  async function syncNow() {
    console.log('🔄 Manual sync triggered');
    await processQueue();
  }

  /**
   * Clear queue (use with caution)
   */
  function clearQueue() {
    const count = queue.length;
    queue = [];
    syncState.isPending = false;
    console.warn(`Cleared ${count} pending sync items`);
  }

  return {
    enqueue,
    getSyncState,
    syncNow,
    clearQueue
  };
}
