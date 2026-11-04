const PRIORITY_KEY = 'spendwise_priority_categories';

/**
 * Returns an ordered array of category IDs prioritized by the user.
 * The most recently created or selected category is always at index 0.
 */
export function getPriorityCategoryIds(): string[] {
  try {
    const raw = localStorage.getItem(PRIORITY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Records a category ID as top priority (placed at index 0).
 * Ensures custom categories appear right at the front on subsequent opens.
 */
export function addPriorityCategoryId(id: string): void {
  if (!id) return;
  try {
    const current = getPriorityCategoryIds().filter((existingId) => existingId !== id);
    const updated = [id, ...current].slice(0, 20);
    localStorage.setItem(PRIORITY_KEY, JSON.stringify(updated));
  } catch {
    // Ignore quota or private-browsing errors
  }
}

