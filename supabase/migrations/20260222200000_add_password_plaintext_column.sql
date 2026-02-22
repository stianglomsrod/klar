-- Migration: Add current_password_plaintext to student_profiles
-- Purpose: Allow teachers to view/reset simple student passwords for young learners (ages 6-12).
-- Tech Debt: Documented in TECH_DEBT.md entry #2.

-- 1. Add column (idempotent)
ALTER TABLE public.student_profiles
  ADD COLUMN IF NOT EXISTS current_password_plaintext text;

-- 2. Backfill existing students with default test password
UPDATE public.student_profiles
  SET current_password_plaintext = '1234'
  WHERE current_password_plaintext IS NULL;
