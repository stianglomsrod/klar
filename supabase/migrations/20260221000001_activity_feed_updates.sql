-- Migration: Add columns to support the teacher activity feed
-- Adds completed_at to tasks, and teacher_reaction + teacher_comment to feedback

-- Step 1: Add completed_at to tasks
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;

-- Backfill: set completed_at for already-completed tasks to their created_at
UPDATE public.tasks
SET completed_at = created_at
WHERE is_completed = true AND completed_at IS NULL;

-- Step 2: Add teacher feedback columns
ALTER TABLE public.feedback
ADD COLUMN IF NOT EXISTS teacher_reaction text;

ALTER TABLE public.feedback
ADD COLUMN IF NOT EXISTS teacher_comment text;
