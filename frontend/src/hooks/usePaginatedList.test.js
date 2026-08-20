import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { usePaginatedList } from './usePaginatedList';

// P1-3: usePaginatedList is the seam every server-paginated list screen hangs off — see
// ARCHITECTURE_REVIEW.md P1-3. Tests cover: unwrapping the {success,data,meta} envelope, that
// changing a filter param resets to page 1 and refetches, and that a search-shaped param is
// debounced rather than firing a request per keystroke.
vi.mock('../api/client', () => ({
  api: { get: vi.fn() },
}));

const { api } = await import('../api/client');

const PAGE_1 = {
  success: true,
  data: [{ id: 1 }, { id: 2 }],
  meta: { page: 1, limit: 25, total: 2, totalPages: 1 },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

describe('usePaginatedList', () => {
  it('fetches on mount and unwraps data/meta', async () => {
    api.get.mockResolvedValue(PAGE_1);
    const { result } = renderHook(() => usePaginatedList('/api/things'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows).toEqual(PAGE_1.data);
    expect(result.current.meta).toEqual(PAGE_1.meta);
    expect(api.get).toHaveBeenCalledWith('/api/things?page=1&limit=25');
  });

  it('does not fetch when the endpoint is falsy', async () => {
    const { result } = renderHook(() => usePaginatedList(null));
    expect(result.current.loading).toBe(false);
    expect(api.get).not.toHaveBeenCalled();
  });

  it('changing page requests the new offset immediately, no debounce', async () => {
    api.get.mockResolvedValue(PAGE_1);
    const { result } = renderHook(() => usePaginatedList('/api/things'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setPage(2));
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/api/things?page=2&limit=25'));
  });

  it('changing a non-search param resets to page 1', async () => {
    api.get.mockResolvedValue(PAGE_1);
    const { result, rerender } = renderHook(
      ({ status }) => usePaginatedList('/api/things', { params: { status } }),
      { initialProps: { status: 'Pending' } }
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setPage(2));
    await waitFor(() => expect(result.current.page).toBe(2));

    rerender({ status: 'Approved' });
    expect(result.current.page).toBe(1);
  });

  it('debounces a search param instead of firing a request per keystroke', async () => {
    api.get.mockResolvedValue(PAGE_1);
    const { rerender } = renderHook(
      ({ search }) => usePaginatedList('/api/things', { params: { search } }),
      { initialProps: { search: '' } }
    );
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));

    rerender({ search: 'c' });
    rerender({ search: 'ca' });
    rerender({ search: 'cab' });

    // Still just the initial mount fetch — the debounce window hasn't elapsed yet.
    expect(api.get).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await waitFor(() => expect(api.get).toHaveBeenLastCalledWith('/api/things?page=1&limit=25&search=cab'));
    expect(api.get).toHaveBeenCalledTimes(2);
  });
});
