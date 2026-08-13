-- Neon pg_cron scheduled job configuration
-- Stored and executed strictly in UTC per architecture.md §8 and ADR-006.

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Job 1: Expiry Purge & 30-Day Revoked Grace Period Cleanup
-- Runs nightly at 00:00 UTC ('0 0 * * *')
SELECT cron.schedule(
  'nightly-expiry-and-grace-purge',
  '0 0 * * *',
  $$
  DELETE FROM notes
  WHERE (expiry_date IS NOT NULL AND expiry_date < NOW())
     OR (revoked = true AND updated_at < NOW() - INTERVAL '30 days');
  $$
);
