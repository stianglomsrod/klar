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
  task_id uuid,
  student_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  student_comment text,
  student_audio_url text,
  quiz_responses jsonb,
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
  specific_student_id uuid,
  emoji text DEFAULT '🎁'::text,
  CONSTRAINT rewards_pkey PRIMARY KEY (id),
  CONSTRAINT rewards_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT rewards_specific_student_id_fkey FOREIGN KEY (specific_student_id) REFERENCES public.profiles(id)
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
  CONSTRAINT tasks_pkey PRIMARY KEY (id),
  CONSTRAINT tasks_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.profiles(id),
  CONSTRAINT tasks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id),
  CONSTRAINT tasks_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id)
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