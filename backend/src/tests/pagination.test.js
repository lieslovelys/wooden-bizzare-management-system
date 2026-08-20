import { describe, it, expect } from 'vitest';
import { parsePagination, buildMeta, splitCountedRows, DEFAULT_LIMIT, MAX_LIMIT } from '../utils/pagination.js';
import { AppError } from '../errors/AppError.js';

describe('parsePagination', () => {
  it('defaults to page 1 and DEFAULT_LIMIT when nothing is given', () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: DEFAULT_LIMIT, offset: 0 });
  });

  it('computes offset from page and limit', () => {
    expect(parsePagination({ page: '3', limit: '10' })).toEqual({ page: 3, limit: 10, offset: 20 });
  });

  it('clamps a limit above maxLimit down to the cap rather than erroring', () => {
    expect(parsePagination({ limit: '99999' })).toEqual({ page: 1, limit: MAX_LIMIT, offset: 0 });
  });

  it('honors a caller-supplied defaultLimit and maxLimit', () => {
    expect(parsePagination({}, { defaultLimit: MAX_LIMIT })).toEqual({ page: 1, limit: MAX_LIMIT, offset: 0 });
    expect(parsePagination({ limit: '500' }, { maxLimit: 50 })).toEqual({ page: 1, limit: 50, offset: 0 });
  });

  it.each([
    ['page=0', { page: '0' }],
    ['negative page', { page: '-1' }],
    ['non-integer page', { page: '1.5' }],
    ['non-numeric page', { page: 'abc' }],
    ['limit=0', { limit: '0' }],
    ['negative limit', { limit: '-5' }],
    ['non-integer limit', { limit: '2.5' }],
    ['non-numeric limit', { limit: 'abc' }],
  ])('rejects %s with AppError(400)', (_label, query) => {
    expect(() => parsePagination(query)).toThrow(AppError);
    try {
      parsePagination(query);
    } catch (e) {
      expect(e.status).toBe(400);
    }
  });
});

describe('buildMeta', () => {
  it('computes totalPages via ceiling division', () => {
    expect(buildMeta({ page: 1, limit: 25, total: 51 })).toEqual({
      page: 1, limit: 25, total: 51, totalPages: 3,
    });
  });

  it('reports totalPages 0 for an empty result set', () => {
    expect(buildMeta({ page: 1, limit: 25, total: 0 })).toEqual({
      page: 1, limit: 25, total: 0, totalPages: 0,
    });
  });
});

describe('splitCountedRows', () => {
  it('returns an empty result untouched', () => {
    expect(splitCountedRows([])).toEqual({ rows: [], total: 0 });
  });

  it('lifts total_count off every row and strips the column', () => {
    const rows = [
      { id: 1, name: 'A', total_count: '2' },
      { id: 2, name: 'B', total_count: '2' },
    ];
    expect(splitCountedRows(rows)).toEqual({
      rows: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }],
      total: 2,
    });
  });
});
