-- Migration: Add completed_flower_colors to student_profiles
-- Stores the actual petal colors of each completed flower as a jsonb array of string arrays.
-- Example: [["#FF0000","#00FF00","#0000FF","#FFFF00","#FF00FF"], ["#AA0000",...]]

ALTER TABLE public.student_profiles
  ADD COLUMN IF NOT EXISTS completed_flower_colors jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.student_profiles.completed_flower_colors
  IS 'Array of 5-color arrays for every completed flower; preserves the student''s color choices permanently.';
