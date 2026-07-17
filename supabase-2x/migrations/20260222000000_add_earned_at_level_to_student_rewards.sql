-- Add earned_at_level column to student_rewards
-- Tracks which level the student was at when they earned the reward.
-- Used to lock coupons if the student's level drops below this value (anti-cheat).
ALTER TABLE public.student_rewards
  ADD COLUMN earned_at_level integer NOT NULL DEFAULT 1;
