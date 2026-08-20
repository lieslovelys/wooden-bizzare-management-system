import { describe, it, expect } from 'vitest';
import { withoutDigits, digitsOnly, isIncompleteContactNumber, CONTACT_NUMBER_LENGTH } from './formValidators';

describe('withoutDigits', () => {
  it('strips digits from a name', () => {
    expect(withoutDigits('Juan123')).toBe('Juan');
  });

  it('leaves a digit-free string untouched', () => {
    expect(withoutDigits('Juan Dela Cruz')).toBe('Juan Dela Cruz');
  });
});

describe('digitsOnly', () => {
  it('strips non-digit characters', () => {
    expect(digitsOnly('091-234-5678')).toBe('0912345678');
  });

  it('accepts a value at exactly the max length', () => {
    expect(digitsOnly('09123456789', CONTACT_NUMBER_LENGTH)).toBe('09123456789');
  });

  it('rejects (returns undefined) once the result would exceed the max length', () => {
    // Matches the existing "further typing is blocked" behavior — the caller keeps whatever
    // was already in state rather than getting a silently truncated value.
    expect(digitsOnly('091234567890', CONTACT_NUMBER_LENGTH)).toBeUndefined();
  });

  it('defaults maxLength to CONTACT_NUMBER_LENGTH', () => {
    expect(digitsOnly('12345678901234')).toBeUndefined();
  });
});

describe('isIncompleteContactNumber', () => {
  it('is false for an empty value — contact number is optional', () => {
    expect(isIncompleteContactNumber('')).toBe(false);
  });

  it('is true for a non-empty value shorter than the required length', () => {
    expect(isIncompleteContactNumber('091234')).toBe(true);
  });

  it('is false once the value reaches the required length', () => {
    expect(isIncompleteContactNumber('09123456789')).toBe(false);
  });
});
