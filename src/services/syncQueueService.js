import { nowIsoTimestamp } from '../shared/dateTime.js';

export function createSyncQueue() {
  const queueStorage = globalThis.localStorage;
  const queueStorageKey = 'kids_chore_sync_queue_v1';
  const deadLetterStorageKey = 'kids_chore_sync_deadletter_v1';
  const handlers = new Map();

  function loadStoredItems(storageKey) {
    if (!queueStorage) {
      return [];
    }

    try {
      const raw = queueStorage.getItem(storageKey);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function persistStoredItems(storageKey, items) {
    if (!queueStorage) {
      return;
    }

    try {
      queueStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      console.warn('Unable to persist sync queue data to localStorage.');
    }
  }

  function toStoredItem(item) {
    return {
      id: item.id,
      type: item.type,
      data: item.data,
      retries: item.retries,
      createdAt: item.createdAt,
      processedAt: item.processedAt ?? null,
      lastAttemptAt: item.lastAttemptAt ?? null
    };
  }

  function fromStoredItem(item) {
    return {
      id: item.id,
      type: item.type,
      data: item.data,
      retries: Number.isInteger(item.retries) ? item.retries : 0,
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : nowIsoTimestamp(),
      processedAt: typeof item.processedAt === 'string' ? item.processedAt : null,
      lastAttemptAt: typeof item.lastAttemptAt === 'string' ? item.lastAttemptAt : null
    };
  }

  let queue = [];
  let deadLetterQueue = [];
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

  function persistQueues() {
    persistStoredItems(queueStorageKey, queue.map(toStoredItem));
    persistStoredItems(deadLetterStorageKey, deadLetterQueue.map(toStoredItem));
  }

  function hydrateQueues() {
    queue = loadStoredItems(queueStorageKey).map(fromStoredItem);
    deadLetterQueue = loadStoredItems(deadLetterStorageKey).map(fromStoredItem);
    syncState.isPending = queue.length > 0;
    syncState.failureCount = deadLetterQueue.length;
  }

  hydrateQueues();

  async function enqueue(type, data, saveFunc) {
    if (typeof saveFunc === 'function') {
      handlers.set(type, saveFunc);
    }

    const item = {
      id: crypto.getRandomValues(new Uint8Array(8)).join(''),
      type,
      data,
      retries: 0,
      createdAt: nowIsoTimestamp(),
      processedAt: null,
      lastAttemptAt: null
    };

    queue.push(item);
    persistQueues();
    syncState.isPending = true;
    
    processQueue();
  }

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
      item.lastAttemptAt = nowIsoTimestamp();
      persistQueues();
      
      try {
        await attemptSave(item);

        item.processedAt = nowIsoTimestamp();
        queue.shift();
        syncState.lastSuccessfulSync = nowIsoTimestamp();
        syncState.failureCount = 0;
        syncState.lastError = null;
        persistQueues();
        
        console.log(`✓ Sync ${item.type}:`, {
          retries: item.retries,
          duration: Date.now() - new Date(item.createdAt).getTime() + 'ms'
        });

      } catch (error) {
        console.error(`✗ Sync ${item.type} failed:`, error.message);

        if (item.retries < MAX_RETRIES) {
          const backoff = Math.min(
            INITIAL_BACKOFF_MS * Math.pow(2, item.retries),
            MAX_BACKOFF_MS
          );
          
          item.retries++;
          syncState.isRetrying = true;
          syncState.lastError = error.message;
          persistQueues();

          console.log(`⏳ Retrying ${item.type} (attempt ${item.retries}/${MAX_RETRIES}) in ${backoff}ms`);

          await new Promise(resolve => setTimeout(resolve, backoff));

        } else {
          console.error(`❌ Max retries exceeded for ${item.type}`);
          syncState.failureCount = deadLetterQueue.length + 1;
          syncState.lastError = `Failed after ${MAX_RETRIES} retries: ${error.message}`;
          syncState.isRetrying = false;

          const failedItem = queue.shift();
          failedItem.retries = 0;
          deadLetterQueue.push(failedItem);
          persistQueues();
        }
      }
    }

    syncState.isPending = false;
    syncState.isRetrying = false;
    processing = false;
  }

  async function attemptSave(item) {
    const saveFunc = handlers.get(item.type);
    if (typeof saveFunc !== 'function') {
      throw new Error(`No sync handler registered for ${item.type}`);
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Sync timeout (30s)'));
      }, 30000);

      saveFunc(item.data)
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

  function getSyncState() {
    return {
      ...syncState,
      queueLength: queue.length,
      deadLetterCount: deadLetterQueue.length,
      pendingItems: queue.map(item => ({ 
        type: item.type, 
        retries: item.retries, 
        createdAt: item.createdAt 
      })),
      failedItems: deadLetterQueue.map(item => ({
        type: item.type,
        retries: item.retries,
        createdAt: item.createdAt,
        lastAttemptAt: item.lastAttemptAt
      }))
    };
  }

  function registerHandler(type, saveFunc) {
    if (typeof saveFunc !== 'function') {
      throw new Error('registerHandler requires a function save handler.');
    }

    handlers.set(type, saveFunc);
  }

  async function retryFailed() {
    if (deadLetterQueue.length === 0) {
      return;
    }

    const itemsToRetry = deadLetterQueue.map(item => ({ ...item, retries: 0 }));
    deadLetterQueue = [];
    queue.push(...itemsToRetry);
    syncState.failureCount = 0;
    syncState.isPending = queue.length > 0;
    persistQueues();
    await processQueue();
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
    const count = queue.length + deadLetterQueue.length;
    queue = [];
    deadLetterQueue = [];
    syncState.isPending = false;
    syncState.failureCount = 0;
    syncState.lastError = null;
    persistQueues();
    console.warn(`Cleared ${count} pending sync items`);
  }

  return {
    enqueue,
    registerHandler,
    getSyncState,
    syncNow,
    retryFailed,
    clearQueue
  };
}
