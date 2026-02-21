-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUM TYPES
CREATE TYPE public.user_role AS ENUM ('teacher', 'student');
CREATE TYPE public.task_type AS ENUM ('standard', 'quiz');
CREATE TYPE public.reward_cost_type AS ENUM ('flowers', 'petals', 'points', 'level');
CREATE TYPE public.schedule_type AS ENUM ('lesson', 'break', 'activity');

-- 3. TABLES

CREATE TABLE public.classes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  grade_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  is_queue_open boolean DEFAULT false,
  CONSTRAINT classes_pkey PRIMARY KEY (id),
  CONSTRAINT classes_grade_id_fkey FOREIGN KEY (grade_id) REFERENCES public.grades(id)
);

CREATE TABLE public.feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  task_id uuid UNIQUE,
  student_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  student_comment text,
  student_audio_url text,
  quiz_responses jsonb,
  teacher_reaction text,
  teacher_comment text,
  student_image_url text,
  CONSTRAINT feedback_pkey PRIMARY KEY (id),
  CONSTRAINT feedback_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id),
  CONSTRAINT feedback_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id)
);

CREATE TABLE public.grades (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT grades_pkey PRIMARY KEY (id)
);

CREATE TABLE public.help_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  class_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'in_progress'::text, 'resolved'::text, 'cancelled'::text])),
  created_at timestamp with time zone DEFAULT now(),
  resolved_at timestamp with time zone,
  CONSTRAINT help_requests_pkey PRIMARY KEY (id),
  CONSTRAINT help_requests_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id),
  CONSTRAINT help_requests_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id)
);

CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name text,
  role USER-DEFINED DEFAULT 'student'::user_role,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);

CREATE TABLE public.push_subscriptions (
  user_id uuid NOT NULL,
  subscription_data jsonb NOT NULL,
  device_type text NOT NULL,
  CONSTRAINT push_subscriptions_pkey PRIMARY KEY (user_id, device_type),
  CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.rewards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  created_by uuid,
  cost_value integer DEFAULT 1,
  cost_type USER-DEFINED DEFAULT 'flowers'::reward_cost_type,
  created_at timestamp with time zone DEFAULT now(),
  emoji text DEFAULT '🎁'::text,
  specific_student_ids ARRAY DEFAULT '{}'::uuid[],
  CONSTRAINT rewards_pkey PRIMARY KEY (id),
  CONSTRAINT rewards_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);

CREATE TABLE public.schedule_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  class_id uuid,
  student_id uuid,
  subject_id uuid,
  day_of_week integer NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 7),
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  type USER-DEFINED DEFAULT 'lesson'::schedule_type,
  custom_title text,
  week_number integer DEFAULT 0,
  CONSTRAINT schedule_entries_pkey PRIMARY KEY (id),
  CONSTRAINT schedule_entries_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id),
  CONSTRAINT schedule_entries_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id),
  CONSTRAINT schedule_entries_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id)
);

CREATE TABLE public.student_profiles (
  id uuid NOT NULL,
  class_id uuid,
  level integer DEFAULT 1,
  points_earned integer DEFAULT 0,
  current_goal_total integer DEFAULT 1000,
  current_xp integer DEFAULT 0,
  flowers_collected integer DEFAULT 0,
  petals_progress integer DEFAULT 0,
  petal_colors ARRAY DEFAULT ARRAY['#E0E0E0'::text, '#E0E0E0'::text, '#E0E0E0'::text, '#E0E0E0'::text, '#E0E0E0'::text],
  show_flower_garden boolean DEFAULT true,
  custom_welcome_message text,
  max_level_reached integer NOT NULL DEFAULT 1,
  CONSTRAINT student_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT student_profiles_id_fkey FOREIGN KEY (id) REFERENCES public.profiles(id),
  CONSTRAINT student_profiles_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id)
);

CREATE TABLE public.student_rewards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  student_id uuid,
  reward_id uuid,
  is_redeemed boolean DEFAULT false,
  date_earned timestamp with time zone DEFAULT now(),
  earned_at_level integer NOT NULL DEFAULT 1,
  CONSTRAINT student_rewards_pkey PRIMARY KEY (id),
  CONSTRAINT student_rewards_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id),
  CONSTRAINT student_rewards_reward_id_fkey FOREIGN KEY (reward_id) REFERENCES public.rewards(id)
);

CREATE TABLE public.student_teacher_settings (
  student_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  push_enabled boolean DEFAULT false,
  CONSTRAINT student_teacher_settings_pkey PRIMARY KEY (student_id, teacher_id),
  CONSTRAINT student_teacher_settings_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id),
  CONSTRAINT student_teacher_settings_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.profiles(id)
);

