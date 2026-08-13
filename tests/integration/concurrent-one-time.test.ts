import { describe, it, expect } from 'vitest';
import { acquireOneTimeLock } from '../../lib/redis';

describe('One-Time Link Concurrent Consumption', () => {
  it('allows only one request to acquire the one-time consume lock under race conditions', async () => {
    const token = 'race_token_123';

    // Simulate two simultaneous requests trying to acquire the one-time lock
    const results = await Promise.all([
      acquireOneTimeLock(token),
      acquireOneTimeLock(token),
    ]);

    const successes = results.filter((res) => res === true);
    const failures = results.filter((res) => res === false);

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);
  });
});
