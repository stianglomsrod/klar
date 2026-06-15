# Klar — Komplett funksjonsanalyse av prototypen

> Generert fra kodebasen per 11. april 2026. Dekker alle brukerrettede funksjoner, teknisk arkitektur, gamification-system og uferdige elementer.

---

## Del 1: Teknisk arkitektur

### 1.1 Tech stack

| Komponent        | Teknologi                                                    | Versjon                      |
| ---------------- | ------------------------------------------------------------ | ---------------------------- |
| Rammeverk        | Next.js (App Router)                                         | 16.1.1                       |
| React            | React 19                                                     | 19.2.3                       |
| Backend/Database | Supabase (PostgreSQL + Auth + Storage + Realtime)            | @supabase/supabase-js 2.89.0 |
| Styling          | Tailwind CSS                                                 | 3.4.17                       |
| Animasjoner      | Framer Motion                                                | 12.23.26                     |
| AI/Parsing       | Google Gemini (`gemini-2.5-flash`) via @google/generative-ai | 0.24.1                       |
| Dokumentparsing  | Mammoth (.docx → tekst)                                      | 1.11.0                       |
| Drag & Drop      | @hello-pangea/dnd                                            | 18.0.1                       |
| Tabeller         | @tanstack/react-table                                        | 8.21.3                       |
| Konfetti         | canvas-confetti + react-confetti                             | 1.9.4 / 6.4.0                |
| Ikoner           | lucide-react                                                 | 0.562.0                      |
| Dato-håndtering  | date-fns                                                     | 4.1.0                        |
| Push-varsler     | web-push (VAPID)                                             | 3.6.7                        |
| UI-primitiver    | Radix UI (Popover)                                           | 1.1.15                       |
| Emoji-velger     | emoji-picker-react                                           | 4.16.1                       |
| PWA              | Manuell Service Worker + manifest.json                       | —                            |
| Språk            | TypeScript                                                   | 5.x                          |
| Hosting          | Ikke spesifisert i kodebasen (Next.js-kompatibel)            | —                            |

### 1.2 PWA-konfigurasjon

- **manifest.json**: `name: "Klar"`, `display: "standalone"`, `lang: "nb"`, `theme_color: "#4f46e5"` (indigo)
- **Service Worker** (`public/sw.js`): Registreres via `ServiceWorkerRegistration.tsx` on mount. Håndterer push-notifikasjoner med emoji-reaksjonsknapper og klikk-navigasjon til elevside.
- **Ikoner**: SVG-basert (`/icon.svg`), `purpose: "any maskable"`

### 1.3 Mappestruktur

| Mappe                            | Rolle                                                                                           |
| -------------------------------- | ----------------------------------------------------------------------------------------------- |
| `src/app/(auth)/`                | Innloggingsside og auth-layout                                                                  |
| `src/app/(dashboard)/student/`   | Alle elevsider (dashboard, fag, timeplan, lesson)                                               |
| `src/app/(dashboard)/teacher/`   | Alle lærersider (oversikt, klasser, oppgaver, timeplan, belønninger, meldinger, ukebrev, admin) |
| `src/app/actions/`               | Server Actions (student CRUD, plan-parsing, fagadmin, køadmin)                                  |
| `src/app/api/`                   | API-ruter (push-varsler, seed-data, vikarlenkegenerering)                                       |
| `src/app/belonninger/`           | Belønningssider for elev (hage, kuponger)                                                       |
| `src/app/subject/[id]/`          | Fagspesifikk oppgaveside (delt elevside)                                                        |
| `src/components/ui/`             | Gjenbrukbare UI-primitiver (Button, Switch, Toast, Dialog, etc.)                                |
| `src/components/student/`        | Elevspesifikke komponenter                                                                      |
| `src/components/teacher/`        | Lærerspesifikke komponenter                                                                     |
| `src/components/shared/`         | Delte komponenter (CouponCard m.fl.)                                                            |
| `src/components/level-up/`       | Level-up-flyt (CelebrationStep, ColorPickerStep, BloomStep)                                     |
| `src/components/student-footer/` | Bunnlinje-widgets (XP-bar, streak, blomst-teaser, tidssporing)                                  |
| `src/hooks/`                     | Custom React-hooks (profil, oppgaveflyt, streak, TTS, mediaspørring)                            |
| `src/contexts/`                  | React Context for elev- og lærerprofil                                                          |
| `src/utils/`                     | Hjelpefunksjoner (farger, tid, ukenummer, Supabase-klienter, avatar)                            |
| `src/types/`                     | Delte TypeScript-typer                                                                          |
| `supabase/`                      | Databaseskjema (`schema.sql`) og migrasjoner                                                    |
| `public/`                        | Statiske filer (manifest, service worker, lyder)                                                |

### 1.4 Autentisering og autorisasjon

**Innloggingsflyt:**

1. Brukeren går til `/login` — rendret som gradient-kort (indigo → lilla → rosa) med brukernavn- og passordfelt
2. Brukernavnet utvides automatisk med `@skole.klar.app` (usynlig e-post-hack for unge elever som bare har brukernavn)
3. `supabase.auth.signInWithPassword()` autentiserer
4. Profilrolle hentes fra `profiles`-tabellen → omdirigerer til `/student` eller `/teacher`

**Vikarinnlogging:**

- Admin genererer magic link via `/api/admin/substitute-link`
- OTP-verifisering i `/auth/callback` → omdirigerer basert på rolle

**Middleware (`src/middleware.ts`):**

- Beskytter `/teacher`-ruter og `/api/push/subscribe`, `/api/seed`
- Uautentiserte brukere → `/login`
- Elever som prøver `/teacher` → `/student`
- Elever på teacher-API → HTTP 403

**Row-Level Security (RLS):**

- Aktivert på ALLE tabeller i databasen
- Hjelpefunksjoner: `is_teacher()`, `is_full_teacher()`, `is_substitute()`, `is_admin_teacher()`, `can_access_student(uuid)`, `can_access_class(uuid)`
- Elever: Kun tilgang til egne data (`auth.uid() = id`)
- Lærere (fulle): Full tilgang til alle data
- Vikarer: Begrenset tilgang via `substitute_assignments`-tabellen — kan bare se elever/klasser de er tilordnet

### 1.5 Database-modell

#### Kjernetabeller

**`profiles`** — Alle brukerkontoer
| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | uuid (PK, FK → auth.users) | Unik bruker-ID |
| full_name | text | Fullt navn |
| role | user_role enum | `'teacher'` eller `'student'` |
| avatar_url | text | Emoji eller Dicebear-URL |
| is_substitute | boolean | Vikar-flagg |
| is_admin | boolean | Admin-flagg for lærere |
| created_at | timestamptz | Opprettet |

