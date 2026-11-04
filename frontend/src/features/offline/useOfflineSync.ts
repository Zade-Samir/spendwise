import { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getPendingCount,
  getPendingTransactions,
  subscribeOfflineQueue,
  isQueueSyncing,
  flushOfflineQueue,
  PendingTransaction,
} from '../../lib/offlineQueue';

export function useOfflineSync() {
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(isQueueSyncing());

  const refreshQueueState = useCallback(async () => {
    try {
      const [count, items] = await Promise.all([
        getPendingCount(),
        getPendingTransactions(),
      ]);
      setPendingCount(count);
      setPendingTransactions(items);
      setIsSyncing(isQueueSyncing());
    } catch {
      // Ignored
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      refreshQueueState();
    };

    const handleOffline = () => {
      setIsOnline(false);
      refreshQueueState();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial load
    refreshQueueState();

    // Subscribe to queue changes (enqueue, remove, update)
    const unsubscribe = subscribeOfflineQueue(() => {
      refreshQueueState();
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, [refreshQueueState]);

  const syncNow = useCallback(async () => {
    if (!navigator.onLine) return;
    await flushOfflineQueue(queryClient);
    await refreshQueueState();
  }, [queryClient, refreshQueueState]);

  return {
    isOnline,
    pendingCount,
    pendingTransactions,
    isSyncing,
    syncNow,
  };
}
