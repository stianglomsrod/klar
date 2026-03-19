-- Migration: 20260319100000_substitute_rls.sql
-- Phase 4 Chunk 2: Comprehensive RLS hardening for substitute teacher system
--
-- This migration:
--   1. Updates existing policies on 6 tables to be substitute-aware
--   2. Enables RLS and adds policies on 6 new tables
--
-- DESIGN PRINCIPLES:
--   - Full teachers retain identical access to pre-RLS state (unrestricted)
--   - Students retain identical access to their own data
--   - Substitutes get scoped SELECT via can_access_student() / can_access_class()
--   - Substitutes cannot write to most tables (chunk 4 may add scoped writes)
--   - PERMISSIVE policies (default) combine with OR logic
--
-- HELPER FUNCTIONS (created in 20260319000000_substitute_schema.sql):
--   is_full_teacher()         — teacher with is_substitute=false
--   is_substitute()           — teacher with is_substitute=true
--   can_access_student(uuid)  — full teachers: true; subs: scoped by assignments
--   can_access_class(uuid)    — full teachers: true; subs: scoped by assignments

BEGIN;

-- ============================================================
-- PART 1: UPDATE EXISTING POLICIES (tables with RLS already)
-- ============================================================

-- ──── profiles ────────────────────────────────────────────
-- Replace broad is_teacher()/role='teacher' with substitute-aware checks.
-- Student policies (own data via auth.uid()=id) remain unchanged.

DROP POLICY IF EXISTS "Teachers can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Teachers can update all profiles" ON public.profiles;

CREATE POLICY "Full teachers can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_full_teacher());

CREATE POLICY "Substitutes can view assigned profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_substitute() AND public.can_access_student(id));

CREATE POLICY "Full teachers can update all profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_full_teacher());


-- ──── student_profiles ───────────────────────────────────
-- Replace broad role='teacher' with can_access_student() for view/update.
-- Student policies (own data via auth.uid()=id) remain unchanged.

DROP POLICY IF EXISTS "Teachers can view all student_profiles" ON public.student_profiles;
DROP POLICY IF EXISTS "Teachers can update all student_profiles" ON public.student_profiles;
DROP POLICY IF EXISTS "Teachers can insert student_profiles" ON public.student_profiles;

-- can_access_student(id) returns true for full teachers, scoped for subs
CREATE POLICY "Teachers can view student_profiles" ON public.student_profiles
  FOR SELECT TO authenticated
  USING (public.can_access_student(id));

CREATE POLICY "Teachers can update student_profiles" ON public.student_profiles
  FOR UPDATE TO authenticated
  USING (public.can_access_student(id));

CREATE POLICY "Full teachers can insert student_profiles" ON public.student_profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_full_teacher());


-- ──── classes ────────────────────────────────────────────
-- Replace broad role='teacher' checks.
-- Subs can only view assigned classes; full teachers retain full CRUD.

DROP POLICY IF EXISTS "Teachers can view all classes" ON public.classes;
DROP POLICY IF EXISTS "Teachers can insert classes" ON public.classes;
DROP POLICY IF EXISTS "Teachers can update classes" ON public.classes;
DROP POLICY IF EXISTS "Teachers can delete classes" ON public.classes;

-- can_access_class(id) returns true for full teachers, scoped for subs
CREATE POLICY "Teachers can view classes" ON public.classes
  FOR SELECT TO authenticated
  USING (public.can_access_class(id));

CREATE POLICY "Full teachers can insert classes" ON public.classes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_full_teacher());

CREATE POLICY "Full teachers can update classes" ON public.classes
  FOR UPDATE TO authenticated
  USING (public.is_full_teacher());

CREATE POLICY "Full teachers can delete classes" ON public.classes
  FOR DELETE TO authenticated
  USING (public.is_full_teacher());


-- ──── daily_announcements ────────────────────────────────
-- Replace broad role='teacher' ALL policy with full-teacher-only.
-- "Students can read announcements" (USING true) remains unchanged.

DROP POLICY IF EXISTS "Teachers can manage announcements" ON public.daily_announcements;

CREATE POLICY "Full teachers manage announcements" ON public.daily_announcements
  FOR ALL TO authenticated
  USING (public.is_full_teacher())
  WITH CHECK (public.is_full_teacher());


-- ──── rewards ────────────────────────────────────────────
-- Replace broad role='teacher' with is_full_teacher().
-- Keep created_by scoping on UPDATE/DELETE (existing security pattern).
-- "Students can view their available rewards" remains unchanged.

DROP POLICY IF EXISTS "Teachers can view all rewards" ON public.rewards;
DROP POLICY IF EXISTS "Teachers can insert rewards" ON public.rewards;
DROP POLICY IF EXISTS "Teachers can update rewards they created" ON public.rewards;
DROP POLICY IF EXISTS "Teachers can delete rewards they created" ON public.rewards;