**`student_profiles`** — Utvidet elevprofil (gamification, innstillinger)
| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | uuid (PK, FK → profiles) | Elev-ID |
| class_id | uuid (FK → classes) | Klasse-tilhørighet |
| level | integer (default 1) | Nåværende nivå |
| current_xp | integer (default 0) | XP innenfor nåværende nivå |
| current_goal_total | integer (default 1000) | XP som trengs per nivå |
| points_earned | integer (default 0) | Totale akkumulerte poeng (livstid) |
| flowers_collected | integer (default 0) | Antall fullførte blomster |
| petals_progress | integer (default 0) | Kronblader fargelagt (0–5) |
| petal_colors | text[] (default 5× #E0E0E0) | Farger per kronblad |
| completed_flower_colors | jsonb (default []) | Arkiv av ferdige blomster (2D-array med farger) |
| show_flower_garden | boolean (default true) | Blomsterhage aktivert |
| garden_positions | jsonb (default {}) | Posisjon for hver blomst i hagen (x, y som %) |
| custom_welcome_message | text | Personlig velkomstmelding fra lærer |
| max_level_reached | integer (default 1) | Høyeste nivå nådd noensinne |
| halfway_celebrated_level | integer (default 0) | Siste nivå halvveisfeiring er vist for |
| pending_reward_levels | integer[] (default []) | Nivåer som venter på premieutvelgelse |
| current_password_plaintext | text | Lesbart passord (for unge elever) |
| streak_enabled | boolean (default false) | Streak-funksjon aktivert |
| streak_mode | text (default 'classic') | `'classic'` (nullstilles) eller `'accumulated'` (kumulativ) |
| current_streak | integer (default 0) | Nåværende streak-telling |
| longest_streak | integer (default 0) | Personlig rekord |
| last_login_date | date | Siste innloggingsdato |
| attendance_reward_progress | jsonb (default {}) | Fremdrift for oppmøtebaserte belønninger |

**`classes`** — Klassegrupper
| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | uuid (PK) | — |
| name | text | F.eks. «5A», «10B» |
| grade_id | uuid (FK → grades) | Trinnkobling |
| is_queue_open | boolean (default false) | Hjelpekø åpen for denne klassen |

**`grades`** — Trinn
| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | uuid (PK) | — |
| name | text | F.eks. «5. Trinn» |

**`student_groups`** — Egendefinerte elevgrupper
| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | uuid (PK) | — |
| name | text | Gruppenavn |
| created_by | uuid (FK → auth.users) | Lærer som opprettet |

**`student_group_members`** — Koblingstabell for grupper
| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| group_id | uuid (FK → student_groups) | — |
| student_id | uuid (FK → profiles) | — |

#### Fag og oppgaver

**`subjects`** — Fagdefinitioner
| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | uuid (PK) | — |
| title | text (UNIQUE) | F.eks. «Matematikk» |
| emoji | text (default '📚') | Emoji for faget |
| color_theme | text (default 'blue') | Tailwind-fargetema |
| created_by | uuid (FK → profiles) | — |

**`tasks`** — Oppgaver tildelt til elever
| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | uuid (PK) | — |
| title | text | Oppgavetittel |
| description | text | Beskrivelse |
| student_id | uuid (FK → profiles) | Tilordnet elev |
| created_by | uuid (FK → profiles) | Lærer som opprettet |
| subject_id | uuid (FK → subjects) | Fag |
| is_completed | boolean (default false) | Fullført? |
| completed_at | timestamptz | Tidspunkt for fullføring |
| type | task_type enum | `'standard'` eller `'quiz'` |
| quiz_data | jsonb | Quiz-spørsmål (hvis quiz) |
| points_value | integer (default 10) | XP-verdi |
| due_date | timestamptz | Frist |
| estimated_duration | integer | Estimert tid i minutter |
| task_library_id | uuid (FK → task_library) | Kobling til mal |
| audio_support_url | text | Lydfil-URL |

**`task_library`** — Gjenbrukbare oppgavemaler
| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | uuid (PK) | — |
| title | text | — |
| description | text | — |
| subject_id | uuid (FK → subjects) | — |
| type | text | `'standard'` eller `'quiz'` |
| quiz_data | jsonb | — |
| grade_level | text | — |
| created_by | uuid (FK → profiles) | — |
| usage_count | integer (default 0) | _Aldri brukt i koden_ |
| audio_url | text | _Aldri brukt i koden_ |

**`task_schedule_entries`** — Kobling mellom oppgave og timeplanavspost
| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| task_id | uuid (FK → tasks) | — |
| schedule_entry_id | uuid (FK → schedule_entries) | — |

#### Timeplan

**`schedule_entries`** — Timeplanposter
| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | uuid (PK) | — |
| class_id | uuid (FK → classes) | Klasse (nullable hvis elev-spesifikk) |
| student_id | uuid (FK → profiles) | Elev (nullable hvis klassebasis) |
| subject_id | uuid (FK → subjects) | — |
| day_of_week | integer (1–7) | Mandag=1, søndag=7 |
| start_time | time | — |
| end_time | time | — |
| type | schedule_type enum | `'lesson'`, `'break'`, `'activity'` |
| custom_title | text | Egendefinert tittel (uten fag) |
| week_number | integer (default 0) | 0 = masterplan, 1–53 = spesifikk uke |

#### Tilbakemelding og kommunikasjon

**`feedback`** — Elevinnleveringer og lærerreaksjoner
| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | uuid (PK) | — |
| task_id | uuid (FK → tasks, UNIQUE) | — |
| student_id | uuid (FK → profiles) | — |
| teacher_id | uuid (FK → profiles) | — |
| student_comment | text | Elevsvar (tekst) |
| student_audio_url | text | Lydopptak-URL |
| student_image_url | text | Bilde-URL |
| quiz_responses | jsonb | Quizsvar (spørsmål-ID → svar) |
| teacher_reaction | text | Emoji-reaksjon (👍🌟💪🎉❤️🔥) |
| teacher_comment | text | Lærerkommentar |
| read_at | timestamptz | Tidspunkt lest av elev |

**`daily_announcements`** — Daglige meldinger
| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | uuid (PK) | — |
| content | text | Meldingsinnhold |
| display_date | date | Visningsdato |
| target_type | text | `'student'`, `'class'`, `'grade'` |
| target_id | uuid | ID for målgruppen |
| created_by | uuid (FK → auth.users) | — |
| message_type | text | `'welcome'` eller `'note'` |

**`weekly_updates`** — Ukentlige læreropplysninger
| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | uuid (PK) | — |
| week_number | integer | — |
| content_text | text | — |
| audio_url | text | — |
| created_by | uuid (FK → profiles) | — |

#### Belønninger

**`rewards`** — Belønningsdefinisjoner
| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | uuid (PK) | — |
| title | text | — |
| description | text | — |
| emoji | text (default '🎁') | — |
| cost_type | reward_cost_type enum | `'flowers'`, `'petals'`, `'points'`, `'level'`, `'attendance'` |
| cost_value | integer (default 1) | Kostnad (nivå, dager, osv.) |
| is_recurring | boolean (default true) | Kan gjentas? |
| max_uses | integer (nullable) | Maks antall ganger (null = ubegrenset) |
| specific_student_ids | uuid[] (default []) | Tom = alle elever; ellers spesifikke IDer |
| created_by | uuid (FK → profiles) | — |

**`student_rewards`** — Opptjente belønninger per elev
| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | uuid (PK) | — |
| student_id | uuid (FK → profiles) | — |
| reward_id | uuid (FK → rewards) | — |
| is_redeemed | boolean (default false) | Innløst? |
| date_earned | timestamptz | — |
| earned_at_level | integer (default 1) | På hvilket nivå belønningen ble opptjent |

#### Hjelpekø

**`help_requests`** — Elevers håndsopprekkinger
| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | uuid (PK) | — |
| student_id | uuid (FK → profiles) | — |
| class_id | uuid (FK → classes) | — |
| status | text | `'pending'`, `'in_progress'`, `'resolved'`, `'cancelled'` |
| sort_order | integer (default 0) | For manuell omrekkefølge |
| active_queue_id | uuid (FK → active_help_queues) | — |
| resolved_at | timestamptz | — |

**`active_help_queues`** — Aktive køsesjoner
| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | uuid (PK) | — |
| class_id | uuid (FK → classes) | — |
| student_group_id | uuid (FK → student_groups) | — |
| status | text | `'open'` eller `'closed'` |

**`help_queue_participants`** — Lærere som deltar i kø
| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| queue_id | uuid (FK → active_help_queues) | — |
| teacher_id | uuid (FK → profiles) | — |

#### Vikar- og push-system

**`substitute_assignments`** — Vikartilordninger
| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | uuid (PK) | — |
| substitute_id | uuid (FK → profiles) | — |
| class_id | uuid (FK → classes, nullable) | — |
| student_id | uuid (FK → profiles, nullable) | — |
| assigned_by | uuid (FK → profiles) | — |
| real_name | text | Visningsnavn |

**`push_subscriptions`** — Push-abonnementer
| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| user_id | uuid (FK → auth.users) | — |
| subscription_data | jsonb | Web Push-abonnement |
| device_type | text | Enhetstype |

**`student_teacher_settings`** — Push-innstillinger per elev–lærer-par
| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| student_id | uuid (PK, FK → profiles) | — |
| teacher_id | uuid (PK, FK → profiles) | — |
| push_enabled | boolean (default false) | Push aktivert? |

**`teacher_active_sessions`** — _Ubrukt tabell_
| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | uuid (PK) | — |
| teacher_id | uuid (FK → profiles) | — |
| class_id | uuid (FK → classes) | — |

#### Nøkkel-RPC-funksjoner

| Funksjon                                                                        | Formål                                                                                                        |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `get_student_schedule(student_id, week_number)`                                 | Returnerer timeplanen for en elev med oppgavetellinger, deduplisert (ukespesifikk prioritert over masterplan) |
| `get_student_daily_announcement(student_id)`                                    | Henter daglig melding (prioritet: elev → klasse → trinn)                                                      |
| `link_student_to_class_structure(student_id, class_name, grade_name)`           | Oppretter trinn/klasse om nødvendig og kobler elev                                                            |
| `is_teacher()` / `is_full_teacher()` / `is_substitute()` / `is_admin_teacher()` | Rollesjekk-funksjoner (SECURITY DEFINER)                                                                      |
| `can_access_student(student_id)` / `can_access_class(class_id)`                 | Tilgangskontroll for vikarer                                                                                  |

---

## Del 2: Elevens brukeropplevelse

### 2.1 Velkomstoverlegg (WelcomeOverlay)

**Hva den gjør:** Når eleven logger inn for første gang i en økt, vises et fullskjermsoverlegg med en personlig hilsen.

**Hvordan den fungerer:**

- Kaller RPC-funksjonen `get_student_daily_announcement()` for å hente daglig melding
- Prioritetsrekkefølge for meldingen: (1) daglig melding fra lærer, (2) egendefinert velkomstmelding på elevprofilen, (3) standard «Hei, {navn}!»
- Lagrer `welcomed=1` i localStorage — vises kun én gang per nettleseøkt
- Klikk hvor som helst avviser overlegget med en fade-up-animasjon
- Sender en `welcomeDismissed` CustomEvent ved lukking

**Visuell beskrivelse:**

- Blå fullskjermsbakgrunn
- Stor hvit tekst med dynamisk melding, f.eks. «Hei, Emma! 👋»
- Undertekst: _«Trykk hvor som helst for å starte dagen.»_
- Hoppende 👇-emoji

### 2.2 Dashboard / Dagens timeplan (`/student`)

**Hva den gjør:** Viser dagens undervisningsøkter i et vertikalt fiskøye-karusellgrensesnitt med sanntidssporing.

**Hvordan den fungerer:**

- Kaller RPC `get_student_schedule()` ved lasting og oppdaterer hvert 5. minutt
- Intern tidssjekk hvert 30. sekund for å oppdatere aktivt fag og tidsindikatorer
- Hvert kort representerer én time (ScheduleCard-komponent)

**Visuell beskrivelse:**

- Header: «Dagens timeplan» i diskret versaltekst
- Vertikal karusell med fiskøye-effekt:
  - Sentrerte kort skaleres til 1.1× med full opacity
  - Perifere kort fader til 0.5–0.85 opacity
  - Aktiv time har lysende skygge (glow shadow)
  - Ferdige timer har CheckCircle2-ikon og dempede farger
- Hvert kort (ScheduleCard) viser:
  - Venstre: Stor fagomoji (3xl–6xl, responsivt)
  - Midten: Fagtittel, oppgavestatus (MissionChip: «2/4»), tidsintervall
  - Høyre: Statusindikator (prikk eller fremdriftsring)
  - 8px venstre-kantlinje fargekodet etter fagtema
- Grønn fremdriftslinje nederst på kortet som viser %-fullført
- ChevronUp/ChevronDown-piler for mobilnavigasjon
- Bakgrunnsgradient: `from-slate-100 via-slate-50 to-blue-50`
- Tom tilstand: Kort med 📅-emoji og lenke til `/student/fag`
- Feilmelding: Toast i bunn: _«Kunne ikke laste dagens oppgaver. Prøv å laste siden på nytt.»_

### 2.3 Fag & Oppgaver (`/student/fag`)

**Hva den gjør:** Viser et rutenett av alle aktive fag med fremdriftsindikatorer. Eleven klikker på et fag for å se oppgavene.

**Hvordan den fungerer:**

- Henter fag med oppgaver fra `subjects` og `tasks`-tabellene
- Grupperer uferdige oppgaver per fag
- Fag uten gjenværende oppgaver flyttes til arkiv

**Visuell beskrivelse:**

- Rutenett: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- Bakgrunn: `#F1F5F9` med subtil gradient
- Hvert fagkort (SubjectCard):
  - Stor emoji (3–4xl med drop-shadow)
  - Fagtittel i fagfargetema
  - Fremdriftstekst: _«X av Y oppgaver ferdig»_ eller _«Alt ferdig! 🎉»_
  - 3px fremdriftslinje nederst, animert
  - Svak rotasjon ±1° for organisk, ujevnt utseende
  - Hover: Skaler 1.02, løft skygge, `-translate-y-2`
  - Tap: Skaler 0.98
  - Komplett-markør: CheckCircle2-ikon
  - Fargeskjema: Kantlinje + lys bakgrunn fra fagets `color_theme`
- Arkivknapp: Flytende handlingsknapp (mobil) eller popover (desktop) med tellermerke
- Tom tilstand (alle oppgaver ferdig): Fullskjermsfeiring med 🎉: _«Alt ferdig! Du har fullført alle oppgavene dine. Flott jobbet!»_

### 2.4 Fagside / Oppgaveliste (`/subject/[id]`)

**Hva den gjør:** Viser alle oppgaver for et spesifikt fag som et rutenett av oppgavekort.

**Hvordan den fungerer:**

- Henter oppgaver fra `tasks` filtrert på `subject_id` og `student_id`
- Bruker `useTaskFlow`-hooken for fullføringslogikk og modalorkestrering

**Visuell beskrivelse:**

- Hero-banner (SubjectHero): Fagomoji (hoppende), fagtittel, fremdriftspill
- Arkivknapp øverst til høyre med tellermerke som pulserer ved nye fullføringer
- Rutenett: `grid-cols-1 md:grid-cols-2` med gap-4
- Hvert oppgavekort (TaskCard):
  - Tittel (fet) + TTS-knapp (høyttalerikon)
  - Beskrivelse (liten, grå tekst)
  - Poengmerke i indigo (f.eks. «10 poeng»)
  - Handlingsknapp:
    - Ufullført standard: Grønn knapp med «Fullfør» + CheckCircle-ikon
    - Ufullført quiz: Lilla knapp med «Start Quiz» + PlayCircle-ikon
    - Fullført: Grønt «Fullført! ✅»-banner
  - Animasjon: Pop-layout exit (skaler 0.5, fade ut)
  - 3D-trykkeeffekt: Tykk bunn-kantlinje + `active:translate-y`

### 2.5 Timebaserte oppgaver (`/student/lesson/[id]`)

**Hva den gjør:** Viser oppgaver knyttet til en spesifikk time (schedule slot).

**Hvordan den fungerer:**

- Bruker `task_schedule_entries`-koblingstabellen for å finne oppgaver per timeplanpost
- Henter faginformasjon fra `schedule_entries` + `subjects`

**Visuell beskrivelse:**

- Hero-banner med fagomoji, tittel, tidsintervall (f.eks. «08:30 – 09:15»), fremdriftspill
- Oppgaverutenett med TaskCard-komponenter
- Tom tilstand: Feiringskort hvis ingen oppgaver eller alle fullført

### 2.6 Ukeplanen (`/student/timeplan`)

**Hva den gjør:** Ukevisning av timeplanen med dagsfaner og sveipenavigasjon.

**Hvordan den fungerer:**

- Henter timeplan via `get_student_schedule` RPC
- Henter ukentlige oppdateringer fra `weekly_updates`
- Mobil: Dagsfaner med sveipenavigasjon (PanInfo-sporing, 50px terskel)
- Desktop: 5-kolonners rutenett

**Visuell beskrivelse:**

- Header: Ukenummer + daglig fremdrift (f.eks. _«3/8 oppgaver fullført i dag»_)
- Mobile dagsfaner (klistret topp):
  - Kortformer: «Man», «Tir», «Ons», «Tor», «Fre»
  - Aktiv fane: Indigo-bakgrunn + hvit tekst med skygge
  - Prikkindikator under fane: smaragd (alt ferdig), indigo (i dag), slate (oppgaver gjenstår)
  - Animert sprett ved suksess
- Timeposter per dag med tidspunkt, faginfo og fremdrift
- MissionChip: Oppgavetelling fargekodet (grønn ved fullføring)
- Weekend-banner for lørdag/søndag
- Ferdigmelding: _«Alle oppgaver fullført i dag! 🎉»_

### 2.7 Oppgavefullføring — standardoppgaver

**Hva den gjør:** Bekrefter fullføring med valgfrie mediebidrag (bilde, lydopptak, tekstkommentar).

**Hvordan den fungerer:**

1. Elev klikker «Fullfør» → CompletionModal åpnes
2. Modal viser pulserende avatar + _«Er du sikker på at du er ferdig?»_
3. Valgfrie mediefelt: kamerabilde (WebcamCapture), lydopptak (AudioRecorder), tekstkommentar
4. Bekreft → `useTaskCompletion.completeTask()`:
   - Oppdaterer `tasks.is_completed = true` og `tasks.completed_at`
   - Legger til XP (`current_xp += points_value`, `points_earned += points_value`)
   - Sjekker nivåopprykk (`current_xp >= current_goal_total`)
   - Sjekker halvveis-feiring
   - Spiller `/sounds/pling.mp3` (volum 0.5)
5. Lagrer mediefiler til Supabase Storage (`student-media/{studentId}/{taskId}/`)
6. Oppretter/oppdaterer `feedback`-rad med medidata og quizsvar
7. Sender push-varsling til lærer (hvis aktivert)

**Visuell beskrivelse:**

- Sentrert hvitt kort med fjæranimasjon
- Pulserende avatar (skaler-animasjon 1 → 1.06 → 1, 3s loop)
- Grønn «Fullfør»-knapp med Send-ikon
- Grå «Avbryt»-knapp
- Lasteindikator: _«Lagrer...»_ med spinner

### 2.8 Oppgavefullføring — quiz

**Hva den gjør:** Fullskjerms quizgrensesnitt med spørsmålsprogresjon.

**Hvordan den fungerer:**

- Quizdata hentes fra `tasks.quiz_data` (JSON-array med spørsmål)
- Hvert spørsmål har type: `text` (åpent svar), `radio` (ett valg) eller `checkbox` (flere valg)
- Svarene lagres i `feedback.quiz_responses`

**Visuell beskrivelse:**

- Fullskjermsbakgrunn: Gradient `from-indigo-600 via-purple-600 to-pink-500`
- Header: Lukkeknapp (X), oppgavetittel, teller (f.eks. «3/10»)
- Fremdriftsbobler: 9 sirkulære knapper per spørsmål
  - Aktiv: Hvit bakgrunn, lilla tekst, skalert 1.1
  - Besvart: Smaragd-400, hakemerkikon
  - Ubesvart: Hvit/20% bakgrunn
- Spørsmålskort: Hvitt, avrundet 3xl, skyveanimasjon
  - Typebadge: _«Spørsmål 5»_, _«Velg ett»_, _«Skriv svar»_
  - Tekst + TTS-knapp
- Svarfelt avhengig av type:
  - Tekst: Tekstområde, min-høyde 120px
  - Radio: Knappgruppe, valgt = lilla-50 + lilla-400 kantlinje
  - Checkbox: Multi-valg-knapper
- Advarsel ved ubesvarte spørsmål: Amber-boks
- Navigasjon: Forrige/Neste + direkte hopp

### 2.9 Belønninger — oversikt (`/belonninger`)

**Hva den gjør:** Sentralt belønningshub med to veier: blomsterhage og kuponger.

**Visuell beskrivelse:**

- Header: _«Mine Premier 🏆»_
- To store kort i rutenett:
  1. **Min Blomsterhage 🌸**: Flower2-ikon i rosa/grønn gradient, _«Se samlingen din og fargelegg nye blomster. Fullfør oppgaver for å samle kronblader.»_, rosa «Aktiv»-badge
  2. **Mine Kuponger 🎫**: Ticket-ikon i oransje gradient, _«Se alle dine premier og belønninger. Bruk kupongene dine sammen med læreren.»_, oransje «Aktiv»-badge
- Hover: Skaler 1.05 med pil-forskyvning

### 2.10 Blomsterhagen (`/belonninger/hage`)

**Hva den gjør:** Interaktiv blomsterhage der eleven kan se og flytte rundt på fullførte blomster i et visuelt landskap.

**Hvordan den fungerer:**

- Henter `completed_flower_colors` og `garden_positions` fra `student_profiles`
- Blomster rendres som FlowerPot-komponenter posisjonert på X/Y-prosent
- Drag & drop via Framer Motion (begrenset til synlig område)
- Posisjoner lagres tilbake til Supabase

**Visuell beskrivelse:**

- Himmelbakgrunn: Gradient `from-sky-200 via-[B0E0F6] to-green-50`
- Sol: Oransje sirkel øverst til høyre, roterer konstant, med stråler
- Skyer: Flytende SVG-former med parallakse
- Bakker: Grønne lag i bakgrunnen
- Blomster: Draggbare FlowerPot-komponenter med determinisk kvasitifeldig plassering som fallback
- Gnistanimasjon ved klikk/tap på blomst (1.2s transient sparkle)
- Lastetilstand: _«Laster hagen din...»_
- Inaktiv tilstand (blomsterhage deaktivert): _«Blomsterhagen er ikke aktivert. Be læreren din om å aktivere blomsterhagen for deg.»_

### 2.11 Kuponger (`/belonninger/kuponger`)

**Hva den gjør:** Viser opptjente belønninger (kuponger) med mulighet for å markere som innløst.

**Hvordan den fungerer:**

- Henter `student_rewards` med `rewards`-data
- Deler inn i aktive (ubrukte) og innløste
- Innløsning: Bekreftelsesmodal → oppdater `is_redeemed = true` → konfetti

**Visuell beskrivelse:**

- Header: Lommebok-ikon + _«Mine Kuponger»_ i lilla → rosa gradient + 🎫
- Undertekst: _«Dine premier og belønninger samlet på ett sted»_
- Aktiv-seksjon: _«✨ Aktive Kuponger»_ med rutenett `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
- Innløst-seksjon: _«🏆 Premieskap»_ (sammenleggbar med ChevronDown/Up)
- Tom tilstand: _«🎁 Ingen ubrukte kuponger. Gå opp i level for å samle flere premier!»_
- Konfetti ved innløsning: 500 partikler, gravity 0.3, 4s varighet

### 2.12 Navigasjon

**Toppmeny (Navigation):**

- Fast toppbar med meny, tittel, tilbakemeldingsknapp
- Venstre: Hamburgermeny (toppnivå-ruter) eller Tilbake-knapp (dype ruter)
- Senter: «Klar»-logoknapp → forsiden
- Høyre: Tilbakemeldingsknapp 💬 med ulestteller (pulserende rød prikk, «9+» ved > 9 uleste)
  - Henter ulest-telling hvert 30. sekund fra `feedback` der `read_at IS NULL`
- Toppnivå-ruter (viser hamburger): `/`, `/student`, `/student/fag`, `/student/timeplan`, `/belonninger`
- Dype ruter (viser tilbake): `/student/lesson/[id]`, `/subject/[id]`

**Sidepanel (Sidebar):**

- Glir inn fra venstre med fjæranimasjon + 50% mørkere bakgrunnsteppe
- Menypunkter:
  - _«Dagen i dag»_ → `/` (Home-ikon)
  - _«Fag & Oppgaver»_ → `/student/fag` (BookOpen)
  - _«Timeplan»_ → `/student/timeplan` (Calendar)
  - _«Belønninger»_ → `/belonninger` (Trophy)
  - Skillelinje
  - _«Logg ut»_ (LogOut-ikon)
- Bunn: Fremdriftskort (avatar, nivå, fremdriftslinje) — avatar klikkbar for avatarvelger

### 2.13 Elevbunnlinje (StudentFooter)

**Hva den gjør:** Fast bunnlinje som viser gamification-status, tidssporing, og hjelpknapp.

**Visuell beskrivelse:** Hvit/85% bakgrunn med uskarphet, topp-kantlinje, skygge. Flex-rad med responsiv avstand.

**Seksjoner (venstre til høyre):**

1. **XP-fremdriftslinje** (XpProgressBar, flex-1):
   - Sporr: Lys grå (slate-200) med subtil toppglans
   - Fylling: Gradient `from-green-400 to-emerald-500` med glødskygge
   - Avatar: Animert sirkel på fremdriftslinjen (emoji eller bilde)
   - Etiketter: «LEVEL {nivå}» (venstre), klikkbar veksling mellom prosent og absolutt XP (høyre)
   - XP-visningsmodus lagret i localStorage

2. **Blomst-teaser** (FlowerTeaser, hvis aktivert):
   - Miniatyr FlowerPot (44px) med kronbladprikker (5 prikker, farget eller grå)
   - Sprettanimasjon ved nytt kronblad
   - Lenke til `/belonninger/hage`

3. **Streak-widget** (StreakWidget, hvis aktivert):
   - 🔥 + tall (f.eks. «🔥 7»)
   - Hover: Skaler 1.05
   - Popover: Streaktall, personlig rekord (klassisk modus: _«🏆 Rekord: {tall} dager»_), neste belønningsfremdrift

4. **Ventende belønning** (PendingRewardBadge):
   - 🎁 pulserende, tellermerke hvis > 1

5. **Tidssporer** (TimeTrackerWidget):
   - Under time: Fagomoji + gjenstående tid + fremdriftsring
   - Friminutt: ☕ + tid til neste time
   - Kommende: Neste fagomoji + minutter til
   - Skolefri: _«Skolefri»_ 🏠

6. **Hjelpknapp** (StudentHelpButton, hvis kø er åpen):
   - 💬 håndsopprekking

### 2.14 Tekst-til-tale (TTS)

**Hva den gjør:** Knapp ved oppgavetekster som leser opp innholdet høyt med norsk stemme.

**Hvordan den fungerer:**

- Bruker nettleserens Web Speech API (`window.speechSynthesis`)
- Stemmevalg: Søker etter `nb-NO` eller `no`-prefiks
- Rate: 0.9 (litt langsommere enn standard), Pitch: 1.0
- Fallback: Systemets standardstemme hvis norsk ikke finnes
- TTSButton-komponent med høyttalerikon fra lucide-react

### 2.15 Tilbakemeldinger fra lærer (FeedbackSheet)

**Hva den gjør:** Viser «rosens vegg» — lærertilbakemeldinger som emojireaksjoner og kommentarer.

**Hvordan den fungerer:**

- Henter fra `feedback`-tabellen filtrert på elev-ID
- Markerer som lest (`read_at`) ved åpning
- Ulest-telling i navigasjonsbaren (rød prikk)

### 2.16 Avatarvelger (AvatarPickerModal)

**Hva den gjør:** Lar eleven velge avatar (emoji eller Dicebear-bilde).

**Hvordan den fungerer:**

- Emoji-alternativer (f.eks. 🦄, ⚽, 🐱)
- Lagrer til `profiles.avatar_url`

### 2.17 Lenker til læringsressurser

Det finnes **ingen** eksterne lenker til læringsressurser i prototype. Oppgaver har kun tittel, beskrivelse, og valgfri lydfil — ingen URL-felt.

### 2.18 Tilpasning for elev

Eleven kan tilpasse:

- **Avatar**: Velge emoji eller bilde via AvatarPickerModal
- **XP-visning**: Veksle mellom prosent og absolutte tall (lagret i localStorage)
- **Blomsterposisjon**: Dra og slipp blomster i hagen

Eleven kan IKKE tilpasse: fargetema, layout, oppgaverekkefølge, skriftstørrelse.

### 2.19 Varsler

- **Push-varsler**: Aktivert via Service Worker. Når den oppgaven sendes tilbake med reaksjon fra lærer, vises push til lærer (ikke eleven).
  - _Merknadsretning_: Push går fra elev → lærer (ved fullføring), ikke omvendt.
- **In-app-varsler**: Ulest tilbakemelding-teller i navigasjonslinjen (rød prikk), toast-meldinger for feil og suksess.

### 2.20 Tilgjengelighet og responsivitet

- **Responsivt design**: Mobil-først med Tailwind-breakpoints (sm, md, lg)
- **Touch-mål**: ≥44×44px på knapper
- **Plattformuavhengighet**: PWA som fungerer på alle nettlesere
- **Språk**: All UI-tekst på norsk bokmål (nb), `lang="nb"` på root-elementet
- **Font**: Geist (sans-serif) + Geist Mono (Latin-subset)
- **Skriftstørrelse**: Ikke justerbar av bruker; følger nettleserens innstillinger
- **Kontrast**: Varierer; bruker mye lyse gradientbakgrunner med mørk tekst
- **Animasjoner**: Fjærbevegelser via Framer Motion, CSS-keyframes for subtil flyt

---

## Del 3: Lærerens brukeropplevelse

### 3.1 Layout og navigasjon

**Desktop (≥1024px):** Fast sidepanel (256px bred) med:

- Logo: Ikon + «Klar» + _«Lærer Dashboard»_
- Navigasjonsmeny:
  - _«Oversikt»_ → `/teacher` (LayoutDashboard-ikon)
  - _«Mine Elever»_ → `/teacher/classes` (Users)
  - _«Fag & Oppgaver»_ → `/teacher/tasks` (BookOpen)
  - _«Timeplaner»_ → `/teacher/timeplan` (CalendarDays)
  - _«Belønninger»_ → `/teacher/rewards` (Gift)
  - _«Meldinger»_ → `/teacher/messages` (MessageSquare)
  - _«Planer»_ → `/teacher/ukebrev` (ClipboardList)
  - _«Vikarstyring»_ → `/teacher/admin` (Shield, kun admin)
- Bunnen: Brukerprofil (avatar, navn, epost) + utloggingsknapp

**Mobil:** Header med hamburger → Skuffl (slide-in fra høyre) med samme navigasjon.

**Hovedinnhold:** `lg:pl-64` for å kompensere sidepanelet. Fargeskjema: Indigo som primærfarge.

### 3.2 Oversiktsside / Dashboard (`/teacher`)

**Hva den gjør:** Læreroversikt med hurtigwidgeter og aktivitetslogg.

**Tre widgets øverst:**

1. **Nylig besøkte elever** (RecentStudents):
   - Viser de 4 sist besøkte elevene (lagret i localStorage per lærer-ID)
   - Søkefunksjon: _«Søk etter elev...»_
   - Klikk navigerer til elevens adminside

2. **Hjelpekø** (ActiveQueuesWidget):
   - Sanntidsabonnement på `help_requests` (status: pending)
   - Viser antall ventende elever
   - Klikk åpner HelpQueueSheet med draggbar omrekkefølge, ventetid, og «løst»-knapp
   - Ventetid-visning: _«nå»_ (<1 min), _«X min»_ (< 5/10 min), _«X time(r)»_ (≥ 1 time, rødt)

3. **Hurtighandlinger** (Quick Actions):
   - _«+ Ny oppgave»_-knapp → åpner CreateTaskModal
   - _«+ Legg til elev»_-knapp → åpner AddStudentModal

**Aktivitetshistorikk (hoveddel):**

- Viser fullførte oppgaver de siste 20 dagene
- Kolonner: Elevavatar + navn, fag (emoji + tittel), oppgavetittel, poeng (⭐), tidspunkt
- Tidspunkt: Relativ formatering (_«5 min siden»_, _«2t siden»_, _«i går»_, dato)
- Klikk åpner ActivityDetailSheet med:
  - Oppgavedetaljer + quizsvar (hvis quiz)
  - Elevbidrag: Bilde, lydopptak, tekstkommentar
  - Hurtigreaksjons-emoji: 👍 🌟 💪 🎉 ❤️ 🔥
  - Tekstkommentarfelt
  - «Send i retur»-knapp (angrer fullføring, reverserer XP/nivå)

### 3.3 Mine Elever / Klasser (`/teacher/classes`)

**Hva den gjør:** Organiserer elever i klasser og grupper med tre visningsmoduser.

**Tre faner:**

**1. Klasser (hierarkivisning) — ClassesAccordion:**

- Trinn → Klasser → Elever (trestruktur)
- Trinn grupperes automatisk fra klassenavn (f.eks. «5A» → «5. Trinn»)
- Kontekstmeny (⋮) per nivå:
  - Trinn: Rediger, legg til klasse
  - Klasse: Legg til elev (bulk), Rediger, Slett, Meld til klasse (TODO — ikke implementert), Kø-toggle
  - Elev: Se profil, Rediger, Flytt til klasse, Fjern fra klasse

**2. Grupper — GroupsAccordion:**

- Viser egendefinerte grupper med medlemslister
- Handlinger: Opprett gruppe, legg til/fjern elever, slett gruppe, gi nytt navn, kø-toggle
- Data fra `student_groups` og `student_group_members`

**3. Elever (tabellvisning) — StudentTable:**

- Korttabell med innebygd redigering
- Kolonner: Navn, Klasse (klikkbar for endring), Nivå, Modus (🌱 Hage eller 🏆 Poeng)
- Sorterbar etter alle kolonner
- Klassefilter på venstresiden
- Søkefelt: _«Søk etter elev...»_

**Global verktøylinje:**

- Søkefelt (tekst varierer etter visning)
- Resultatantall: _«Viser X av Y elever»_
- Visningsveksler: Klasser | Grupper | Elever

### 3.4 Elevstyring — enkeltside (`/teacher/students/[id]`)

**Hva den gjør:** Dyp administrasjonsside for en enkelt elev med profil, innstillinger, oppgaver og timeplan.

**Layout: Flerspaltet rutenett**

**Kolonne 1: Innstillinger (StudentSettingsCard)**

- Toggle: _«Aktiver Blomsterhage»_ — _«Eleven kan se og fargelegge kronblader...»_
- Toggle: _«Aktiver Streak 🔥»_ — _«Eleven ser sin streak-teller...»_
  - Underbryting: _«Klassisk»_ (nullstilles ved manglende dag) vs. _«Akkumulert»_ (teller totale aktive dager)
- Tekstfelt: _«Velkomstmelding»_
- Lagre-knapp med lastetilstand

**Kolonne 2: Profil & Klasse**

- Avatar, Navn, Nivåmerke
- Klassevelger (ClassCombobox) — nedtrekksliste for å velge/opprette klasse
- Passordkort (StudentPasswordCard):
  - Viser nåværende klartekstpassord
  - _«Reset Passord»_-knapp → genererer barnvennlig passord
  - Format: `[Fargenavn][Dyrenavn][2-siffer]`, f.eks. «RødUgle47»

**Kolonne 3: Nivå & Valuta**

- XP-bar med prosent
- Poengmerke (⭐ gul): fra `points_earned`
- Blomstermerke (🌸 rosa): fra `flowers_collected` (hvis hage er aktivert)
- Streakmerke (🔥 oransje): nåværende/lengste streak (hvis streak aktivert)

**Kolonne 4: Belønningsadministrasjon (StudentRewardManager)**

- Viser belønninger tildelt til eleven
- _«Legg til belønninger»_-modal for å velge fra bibliotek eller opprette ny

**Kolonner 5–7: Oppgavefaner (full bredde)**

| Fane         | Innhold                                                                                                        |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| **Todo**     | Uferdige oppgaver tildelt eleven, med fag-emoji, tittel, beskrivelse, frist, poeng, redigerings-/sletteknapper |
| **Fullført** | Fullførte oppgaver med tilbakemeldingsindikatorer                                                              |
| **Timeplan** | WeeklyScheduleEditor med ukevelger                                                                             |

**Fristformat:** _«I dag»_, _«I morgen»_ eller «DD. MMM»

### 3.5 Fag & Oppgaver (`/teacher/tasks`)

**Hva den gjør:** Opprett og administrer gjenbrukbare oppgavemaler; organiser etter fag.

**Fagadministrasjon (topp):**

- Liste over fag med inline redigering/sletting
- Hvert fag: Emoji-velger, tittelfelt, fargevelger-modal
- Handlinger: Lagre, Avbryt, Slett med bekreftelse
- Toast: _«Faget ble oppdatert»_, _«Faget ble slettet»_

**Oppgavebibliotek:**

- Verktøylinje: Søkefelt (_«Søk etter oppgaver...»_), fagfilter (_«Alle Fag»_), _«+ Ny Oppgave»_-knapp
- Rutenett (3–4 kolonner):
  - Fag-emoji + tittel, beskrivelsesutdrag, type-badge (Standard/Quiz), klassetrinninfo
  - Hover: Rediger-/sletteikoner

**Oppgaveoppretting (CreateTaskModal) — to-trinns veiviser:**

_Trinn 1: Innhold_

- Tittelfelt, beskrivelsesfelt
- Fagvelger (nedtrekksliste + mulighet for nytt fag)
- Typevelger: Standard | Quiz
- Hvis quiz: QuizBuilder — legg til spørsmål med:
  - Spørsmålstekst
  - Svartype: Tekst | Radio (ett valg) | Checkbox (flere valg)
  - Alternativer (for valgspørsmål)
  - Fjern spørsmål-knapp

_Trinn 2: Tildeling_

- RecipientPicker: Velg elever, klasser eller grupper
- SchedulePicker: Koble til timeplanøkter
- Hvis gjentakende (flere ødelegg): Toggle _«Gjentakende oppgave»_ + modusvelger
  - Delt: Én oppgave for alle økter
  - Per økt: Separat oppgave per timeplanøkt

**Tilbaketrekking av oppgaver:** Ved sletting av mal: mulighet for å _«trekke tilbake ufullførte elevoppgaver»_ (sletter oppgaver med `task_library_id` og `is_completed = false`)

### 3.6 Timeplanstyrning (`/teacher/timeplan`)

**Hva den gjør:** Last opp timeplaner fra Word-dokumenter og administrer timeplanposter direkte.

**Venstre sidepanel: Kontekstvalg**

- Modusveksler: Master (uke 0) | Ukentlig (uke 1–53)
- Trinn/klasse-velger
- Elevvelger (valgfritt, for elevspesifikke overstyringer)
- Ukevelger

**Hoveddel: Filopplasting og forhåndsvisning**

Uten opplastet timeplan:

- Slipp-sone for .docx-filer: _«Last opp dokument»_, _«Dra og slipp eller klikk for å velge en .docx-fil (ukebrev eller undervisningsplan)»_
- Hovefekt: Kantlinjefargeendring til indigo

Under parsing:

- Lastespinner + _«AI analyserer dokumentet...»_

Etter vellykket parsing:

- Header-kort (indigo-gradient) med kalenderikon, «Uke X», type-badge (_«📨 Ukebrev»_ eller _«📋 Ukeplanlegger»_), filnavn
- Hint: _«🖊️ Klikk på tekst for å redigere»_
- Forhåndsvisningsinnhold (redigerbart)
- Handlingsknapper: _«Lagre»_, _«Avbryt»_, _«Lagre også som masterplan»_

**Direkte timeplanredigering (WeeklyScheduleEditor):**

- Dagspaltede rutenett (Man–Søn)
- Viser sammenslått klasse + elevspesifikke overstyringer
- Legg til/rediger/slett timeposter via modal
- ScheduleEntryModal: Emnevalg, tidspunkter (TimePicker), dag, uketall

### 3.7 AI-parsing av dokumenter (`parse-weekly-plan.ts`)

**Hva den gjør:** Ekstrahere timeplan, oppgaver og meldinger fra Word-dokumenter ved hjelp av AI.

**Hvordan den fungerer:**

1. Mottar .docx-fil via FormData
2. Konverterer til rå tekst med Mammoth-biblioteket
3. Sender til **Google Gemini (`gemini-2.5-flash`)** med strukturert systemmelding (600+ linjer)
4. Temperatur: 0.1 (faktabasert ekstraksjonsmodus)

**Klassifisering:**

- **UKEBREV** (foreldrebrev): Inneholder ukeplan, lekser, læringsmål, foreldremeldinger
- **UKEPLANLEGGER** (lærerens undervisningsplan): Inneholder nummererte timer, mål per økt, aktiviteter

**Utdata for ukebrev:** Ukenummer, generelle meldinger, læringsmål per fag, lekser per fag, timeplanposter (klasse, dag, tid, fag)

**Utdata for ukeplanlegger:** Ukenummer, oppgaver per økt (fag, øktsnummer, tittel, beskrivelse, mål, målklasser)

### 3.8 Belønningsbibliotek (`/teacher/rewards`)

**Hva den gjør:** Opprette og administrere belønninger som elever kan velge ved nivåopprykk.

**Visuell beskrivelse:**

- Header: _«Belønningsbibliotek»_ — _«Administrer belønninger som elevene kan velge mellom når de rykker opp i nivå.»_
- _«+ Ny Belønning»_-knapp (indigo-600)
- Rutenett (4 kolonner desktop)
- Hvert belønningskort:
  - Stor emoji (5xl), tittel, beskrivelse
  - Kostnadsmerke med ikon:
    - Poeng (⭐ gul): «Poeng»
    - Blomster (🌸 rosa): «Blomster»
    - Kronblader (✨ lilla): «Kronblader»
    - Nivå (📈 indigo): «Nivå»
    - Oppmøte (🔥 oransje): «Hver X. dag»
  - Frekvensbadge: _«Engangs»_ eller _«Maks X×»_
  - Hover: Rediger- og sletteikoner

**Belønningsskjema (RewardForm):**

- Felt: Tittel, beskrivelse, emoji-velger, kostnadstype, kostnadsverdi, maks bruk
- Elevvelger: Spesifikke elever eller alle
- Gjentakbar-toggle

### 3.9 Meldinger (`/teacher/messages`)

**Hva den gjør:** Sender daglige meldinger til elever, klasser eller trinn.

**Tospaltet layout:**

Venstre: Kalender og meldingsliste

- Datovelger
- Meldinger for valgt dato: _«Meldinger for [ukedag], [dato]»_
- Liste med target-type-badge, målnavn, sletteikon
- Tom tilstand: _«Ingen meldinger denne dagen»_

Høyre: Meldingsskjema

- RecipientSelector: Multi-valg med avkryssingsbokser for trinn → klasser → enkelelever
- Datovelger: _«Velg dato»_
- Meldingsfelt: _«Skriv melding...»_
- Send-knapp: _«Send melding»_
- Suksess-toast: _«Melding lagret til X mottaker(e)!»_
- Oppretter separate `daily_announcements`-rader per mottaker

### 3.10 Planer / Ukebrev-opplasting (`/teacher/ukebrev`)

**Hva den gjør:** Spesialisert side for å laste opp og analysere Word-dokumenter (ukebrev/ukeplanlegger).

**Arbeidsflyt:**

1. Last opp .docx-fil (dra-og-slipp eller filvelger)
2. AI analyserer og klassifiserer dokumenttypen
3. Forhåndsvisning med redigerbart innhold
4. Lagre til database (oppretter/oppdaterer timeposter og oppgavemaler)

**Manglende data-dialog (MissingDataDialog):** Håndterer situasjoner der AI-en refererer til klasser eller fag som ikke finnes i databasen — lar lærer opprette dem inline.

**Utkastlagring:** Lagret i localStorage med nøkkel `planlegging_draft`, gjenopprettes ved sideinnlasting.

### 3.11 Vikarstyring (`/teacher/admin` — kun admin)

**Hva den gjør:** Administrerer vikarkontoer, genererer innloggingslenker, tildeler klasser/elever.

**Tilgangskontroll:** Krever `profile.is_admin = true`. Ellers vises Shield-ikon + _«Ingen tilgang»_.

**Layout:**

- Header: _«Vikarstyring»_ — _«Aktiver vikarkontoer, tildel klasser og generer innloggingslenker.»_
- Liste over vikarkontoer (SubstituteManager), hvert kort utvikbart:
  - Statusdot (grønn hvis tildelinger, grå hvis ikke)
  - Navn, epost, tildelingsantall
  - Utvidet panel: Aktive tildelinger (klasse/elev), legg til ny tildeling, generer magic link
- Kopiér innloggingslenke til utklippstavle

**API:** `POST /api/admin/substitute-link` med epost → genererer Supabase magic link med custom callback → returnerer URL

### 3.12 Opprette ny elev (AddStudentModal)

**Fullstendig flyt:**

1. Lærer fyller inn fullt navn og velger/oppretter klasse
2. Server action `createStudent()`:
   - Oppretter Supabase auth-bruker med e-post `{brukernavn}@skole.klar.app`
   - Standardpassord: `"1234"`
   - Passord lagres også i `current_password_plaintext`
   - Genererer Dicebear-avatar basert på navn
   - Oppretter `profiles`-rad med rolle `student`
   - Oppretter `student_profiles`-rad med standardverdier
   - Kaller `link_student_to_class_structure()` for å koble til trinn/klasse
3. Suksessvisning: _«{fulltNavn} er lagt til!»_ + innloggingsinformasjon
4. «Kopier innloggingsinfo»-knapp

### 3.13 Hjelpekø-system

**Hvordan det fungerer:**

- Lærer aktiverer hjelpekø per klasse/gruppe via QueueToggle
- Elever ser StudentHelpButton i bunnlinjen når `is_queue_open = true`
- Elev trykker → oppretter `help_request` med status `pending`
- Lærer ser antall ventende i dashboard-widget + sanntidsoppdatering
- HelpQueueSheet: Draggbar omrekkefølge, ventetid per elev, «✓ Løst»-knapp

### 3.14 Push-varsler til lærer

**Flyt:**

1. Elev fullfører oppgave → klient kaller `POST /api/push/send`
2. API sjekker om læreren har push aktivert for denne eleven (`student_teacher_settings.push_enabled`)
3. Henter alle push-abonnementer for læreren
4. Genererer HMAC-SHA256-token for sikker reaksjonsverifisering
5. Sender via `web-push` VAPID
6. Push-melding på lærerens enhet med 4 emoji-reaksjonsknapper: 👍 🌟 💪 🎉
7. Klikk på emoji → `POST /api/push/react` med HMAC-verifisering → lagrer i `feedback`
8. Klikk på varselkroppen → åpner `/teacher/students/{elevId}`

### 3.15 Statistikk og oversikt

Det finnes **ingen dedikert statistikkside** med grafer eller diagrammer. Læreren ser:

- Aktivitetslogg (siste 20 dager) på oversiktssiden
- Oppgavefullføringsstatus per elev (Todo/Fullført-faner)
- Nivå, XP og poeng per elev
- Streaktelling (hvis aktivert)

### 3.16 Prioritering og differensiering

- **Poengverdi per oppgave**: Læreren setter `points_value` individuelt (standard: 10)
- **Elevspesifikke belønninger**: `specific_student_ids`-felt for å målrette belønninger
- **Elevspesifikk timeplan**: Overstyringer per elev via `schedule_entries.student_id`
- **Tilpassede velkomstmeldinger**: Per-elev tekst
- **Feature-toggles**: Blomsterhage og streak kan aktiveres/deaktiveres per elev
- **Streak-modus**: Klassisk (strengt daglig) vs. akkumulert (aldri nullstilt) — kan velges per elev
- Ingen eksplisitt «prioritering»-felt på oppgaver.

---

## Del 4: Gamification-systemet i detalj

### 4.1 XP-systemet

**XP-opptjening:**

- Hver oppgave har et `points_value`-felt (standardverdi: 10 XP)
- XP tildeles ved fullføring: `current_xp += points_value` og `points_earned += points_value`
- `current_xp`: XP innenfor nåværende nivå (nullstilles ved nivåopprykk)
- `points_earned`: Total livstids-XP (nullstilles aldri)

**XP-visning:**

- Fremdriftslinje i elevens bunnlinje med gradient fra green-400 til emerald-500
- Avatar-markør beveger seg langs linjen med fjæranimasjon
- Klikkbar veksling mellom prosent (f.eks. «42%») og absolutt (f.eks. «420 / 1000»)
- Modus lagres i localStorage (`xp-display-mode`)

### 4.2 Nivåsystemet

**Terskel per nivå:** 1000 XP fast (ingen eskalering). Feltet `current_goal_total` er satt til 1000 for alle elever ved opprettelse, og endres aldri i koden.

**Nivåopprykk-logikk:**

```
while (finalCurrentXp >= goalTotal):
    newLevel += 1
    finalCurrentXp -= goalTotal
```

- Overskudds-XP overføres til neste nivå
- Flere nivåopprykk i én oppgave er støttet (f.eks. 200 XP med 50 gjenstående → 2 nivåer opp)
- **Ingen øvre grense**: Nivåer øker uendelig

**Betingelser for premieutvelgelse:**

- Nivåopprykk utløser modal KUN hvis `newLevel > max_level_reached` (ny personlig rekord)
- Hindrer re-utløsning ved angre/re-fullføring

### 4.3 Halvveisfeiring

**Nøyaktig utløserbetingelse:**

1. Oppgaven fører IKKE til nivåopprykk (`!shouldLevelUp`)
2. XP krysser 50%-terskelen: Før oppgaven var `current_xp < 500`, etter er `current_xp >= 500`
3. Aldri feiret på dette nivået: `halfway_celebrated_level < currentLevel`

**Visuelt:**

- Header: Gradient `from-amber-400 via-yellow-400 to-orange-400`
- 🎯-ikon med fjæranimasjon
- Tittel: _«Halvveis!»_
- Undertekst: _«Du er halvveis til nivå {nivå + 1}!»_
- Animert fremdriftslinje 0% → aktuell %
- Gjenstående XP: _«{XP} XP igjen til neste nivå»_
- Belønningsteaser: Viser belønninger ved neste nivå (blomst 🌸 + databasebelønninger)
- Raskeste vei: Algoritme beregner høyestverdige ufullførte oppgaver — _«Fullfør disse {N} oppgavene for å nå neste nivå!»_
- Konfetti: 60 partikler, spread 55, gravity 0.8

### 4.4 Nivåopprykk-flyt (LevelUpModal — 3-trinns veiviser)

**Trinn 1: Feiring (CelebrationStep)**

- Stor tekst: _«GRATULERER! 🎉»_
- _«Du er nå i Level {nyNivå}!»_
- _«Velg din premie:»_
- Horisontal rullbar liste med premievalg:
  - **Blomsterkronblad** (hvis `show_flower_garden`): 🌸-badge, _«Fargelegg Kronblad»_
  - **Databasebelønninger**: Rutenett med tilgjengelige belønninger (emoji + tittel + beskrivelse)
  - Venstre/høyre-piler hvis innholdet renner over
  - Lastetilstand: _«Laster premier...»_
- Konfetti: 500 partikler, gravity 0.3

**Trinn 2: Fargevalg (ColorPickerStep, hvis kronblad valgt)**

- Emoji: 🎨 → 🌸 når farge velges
- FlowerPot: Interaktiv, responsiv størrelse (180–260px)
- Malerpalett (trebakgrunn SVG):
  - 8 fargeblobs med unike SVG-baner og rotasjonsvariasjon
  - **Farger:** Rød, Blå, Grønn, Rosa, Lilla, Oransje, Gul, Turkis
  - Valgt: Hvitt ✓-overlegg
  - Hover: Skaler 1.15, roter +5°
  - PaintBrushCursor: Egendefinert SVG-penselmarkør (desktop) / farget sirkelklatt (mobil)
  - Dryppanimasjon ved first dip (tåredråpe faller 22px)
- Klikk på fargeklatt → dypp pensel → klikk kronblad for å fargelegge
  - Splash-animasjon: Skaler [0.85 → 1.25 → 1], glødende drop-shadow
  - Allerede malt kronblad: Risteanimasjon (roter [-8 → 8 → -5 → 5 → 0])
  - Hover på ufarget: Hvit glødskygge

**Trinn 3: Blomstre-feiring (BloomStep, når 5/5 kronblader er farget)**

- Tekst med regnbuegradient: _«Ny blomst i hagen! 🌺»_
- FlowerPot med full blomstre-animasjon:
  - Stage 1 (0ms): Kronblader pulserer utover (skaler [1 → 1.3 → 1.15])
  - Stage 2 (800ms): Glødeburst i senteret
  - Stage 3 (1800ms): Krymp + flyt oppover (skaler [1.15 → 0.6], opacity [1 → 0], y -60)
  - Ferdig (3200ms): Avvis-knapp vises
- Avvis-knapp: _«Fantastisk! ✨»_
- Blomsten lagres i `completed_flower_colors`, `flowers_collected` økes

### 4.5 Kronblad- og blomstmekanikk

**5 kronblader = 1 komplett blomst.**

- Standard ufylt farge: `#E0E0E0` (grå)
- Hvert nivåopprykk gir mulighet til å fargelegge ett kronblad
- Lagring: `petal_colors`-array (5 elementer), `petals_progress` (0–5)
- Fullføring: Når alle 5 er farget (ikke grå) → blomsten arkiveres:
  - `petals_progress` → 0
  - `petal_colors` → nullstilt til 5× grå
  - `flowers_collected` += 1
  - `completed_flower_colors` ← legger til fargesettet
  - Konfettiburst: 150 partikler med fargene fra blomsten

**FlowerPot-komponent (SVG):**

- 5 tåredråpe-kronblader skapt med Bezier-kurver, rotert 36° for symmetrisk fordeling
- Stilk (grønn linje), potte (bronsefarga trapesoid med 3D-kant/jord)
- Ufylt kronblad: Grå (#E0E0E0), stiplet omriss, lav opacity (0.4), pulsanimasjon
- Malt kronblad: Eksplisitt farge, solid fylling, full opacity, drop-shadow glød
- Bloom-animasjon: 3.2s total med fire stadier (puls, glød, krymp, forsvinning)

### 4.6 Streaks (oppmøtestreaks)

**Aktivering:** Per-elev toggle i lærerens innstillingskort. To moduser:

**Klassisk modus (`classic`):**

- Streak fortsetter kun hvis siste innlogging var I GÅR
- Brytes hvis en dag mangler → nullstilles til 1
- `longest_streak` sporer personlig rekord

**Akkumulert modus (`accumulated`):**

- Streak øker ved hver innlogging, nullstilles aldri
- `longest_streak` er alltid lik `current_streak`

**Streak-belønninger:**

- Belønninger med `cost_type = "attendance"` utløses automatisk
- Ikke-gjentakende: Gis én gang ved `current_streak >= cost_value`
- Gjentakende: `Math.floor(daysSinceGrant / cost_value)` ganger, begrenset av `max_uses`
- Eksempel: 5-dagers belønning, streak = 12, siste tildeling ved streak 2 → `floor(10/5) = 2` tildelinger

**Fingerprint mot dobbeltgiving:** Hash av `current_streak + attendance_reward_progress` forhindrer duplikater.

**Streak-milestone-modal (StreakMilestoneModal):**

- Vises når streak når en milepæl OG en belønning opptjenes
- Emojiutbrudd med belønningemojier
- Stort 🔥 + tall
- Undertekst: _«dager med nærvær»_ (klassisk) eller _«dager totalt»_ (akkumulert)
- Ny rekord: 🏆 _«Ny personlig rekord!»_
- Knapp: _«Kult! 🌟»_

### 4.7 Badges/achievements

Det finnes **ingen separat badge-/prestasjons-system**. All anerkjennelse er bakt inn i:

- Nivåopprykk-modaler
- Bloom-feiringer
- Streak-milestones
- Konfettianimasjoner

### 4.8 Konfetti og animasjoner

| Hendelse          | Trigger         | Partikler | Gravity  | Varighet                |
| ----------------- | --------------- | --------- | -------- | ----------------------- |
| Nivåopprykk       | CelebrationStep | 500       | 0.3      | Standard                |
| Halvveisfeiring   | HalfwayModal    | 60        | 0.8      | Standard (spread 55)    |
| Kuponginnsløsning | Kuponger-siden  | 500       | 0.3      | 4s                      |
| Blomst-fullføring | selectReward    | 150       | Standard | Standard (blomstfarger) |

**Framer Motion generelt:**

- Montering: Fade + scale + translate
- Animasjon: Til full synlighet
- Hover: `whileHover={{ scale: 1.05 }}`, lett løft
- Tap: `whileTap={{ scale: 0.95 }}`
- Overganger: Fjær (damping 20–25, stiffness 300)
- Exit: Pop-layout (scale 0.5, fade)

**CSS-animasjoner:**

- `bounce-settle`: 1s dropp-inn med spretting
- `subtle-float`: 3s opp-og-ned-bevegelse (6px)
- `scrollbar-hide`: Skjuler rullefelt

### 4.9 Lyd

- **Eneste lydfil:** `/sounds/pling.mp3` — spilles ved oppgavefullføring (volum 0.5)
- Ingen separat nivåopprykklyd
- Grasiøs fallback: Ignoreres stille hvis nettleseren blokkerer autoplay

### 4.10 Ledertavle

Det finnes **ingen ledertavle** eller sammenligning mellom elever. All gamification er individuell.

### 4.11 Belønningsmekanismer (oppsummering)

| Belønningstype    | Utløser        | Beskrivelse                                   |
| ----------------- | -------------- | --------------------------------------------- |
| Kronblad (petal)  | Nivåopprykk    | Eleven fargelegger ett kronblad; 5 = blomst   |
| Databasebelønning | Nivåopprykk    | Kupong/premie fra lærerdefinert bibliotek     |
| Oppmøtebelønning  | Streak-milepæl | Automatisk basert på attendance-belønninger   |
| Halvveisfeiring   | 50% av nivå    | Motivasjonsmessig (ingen materiell belønning) |
| Bloom-feiring     | 5/5 kronblader | Blomst arkiveres i hagen                      |

### 4.12 Angre / Returner oppgave

Lærer kan sende en fullført oppgave i retur:

1. Merker oppgaven som `is_completed = false`
2. Trekker fra `points_value` fra `current_xp`
3. Hvis XP blir negativ: Nivånedrykk (+ `goalTotal` til XP per nivå tilbake)
4. Fjerner `pending_reward_levels` for tilbakekalte nivåer
5. Sletter `student_rewards` opptjent på høyere nivåer
6. Nullstiller `halfway_celebrated_level` hvis under 50%

---

## Del 5: Komplett funksjonsliste

| #   | Funksjon                              | Brukergruppe  | Kort beskrivelse                                                                      | Nøkkelkomponenter/filer                                                           |
| --- | ------------------------------------- | ------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 1   | Innlogging med brukernavn og passord  | Begge         | Supabase auth med usynlig @skole.klar.app-utvidelse. Omdirigerer basert på rolle.     | `(auth)/login/page.tsx`, `auth/callback/route.ts`                                 |
| 2   | Rollebasert omdirigering              | Begge         | Rotside `/` sjekker rolle og sender til riktig dashboard                              | `page.tsx`, `middleware.ts`                                                       |
| 3   | Velkomstoverlegg                      | Elev          | Personlig hilsen ved dagststart med daglig melding, custom tekst eller «Hei, {navn}!» | `WelcomeOverlay.tsx`                                                              |
| 4   | Dagens timeplan (fiskøye-karusell)    | Elev          | Vertikalt skrollhjul med dagens timer, sanntidssporing, fremdrich indikatorer         | `(dashboard)/student/page.tsx`, `ScheduleCard.tsx`                                |
| 5   | Fag & oppgaver-oversikt               | Elev          | Rutenett av aktive fag med fremdriftsindikatorer                                      | `student/fag/page.tsx`, `SubjectCard.tsx`                                         |
| 6   | Fagspesifikk oppgaveliste             | Elev          | Oppgavekort per fag med fullføringsknapper                                            | `subject/[id]/page.tsx`, `TaskCard.tsx`                                           |
| 7   | Timebaserte oppgaver                  | Elev          | Oppgaver knyttet til spesifikke timeplankort                                          | `student/lesson/[id]/page.tsx`                                                    |
| 8   | Ukeplanoversikt med sveipenavigering  | Elev          | Daglig/ukentlig timeplanvisning med tunn og dagsfaner                                 | `student/timeplan/page.tsx`                                                       |
| 9   | Oppgavefullføring (standard)          | Elev          | Bekreftelsesmodal med valgfrie medier (bilde, lyd, tekst)                             | `CompletionModal.tsx`, `useTaskCompletion.ts`                                     |
| 10  | Quiz-grensesnitt                      | Elev          | Fullskjerms quiz med tekst/radio/checkbox-spørsmål og progresjon                      | `StudentQuizView.tsx`                                                             |
| 11  | XP-fremdriftslinje                    | Elev          | Animert progress bar i bunnlinjen med avatar-markør og nivåvisning                    | `XpProgressBar.tsx`                                                               |
| 12  | Nivåopprykk med prisvelger            | Elev          | 3-trinns modal: feiring → fargevalg/kupong → blomstre-animasjon                       | `LevelUpModal.tsx`, `CelebrationStep.tsx`, `ColorPickerStep.tsx`, `BloomStep.tsx` |
| 13  | Halvveisfeiring                       | Elev          | Motivasjonsmodal ved 50% XP med raskeste vei til nivåopprykk                          | `HalfwayModal.tsx`                                                                |
| 14  | Kronblad-fargeliegging                | Elev          | Interaktiv fargelegging av blomsterkronblader med pensel og sprettanimasjoner         | `ColorPickerStep.tsx`, `FlowerPot.tsx`, `PaintBrushCursor.tsx`                    |
| 15  | Blomsterhage                          | Elev          | Interaktiv hage med draggbare blomster, himmel, sol, skyer                            | `belonninger/hage/page.tsx`, `FlowerPot.tsx`                                      |
| 16  | Kupongsystem                          | Elev          | Visning av opptjente premier med innløsning og konfetti                               | `belonninger/kuponger/page.tsx`, `CouponCard.tsx`                                 |
| 17  | Belønningshub                         | Elev          | Landingsside med lenker til hage og kuponger                                          | `belonninger/page.tsx`                                                            |
| 18  | Oppmøtestreak                         | Elev          | Streak-teller med klassisk/akkumulert modus og milestone-feiringer                    | `useAttendanceStreak.ts`, `StreakWidget.tsx`, `StreakMilestoneModal.tsx`          |
| 19  | Streak-milestonebelønninger           | Elev          | Automatiske belønningsgaver basert på streakoppmøte                                   | `useAttendanceStreak.ts`                                                          |
| 20  | Tidssporing                           | Elev          | Widget som viser pågående fag, gjenstående tid, og neste time                         | `TimeTrackerWidget.tsx`, `useTimeTracker.ts`                                      |
| 21  | Hjelp-håndsopprekning                 | Elev          | Knapp for å be om hjelp fra lærer (når kø er åpen)                                    | `StudentHelpButton.tsx`                                                           |
| 22  | Avatarvalg                            | Elev          | Velge emoji- eller bilde-avatar via modal                                             | `AvatarPickerModal.tsx`                                                           |
| 23  | Tekst-til-tale (TTS)                  | Elev          | Opplesning av oppgavetekst med norsk stemme (nb-NO)                                   | `useTTS.ts`, `TTSButton.tsx`                                                      |
| 24  | Tilbakemeldingsvisning                | Elev          | «Rosens vegg» med lærernes emojireaksjoner og kommentarer                             | `FeedbackSheet.tsx`                                                               |
| 25  | Arkiv for fullførte fag               | Elev          | Skuffe/popover med fullførte fag                                                      | `ArchiveDrawer.tsx`, `ResponsiveArchive.tsx`                                      |
| 26  | XP-visningsmodus                      | Elev          | Toggle mellom prosent og absolutt XP-visning                                          | `XpProgressBar.tsx`                                                               |
| 27  | Blomst-teaser i bunnlinje             | Elev          | Miniblomst med kronbladprikker og lenke til hage                                      | `FlowerTeaser.tsx`                                                                |
| 28  | Ventende belønning-badge              | Elev          | Pulserende 🎁-ikon for ubrukte nivåpremier                                            | `PendingRewardBadge.tsx` (StudentFooter)                                          |
| 29  | Sidenavigasjon med sidepanel          | Elev          | Slide-out meny med sidelenker og fremdriftskort                                       | `Sidebar.tsx`                                                                     |
| 30  | Lykkelig lyd ved fullføring           | Elev          | «Pling»-lydeffekt ved oppgavefullføring                                               | `useTaskCompletion.ts`, `/sounds/pling.mp3`                                       |
| 31  | Lærerdashboard med aktivitetslogg     | Lærer         | Oversikt med widgets og de siste 20 dagenes fullføringer                              | `teacher/page.tsx`, `ActivityDetailSheet.tsx`                                     |
| 32  | Hjelpekø-håndtering                   | Lærer         | Sanntidskø med draggbar omrekkefølge og ventetidvisning                               | `HelpQueueSheet.tsx`, `ActiveQueuesWidget.tsx`                                    |
| 33  | Kø-toggle per klasse/gruppe           | Lærer         | Åpne/lukke hjelpekø for en klasse eller gruppe                                        | `QueueToggle.tsx`                                                                 |
| 34  | Nylig besøkte elever                  | Lærer         | Widget med siste 4 besøkte elever og søk                                              | `RecentStudents.tsx`                                                              |
| 35  | Hurtighandlinger                      | Lærer         | Knapper for å opprette oppgave og legge til elev                                      | `teacher/page.tsx`                                                                |
| 36  | Opprett ny elev                       | Lærer         | Fullstendig flyt med auth, profil, klasse og generert innlogging                      | `AddStudentModal.tsx`, `student-actions.ts`                                       |
| 37  | Passord-tilbakestilling               | Lærer         | Genererer barnvennlig passord (FargenDyretall)                                        | `StudentPasswordCard.tsx`, `student-actions.ts`                                   |
| 38  | Klasseadministrasjon (hierarki)       | Lærer         | Trinn → klasse → elevvisning med kontekstmenyer                                       | `ClassesAccordion.tsx`                                                            |
| 39  | Gruppesystem                          | Lærer         | Opprette, redigere og slette egendefinerte elevgrupper                                | `GroupsAccordion.tsx`, `CreateGroupModal.tsx`                                     |
| 40  | Elevtabellvisning                     | Lærer         | Sortbar tabell med inline redigering av klasse og modus                               | `StudentTable.tsx`                                                                |
| 41  | Elevinnstillinger                     | Lærer         | Toggle blomsterhage, streak, custom melding per elev                                  | `StudentSettingsCard.tsx`, `EditStudentSheet.tsx`                                 |
| 42  | Elevprofiladministrasjon              | Lærer         | Dyp admin med nivå/XP/belønninger, oppgaver og timeplan                               | `teacher/students/[id]/page.tsx`                                                  |
| 43  | Oppgavebidliotek                      | Lærer         | Opprett og administrer gjenbrukbare oppgavemaler                                      | `teacher/tasks/page.tsx`                                                          |
| 44  | Oppgaveoppretting (standard + quiz)   | Lærer         | To-trinns veiviser med innhold og tildeling                                           | `CreateTaskModal.tsx`, `QuizBuilder.tsx`                                          |
| 45  | Oppgavetildeling til elever/klasser   | Lærer         | RecipientPicker for multi-valg av mottakere                                           | `RecipientPicker.tsx`                                                             |
| 46  | Oppgavekobling til timeplanøkter      | Lærer         | SchedulePicker for å knytte oppgaver til timer                                        | `SchedulePicker.tsx`                                                              |
| 47  | Gjentakende oppgavemodus              | Lærer         | Delt eller per-økt oppgaveduplisering                                                 | `CreateTaskModal.tsx`                                                             |
| 48  | Fagadministrasjon                     | Lærer         | Opprett, rediger og slett fag med emoji og fargetema                                  | `manage-subjects.ts`, `teacher/tasks/page.tsx`                                    |
| 49  | Timeplanadministrasjon                | Lærer         | Direkte redigering av timeplan med dagsspaltede rutenett                              | `WeeklyScheduleEditor.tsx`, `ScheduleEntryModal.tsx`                              |
| 50  | AI-basert dokumentimport              | Lærer         | Last opp .docx → Gemini AI klassifiserer og ekstrahere timeplan/oppgaver              | `parse-weekly-plan.ts`, `teacher/ukebrev/page.tsx`                                |
| 51  | Ukebrev-forhåndsvisning og redigering | Lærer         | Forhåndsvisning av AI-analysert innhold med inline redigering                         | `UkebrevPreview.tsx`, `PreviewLessonPlan.tsx`                                     |
| 52  | Masterplan vs. ukeplan                | Lærer         | Støtte for standard-timeplan (uke 0) og ukespesifikke justeringer                     | `schedule-queries.ts`, `WeeklyScheduleEditor.tsx`                                 |
| 53  | Belønningsbidliotek                   | Lærer         | Opprett og administrer belønninger med kostnadstyper og begrensninger                 | `teacher/rewards/page.tsx`, `RewardForm.tsx`                                      |
| 54  | Belønninger per elev                  | Lærer         | Tildel spesifikke belønninger til individuelle elever                                 | `StudentRewardManager.tsx`                                                        |
| 55  | Daglige meldinger                     | Lærer         | Send målrettede meldinger til elev/klasse/trinn per dato                              | `teacher/messages/page.tsx`, `daily_announcements`                                |
| 56  | Aktivitetsdetaljer med tilbakemelding | Lærer         | Se elevbidrag, gi emojireaksjon og tekstkommentar                                     | `ActivityDetailSheet.tsx`                                                         |
| 57  | Returner oppgave                      | Lærer         | Angre fullføring med XP-reversering og nivånedrykk                                    | `useTaskCompletion.ts` (undoTask)                                                 |
| 58  | Push-varsler ved oppgavefullføring    | Lærer         | Mottar push med emoji-reaksjonsknapper når elev fullfører                             | `api/push/send`, `api/push/react`, `sw.js`                                        |
| 59  | Tilbaketrekking av oppgavemaler       | Lærer         | Slett mal + mulighet for å fjerne ufullførte elevoppgaver                             | `teacher/tasks/page.tsx`                                                          |
| 60  | Vikarstyring                          | Lærer (admin) | Administrer vikarkontoer, generer magic links, tildel klasser                         | `teacher/admin/page.tsx`, `SubstituteManager.tsx`                                 |
| 61  | Flytt elev mellom klasser             | Lærer         | Dialog for å endre elevs klassetilhørighet                                            | `MoveStudentDialog.tsx`, `student-actions.ts`                                     |
| 62  | Bulk-elevtilordning                   | Lærer         | Legg til flere elever til en klasse samtidig                                          | `BulkStudentAssignModal.tsx`                                                      |
| 63  | Kopier innloggingsinfo                | Lærer         | Kopier brukernavn og passord til utklippstavle                                        | `AddStudentModal.tsx`                                                             |
| 64  | Utkastlagring av plan                 | Lærer         | Lagring av ulastede dokumenter i localStorage                                         | `teacher/ukebrev/page.tsx`                                                        |
| 65  | Manglende data-dialog                 | Lærer         | Inline opprettelse av klasser/fag som mangler fra AI-import                           | `MissingDataDialog.tsx`                                                           |
| 66  | Kostadsbaserte belønninger            | Lærer         | Ulike kostnadstyper: poeng, blomster, kronblader, nivå, oppmøte                       | `rewards`-tabell, `RewardForm.tsx`                                                |
| 67  | PWA-installasjon                      | Begge         | Manifest + service worker for standalone-opplevelse                                   | `manifest.json`, `sw.js`, `ServiceWorkerRegistration.tsx`                         |
| 68  | Tilbakemelding via push-reaksjon      | Lærer         | Klikk emoji på push-melding for umiddelbar feedback                                   | `sw.js`, `api/push/react`                                                         |
| 69  | Tom-tilstand-håndtering               | Begge         | Meningsfulle tomme tilstander med emojier og veiledning overalt                       | Alle sider                                                                        |
| 70  | Lasttilstander                        | Begge         | Spinnere, skjeletter og lasteindikator-meldinger                                      | Alle sider                                                                        |
| 71  | Feilhåndtering med toast              | Begge         | Norske feilmeldinger i toast-varsler                                                  | `useToast.ts`, `Toast.tsx`                                                        |
| 72  | Responsivt design                     | Begge         | Mobil-først med tilpasning til desktop via Tailwind breakpoints                       | Alle komponenter                                                                  |

---

## Del 6: Ting som ser uferdig eller planlagt ut

### 6.1 TODO-kommentarer i kode

| Sted                                   | Beskrivelse                                                                                                       | Status                                                                       |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `ClassesAccordion.tsx` (ca. linje 269) | `// TODO: Implement message class` — ingen handler implementert for å sende melding til klasse fra kontekstmenyen | Ikke implementert                                                            |
| `useTaskCompletion.ts` (ca. linje 238) | `// TODO: Implement reward claim logic` — dokumentert i HANDOVER_STATE.md                                         | Delvis løst (kuponger fungerer, men generell reward-purchasing er begrenset) |

### 6.2 Ufullstendige toggles

| Funksjon                                               | Problem                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `flowerGameEnabled`-toggle i `StudentSettingsCard.tsx` | UI-toggle rendres og responderer lokalt, men **lagrer aldri til databasen**. Ingen `flower_game_enabled`-kolonne i `student_profiles`. Dokumentert i CODE_AUDIT.md som «🟡 still TODO». `show_flower_garden` fungerer — det er `flowerGameEnabled` som er det separate, uferdige feltet. |

### 6.3 Ubrukte databasetabeller

| Tabell                    | Status                                                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `teacher_active_sessions` | Opprettet men **aldri lest fra eller skrevet til** i koden. Ingen queries funnet. Muligens planlagt for lærerøkt-sporing. |

### 6.4 Ubrukte databasekolonner

| Tabell         | Kolonne              | Status                                                                           |
| -------------- | -------------------- | -------------------------------------------------------------------------------- |
| `task_library` | `usage_count`        | Aldri inkrementert eller lest. Planlagt for bruksstatistikk, aldri implementert. |
| `task_library` | `audio_url`          | Aldri skrevet. `audio_support_url` på `tasks`-tabellen brukes i stedet.          |
| `tasks`        | `quiz_content`       | Ser ut til å være erstattet av `quiz_data`. Begge eksisterer.                    |
| `tasks`        | `estimated_duration` | Aldri satt i UI; ingen tidsestimater vises til eleven.                           |

### 6.5 Tom funksjon

| Funksjon            | Fil                                              | Problem                                                                                  |
| ------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `handleTaskCreated` | `teacher/students/[id]/page.tsx` (ca. linje 259) | Tomt funksjonskropp — skal oppdatere oppgavelisten etter ny oppgave, men gjør ingenting. |

### 6.6 Arkitektoniske begrensninger / teknisk gjeld

| Element                              | Beskrivelse                                                                                             |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| **Usynlig e-post-hack**              | Elevbrukernavn utvides til `@skole.klar.app` — workaround for at Supabase Auth krever e-post            |
| **Klartekstpassord**                 | `current_password_plaintext` i `student_profiles` — bevisst valg for unge brukere, men sikkerhetsrisiko |
| **Statisk XP-terskel**               | 1000 XP per nivå uten eskalering — aldri endret via UI eller konfig                                     |
| **Ingen bruker-synlig passordbytte** | Kun lærer kan resette passord; elev har ikke tilgang                                                    |

### 6.7 Funksjonalitet som finnes i backend men mangler fullstendig UI

| Funksjon                                 | Backend-status                    | Frontend-status                                                                              |
| ---------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------- |
| Daglige meldinger (daily_announcements)  | RPC + tabell + RLS komplett       | Lærer-UI for sending er implementert (/teacher/messages); elevvisning kun via WelcomeOverlay |
| Ukentlige oppdateringer (weekly_updates) | Tabell eksisterer                 | Leses i elevens timeplan, men ingen lærer-UI for å opprette                                  |
| Belønningskjøp (reward claim)            | `student_rewards`-tabell fungerer | Kun via nivåopprykk-modal; ingen «butikk» for å kjøpe med poeng                              |

### 6.8 Planlagte men aldri implementerte funksjoner (basert på kodestruktur)

- **Ledertavle**: Ingen kode, ingen databasestruktur — aldri planlagt i koden
- **Sjekkpunkter/merker**: Ingen badge-/achievement-system utover bloom og streaks
- **Kommunikasjon elev ↔ lærer**: Ingen meldingssystem utover daglige meldinger og push-reaksjoner
- **Statistikkdashboard for lærer**: Ingen grafer eller visualiseringer; kun aktivitetslogg
- **Lærernotifikasjoner ved elevfullføring (in-app)**: Kun push-basert, ingen in-app-notifikasjonsliste
- **Ekstern linking**: Ingen mulighet for å legge til lenker til læringsresurser i oppgaver
