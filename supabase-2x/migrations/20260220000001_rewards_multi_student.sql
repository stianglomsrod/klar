-- Migration: Change rewards from single student assignment to multi-student assignment
-- Changes specific_student_id (uuid) -> specific_student_ids (uuid[])

-- Step 1: Add the new array column with default empty array
ALTER TABLE public.rewards
ADD COLUMN specific_student_ids uuid[] DEFAULT '{}';

-- Step 2: Migrate existing data from old column to new column
UPDATE public.rewards
SET specific_student_ids = ARRAY[specific_student_id]
WHERE specific_student_id IS NOT NULL;

-- Step 3: Drop ALL policies that depend on the old column BEFORE dropping it
DROP POLICY IF EXISTS "Rewards visibility" ON public.rewards;
DROP POLICY IF EXISTS "Students can view their available rewards" ON public.rewards;

-- Step 4: Drop the old foreign key constraint and column
ALTER TABLE public.rewards
DROP CONSTRAINT IF EXISTS rewards_specific_student_id_fkey;

ALTER TABLE public.rewards
DROP COLUMN specific_student_id;

-- Recreate with array check: student can see if array is empty (global) or contains their id
CREATE POLICY "Students can view their available rewards"
ON public.rewards
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'student'
  )
  AND (specific_student_ids = '{}' OR auth.uid() = ANY(specific_student_ids))
);
