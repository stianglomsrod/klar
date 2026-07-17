-- Add max_uses column to rewards table
-- NULL = unlimited (can be earned any number of times)
-- Positive integer = maximum times a single student can earn this reward
ALTER TABLE public.rewards ADD COLUMN max_uses integer DEFAULT NULL;

-- Backfill: existing one-time rewards (is_recurring = false) get max_uses = 1
UPDATE public.rewards SET max_uses = 1 WHERE is_recurring = false;

-- Add a CHECK constraint to ensure max_uses is positive when set
ALTER TABLE public.rewards ADD CONSTRAINT rewards_max_uses_positive CHECK (max_uses IS NULL OR max_uses > 0);
