-- Migration: Add teacher_id and read_at to feedback table
-- teacher_id: FK to profiles — tracks which teacher left the feedback
-- read_at: timestamp — tracks when the student first viewed the feedback

ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS teacher_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS read_at timestamp with time zone;

-- Index for quick "unread feedback" lookups per student
CREATE INDEX IF NOT EXISTS idx_feedback_student_unread
  ON public.feedback (student_id)
  WHERE read_at IS NULL AND (teacher_reaction IS NOT NULL OR teacher_comment IS NOT NULL);
