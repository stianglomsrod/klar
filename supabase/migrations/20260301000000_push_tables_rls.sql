-- ============================================================
-- Enable RLS on push_subscriptions and student_teacher_settings
-- ============================================================

-- push_subscriptions ──────────────────────────────────────────
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Teachers can manage their own push subscriptions
CREATE POLICY push_subscriptions_own_select
  ON public.push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY push_subscriptions_own_insert
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY push_subscriptions_own_update
  ON public.push_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY push_subscriptions_own_delete
  ON public.push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);


-- student_teacher_settings ────────────────────────────────────
ALTER TABLE public.student_teacher_settings ENABLE ROW LEVEL SECURITY;

-- Teachers can manage settings where they are the teacher
CREATE POLICY sts_teacher_select
  ON public.student_teacher_settings FOR SELECT
  USING (auth.uid() = teacher_id);

CREATE POLICY sts_teacher_insert
  ON public.student_teacher_settings FOR INSERT
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY sts_teacher_update
  ON public.student_teacher_settings FOR UPDATE
  USING (auth.uid() = teacher_id);

CREATE POLICY sts_teacher_delete
  ON public.student_teacher_settings FOR DELETE
  USING (auth.uid() = teacher_id);
