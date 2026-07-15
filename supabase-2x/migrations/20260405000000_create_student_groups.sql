-- Student Groups: teacher-created custom sub-groups of students
-- Groups are independent of class hierarchy (cross-class groupings)

-- ── Main groups table ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.student_groups (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Junction table: group ↔ student ────────────────────
CREATE TABLE IF NOT EXISTS public.student_group_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   uuid NOT NULL REFERENCES public.student_groups(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  UNIQUE(group_id, student_id)
);

-- ── RLS ────────────────────────────────────────────────
ALTER TABLE public.student_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_group_members ENABLE ROW LEVEL SECURITY;

-- Teachers can CRUD their own groups
CREATE POLICY "Teachers can view own groups"
  ON public.student_groups FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Teachers can create groups"
  ON public.student_groups FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Teachers can update own groups"
  ON public.student_groups FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Teachers can delete own groups"
  ON public.student_groups FOR DELETE
  USING (auth.uid() = created_by);

-- Members: teachers can manage members of their own groups
CREATE POLICY "Teachers can view group members"
  ON public.student_group_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.student_groups g
      WHERE g.id = group_id AND g.created_by = auth.uid()
    )
  );

CREATE POLICY "Teachers can add group members"
  ON public.student_group_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.student_groups g
      WHERE g.id = group_id AND g.created_by = auth.uid()
    )
  );

CREATE POLICY "Teachers can remove group members"
  ON public.student_group_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.student_groups g
      WHERE g.id = group_id AND g.created_by = auth.uid()
    )
  );
