-- --------------------------------------------------------
-- KLAR LÆRING - DATABASE SCHEMA
-- This file represents the current structure of the database.
-- --------------------------------------------------------

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUM TYPES (Definisjoner av faste valg)
-- Basert på standardverdier og tidligere kontekst
CREATE TYPE public.user_role AS ENUM ('teacher', 'student');
CREATE TYPE public.task_type AS ENUM ('standard', 'quiz');
CREATE TYPE public.reward_cost_type AS ENUM ('flowers', 'petals', 'points', 'level');
CREATE TYPE public.schedule_type AS ENUM ('lesson', 'break', 'activity');

-- 3. TABLES

-- Grades (Trinn/Klassetrinn)
CREATE TABLE public.grades (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Classes (Klasser, f.eks. "5A")
CREATE TABLE public.classes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  grade_id uuid REFERENCES public.grades(id),
  created_at timestamp with time zone DEFAULT now()
);

-- Profiles (Hovedtabell for brukere: Lærere og Elever)
-- Koblet direkte til auth.users
CREATE TABLE public.profiles (
  id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name text,
  role public.user_role DEFAULT 'student'::public.user_role,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now()
);

-- Student Profiles (Utvidelse: Kun data for elever)
-- Inneholder gamification, fremgang og klasse-tilhørighet
CREATE TABLE public.student_profiles (
  id uuid NOT NULL,
  class_id uuid,
  level integer DEFAULT 1,
  points_earned integer DEFAULT 0,
  current_goal_total integer DEFAULT 100, -- Poeng sum man må nå for neste level
  current_xp integer DEFAULT 0,          -- Nåværende poeng mot neste level
  
  -- Blomsterhage-logikk
  flowers_collected integer DEFAULT 0,   -- Antall hele blomster ferdigstilt
  petals_progress integer DEFAULT 0,     -- Hvor mange blader på NÅVÆRENDE blomst (0-5)
  petal_colors text[] DEFAULT ARRAY['#FFC0CB', '#FFC0CB', '#FFC0CB', '#FFC0CB', '#FFC0CB'], -- Fargene valgt for de 5 bladene
  show_flower_garden boolean DEFAULT true, -- Om læreren tillater dette spillet
  
  custom_welcome_message text,
  
  CONSTRAINT student_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT student_profiles_id_fkey FOREIGN KEY (id) REFERENCES public.profiles(id),
  CONSTRAINT student_profiles_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id)
);

-- Subjects (Fag)
CREATE TABLE public.subjects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  emoji text DEFAULT '📚',
  color_theme text DEFAULT 'blue',
  date date DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES public.profiles(id)
);

-- Tasks (Oppgaver)
CREATE TABLE public.tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT now(),
  title text NOT NULL,
  description text,
  student_id uuid NOT NULL REFERENCES public.profiles(id),
  created_by uuid REFERENCES public.profiles(id),
  subject_id uuid REFERENCES public.subjects(id),
  is_completed boolean DEFAULT false,
  due_date timestamp with time zone,
  type public.task_type DEFAULT 'standard'::public.task_type,
  estimated_duration integer,
  points_value integer DEFAULT 10,
  audio_support_url text,
  quiz_content jsonb, -- Innholdet i quizen (spørsmål)
  quiz_data jsonb     -- Metadata eller instillinger
);

-- Feedback (Tilbakemeldinger på oppgaver)
CREATE TABLE public.feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid REFERENCES public.tasks(id),
  student_id uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone DEFAULT now(),
  student_comment text,
  student_audio_url text,
  quiz_responses jsonb -- Svarene eleven ga
);

-- Rewards (Belønninger læreren oppretter)
CREATE TABLE public.rewards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  created_by uuid REFERENCES public.profiles(id),
  cost_value integer DEFAULT 1,
  cost_type public.reward_cost_type DEFAULT 'flowers'::public.reward_cost_type
);

-- Student Rewards (Koblingstabell: Belønninger eleven har kjøpt/fått)
CREATE TABLE public.student_rewards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid REFERENCES public.profiles(id),
  reward_id uuid REFERENCES public.rewards(id),
  is_redeemed boolean DEFAULT false,
  date_earned timestamp with time zone DEFAULT now()
);

-- Schedule (Timeplan)
CREATE TABLE public.schedule (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  type public.schedule_type DEFAULT 'lesson'::public.schedule_type,
  days text[] NOT NULL, -- Array av dager, f.eks. ['Monday', 'Wednesday']
  target_group text DEFAULT 'all'
);

-- Weekly Updates (Ukebrev)
CREATE TABLE public.weekly_updates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT now(),
  week_number integer,
  content_text text,
  audio_url text,
  created_by uuid REFERENCES public.profiles(id)
);

-- Student Teacher Settings (Kobling lærere/elever, f.eks. for push)
CREATE TABLE public.student_teacher_settings (
  student_id uuid NOT NULL REFERENCES public.profiles(id),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id),
  push_enabled boolean DEFAULT false,
  CONSTRAINT student_teacher_settings_pkey PRIMARY KEY (student_id, teacher_id)
);

-- Push Subscriptions (For nettleser-varsler)
CREATE TABLE public.push_subscriptions (
  user_id uuid NOT NULL REFERENCES auth.users(id),
  device_type text NOT NULL,
  subscription_data jsonb NOT NULL,
  CONSTRAINT push_subscriptions_pkey PRIMARY KEY (user_id, device_type)
);