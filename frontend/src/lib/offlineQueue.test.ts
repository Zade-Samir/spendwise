import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  enqueueTransaction,
  getPendingTransactions,
  getPendingCount,
  removePendingTransaction,
  clearPendingTransactions,
  flushOfflineQueue,
} from './offlineQueue';
import { api, ApiError } from './api';
import { TransactionCreatePayload, Transaction } from '../types/transactions';

describe('Offline Queue & Synchronization Engine', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await clearPendingTransactions();
  });

  it('enqueues a transaction into IndexedDB with client_id and created_at', async () => {
    const payload: TransactionCreatePayload = {
      amount_minor: 12500, // ₹125.00 in integer paise
      category_id: 'cat-food-123',
      merchant: 'Chai Point',
      payment_method: 'upi',
      client_id: 'offline-uuid-1',
    };

    const item = await enqueueTransaction(payload);
    expect(item.client_id).toBe('offline-uuid-1');
    expect(item.attempts).toBe(0);
    expect(item.last_error).toBeNull();
    expect(item.payload.amount_minor).toBe(12500);

    const count = await getPendingCount();
    expect(count).toBe(1);

    const pending = await getPendingTransactions();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.client_id).toBe('offline-uuid-1');
    expect(pending[0]?.payload.merchant).toBe('Chai Point');
  });

  it('removes a pending transaction from IndexedDB by client_id', async () => {
    const payload: TransactionCreatePayload = {
      amount_minor: 45000,
      category_id: 'cat-groceries-456',
      merchant: 'Zepto',
      payment_method: 'card',
      client_id: 'offline-uuid-2',
    };

    await enqueueTransaction(payload);
    expect(await getPendingCount()).toBe(1);

    await removePendingTransaction('offline-uuid-2');
    expect(await getPendingCount()).toBe(0);
  });

  it('flushes pending queue sequentially and handles 201 Created and 409 Conflict replay idempotency', async () => {
    const tx1: TransactionCreatePayload = {
      amount_minor: 10000,
      category_id: 'cat-1',
      merchant: 'Metro Smart Card',
      payment_method: 'card',
      client_id: 'uuid-metro-1',
      occurred_at: '2026-11-03T01:00:00.000Z',
    };

    const tx2: TransactionCreatePayload = {
      amount_minor: 25000,
      category_id: 'cat-2',
      merchant: 'Swiggy',
      payment_method: 'upi',
      client_id: 'uuid-swiggy-2',
      occurred_at: '2026-11-03T01:05:00.000Z',
    };

    await enqueueTransaction(tx1);
    await enqueueTransaction(tx2);
    expect(await getPendingCount()).toBe(2);

    const postSpy = vi.spyOn(api, 'post').mockImplementation(async (_endpoint, body) => {
      const payload = body as TransactionCreatePayload;
      if (payload.client_id === 'uuid-metro-1') {
        return {
          id: 'server-id-1',
          client_id: payload.client_id,
          amount_minor: payload.amount_minor,
        } as unknown as Transaction;
      }
      if (payload.client_id === 'uuid-swiggy-2') {
        // Simulate 409 Conflict (idempotent duplicate rejection from backend)
        throw new ApiError(409, 'Duplicate client_id');
      }
      return {} as unknown as Transaction;
    });

    const result = await flushOfflineQueue();
    expect(result.synced).toBe(2);
    expect(result.failed).toBe(0);
    expect(await getPendingCount()).toBe(0);
    expect(postSpy).toHaveBeenCalledTimes(2);
  });

  it('halts flush and retains queue when encountering network failure', async () => {
    const tx: TransactionCreatePayload = {
      amount_minor: 5000,
      category_id: 'cat-3',
      merchant: 'Tea Stall',
      payment_method: 'cash',
      client_id: 'uuid-tea-3',
    };

    await enqueueTransaction(tx);
    expect(await getPendingCount()).toBe(1);

    vi.spyOn(api, 'post').mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await flushOfflineQueue();
    expect(result.synced).toBe(0);
    // Queue should remain intact for the next sync attempt
    expect(await getPendingCount()).toBe(1);
  });

  it('records validation errors (422) on item and increments attempt counter', async () => {
    const tx: TransactionCreatePayload = {
      amount_minor: 9900,
      category_id: 'cat-invalid',
      merchant: 'Unknown Vendor',
      payment_method: 'upi',
      client_id: 'uuid-invalid-4',
    };

    await enqueueTransaction(tx);

    vi.spyOn(api, 'post').mockRejectedValue(
      new ApiError(422, 'Category does not exist', 'validation_error')
    );

    const result = await flushOfflineQueue();
    expect(result.synced).toBe(0);
    expect(result.failed).toBe(1);

    const pending = await getPendingTransactions();
    expect(pending).toHaveLength(1);
    expect(pending[0]?.attempts).toBe(1);
    expect(pending[0]?.last_error).toBe('Category does not exist');
  });
});
