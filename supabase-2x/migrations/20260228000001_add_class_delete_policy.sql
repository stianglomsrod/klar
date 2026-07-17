-- Add DELETE RLS policy for teachers on classes table.
-- Required so the service-role client can delete via admin,
-- and so future browser-client usage (if any) is safe.

CREATE POLICY "Teachers can delete classes" ON public.classes
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher')
  );