CREATE TABLE public.subjects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL UNIQUE,
  emoji text DEFAULT '📚'::text,
  color_theme text DEFAULT 'blue'::text,
  date date DEFAULT CURRENT_DATE,
  created_by uuid,
  CONSTRAINT subjects_pkey PRIMARY KEY (id),
  CONSTRAINT subjects_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);
-- Daily announcements for targeted messages
CREATE TABLE IF NOT EXISTS public.daily_announcements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  content text NOT NULL,
  display_date date NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('student', 'class', 'grade')),
  target_id uuid NOT NULL,
  message_type text DEFAULT 'welcome'::text CHECK (message_type IN ('welcome', 'note')),
  CONSTRAINT daily_announcements_unique_target_date UNIQUE (display_date, target_type, target_id)
);

-- RLS for daily_announcements
ALTER TABLE public.daily_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can manage announcements" ON public.daily_announcements
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher')
  );

CREATE POLICY "Students can read announcements" ON public.daily_announcements
  FOR SELECT
  USING (true);

-- Function to fetch a student's announcement for the current date
CREATE OR REPLACE FUNCTION public.get_student_daily_announcement(p_student_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class_id uuid;
  v_grade_id uuid;
  v_message text;
BEGIN
  SELECT sp.class_id, c.grade_id
    INTO v_class_id, v_grade_id
    FROM public.student_profiles sp
    LEFT JOIN public.classes c ON sp.class_id = c.id
    WHERE sp.id = p_student_id;

  SELECT content INTO v_message
    FROM public.daily_announcements
    WHERE display_date = CURRENT_DATE
      AND target_type = 'student'
      AND target_id = p_student_id
    LIMIT 1;

  IF v_message IS NOT NULL THEN RETURN v_message; END IF;

  IF v_class_id IS NOT NULL THEN
    SELECT content INTO v_message
      FROM public.daily_announcements
      WHERE display_date = CURRENT_DATE
        AND target_type = 'class'
        AND target_id = v_class_id
      LIMIT 1;

    IF v_message IS NOT NULL THEN RETURN v_message; END IF;
  END IF;

  IF v_grade_id IS NOT NULL THEN
    SELECT content INTO v_message
      FROM public.daily_announcements
      WHERE display_date = CURRENT_DATE
        AND target_type = 'grade'
        AND target_id = v_grade_id
      LIMIT 1;

    IF v_message IS NOT NULL THEN RETURN v_message; END IF;
  END IF;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_student_daily_announcement(uuid) TO authenticated, service_role;

-- Function to link a student to a class structure (creates grade/class if needed)
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
  -- 1. Håndter TRINN (Grade)
  -- Prøv å finne trinnet først
  SELECT id INTO v_grade_id FROM public.grades WHERE name = p_grade_name LIMIT 1;
  
  -- Hvis trinnet ikke finnes, opprett det
  IF v_grade_id IS NULL THEN
    INSERT INTO public.grades (name) VALUES (p_grade_name)
    RETURNING id INTO v_grade_id;
  END IF;

  -- 2. Håndter KLASSE (Class)
  -- Prøv å finne klassen (koblet til riktig trinn)
  SELECT id INTO v_class_id FROM public.classes 
  WHERE name = p_class_name AND grade_id = v_grade_id LIMIT 1;

  -- Hvis klassen ikke finnes, opprett den
  IF v_class_id IS NULL THEN
    INSERT INTO public.classes (name, grade_id, is_queue_open) 
    VALUES (p_class_name, v_grade_id, false)
    RETURNING id INTO v_class_id;
  END IF;

  -- 3. Oppdater ELEVEN (student_profiles)
  -- Nå som vi garantert har en class_id, kobler vi eleven til den
  UPDATE public.student_profiles
  SET class_id = v_class_id,
      level = CAST(SUBSTRING(p_grade_name FROM '^[0-9]+') AS INTEGER)
  WHERE id = p_student_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_student_to_class_structure(uuid, text, text) TO authenticated, service_role;

CREATE TABLE public.task_library (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid,
  title text NOT NULL,
  description text,
  subject_id uuid,
  grade_level text,
  type text DEFAULT 'standard'::text CHECK (type = ANY (ARRAY['standard'::text, 'quiz'::text])),
  quiz_data jsonb,
  audio_url text,
  usage_count integer DEFAULT 0,
  CONSTRAINT task_library_pkey PRIMARY KEY (id),
  CONSTRAINT task_library_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT task_library_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id)
);

-- RLS for task_library
ALTER TABLE public.task_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can view all task library items" ON public.task_library
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher')
  );

CREATE POLICY "Teachers can insert task library items" ON public.task_library
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher')
  );

CREATE POLICY "Teachers can update their task library items" ON public.task_library
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher')
  );

CREATE POLICY "Teachers can delete their task library items" ON public.task_library
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'teacher')
  );

