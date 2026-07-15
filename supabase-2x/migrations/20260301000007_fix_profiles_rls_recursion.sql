-- Hotfix: Fix infinite recursion in profiles RLS policies
--
-- The previous migration (20260301000006) created teacher SELECT/UPDATE policies
-- on `public.profiles` that referenced `public.profiles` itself:
--
--   USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'teacher'))
--
-- This causes infinite recursion: evaluating the policy triggers another SELECT on
-- profiles, which evaluates the same policy again, ad infinitum. PostgreSQL detects
-- this and returns a 500 error ("infinite recursion detected in policy for relation").
--
-- Fix: Create a SECURITY DEFINER helper function `is_teacher()` that bypasses RLS
-- when checking the teacher role, then replace the recursive policies.

-- ============================================================
-- 1. Helper function (bypasses profiles RLS via SECURITY DEFINER)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'teacher'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_teacher() TO authenticated;

-- ============================================================
-- 2. Drop the recursive policies on profiles
-- ============================================================

DROP POLICY IF EXISTS "Teachers can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Teachers can update all profiles" ON public.profiles;

-- ============================================================
-- 3. Recreate with is_teacher() — no self-referential recursion
-- ============================================================

CREATE POLICY "Teachers can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_teacher());

CREATE POLICY "Teachers can update all profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_teacher());
