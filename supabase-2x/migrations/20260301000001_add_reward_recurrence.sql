-- Add is_recurring flag to rewards table
-- true  = reward appears every level-up (default, backwards-compatible)
-- false = reward disappears after a student selects it once
ALTER TABLE public.rewards
  ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT true;

-- Back-fill: all existing rewards stay recurring
UPDATE public.rewards SET is_recurring = true WHERE is_recurring IS NULL;
