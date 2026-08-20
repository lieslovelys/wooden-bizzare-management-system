import React from 'react';

// Prev/Next with a range readout — see ARCHITECTURE_REVIEW.md P1-3. Drops in below any of the
// list screens' markup (real <table>s and per-screen CSS-grid div "tables" alike) since it's a
// self-contained block, not something that needs to match a particular table implementation.
const Pagination = ({ page, meta, onChange }) => {
  const { total = 0, totalPages = 0, limit = 25 } = meta || {};

  if (totalPages <= 1) return null;

  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <nav className="wb-pagination" aria-label="Pagination">
      <button
        type="button"
        className="wb-pagination-btn"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        ‹ Prev
      </button>
      <span className="wb-pagination-range">
        Showing {start}–{end} of {total}
      </span>
      <button
        type="button"
        className="wb-pagination-btn"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="Next page"
      >
        Next ›
      </button>
    </nav>
  );
};

export default Pagination;
