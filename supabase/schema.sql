-- schema.sql
-- Master-definisjon for AI-agenten.
-- Oppdatert: Bruker nå KUN 'classes' for struktur. Trinn utledes av klassenavn (eks: "5A" -> 5. trinn).

-- --------------------------------------------------------
-- 0. ENUMS (Antas eksisterende i basen)
-- --------------------------------------------------------
-- user_role: 'student', 'teacher', 'admin'
-- task_type: 'standard', 'quiz', etc.
-- reward_cost_type: 'flowers', 'petals', 'points'
-- schedule_type: 'lesson', etc.

-- --------------------------------------------------------
-- 1. ORGANISASJON
-- --------------------------------------------------------

-- Klasser er nå hovedenheten.
-- Agenten skal hente alle klasser og gruppere dem basert på første siffer i 'name'.
CREATE TABLE public.classes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL, -- Eks: "5A", "10B", "3C"
  created_at timestamp with time zone DEFAULT now()
  -- grade_id er fjernet fra definisjonen da logikken er flyttet til frontend
);

-- (Tabellen 'grades' er fjernet fra skjemaet da den ikke lenger brukes til navigasjon)

-- --------------------------------------------------------
-- 2. BRUKERE / PROFILER
-- --------------------------------------------------------

CREATE TABLE public.profiles (
  id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id),
  created_at timestamp with time zone DEFAULT now(),
  full_name text,
  role USER-DEFINED DEFAULT 'student'::user_role,
  
  -- Skoletilknytning
  class_id uuid REFERENCES public.classes(id), -- Kobler eleven til en klasse
  class_name text, -- (Fallback/Legacy)
  
  -- Gamification Data
  avatar_url text,
  current_avatar text DEFAULT '⚽'::text,
  level integer DEFAULT 1,
  points_earned integer DEFAULT 0,
  current_goal_total integer DEFAULT 1000,
  highest_level_reached integer DEFAULT 1,
  
  -- Blomster-logikk
  flowers_collected integer DEFAULT 0,
  petals_progress integer DEFAULT 0,
  points_per_petal integer DEFAULT 50,
  petal_colors ARRAY DEFAULT ARRAY['#FFC0CB'::text, '#FFC0CB'::text, '#FFC0CB'::text, '#FFC0CB'::text, '#FFC0CB'::text],
  show_flower_garden boolean DEFAULT true,
  
  custom_welcome_message text
);

-- --------------------------------------------------------
-- 3. OPPGAVER & FAG
-- --------------------------------------------------------

CREATE TABLE public.subjects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  emoji text DEFAULT '📚'::text,
  color_theme text DEFAULT 'blue'::text,
  created_by uuid REFERENCES public.profiles(id)
);

CREATE TABLE public.tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamp with time zone DEFAULT now(),
  title text NOT NULL,
  description text,
  student_id uuid NOT NULL REFERENCES public.profiles(id),
  created_by uuid REFERENCES public.profiles(id),
  subject_id uuid REFERENCES public.subjects(id),
  
  -- Status & Type
  is_completed boolean DEFAULT false,
  due_date timestamp with time zone,
  type USER-DEFINED DEFAULT 'standard'::task_type,
  
  -- Innhold
  audio_support_url text,
  quiz_content jsonb,
  estimated_duration integer,
  points_value integer DEFAULT 10
);

CREATE TABLE public.feedback (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid REFERENCES public.tasks(id),
  student_id uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone DEFAULT now(),
  
  student_comment text,
  student_audio_url text,
  quiz_responses jsonb
);

-- --------------------------------------------------------
-- 4. BELØNNINGER (REWARDS)
-- --------------------------------------------------------

CREATE TABLE public.rewards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  created_by uuid REFERENCES public.profiles(id),
  
  -- Prismodell
  cost_value integer DEFAULT 1,
  cost_type USER-DEFINED DEFAULT 'flowers'::reward_cost_type 
);

CREATE TABLE public.student_rewards (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid REFERENCES public.profiles(id),
  reward_id uuid REFERENCES public.rewards(id),
  is