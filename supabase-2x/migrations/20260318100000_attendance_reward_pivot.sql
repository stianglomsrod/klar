-- Pivot: Replace streak stars with direct attendance rewards
-- 1. Add 'attendance' to the reward_cost_type enum
ALTER TYPE public.reward_cost_type ADD VALUE 'attendance';

-- 2. Drop deprecated star/milestone columns
ALTER TABLE public.student_profiles DROP COLUMN IF EXISTS streak_stars;
ALTER TABLE public.student_profiles DROP COLUMN IF EXISTS last_streak_milestone;

-- 3. Add per-reward progress tracking JSONB
--    Structure: Record<reward_id, { baseline: number; last_granted_at: number }>
--    baseline = student's current_streak when reward was first observed
--    last_granted_at = current_streak when the last grant occurred
ALTER TABLE public.student_profiles
  ADD COLUMN attendance_reward_progress jsonb NOT NULL DEFAULT '{}'::jsonb;
