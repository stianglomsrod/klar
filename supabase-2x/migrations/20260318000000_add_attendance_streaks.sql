-- Add attendance streak columns to student_profiles
-- Feature: "Nærværsstjerner" (Attendance Stars)
-- Disabled by default; teacher opts in per student.

ALTER TABLE public.student_profiles
  ADD COLUMN streak_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN streak_mode text NOT NULL DEFAULT 'classic'
    CHECK (streak_mode IN ('classic', 'accumulated')),
  ADD COLUMN current_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN longest_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN last_login_date date,
  ADD COLUMN streak_stars integer NOT NULL DEFAULT 0,
  ADD COLUMN last_streak_milestone integer NOT NULL DEFAULT 0;
