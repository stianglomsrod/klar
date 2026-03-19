-- ══════════════════════════════════════════════════════════
-- Migration: Substitute Teacher (Vikar) Schema Foundation
-- ══════════════════════════════════════════════════════════

-- 1. Add substitute & admin flags to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_substitute boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- 2. Create substitute_assignments table
CREATE TABLE public.substitute_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  substitute_id uuid NOT NULL,
  class_id uuid,
  student_id uuid,
  assigned_by uuid NOT NULL,
  real_name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT substitute_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT substitute_assignments_substitute_id_fkey FOREIGN KEY (substitute_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT substitute_assignments_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE,
  CONSTRAINT substitute_assignments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT substitute_assignments_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.profiles(id),
  CONSTRAINT substitute_assignments_scope_xor CHECK (
    (class_id IS NOT NULL AND student_id IS NULL) OR
    (class_id IS NULL AND student_id IS NOT NULL)
  )
);

-- Indexes for RLS helper function performance
CREATE INDEX idx_sub_assignments_substitute ON public.substitute_assignments(substitute_id);
CREATE INDEX idx_sub_assignments_class ON public.substitute_assignments(class_id) WHERE class_id IS NOT NULL;
CREATE INDEX idx_sub_assignments_student ON public.substitute_assignments(student_id) WHERE student_id IS NOT NULL;

-- RLS on substitute_assignments
ALTER TABLE public.substitute_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage substitute_assignments"
  ON public.substitute_assignments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'teacher' AND is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'teacher' AND is_admin = true
    )
  );

CREATE POLICY "Substitutes can view own assignments"
  ON public.substitute_assignments
  FOR SELECT TO authenticated
  USING (substitute_id = auth.uid());

-- ──────────────────────────────────────────────────────────
-- 3. Helper functions for RLS
-- ──────────────────────────────────────────────────────────

-- is_full_teacher(): regular teacher, NOT a substitute
CREATE OR REPLACE FUNCTION public.is_full_teacher()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'teacher'
      AND is_substitute = false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_full_teacher() TO authenticated;

-- is_substitute(): teacher flagged as substitute
CREATE OR REPLACE FUNCTION public.is_substitute()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'teacher'
      AND is_substitute = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_substitute() TO authenticated;

-- is_admin_teacher(): teacher flagged as admin
CREATE OR REPLACE FUNCTION public.is_admin_teacher()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'teacher'
      AND is_admin = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_teacher() TO authenticated;

-- can_access_student(p_student_id): scoping check for substitutes
-- Short-circuit: non-teachers → false, full teachers → true, subs → check assignments
CREATE OR REPLACE FUNCTION public.can_access_student(p_student_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT CASE
    -- Not a teacher at all → false
    WHEN NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'teacher'
    ) THEN false
    -- Full teacher (not substitute) → always true
    WHEN NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_substitute = true
    ) THEN true
    -- Substitute → check direct student assignment OR class assignment
    ELSE EXISTS (
      SELECT 1 FROM public.substitute_assignments sa
      WHERE sa.substitute_id = auth.uid()
        AND (
          sa.student_id = p_student_id
          OR sa.class_id = (
            SELECT sp.class_id FROM public.student_profiles sp
            WHERE sp.id = p_student_id
          )
        )
    )
  END;
$$;

GRANT EXECUTE ON FUNCTION public.can_access_student(uuid) TO authenticated;

-- can_access_class(p_class_id): scoping for class-level tables
CREATE OR REPLACE FUNCTION public.can_access_class(p_class_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'teacher'
    ) THEN false
    WHEN NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_substitute = true
    ) THEN true
    ELSE EXISTS (
      SELECT 1 FROM public.substitute_assignments sa
      WHERE sa.substitute_id = auth.uid()
        AND sa.class_id = p_class_id
    )
  END;
$$;

GRANT EXECUTE ON FUNCTION public.can_access_class(uuid) TO authenticated;
