-- ========================================
-- KLAR LÆRING - DATABASE SCHEMA
-- Updated: Current production schema from Supabase
-- WARNING: This schema is for context only and is not meant to be run.
-- ========================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUM TYPES
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
CREATE TABLE public.profiles (
  id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  role public.user_role DEFAULT 'student'::public.user_role,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now()
);

-- Student Profiles (Utvidelse: Kun data for elever)
CREATE TABLE public.student_profiles (
  id uuid NOT NULL PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id),
  level integer DEFAULT 1,
  points_earned integer DEFAULT 0,
  current_goal_total integer DEFAULT 1000,
  current_xp integer DEFAULT 0,
  flowers_collected integer DEFAULT 0,
  petals_progress integer DEFAULT 0,
  petal_colors text[] DEFAULT ARRAY['#E0E0E0', '#E0E0E0', '#E0E0E0', '#E0E0E0', '#E0E0E0'],
  show_flower_garden boolean DEFAULT true,
  custom_welcome_message text
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
  quiz_content jsonb,
  quiz_data jsonb
);

-- Feedback (Tilbakemeldinger på oppgaver)
CREATE TABLE public.feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid REFERENCES public.tasks(id),
  student_id uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone DEFAULT now(),
  student_comment text,
  student_audio_url text,
  quiz_responses jsonb
);

-- Rewards (Belønninger læreren oppretter)
CREATE TABLE public.rewards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  created_by uuid REFERENCES public.profiles(id),
  cost_value integer DEFAULT 1,
  cost_type public.reward_cost_type DEFAULT 'flowers'::public.reward_cost_type,
  created_at timestamp with time zone DEFAULT now(),
  specific_student_id uuid REFERENCES public.profiles(id),
  emoji text DEFAULT '🎁'
);

-- Student Rewards (Transaksjoner: Belønninger eleven har "kjøpt"/fått)
CREATE TABLE public.student_rewards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid REFERENCES public.profiles(id),
  reward_id uuid REFERENCES public.rewards(id),
  is_redeemed boolean DEFAULT false,
  date_earned timestamp with time zone DEFAULT now()
);

-- Student Teacher Settings (Innstillinger per elev per lærer)
CREATE TABLE public.student_teacher_settings (
  student_id uuid NOT NULL REFERENCES public.profiles(id),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id),
  push_enabled boolean DEFAULT false,
  CONSTRAINT student_teacher_settings_pkey PRIMARY KEY (student_id, teacher_id)
);

-- Push Subscriptions (Varslinger)
CREATE TABLE public.push_subscriptions (
  user_id uuid NOT NULL REFERENCES auth.users(id),
  subscription_data jsonb NOT NULL,
  device_type text NOT NULL,
  CONSTRAINT push_subscriptions_pkey PRIMARY KEY (user_id, device_type)
);

-- Schedule (Tidsplan)
CREATE TABLE public.schedule (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  type public.schedule_type DEFAULT 'lesson'::public.schedule_type,
  days text[] NOT NULL,
  target_group text DEFAULT 'all'
);

-- Weekly Updates (Ukentlige oppdateringer)
CREATE TABLE public.weekly_updates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT now(),
  week_number integer,
  content_text text,
  audio_url text,
  created_by uuid REFERENCES public.profiles(id)