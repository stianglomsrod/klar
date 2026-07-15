-- Enable RLS on task_library table
ALTER TABLE public.task_library ENABLE ROW LEVEL SECURITY;

-- Allow teachers to view all task library items
CREATE POLICY "Teachers can view all task library items"
ON public.task_library
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'teacher'
  )
);

-- Allow teachers to insert task library items
CREATE POLICY "Teachers can insert task library items"
ON public.task_library
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'teacher'
  )
);

-- Allow teachers to update task library items they created
CREATE POLICY "Teachers can update their task library items"
ON public.task_library
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

-- Allow teachers to delete task library items they created
CREATE POLICY "Teachers can delete their task library items"
ON public.task_library
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
