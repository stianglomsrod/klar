-- Add unique constraint on classes(name, grade_id) to prevent duplicate
-- class names within the same grade. The RPC `link_student_to_class_structure`
-- already does case-insensitive lookups, but this adds a hard DB-level guard.
--
-- Also adds UPDATE RLS policy for teachers (needed for future class rename).

-- 1. Unique index (case-insensitive name + grade_id, NULLs treated as equal)
CREATE UNIQUE INDEX IF NOT EXISTS classes_name_grade_unique
  ON public.classes (LOWER(name), COALESCE(grade_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- 2. UPDATE policy for teachers
CREATE POLICY "Teachers can update classes" ON public.classes
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher')
  );
