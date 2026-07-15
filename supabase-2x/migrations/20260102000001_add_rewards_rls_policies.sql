-- Enable RLS on rewards table
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

-- Allow teachers to view all rewards
CREATE POLICY "Teachers can view all rewards"
ON public.rewards
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'teacher'
  )
);

-- Allow teachers to insert rewards
CREATE POLICY "Teachers can insert rewards"
ON public.rewards
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'teacher'
  )
);

-- Allow teachers to update rewards they created
CREATE POLICY "Teachers can update rewards they created"
ON public.rewards
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'teacher'
  )
);

-- Allow teachers to delete rewards they created
CREATE POLICY "Teachers can delete rewards they created"
ON public.rewards
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'teacher'
  )
);

-- Allow students to view rewards available to them
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
  AND (specific_student_id IS NULL OR specific_student_id = auth.uid())
);
