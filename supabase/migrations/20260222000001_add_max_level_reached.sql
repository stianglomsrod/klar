-- Add max_level_reached to student_profiles.
-- Tracks the highest level a student has ever achieved (high-water mark).
-- Prevents the Level-Up modal from re-triggering on undo → re-complete cycles.
ALTER TABLE public.student_profiles
  ADD COLUMN max_level_reached integer NOT NULL DEFAULT 1;

-- Sync existing rows so students don't get re-prompted for past levels.
UPDATE public.student_profiles
  SET max_level_reached = level;
