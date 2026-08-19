import { describe, it, expect } from 'vitest';
import {
  formatCurrency,
  formatProjectId,
  formatWorkerId,
  formatDate,
  formatDateShort,
  formatTime12h,
} from './format';

describe('formatCurrency', () => {
  it('formats with the peso sign, thousands separators, and two decimals', () => {
    expect(formatCurrency(1200)).toBe('₱1,200.00');
  });

  it('formats a decimal value', () => {
    expect(formatCurrency(1234.5)).toBe('₱1,234.50');
  });

  it('falls back to ₱0.00 for non-numeric input', () => {
    expect(formatCurrency(undefined)).toBe('₱0.00');
    expect(formatCurrency(null)).toBe('₱0.00');
    expect(formatCurrency('not a number')).toBe('₱0.00');
  });
});

describe('formatProjectId', () => {
  it('zero-pads to 2 digits with a WB- prefix', () => {
    expect(formatProjectId(7)).toBe('WB-07');
    expect(formatProjectId(12)).toBe('WB-12');
  });

  it('handles a missing id', () => {
    expect(formatProjectId(null)).toBe('WB-?');
    expect(formatProjectId(undefined)).toBe('WB-?');
    expect(formatProjectId('')).toBe('WB-?');
  });
});

describe('formatWorkerId', () => {
  it('zero-pads to 2 digits with a W- prefix', () => {
    expect(formatWorkerId(7)).toBe('W-07');
  });

  it('handles a missing id', () => {
    expect(formatWorkerId(null)).toBe('W-?');
  });
});

describe('formatDate', () => {
  it('formats as a long-form date', () => {
    expect(formatDate('2026-01-07')).toBe('January 7, 2026');
  });

  it('handles missing/invalid input', () => {
    expect(formatDate(null)).toBe('N/A');
    expect(formatDate('')).toBe('N/A');
    expect(formatDate('not a date')).toBe('N/A');
  });
});

describe('formatDateShort', () => {
  it('formats as an abbreviated date', () => {
    expect(formatDateShort('2026-01-07')).toBe('Jan 7, 2026');
  });

  it('handles missing/invalid input', () => {
    expect(formatDateShort(null)).toBe('');
    expect(formatDateShort('not a date')).toBe('');
  });
});

describe('formatTime12h', () => {
  it('formats a morning time', () => {
    expect(formatTime12h('08:30')).toBe('8:30 AM');
  });

  it('formats an afternoon time', () => {
    expect(formatTime12h('17:00')).toBe('5:00 PM');
  });

  it('formats midnight and noon correctly', () => {
    expect(formatTime12h('00:00')).toBe('12:00 AM');
    expect(formatTime12h('12:00')).toBe('12:00 PM');
  });

  it('handles missing input', () => {
    expect(formatTime12h(null)).toBe('—');
    expect(formatTime12h('')).toBe('—');
  });
});
