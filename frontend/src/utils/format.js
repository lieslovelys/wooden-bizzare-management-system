// Shared display formatters — replaces the drifted, independently-reimplemented versions that
// used to live in individual components (see ARCHITECTURE_REVIEW.md P2, "Client-side derived
// business logic duplicated with drift"). Plain functions, no React, so they're trivial to unit
// test and safe to import from anywhere.
import { apiUrl } from '../api/client';

// ₱1,200.00 — two decimals, thousands separators. Replaces three prior implementations that
// disagreed on both the symbol and the decimal places.
export const formatCurrency = (n) => {
  const value = Number(n);
  if (!Number.isFinite(value)) return '₱0.00';
  return '₱' + value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// WB-07 — zero-padded to 2 digits. Chosen as the canonical format because it was already the
// majority format across the app (5 of 9 sites) before this pass.
export const formatProjectId = (id) => {
  if (id === null || id === undefined || id === '') return 'WB-?';
  return `WB-${String(id).padStart(2, '0')}`;
};

// W-07 — same padding convention as formatProjectId, for worker/employee ids.
export const formatWorkerId = (id) => {
  if (id === null || id === undefined || id === '') return 'W-?';
  return `W-${String(id).padStart(2, '0')}`;
};

// January 7, 2026
export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

// Jan 7, 2026
export const formatDateShort = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// 2026-08-20 — an HTML date-input value (`YYYY-MM-DD`), built from local calendar parts. PRD B.6:
// EditProjectForm.jsx used to do `new Date(dateString).toISOString().split('T')[0]`, which parses
// to local midnight and then renders it in UTC — in UTC+8 that shifts the date back a day, so an
// edited project's dates could silently move on save. Never reach for `toISOString` on a plain
// calendar date for this reason; build the string from local getters instead.
export const toDateInputValue = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// PRD.md C.2 "Storage discipline": worker photos are served one at a time from
// GET /api/workers/:id/photo, not inlined into list responses — `worker` is any object carrying
// `user_id` and `photo_path` (getAllWorkers' own row shape; EditWorkerModal and Attendance.jsx's
// worker-list fetch both use the same endpoint, so this is safe to reuse for both). Returns null
// when there's nothing to show, so callers can fall back to an initials avatar. `?v=<photo_path>`
// is a cache-buster — the filename itself changes on every replace (see photoStorage.savePhoto),
// so this URL never needs revalidating against a stale browser cache.
export const workerPhotoUrl = (worker) => {
  if (!worker?.user_id || !worker?.photo_path) return null;
  return apiUrl(`/api/workers/${worker.user_id}/photo?v=${encodeURIComponent(worker.photo_path)}`);
};

// 8:30 AM — expects a "HH:MM[:SS]" string (as returned by Postgres `time` columns).
export const formatTime12h = (t) => {
  if (!t) return '—';
  const [h, m] = t.slice(0, 5).split(':');
  const hours = parseInt(h, 10);
  if (Number.isNaN(hours)) return '—';
  const ampm = hours >= 12 ? 'PM' : 'AM';
  return `${hours % 12 || 12}:${m} ${ampm}`;
};
