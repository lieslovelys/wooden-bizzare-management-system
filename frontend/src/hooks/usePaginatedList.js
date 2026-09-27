import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

// P1-3: the seam every server-paginated list screen hangs off — see
// ARCHITECTURE_REVIEW.md P1-3. Drives one GET endpoint that returns
// `{ success, data, meta: { page, limit, total, totalPages } }`. Pass a falsy `endpoint`
// (e.g. a userID that hasn't loaded yet) to skip fetching entirely — mirrors the existing
// `if (!userID) return;` guards this replaces in worker/WorkerJobOrder.jsx and elsewhere.

const DEBOUNCE_MS = 300;

// `search` is debounced so typing doesn't fire a request per keystroke; every other param (a
// dropdown, a toggle) takes effect immediately — the setState here happens inside a setTimeout
// callback, not synchronously in the effect body, so it's exempt from
// react-hooks/set-state-in-effect the same way the ignore-guarded async fetch below is.
function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

const emptyMeta = (limit) => ({ page: 1, limit, total: 0, totalPages: 0 });

// `refreshKey` (FR-4): an opaque value a caller can bump (e.g. an "arrivals" counter from
// globals/NotificationProvider.jsx) to make the list refetch when something external changed —
// same effect as calling `refetch()`, but expressible as a dependency instead of an imperative
// call, so a component that only re-renders when the key changes doesn't need its own effect.
// It never becomes a query parameter and never resets the page, unlike a change to `params`.
export function usePaginatedList(endpoint, { params = {}, pageSize = 25, refreshKey } = {}) {
  const { search, ...restParams } = params;
  const debouncedSearch = useDebouncedValue(search, DEBOUNCE_MS);
  const effectiveKey = JSON.stringify({ ...restParams, search: debouncedSearch });

  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(() => emptyMeta(pageSize));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refetchTick, setRefetchTick] = useState(0);

  // Resets to page 1 whenever the effective filter set changes, so a filter change never
  // strands the caller on a page number the new result set may not have. This adjusts state
  // during render (React's documented pattern for "derive state from a prop/param change")
  // rather than in a useEffect, so it lands in the same render instead of causing an extra one.
  const [committedKey, setCommittedKey] = useState(effectiveKey);
  if (effectiveKey !== committedKey) {
    setCommittedKey(effectiveKey);
    if (page !== 1) setPage(1);
  }

  useEffect(() => {
    if (!endpoint) {
      setLoading(false);
      return;
    }
    let ignore = false;
    (async () => {
      setLoading(true);
      try {
        const qs = new URLSearchParams();
        qs.set('page', String(page));
        qs.set('limit', String(pageSize));
        const effective = JSON.parse(effectiveKey);
        for (const [key, value] of Object.entries(effective)) {
          if (value === undefined || value === null || value === '') continue;
          qs.set(key, Array.isArray(value) ? value.join(',') : String(value));
        }
        const result = await api.get(`${endpoint}?${qs.toString()}`);
        if (!ignore) {
          setRows(result?.data || []);
          setMeta(result?.meta || emptyMeta(pageSize));
          setError(null);
        }
      } catch (err) {
        if (!ignore) setError(err);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [endpoint, page, pageSize, effectiveKey, refetchTick, refreshKey]);

  const refetch = useCallback(() => setRefetchTick((t) => t + 1), []);

  // `setRows` is exposed for optimistic single-row updates (delete one row, mark one row read)
  // within the currently-loaded page — cheaper than a round trip for a change that doesn't
  // affect which rows belong on this page. A change that DOES affect membership (a bulk action,
  // a filter change) should call `refetch()` (or change `page`) instead.
  return { rows, setRows, meta, page, setPage, loading, error, refetch };
}
