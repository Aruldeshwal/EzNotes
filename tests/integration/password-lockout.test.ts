import { describe, it, expect } from 'vitest';
import { recordPasswordFailure, checkLockout } from '../../lib/redis';

describe('Password Brute-Force Lockout Defense', () => {
  it('locks out IP after 5 failed password attempts', async () => {
    const token = 'pass_token_lockout';
    const ip = '192.168.1.100';

    expect(await checkLockout(token, ip)).toBe(false);

    // Perform 4 failed attempts
    for (let i = 1; i <= 4; i++) {
      const res = await recordPasswordFailure(token, ip);
      expect(res.isLockedOut).toBe(false);
      expect(res.fails).toBe(i);
    }

    // 5th failed attempt triggers lockout
    const fifthAttempt = await recordPasswordFailure(token, ip);
    expect(fifthAttempt.isLockedOut).toBe(true);

    // Subsequent check verifies IP is locked out
    expect(await checkLockout(token, ip)).toBe(true);
  });
});
