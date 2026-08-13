import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../lib/password';

describe('Password Utility', () => {
  it('correctly hashes and verifies a password', async () => {
    const plain = 'SuperSecret123!';
    const hash = await hashPassword(plain);

    expect(hash).not.toBe(plain);
    expect(hash.startsWith('$2a$') || hash.startsWith('$2b$')).toBe(true);

    const isValid = await verifyPassword(plain, hash);
    expect(isValid).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const plain = 'SuperSecret123!';
    const hash = await hashPassword(plain);

    const isValid = await verifyPassword('WrongPassword', hash);
    expect(isValid).toBe(false);
  });
});
