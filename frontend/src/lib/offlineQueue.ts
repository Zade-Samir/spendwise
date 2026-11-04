import { openDB, IDBPDatabase } from 'idb';
import { api, ApiError } from './api';
import { TransactionCreatePayload, Transaction } from '../types/transactions';
import type { QueryClient } from '@tanstack/react-query';

const DB_NAME = 'spendwise_offline';
const STORE_NAME = 'pending_transactions';
const DB_VERSION = 1;

export interface PendingTransaction {
  client_id: string;
  payload: TransactionCreatePayload;
  created_at: string;
  attempts: number;
  last_error: string | null;
}

let dbPromise: Promise<IDBPDatabase> | null = null;
let isSyncing = false;
const listeners = new Set<() => void>();

function getDB(): Promise<IDBPDatabase> {
  if (typeof window === 'undefined') {
    // Server-side or non-browser fallback
    return Promise.reject(new Error('IndexedDB is not available in non-browser environment'));
  }

  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'client_id' });
          store.createIndex('created_at', 'created_at', { unique: false });
        }
      },
    });
  }
  return dbPromise;
}

function notifyListeners(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (err) {
      console.error('Error in offline queue subscriber:', err);
    }
  });
}

export function subscribeOfflineQueue(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function enqueueTransaction(
  payload: TransactionCreatePayload
): Promise<PendingTransaction> {
  const clientId = payload.client_id || crypto.randomUUID();
  const db = await getDB();

  const item: PendingTransaction = {
    client_id: clientId,
    payload: {
      ...payload,
      client_id: clientId,
    },
    created_at: payload.occurred_at || new Date().toISOString(),
    attempts: 0,
    last_error: null,
  };

  await db.put(STORE_NAME, item);
  notifyListeners();
  return item;
}

export async function getPendingTransactions(): Promise<PendingTransaction[]> {
  try {
    const db = await getDB();
    const items = (await db.getAll(STORE_NAME)) as PendingTransaction[];
    return items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  } catch {
    return [];
  }
}

export async function getPendingCount(): Promise<number> {
  try {
    const db = await getDB();
    return await db.count(STORE_NAME);
  } catch {
    return 0;
  }
}

export async function removePendingTransaction(clientId: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete(STORE_NAME, clientId);
    notifyListeners();
  } catch (err) {
    console.error('Failed to remove pending transaction:', err);
  }
}

export async function updatePendingTransaction(item: PendingTransaction): Promise<void> {
  try {
    const db = await getDB();
    await db.put(STORE_NAME, item);
    notifyListeners();
  } catch (err) {
    console.error('Failed to update pending transaction:', err);
  }
}

export async function clearPendingTransactions(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear(STORE_NAME);
    notifyListeners();
  } catch (err) {
    console.error('Failed to clear pending transactions:', err);
  }
}

export function isQueueSyncing(): boolean {
  return isSyncing;
}

export async function flushOfflineQueue(
  queryClient?: QueryClient
): Promise<{ synced: number; failed: number }> {
  if (isSyncing) {
    return { synced: 0, failed: 0 };
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  const items = await getPendingTransactions();
  if (items.length === 0) {
    return { synced: 0, failed: 0 };
  }

  isSyncing = true;
  notifyListeners();

  let syncedCount = 0;
  let failedCount = 0;

  try {
    for (const item of items) {
      try {
        await api.post<Transaction>('/transactions', item.payload);
        await removePendingTransaction(item.client_id);
        syncedCount++;
      } catch (err: unknown) {
        if (err instanceof ApiError) {
          if (err.status === 409) {
            // Already synced (idempotent replay via backend partial unique index)
            await removePendingTransaction(item.client_id);
            syncedCount++;
          } else if (err.status === 422 || err.status === 400) {
            // Unrecoverable validation error
            item.attempts += 1;
            item.last_error = err.message || 'Validation error';
            await updatePendingTransaction(item);
            failedCount++;
          } else {
            // Server error / network error, stop flush loop
            failedCount++;
            break;
          }
        } else {
          // Network disconnect or fetch abort, stop flush loop
          break;
        }
      }
    }
  } finally {
    isSyncing = false;
    notifyListeners();

    if (syncedCount > 0 && queryClient) {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['recent-merchants'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['analytics'] });
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('spendwise:offline-sync', {
          detail: { synced: syncedCount, failed: failedCount },
        })
      );
    }
  }

  return { synced: syncedCount, failed: failedCount };
}

let syncListenersInitialized = false;

export function setupOfflineSyncListeners(queryClient: QueryClient): void {
  if (syncListenersInitialized || typeof window === 'undefined') {
    return;
  }
  syncListenersInitialized = true;

  // 1. Online event
  window.addEventListener('online', () => {
    flushOfflineQueue(queryClient);
  });

  // 2. Visibility change (user returns to SpendWise)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      flushOfflineQueue(queryClient);
    }
  });

  // 3. Cold application launch
  setTimeout(() => {
    flushOfflineQueue(queryClient);
  }, 1000);
}
