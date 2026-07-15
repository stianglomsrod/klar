-- Add emoji column to rewards table
-- This allows teachers to customize reward icons

ALTER TABLE public.rewards 
ADD COLUMN IF NOT EXISTS emoji text DEFAULT '🎁';

-- Backfill existing rewards with default emoji
UPDATE public.rewards 
SET emoji = '🎁' 
WHERE emoji IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.rewards.emoji IS 'Emoji icon for the reward (e.g., 🎁 🍕 ⏰ 🎨)';