CREATE POLICY "Full teachers can view all rewards" ON public.rewards
  FOR SELECT TO authenticated
  USING (public.is_full_teacher());

CREATE POLICY "Full teachers can insert rewards" ON public.rewards
  FOR INSERT TO authenticated
  WITH CHECK (public.is_full_teacher());

CREATE POLICY "Full teachers can update own rewards" ON public.rewards
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() AND public.is_full_teacher());

CREATE POLICY "Full teachers can delete own rewards" ON public.rewards
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() AND public.is_full_teacher());


-- ──── student_rewards ────────────────────────────────────
-- RLS already enabled (20260102000002) but only has a teacher DELETE policy.
-- Add missing student CRUD + teacher view/write policies.
-- Existing "Teachers can delete student_rewards for their rewards" remains.

DROP POLICY IF EXISTS "Students can view own student rewards" ON public.student_rewards;
DROP POLICY IF EXISTS "Students can insert own student rewards" ON public.student_rewards;
DROP POLICY IF EXISTS "Students can update own student rewards" ON public.student_rewards;
DROP POLICY IF EXISTS "Teachers can view student rewards" ON public.student_rewards;
DROP POLICY IF EXISTS "Full teachers can insert student rewards" ON public.student_rewards;
DROP POLICY IF EXISTS "Full teachers can update student rewards" ON public.student_rewards;

CREATE POLICY "Students can view own student rewards" ON public.student_rewards
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Students can insert own student rewards" ON public.student_rewards
  FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can update own student rewards" ON public.student_rewards
  FOR UPDATE TO authenticated
  USING (student_id = auth.uid());

-- can_access_student covers both full teachers (all) and subs (scoped)
CREATE POLICY "Teachers can view student rewards" ON public.student_rewards
  FOR SELECT TO authenticated
  USING (public.can_access_student(student_id));

CREATE POLICY "Full teachers can insert student rewards" ON public.student_rewards
  FOR INSERT TO authenticated
  WITH CHECK (public.is_full_teacher());

CREATE POLICY "Full teachers can update student rewards" ON public.student_rewards
  FOR UPDATE TO authenticated
  USING (public.is_full_teacher());


-- ============================================================
-- PART 2: ENABLE RLS + ADD POLICIES (tables without RLS)
-- ============================================================

-- ──── tasks ──────────────────────────────────────────────
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Students can update own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Teachers can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Full teachers can insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "Full teachers can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Full teachers can delete tasks" ON public.tasks;

CREATE POLICY "Students can view own tasks" ON public.tasks
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Students can update own tasks" ON public.tasks
  FOR UPDATE TO authenticated
  USING (student_id = auth.uid());

-- can_access_student covers full teachers (all) + subs (assigned students)
CREATE POLICY "Teachers can view tasks" ON public.tasks
  FOR SELECT TO authenticated
  USING (public.can_access_student(student_id));

CREATE POLICY "Full teachers can insert tasks" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (public.is_full_teacher());

CREATE POLICY "Full teachers can update tasks" ON public.tasks
  FOR UPDATE TO authenticated
  USING (public.is_full_teacher());

CREATE POLICY "Full teachers can delete tasks" ON public.tasks
  FOR DELETE TO authenticated
  USING (public.is_full_teacher());


-- ──── feedback ───────────────────────────────────────────
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Students can insert own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Students can update own feedback" ON public.feedback;
DROP POLICY IF EXISTS "Teachers can view feedback" ON public.feedback;
DROP POLICY IF EXISTS "Full teachers can insert feedback" ON public.feedback;
DROP POLICY IF EXISTS "Full teachers can update feedback" ON public.feedback;

CREATE POLICY "Students can view own feedback" ON public.feedback
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Students can insert own feedback" ON public.feedback
  FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can update own feedback" ON public.feedback
  FOR UPDATE TO authenticated
  USING (student_id = auth.uid());

-- can_access_student covers full teachers (all) + subs (assigned students)
CREATE POLICY "Teachers can view feedback" ON public.feedback
  FOR SELECT TO authenticated
  USING (public.can_access_student(student_id));

CREATE POLICY "Full teachers can insert feedback" ON public.feedback
  FOR INSERT TO authenticated
  WITH CHECK (public.is_full_teacher());

CREATE POLICY "Full teachers can update feedback" ON public.feedback
  FOR UPDATE TO authenticated
  USING (public.is_full_teacher());


-- ──── help_requests ──────────────────────────────────────
ALTER TABLE public.help_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view own help requests" ON public.help_requests;
DROP POLICY IF EXISTS "Students can insert help requests" ON public.help_requests;
DROP POLICY IF EXISTS "Students can update own help requests" ON public.help_requests;
DROP POLICY IF EXISTS "Teachers can view help requests" ON public.help_requests;
DROP POLICY IF EXISTS "Full teachers can update help requests" ON public.help_requests;

