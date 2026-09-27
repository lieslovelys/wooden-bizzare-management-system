import { expect } from 'vitest';

// DESIGN.md §7#10 — every raw <table> converted to mobile cards (css/globals.css's
// .wb-card-table) needs a data-label on each non-colspan <td>, since the CSS reads it via
// `attr(data-label)` for the card's field label. jsdom computes no layout, so a test can't see
// whether the label actually renders correctly at 360px, but it can catch the one thing that
// silently breaks the mechanism outright: a cell missing the attribute (blank label) or a
// colspan cell that has one it doesn't need.
// `skipSelector` (optional): a cell matching it is deliberately unlabeled — e.g.
// WorkerProductivity's rank/name cell, which is the card's own header rather than a
// label/value pair — and is excluded from the "must have data-label" check.
export function expectCardLabels(container, tableSelector, { skipSelector } = {}) {
  const table = container.querySelector(tableSelector);
  expect(table, `no <table> matching "${tableSelector}"`).toBeTruthy();
  expect(table.className.split(/\s+/)).toContain('wb-card-table');

  const cells = table.querySelectorAll('tbody td');
  for (const cell of cells) {
    if (cell.hasAttribute('colspan')) continue;
    if (skipSelector && cell.closest(skipSelector)) continue;
    const label = cell.getAttribute('data-label');
    expect(label, `<td> in ${tableSelector} is missing data-label: ${cell.outerHTML.slice(0, 120)}`).toBeTruthy();
  }
}
