-- Fix: Prevent duplicate class creation when assigning students to classes.
-- Root cause: The original function used exact name + grade_id match; classes
-- created by save-weekly-plan (with grade_id = NULL) were never matched,
-- causing a new row to be inserted.
--
-- Changes:
--   1. Case-insensitive grade lookup (LOWER)
--   2. Case-insensitive class lookup with grade_id fallback
--   3. Auto-heal: backfill NULL grade_id on existing classes

CREATE OR REPLACE FUNCTION public.link_student_to_class_structure(
  p_student_id uuid,
  p_class_name text,
  p_grade_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grade_id uuid;
  v_class_id uuid;
BEGIN
  -- 1. Håndter TRINN (Grade) — case-insensitive lookup
  SELECT id INTO v_grade_id
    FROM public.grades
   WHERE LOWER(name) = LOWER(p_grade_name)
   LIMIT 1;

  IF v_grade_id IS NULL THEN
    INSERT INTO public.grades (name) VALUES (p_grade_name)
    RETURNING id INTO v_grade_id;
  END IF;

  -- 2. Håndter KLASSE (Class) — two-pass lookup
  --    Pass A: exact grade match (case-insensitive name)
  SELECT id INTO v_class_id
    FROM public.classes
   WHERE LOWER(name) = LOWER(p_class_name)
     AND grade_id = v_grade_id
   LIMIT 1;

  --    Pass B: fallback — any grade (including NULL)
  IF v_class_id IS NULL THEN
    SELECT id INTO v_class_id
      FROM public.classes
     WHERE LOWER(name) = LOWER(p_class_name)
     LIMIT 1;

    -- Auto-heal: if found with NULL or wrong grade_id, update it
    IF v_class_id IS NOT NULL THEN
      UPDATE public.classes
         SET grade_id = v_grade_id
       WHERE id = v_class_id
         AND (grade_id IS NULL OR grade_id IS DISTINCT FROM v_grade_id);
    END IF;
  END IF;

  --    Pass C: create only when truly not found
  IF v_class_id IS NULL THEN
    INSERT INTO public.classes (name, grade_id, is_queue_open)
    VALUES (p_class_name, v_grade_id, false)
    RETURNING id INTO v_class_id;
  END IF;

  -- 3. Koble eleven til klassen
  UPDATE public.student_profiles
     SET class_id = v_class_id,
         level = CAST(SUBSTRING(p_grade_name FROM '^[0-9]+') AS INTEGER)
   WHERE id = p_student_id;
END;
$$;