CREATE TABLE public.task_schedule_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  task_id uuid,
  schedule_entry_id uuid,
  CONSTRAINT task_schedule_entries_pkey PRIMARY KEY (id),
  CONSTRAINT task_schedule_entries_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id),
  CONSTRAINT task_schedule_entries_schedule_entry_id_fkey FOREIGN KEY (schedule_entry_id) REFERENCES public.schedule_entries(id)
);

CREATE TABLE public.tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  title text NOT NULL,
  description text,
  student_id uuid NOT NULL,
  created_by uuid,
  is_completed boolean DEFAULT false,
  due_date timestamp with time zone,
  type USER-DEFINED DEFAULT 'standard'::task_type,
  quiz_content jsonb,
  audio_support_url text,
  estimated_duration integer,
  points_value integer DEFAULT 10,
  subject_id uuid,
  quiz_data jsonb,
  task_library_id uuid,
  completed_at timestamp with time zone,
  CONSTRAINT tasks_pkey PRIMARY KEY (id),
  CONSTRAINT tasks_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id),
  CONSTRAINT tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT tasks_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id),
  CONSTRAINT tasks_task_library_id_fkey FOREIGN KEY (task_library_id) REFERENCES public.task_library(id) ON DELETE SET NULL
);

CREATE TABLE public.teacher_active_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  class_id uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT teacher_active_sessions_pkey PRIMARY KEY (id),
  CONSTRAINT teacher_active_sessions_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.profiles(id),
  CONSTRAINT teacher_active_sessions_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id)
);

CREATE TABLE public.weekly_updates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  week_number integer,
  content_text text,
  audio_url text,
  created_by uuid,
  CONSTRAINT weekly_updates_pkey PRIMARY KEY (id),
  CONSTRAINT weekly_updates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id)
);

-- 4. RPC FUNCTIONS

-- Function to get student schedule with task counts
CREATE OR REPLACE FUNCTION get_student_schedule(
  p_student_id UUID,
  p_current_week_number INTEGER
)
RETURNS TABLE (
  id UUID,
  day_of_week INTEGER,
  start_time TEXT,
  end_time TEXT,
  subject_id UUID,
  subject_title TEXT,
  emoji TEXT,
  subject_color TEXT,
  entry_has_tasks BOOLEAN,
  subject_has_tasks BOOLEAN,
  custom_title TEXT,
  week_number INTEGER,
  tasks_total BIGINT,
  tasks_completed BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    se.id,
    se.day_of_week,
    se.start_time::TEXT,
    se.end_time::TEXT,
    se.subject_id,
    COALESCE(s.title, se.custom_title, 'Time') AS subject_title,
    COALESCE(s.emoji, '📚') AS emoji,
    COALESCE(s.color_theme, 'gray') AS subject_color,
    COALESCE(
      EXISTS(
        SELECT 1 FROM task_schedule_entries tse
        JOIN tasks t ON tse.task_id = t.id
        WHERE tse.schedule_entry_id = se.id
        AND t.student_id = p_student_id
      ),
      FALSE
    ) AS entry_has_tasks,
    COALESCE(
      EXISTS(
        SELECT 1 FROM tasks t
        WHERE t.subject_id = se.subject_id
        AND t.student_id = p_student_id
        AND t.is_completed = FALSE
        AND NOT EXISTS (
          SELECT 1 FROM task_schedule_entries tse2 WHERE tse2.task_id = t.id
        )
      ),
      FALSE
    ) AS subject_has_tasks,
    se.custom_title,
    COALESCE(se.week_number, 0) AS week_number,
    (
      SELECT COUNT(*)
      FROM task_schedule_entries tse
      JOIN tasks t ON tse.task_id = t.id
      WHERE tse.schedule_entry_id = se.id
      AND t.student_id = p_student_id
    ) AS tasks_total,
    (
      SELECT COUNT(*)
      FROM task_schedule_entries tse
      JOIN tasks t ON tse.task_id = t.id
      WHERE tse.schedule_entry_id = se.id
      AND t.student_id = p_student_id
      AND t.is_completed = TRUE
    ) AS tasks_completed
  FROM schedule_entries se
  LEFT JOIN subjects s ON se.subject_id = s.id
  WHERE se.type = 'lesson'
  AND (
    se.student_id = p_student_id
    OR se.class_id IN (
      SELECT class_id FROM student_profiles WHERE student_profiles.id = p_student_id
    )
  )
  AND (se.week_number = p_current_week_number OR se.week_number = 0 OR se.week_number IS NULL)
  ORDER BY se.day_of_week, se.start_time;
END;
$$ LANGUAGE plpgsql STABLE;

GRANT EXECUTE ON FUNCTION get_student_schedule(UUID, INTEGER) TO authenticated;