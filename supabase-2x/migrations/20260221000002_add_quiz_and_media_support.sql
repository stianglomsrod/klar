-- Migration: Add student image upload support to feedback
-- The quiz infrastructure (task_type enum, tasks.type, tasks.quiz_data,
-- task_library.quiz_data, feedback.quiz_responses) is already in place.
-- This migration adds the missing column for student photo deliveries.

-- 1. Add student_image_url to feedback (for photo submissions)
ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS student_image_url text;
