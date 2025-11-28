import { describe, it, expect } from 'vitest';
import { _isSignificantShortage } from './mancoService';

describe('isSignificantShortage', () => {
  it('returns true for non weighed product with shortage', () => {
    const prod = { shortage: 1, isWeighed: false };
    expect(_isSignificantShortage(prod)).toBe(true);
  });

  it('returns false for weighed product with small shortage', () => {
    const prod = { shortage: 1, quantity: 10, isWeighed: true };
    expect(_isSignificantShortage(prod)).toBe(false);
  });

  it('returns true for weighed product with big shortage', () => {
    const prod = { shortage: 3, quantity: 10, isWeighed: true };
    expect(_isSignificantShortage(prod)).toBe(true);
  });
});
