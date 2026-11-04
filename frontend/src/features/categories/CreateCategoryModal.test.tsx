import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CreateCategoryModal } from './CreateCategoryModal';
import { ToastProvider } from '../../components/ui/ToastContext';
import * as apiModule from '../../lib/api';
import { getPriorityCategoryIds } from '../../lib/categoryPriority';

vi.mock('../../lib/api', () => ({
  api: {
    post: vi.fn(),
  },
}));

describe('CreateCategoryModal & Category Priority', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders modal inputs and creates custom category with front priority', async () => {
    const mockCreatedCategory = {
      id: 'cat-custom-123',
      name: 'Chai & Snacks',
      icon: 'coffee',
      color: '#F59E0B',
      sort_order: 11,
      is_default: false,
      archived_at: null,
      usage_count_30d: 0,
    };

    (apiModule.api.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce(mockCreatedCategory);

    const onCreated = vi.fn();
    const onClose = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <CreateCategoryModal
            isOpen={true}
            onClose={onClose}
            onCreated={onCreated}
            initialName="Chai"
          />
        </ToastProvider>
      </QueryClientProvider>
    );

    expect(screen.getByText('Create Custom Category')).toBeDefined();
    const input = screen.getByPlaceholderText(/Chai & Snacks/i) as HTMLInputElement;
    expect(input.value).toBe('Chai');

    fireEvent.change(input, { target: { value: 'Chai & Snacks' } });

    const submitBtn = screen.getByRole('button', { name: /Create & Pin to Front/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(apiModule.api.post).toHaveBeenCalledWith('/categories', {
        name: 'Chai & Snacks',
        icon: 'tag',
        color: '#6366F1',
      });
      expect(onCreated).toHaveBeenCalledWith(mockCreatedCategory);
      expect(onClose).toHaveBeenCalled();
    });

    // Check that ID is prioritized at index 0
    const priorityIds = getPriorityCategoryIds();
    expect(priorityIds[0]).toBe('cat-custom-123');
  });
});
