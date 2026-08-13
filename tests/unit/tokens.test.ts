import { describe, it, expect } from 'vitest';
import { generateShareToken } from '../../lib/tokens';

describe('generateShareToken', () => {
  it('generates a string of length 12', () => {
    const token = generateShareToken();
    expect(typeof token).toBe('string');
    expect(token.length).toBe(12);
  });

  it('generates unique tokens on subsequent calls', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateShareToken()));
    expect(tokens.size).toBe(50);
  });
});