CREATE POLICY "Students can view own help requests" ON public.help_requests
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Students can insert help requests" ON public.help_requests
  FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can update own help requests" ON public.help_requests
  FOR UPDATE TO authenticated
  USING (student_id = auth.uid());

-- can_access_student covers full teachers (all) + subs (assigned students)
CREATE POLICY "Teachers can view help requests" ON public.help_requests
  FOR SELECT TO authenticated
  USING (public.can_access_student(student_id));

CREATE POLICY "Full teachers can update help requests" ON public.help_requests
  FOR UPDATE TO authenticated
  USING (public.is_full_teacher());


-- ──── schedule_entries ───────────────────────────────────
ALTER TABLE public.schedule_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view own schedule" ON public.schedule_entries;
DROP POLICY IF EXISTS "Teachers can view schedule entries" ON public.schedule_entries;
DROP POLICY IF EXISTS "Full teachers can insert schedule entries" ON public.schedule_entries;
DROP POLICY IF EXISTS "Full teachers can update schedule entries" ON public.schedule_entries;
DROP POLICY IF EXISTS "Full teachers can delete schedule entries" ON public.schedule_entries;

-- Students see entries for their class or directly for them
CREATE POLICY "Students can view own schedule" ON public.schedule_entries
  FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR class_id IN (
      SELECT sp.class_id FROM public.student_profiles sp
      WHERE sp.id = auth.uid()
    )
  );

-- can_access_class/can_access_student cover full teachers + subs
CREATE POLICY "Teachers can view schedule entries" ON public.schedule_entries
  FOR SELECT TO authenticated
  USING (
    (class_id IS NOT NULL AND public.can_access_class(class_id))
    OR (student_id IS NOT NULL AND public.can_access_student(student_id))
  );

CREATE POLICY "Full teachers can insert schedule entries" ON public.schedule_entries
  FOR INSERT TO authenticated
  WITH CHECK (public.is_full_teacher());

CREATE POLICY "Full teachers can update schedule entries" ON public.schedule_entries
  FOR UPDATE TO authenticated
  USING (public.is_full_teacher());

CREATE POLICY "Full teachers can delete schedule entries" ON public.schedule_entries
  FOR DELETE TO authenticated
  USING (public.is_full_teacher());


-- ──── task_schedule_entries ──────────────────────────────
ALTER TABLE public.task_schedule_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students can view own task schedule entries" ON public.task_schedule_entries;
DROP POLICY IF EXISTS "Teachers can view task schedule entries" ON public.task_schedule_entries;
DROP POLICY IF EXISTS "Full teachers can insert task schedule entries" ON public.task_schedule_entries;
DROP POLICY IF EXISTS "Full teachers can delete task schedule entries" ON public.task_schedule_entries;

-- Students see entries linked to their own tasks
CREATE POLICY "Students can view own task schedule entries" ON public.task_schedule_entries
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_schedule_entries.task_id
      AND t.student_id = auth.uid()
    )
  );

-- Teachers/subs see entries linked to accessible students' tasks
CREATE POLICY "Teachers can view task schedule entries" ON public.task_schedule_entries
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_schedule_entries.task_id
      AND public.can_access_student(t.student_id)
    )
  );

CREATE POLICY "Full teachers can insert task schedule entries" ON public.task_schedule_entries
  FOR INSERT TO authenticated
  WITH CHECK (public.is_full_teacher());

CREATE POLICY "Full teachers can delete task schedule entries" ON public.task_schedule_entries
  FOR DELETE TO authenticated
  USING (public.is_full_teacher());


-- ──── weekly_updates ─────────────────────────────────────
ALTER TABLE public.weekly_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read weekly updates" ON public.weekly_updates;
DROP POLICY IF EXISTS "Full teachers can insert weekly updates" ON public.weekly_updates;
DROP POLICY IF EXISTS "Full teachers can update weekly updates" ON public.weekly_updates;
DROP POLICY IF EXISTS "Full teachers can delete weekly updates" ON public.weekly_updates;

-- All authenticated users can read weekly updates
CREATE POLICY "Anyone can read weekly updates" ON public.weekly_updates
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Full teachers can insert weekly updates" ON public.weekly_updates
  FOR INSERT TO authenticated
  WITH CHECK (public.is_full_teacher());

CREATE POLICY "Full teachers can update weekly updates" ON public.weekly_updates
  FOR UPDATE TO authenticated
  USING (public.is_full_teacher());

CREATE POLICY "Full teachers can delete weekly updates" ON public.weekly_updates
  FOR DELETE TO authenticated
  USING (public.is_full_teacher());

COMMIT;
