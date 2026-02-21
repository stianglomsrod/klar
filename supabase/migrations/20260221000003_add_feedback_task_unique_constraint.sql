-- Migration: Add unique constraint on feedback.task_id
-- This is required for upsert operations (ON CONFLICT) when saving quiz responses.
-- Since each task is assigned to a specific student (tasks.student_id), task_id
-- is naturally unique per feedback row.

-- 1. Remove duplicate feedback rows (keep the most recent one per task_id)
DELETE FROM public.feedback f1
USING public.feedback f2
WHERE f1.task_id = f2.task_id
  AND f1.created_at < f2.created_at;

-- 2. Add unique constraint
ALTER TABLE public.feedback
ADD CONSTRAINT feedback_task_id_unique UNIQUE (task_id);
