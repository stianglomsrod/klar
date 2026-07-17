-- Prevent duplicate reward claims via a composite unique constraint.
--
-- UNIQUE(student_id, reward_id, earned_at_level) means:
--   • A student cannot claim the SAME reward at the SAME level twice
--     (prevents race conditions from double-clicks / concurrent tabs)
--   • Recurring rewards can still be earned at different levels (intended)
--   • One-time rewards are additionally filtered out of the LevelUpModal UI
--     after the first claim, providing a second layer of defence
--
-- The application uses ON CONFLICT DO NOTHING for graceful handling.

-- Step 1: Clean up any exact duplicates before adding the constraint
DELETE FROM public.student_rewards a
  USING public.student_rewards b
WHERE a.id > b.id                              -- keep the older row
  AND a.student_id = b.student_id
  AND a.reward_id  = b.reward_id
  AND a.earned_at_level = b.earned_at_level;

-- Step 2: Add the composite unique constraint
ALTER TABLE public.student_rewards
  ADD CONSTRAINT student_rewards_unique_per_level
  UNIQUE (student_id, reward_id, earned_at_level);

