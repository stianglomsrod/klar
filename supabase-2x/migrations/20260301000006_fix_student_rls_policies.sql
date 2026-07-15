-- Migration: Fix RLS policies for profiles, student_profiles, and subjects
-- Resolves: Student profile disconnect (Level 1 / Unicorn fallback) and dead FULLFØR button.
--
-- Root cause: RLS was enabled on `profiles` and `student_profiles` (relrowsecurity = true)
-- but no policies existed for the student role. All student SELECTs returned zero rows,
-- causing StudentProfileContext to fall through to defaults. The null profile then
-- made handleConfirmCompletion early-return silently on every click.
--
-- Additionally, `subjects` had RLS enabled with teacher-only SELECT policies,
-- blocking students from reading subject data (name, emoji, color).

-- ============================================================
-- 1. PROFILES — student & teacher policies
-- ============================================================

-- Clean slate: drop any broken policies from previous fix attempts
DROP POLICY IF EXISTS "Students can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Students can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Teachers can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Teachers can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Ensure RLS is enabled (idempotent)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Students can read their own profile
CREATE POLICY "Students can view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- Students can update their own profile (e.g. avatar_url via AvatarPickerModal)
CREATE POLICY "Students can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Teachers can read all profiles (dashboard, student lists, feedback joins)
CREATE POLICY "Teachers can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'teacher'
    )
  );

-- Teachers can update profiles (e.g. via server actions with service role,
-- but also for direct browser-client operations)
CREATE POLICY "Teachers can update all profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'teacher'
    )
  );

-- Any authenticated user can insert their own profile row (triggered by auth signup)
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- 2. STUDENT_PROFILES — student & teacher policies
-- ============================================================

-- Clean slate
DROP POLICY IF EXISTS "Students can view own student_profile" ON public.student_profiles;
DROP POLICY IF EXISTS "Students can insert own student_profile" ON public.student_profiles;
DROP POLICY IF EXISTS "Students can update own student_profile" ON public.student_profiles;
DROP POLICY IF EXISTS "Teachers can view all student_profiles" ON public.student_profiles;
DROP POLICY IF EXISTS "Teachers can update all student_profiles" ON public.student_profiles;
DROP POLICY IF EXISTS "Teachers can insert student_profiles" ON public.student_profiles;

-- Ensure RLS is enabled (idempotent)
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;

-- Students can read their own student_profile
CREATE POLICY "Students can view own student_profile" ON public.student_profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- Students can insert their own student_profile (first-time auto-creation in StudentProfileContext)
CREATE POLICY "Students can insert own student_profile" ON public.student_profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- Students can update their own student_profile (XP, level, petals, flowers, garden, etc.)
CREATE POLICY "Students can update own student_profile" ON public.student_profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Teachers can read all student_profiles (student detail page, class lists)
CREATE POLICY "Teachers can view all student_profiles" ON public.student_profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'teacher'
    )
  );

-- Teachers can update all student_profiles (class assignment, settings, password reset)
CREATE POLICY "Teachers can update all student_profiles" ON public.student_profiles
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'teacher'
    )
  );

-- Teachers can insert student_profiles (student creation via server actions)
CREATE POLICY "Teachers can insert student_profiles" ON public.student_profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'teacher'
    )
  );

-- ============================================================
-- 3. SUBJECTS — add missing student SELECT policy
-- ============================================================

DROP POLICY IF EXISTS "Students can view all subjects" ON public.subjects;

-- Students need to read subjects for subject pages, schedule cards, task cards
CREATE POLICY "Students can view all subjects" ON public.subjects
  FOR SELECT TO authenticated
  USING (true);
