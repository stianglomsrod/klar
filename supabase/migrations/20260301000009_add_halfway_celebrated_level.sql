-- Add halfway_celebrated_level to student_profiles
-- Tracks the highest level for which the 50% milestone celebration has been shown.
-- 0 = never celebrated. When the modal fires for level N, this is set to N.
ALTER TABLE public.student_profiles ADD COLUMN halfway_celebrated_level integer NOT NULL DEFAULT 0;
