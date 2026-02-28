-- Migration: Add garden_positions to student_profiles
-- Stores the student's custom flower positions in the Living Meadow as a jsonb object.
-- Shape: { "0": { "x": 25.5, "y": 60.3 }, "1": { "x": 70.1, "y": 45.8 }, ... }
-- Coordinates are percentages (0-100) of the garden container for responsive layout.

ALTER TABLE public.student_profiles
  ADD COLUMN IF NOT EXISTS garden_positions jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.student_profiles.garden_positions
  IS 'Map of flower index to {x, y} percentage coordinates for the interactive garden sandbox. Enables drag-and-drop flower placement.';
