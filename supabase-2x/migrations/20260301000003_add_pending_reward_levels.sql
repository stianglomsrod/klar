-- Track unclaimed level-up rewards.
--
-- When a student levels up, the new level(s) are appended to this array.
-- When the student selects a reward (petal paint or database coupon),
-- the corresponding level is removed.
--
-- This ensures rewards survive browser refreshes, tab closures, and
-- device switches. The student dashboard shows a reminder banner
-- whenever this array is non-empty.

ALTER TABLE public.student_profiles
  ADD COLUMN pending_reward_levels integer[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.student_profiles.pending_reward_levels IS
  'Array of level numbers where the student has not yet claimed a reward. '
  'Populated atomically with the level-up in completeTask, cleared on selectReward.';
