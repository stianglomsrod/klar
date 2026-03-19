# PROJECT DNA — Klar Education Platform

> **Purpose:** This file is the persistent knowledge base for any AI agent or developer taking over this project. Read this first before making any changes.

---

## 1. Tech Stack Snapshot

| Layer             | Technology                               | Version                       |
| ----------------- | ---------------------------------------- | ----------------------------- |
| **Framework**     | Next.js (App Router)                     | 16.1.1                        |
| **React**         | React + ReactDOM                         | 19.2.3                        |
| **Language**      | TypeScript                               | ^5                            |
| **Styling**       | Tailwind CSS                             | ^3.4.17                       |
| **Animation**     | Framer Motion                            | ^12.23.26                     |
| **Icons**         | Lucide React                             | ^0.562.0                      |
| **UI Primitives** | Radix UI (Popover, AlertDialog)          | latest                        |
| **Backend / DB**  | Supabase (Auth, Postgres + RLS, Storage) | @supabase/supabase-js ^2.89.0 |
| **Supabase SSR**  | @supabase/ssr                            | ^0.8.0                        |
| **Fonts**         | Geist + Geist Mono (next/font/google)    | —                             |
| **Table**         | @tanstack/react-table                    | ^8.21.3                       |
| **Date**          | date-fns                                 | ^4.1.0                        |
| **Confetti**      | canvas-confetti + react-confetti         | latest                        |
| **Class Merge**   | clsx + tailwind-merge                    | latest                        |
| **AI / LLM**      | Google Generative AI (Gemini 2.5 Flash)  | latest                        |
| **Doc Parsing**   | Mammoth (.docx → text)                   | latest                        |

### Environment Variables (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=<supabase-project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
GEMINI_API_KEY=<google-gemini-api-key>
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<vapid-public-key>
VAPID_PRIVATE_KEY=<vapid-private-key>
PUSH_REACT_SECRET=<shared-secret-for-hmac-reaction-tokens>
SUPABASE_SERVICE_ROLE_KEY=<supabase-service-role-key>
SEED_SECRET=<optional-secret-for-seed-endpoint>
```

### Scripts

```bash
npm run dev    # next dev
npm run build  # next build
npm run start  # next start
npm run lint   # eslint
```

---

## 2. Core Architecture

### 2.1 App Router Structure

```
src/app/
├── layout.tsx          # Root: lang="nb", Geist fonts
├── page.tsx            # Landing / redirect
├── globals.css         # Tailwind base + custom styles
│
├── (auth)/             # Auth route group
│   ├── layout.tsx
│   └── login/page.tsx
│
├── (dashboard)/        # Dashboard route group
│   ├── student/        # Student dashboard (layout, page, fag/, timeplan/)
│   │   ├── lesson/[id]/page.tsx   # Container B — session-scoped tasks
│   │   └── timeplan/page.tsx      # Weekly schedule view (swipeable days / 5-col grid)
│   └── teacher/        # Teacher dashboard (layout, page, classes/, messages/,
│                       #   rewards/, students/[id]/, tasks/, timeplan/, ukebrev/)
│
├── actions/            # Server Actions
│   ├── student-actions.ts  # createStudent, resetStudentPassword, updateStudentClass
│   └── parse-weekly-plan.ts  # AI-powered .docx → structured JSON (Gemini + Mammoth)
│   └── save-weekly-plan.ts   # Class/subject normalization, hybrid splitting, auto-create flow, saves to DB
│
├── api/seed/route.ts   # Seed data endpoint (dev-only, X-Seed-Secret guarded)
├── api/push/            # Push notification API
│   ├── subscribe/route.ts  # Save teacher's PushSubscription to DB
│   ├── send/route.ts       # Send push to teacher on task completion (HMAC token)
│   └── react/route.ts      # Receive emoji reaction from SW (HMAC-verified, emoji-validated)
├── belonninger/        # Rewards pages (garden, coupons)
│   ├── layout.tsx, page.tsx, hage/, kuponger/
│
└── subject/            # Container A — global subject library
    ├── layout.tsx
    └── [id]/page.tsx   # ~746 lines — all tasks for a subject (refactored Phase A)
```

### 2.2 Supabase Client Helpers

| File                            | Usage                                                                                   |
| ------------------------------- | --------------------------------------------------------------------------------------- |
| `src/utils/supabase/client.ts`  | `createBrowserClient()` — used in all `"use client"` components                         |
| `src/utils/supabase/server.ts`  | `createServerClient()` — used in Server Components / Route Handlers                     |
| `src/utils/supabase/storage.ts` | `uploadStudentMedia(file, studentId, taskId, type)` — uploads to `student-media` bucket |

### 2.3 Contexts

**`StudentProfileContext`** (`src/contexts/StudentProfileContext.tsx`)

- Provides `StudentProfile` type: `id`, `full_name`, `avatar_url`, `level`, `points_earned`, `current_goal_total`, `current_xp`, `petals_progress`, `flowers_collected`, `petal_colors`, `show_flower_garden`, `custom_welcome_message`, `class_id`, `max_level_reached`, `pending_reward_levels`, `completed_flower_colors`, `garden_positions`, `halfway_celebrated_level`, `streak_enabled`, `streak_mode`, `current_streak`, `longest_streak`, `last_login_date`, `attendance_reward_progress`
- Merges data from `profiles` + `student_profiles` tables
- Auto-creates `student_profiles` row if missing (PGRST116 error → insert)
- Exposes `refresh()` to re-fetch after XP updates

**`TeacherProfileContext`** (`src/contexts/TeacherProfileContext.tsx`)

- Similar pattern for teacher profile data

### 2.4 Hooks

| Hook                  | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useTTS`              | Browser-native Text-to-Speech via Web Speech API. Always speaks Norwegian Bokmål (`nb-NO`). Toggle: speak/stop. Rate 0.9, pitch 1.0.                                                                                                                                                                                                                                                                                               |
| `useTimeTracker`      | Tracks current schedule activity (lesson/break/free) based on `schedule_entries`. Returns `currentActivity`, `timeRemaining`, `progress`.                                                                                                                                                                                                                                                                                          |
| `useTaskCompletion`   | Centralised gamification hook: `completeTask(id, pts)` → XP, level-up detection, sound, profile refresh. Also: `undoTask`, `selectReward` (returns `RewardResult` with `isFlowerComplete`), `playSuccessSound`. Push notifications are debounced (2 s) at module level — rapid completions are batched into one notification (e.g., "3 oppgaver fullført"). Used internally by `useTaskFlow`.                                                                                                                                                                                  |
| `useTaskFlow`         | Shared task submission flow for Container A & B. Encapsulates media state, `handleConfirmCompletion`, `handleQuizSubmit`, quiz/modal state, reward selection. Delegates XP to `useTaskCompletion`.                                                                                                                                                                                                                                 |
| `useStudentProfile`   | Shorthand consumer of `StudentProfileContext`                                                                                                                                                                                                                                                                                                                                                                                      |
| `useTeacherProfile`   | Shorthand consumer of `TeacherProfileContext`                                                                                                                                                                                                                                                                                                                                                                                      |
| `useMediaQuery`       | CSS media query hook                                                                                                                                                                                                                                                                                                                                                                                                               |
| `useToast`            | Lightweight toast notification hook. Returns `{ toast, showToast, hideToast }` for non-blocking user feedback.                                                                                                                                                                                                                                                                                                                     |
| `useAttendanceStreak` | Attendance streak hook. Tracks daily login streaks, auto-grants `cost_type='attendance'` rewards every N streak days, computes nearest upcoming reward for StreakWidget popover, and triggers `StreakMilestoneModal` celebrations. Three effects: new-day streak increment, same-day mount reward check, nearest reward popover. Uses fingerprint-based deduplication and `upsert` with `ignoreDuplicates` for idempotent inserts. |

### 2.5 XP / Leveling System

- Students earn XP from completing tasks (`points_value`, default 10)
- `current_xp` accumulates toward `current_goal_total`
- When `current_xp >= current_goal_total` → level up, `LevelUpModal` shown, `current_goal_total` increases
- `max_level_reached` column tracks highest level ever reached (never decreases)
- `halfway_celebrated_level` column tracks which level's 50% milestone has already been celebrated (prevents double-firing). Reset when undo drops XP below 50%.
- **Reward Persistence:** `pending_reward_levels integer[]` on `student_profiles` tracks levels where a reward hasn't been claimed yet. Set atomically with the level-up in `completeTask`. Cleared when `selectReward` succeeds (via `forLevel` parameter). Cleaned up on `undoTask` demotion. Backdrop click is disabled on `LevelUpModal` to prevent accidental dismissal; the X button still works but the reward stays in the DB pending array. **Global Reward Awareness:** The reward claim UI lives in `StudentFooterWrapper`, which renders on every student page (dashboard, subject, rewards). A glowing/pulsing gift icon (🎁) appears in the footer bar when `pending_reward_levels` is non-empty. Clicking it opens `LevelUpModal` for `Math.min(...pendingLevels)`. After the reward is claimed, the icon disappears (or updates its badge count for multiple pending levels). This replaced the earlier `PendingRewardClaim` dashboard-only floating banner.
- Flower garden: 5-petal system where `petals_progress` (0–4) fills petals with colors from subject theme, `flowers_collected` increments on 5th petal. Painting the 5th petal triggers "The Bloom Moment" — a multi-stage celebration (canvas-confetti burst, FlowerPot bloom animation, rainbow "Ny blomst i hagen!" message) before auto-dismissing. **Flower Memory:** When a flower completes, its 5-color array is appended to `completed_flower_colors` (jsonb `string[][]`) before the active petals reset. This preserves every flower's unique color palette permanently. **The Living Meadow** (`/belonninger/hage`): Full-screen landscape with sky gradient, drifting clouds, rolling SVG hills, and a sun. Historical flowers from `completed_flower_colors` are organically scattered across the hills using deterministic pseudo-random positioning (no CSS grid). The current in-progress flower sits prominently in the foreground. Flowers gently sway and sparkle on tap. **Interactive Garden Sandbox (Operation Poio-Hage):** Each completed flower is draggable via Framer Motion `drag`. When a flower is repositioned, its percentage-based coordinates are persisted to Supabase `garden_positions` (jsonb, `Record<string, {x: number, y: number}>`). Flowers without a saved position fall back to the deterministic `getFlowerPlacement()` algorithm. This lets students arrange their garden however they like while new flowers still appear in natural-looking default positions.
- `selectReward` returns `RewardResult { success: boolean; isFlowerComplete: boolean }` — callers can detect flower completion

### 2.6 Subject Color System

- `src/utils/subject-colors.ts` — centralized palette mapping subject names to Tailwind color themes
- Norwegian subjects: Norsk → red, Matte → blue, Engelsk → orange, Samfunnsfag → amber, Naturfag → green, KRLE → purple, K&H → violet, Gym → rose, M&H → emerald
- All CSS classes explicitly defined (no dynamic template literals) to avoid Tailwind purge issues

---

## 3. Key Components — Detailed State

### 3.1 CompletionModal (`src/components/CompletionModal.tsx`)

The task submission confirmation overlay. Current props:

- `isOpen`, `onClose`, `onConfirm` — standard dialog controls
- `onBeforeConfirm?: () => Promise<void>` — async hook called before `onConfirm` (used for smart-stop of recordings). Shows `Loader2` spinner with "Lagrer..." while resolving.
- `avatarUrl?: string | null` — renders student avatar with **breathing animation** (`motion.div` → `scale: [1, 1.06, 1]`, 3s infinite)
- `warningMessage?: string` — amber warning box (e.g., "Du har 2 ubesvarte spørsmål")
- `children?: ReactNode` — slot for `MediaUploadToolbar` (centered via `flex justify-center`)

Button shows "Fullfør" with `Send` icon. No pulse/bounce animations — intentionally calm.

### 3.2 AudioRecorder (`src/components/ui/AudioRecorder.tsx`)

3-state audio recorder (idle → recording → playback) using `MediaRecorder` API.

- **Converted to `forwardRef`** — exposes `AudioRecorderHandle`:
  - `stopAndFinalize(): Promise<Blob | null>` — wraps `MediaRecorder.stop()` in a Promise resolving on `onstop` event
  - `isRecording: boolean`
- Uses `useImperativeHandle` to expose the handle
- Supports `compact` mode for per-question quiz layout
- MIME type detection: prefers `audio/webm`, falls back to `audio/mp4`

### 3.3 MediaUploadToolbar (`src/components/ui/MediaUploadToolbar.tsx`)

Toolbar with Audio + Camera + Gallery buttons.

- **Converted to `forwardRef`** — exposes `MediaUploadToolbarHandle`:
  - `stopRecordingIfActive(): Promise<Blob | null>` — delegates to `AudioRecorderHandle`
  - `isRecording: boolean`
- **Touch detection**: `useIsTouchDevice()` hook using `useState` initializer (checks `"ontouchstart" in window || navigator.maxTouchPoints > 0`)
- Camera routing: touch devices → native `<input capture="environment">` | desktop → `WebcamCapture` overlay
- **Conditional mount**: `{webcamOpen && <WebcamCapture />}` — avoids React 19 ref-during-render issues

### 3.4 WebcamCapture (`src/components/ui/WebcamCapture.tsx`)

Full-screen webcam overlay for desktop users.

- Uses `navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } })`
- Canvas snapshot: `toBlob("image/jpeg", 0.9)` → `new File()`
- Norwegian labels: "Ta bilde", "Ta nytt bilde", "Bruk bilde"
- `AnimatePresence` animations, proper cleanup with `cancelled` flag
- Error state: "Kunne ikke åpne kameraet. Sjekk tillatelsene i nettleseren."

### 3.5 StudentQuizView (`src/components/student/StudentQuizView.tsx`)

Full-screen quiz with:

- Navigation bubbles (answered/current/unanswered state)
- Per-question `AudioRecorder` (compact mode)
- `isAnswered()` checks `audioBlobs[questionId]` first — recording audio counts as answering
- Nav footer: `max-w-lg mx-auto w-full` (constrained center)
- "Lever" button: `shadow-md hover:shadow-lg hover:scale-[1.02]` (no colored shadows that get clipped)
- `CompletionModal` rendered at `z-[60]` with dynamic `warningMessage` for unanswered count

### 3.6 ActivityDetailSheet (`src/components/teacher/ActivityDetailSheet.tsx`)

Slide-out panel for teacher grading. ~554 lines.

- Width: `max-w-lg sm:max-w-[50vw]` (expands to 50% viewport on desktop)
- `useEffect` syncs `feedbackComment` from `activity.feedback.teacher_comment` on `activity.id` change
- Quick reactions: `["👍", "🌟", "💪", "🎉", "❤️", "🔥"]`
- Teacher feedback section: `bg-indigo-50/30` background
- Image display: `max-h-96`
- Return-task functionality via `AlertDialog` confirmation

### 3.7 Subject Page — Container A (`src/app/subject/[id]/page.tsx`)

Global subject library (~746 lines, refactored in Phase A). Shows **all tasks** for a subject regardless of schedule.

- Uses `useTaskCompletion()` hook for XP/leveling (extracted in Phase A)
- Uses `<SubjectProgress>` component for progress pill (extracted in Phase A)
- Uses `<TaskCard>` for individual task cards
- `mediaToolbarRef = useRef<MediaUploadToolbarHandle>(null)`
- `CompletionModal` receives:
  - `avatarUrl={profile?.avatar_url}`
  - `onBeforeConfirm` → calls `mediaToolbarRef.current?.stopRecordingIfActive()`
- `MediaUploadToolbar` receives `ref={mediaToolbarRef}`
- Handles both standard tasks and quizzes
- Archive modal for completed tasks with undo

### 3.8 Lesson Page — Container B (`src/app/(dashboard)/student/lesson/[id]/page.tsx`)

Session-scoped task view (~460 lines, built in Phase B). Shows **only tasks linked to a specific schedule entry** via the `task_schedule_entries` junction table.

- Data flow: `schedule_entries` → `task_schedule_entries` → `tasks`
- Reuses: `TaskCard`, `useTaskCompletion()`, `SubjectProgress`, `CompletionModal`, `LevelUpModal`, `StudentQuizView`, `MediaUploadToolbar`
- NO archive drawer (session view = focused on current tasks only)
- "Se alle [Fag]-oppgaver →" link to Container A (`/subject/[subjectId]`)
- Empty states: "Ingen oppgaver for denne timen" (zero tasks) vs "Gratulerer!" (all completed)
- Student dashboard (`/student`) links here via `router.push(/student/lesson/${entry.id})`

---

## 4. Imperative Handle Chain (Smart Submission)

The "smart stop" pattern ensures audio recordings are finalized before task submission:

```
CompletionModal.onBeforeConfirm (async)
  └── MediaUploadToolbar.stopRecordingIfActive()
        └── AudioRecorder.stopAndFinalize() → Promise<Blob | null>
              └── MediaRecorder.stop() → onstop → resolve(blob)
```

Each layer uses `forwardRef` + `useImperativeHandle`. The `CompletionModal` shows a `Loader2` spinner with "Lagrer..." during the `onBeforeConfirm` Promise.

---

## 5. Database Schema (Supabase Postgres)

### Enum Types

- `user_role`: `'teacher'` | `'student'`
- `task_type`: `'standard'` | `'quiz'`
- `reward_cost_type`: `'flowers'` | `'petals'` | `'points'` | `'level'` | `'attendance'`
- `schedule_type`: `'lesson'` | `'break'` | `'activity'`

### Tables

| Table                      | Purpose                            | Key Columns                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`                 | All users (linked to `auth.users`) | `id`, `full_name`, `role`, `avatar_url`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `student_profiles`         | Student-specific data              | `id` → profiles, `class_id`, `level`, `current_xp`, `current_goal_total`, `points_earned`, `petals_progress`, `flowers_collected`, `petal_colors[]`, `completed_flower_colors` (jsonb), `max_level_reached`, `halfway_celebrated_level`, `pending_reward_levels[]`, `garden_positions` (jsonb — `Record<string, {x: number, y: number}>`, percentage-based flower coordinates), `streak_enabled` (bool), `streak_mode` (`classic`/`accumulated`), `current_streak`, `longest_streak`, `last_login_date`, `attendance_reward_progress` (jsonb — `Record<reward_id, { baseline, last_granted_at }>`) |
| `classes`                  | School classes                     | `name`, `grade_id`, `is_queue_open`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `grades`                   | School grades (trinn)              | `name`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `subjects`                 | School subjects                    | `title` (UNIQUE), `emoji`, `color_theme`, `created_by`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `tasks`                    | Assigned tasks                     | `student_id`, `created_by`, `title`, `description`, `is_completed`, `type` (standard/quiz), `quiz_data` (jsonb), `audio_support_url`, `points_value`, `subject_id`, `task_library_id`, `completed_at`                                                                                                                                                                                                                                                                                                                                                                                              |
| `feedback`                 | Task submissions                   | `task_id` (UNIQUE), `student_id`, `student_comment`, `student_audio_url`, `student_image_url`, `quiz_responses` (jsonb), `teacher_reaction`, `teacher_comment`                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `task_library`             | Reusable task templates            | `title`, `description`, `subject_id`, `grade_level`, `type`, `quiz_data`, `audio_url`, `usage_count`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `schedule_entries`         | Weekly schedule slots              | `class_id`/`student_id`, `subject_id`, `day_of_week` (1-7), `start_time`, `end_time`, `type`, `week_number`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `task_schedule_entries`    | Links tasks ↔ schedule             | `task_id`, `schedule_entry_id`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `rewards`                  | Teacher-created rewards            | `title`, `emoji`, `cost_value`, `cost_type`, `specific_student_ids[]`, `created_by`, `is_recurring`, `max_uses` (null=unlimited, int=limit per student)                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `student_rewards`          | Earned/redeemed rewards            | `student_id`, `reward_id`, `is_redeemed`, `earned_at_level` (**dual-purpose**: player level for regular rewards, streak day number for `attendance` rewards). UNIQUE constraint on `(student_id, reward_id, earned_at_level)`.                                                                                                                                                                                                                                                                                                                                                                     |
| `help_requests`            | Student help queue                 | `student_id`, `class_id`, `status` (pending/in_progress/resolved/cancelled)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `daily_announcements`      | Targeted messages                  | `target_type` (student/class/grade), `target_id`, `content`, `display_date`, `message_type`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `teacher_active_sessions`  | Active monitor sessions            | `teacher_id`, `class_id`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `weekly_updates`           | Weekly content updates             | `week_number`, `content_text`, `audio_url`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `push_subscriptions`       | Push notification config           | `user_id`, `subscription_data`, `device_type`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `student_teacher_settings` | Per-pair settings                  | `student_id`, `teacher_id`, `push_enabled`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

### RPC Functions

- `get_student_schedule(p_student_id, p_current_week_number)` — returns schedule with task counts
- `get_student_daily_announcement(p_student_id)` — cascade lookup: student → class → grade
- `link_student_to_class_structure(p_student_id, p_class_name, p_grade_name)` — upsert grade/class, link student

### Storage Bucket

- **`student-media`** — stores student uploads
- Path format: `{studentId}/{taskId}/{type}_{timestamp}.{ext}`
- Upload helper: `src/utils/supabase/storage.ts`

---

## 5b. Security Boundary

### Middleware (`src/middleware.ts`)

Next.js middleware enforces role-based access control at the edge:

- **Teacher routes** (`/teacher/*`): Requires authenticated user with `profiles.role = 'teacher'`. Students are redirected to `/student`. Unauthenticated users are redirected to `/login`.
- **Teacher API routes** (`/api/push/subscribe`, `/api/seed`): Same role check; returns 401/403 JSON instead of redirects.
- **Public paths** (`/login`, `/api/push/react`, `/api/push/send`): Bypass middleware entirely.
- **Student routes** (`/student/*`, `/subject/*`, `/belonninger/*`): No middleware restriction (rely on application-level `student_id` scoping).

### Seed API Protection

`/api/seed` has two layers of protection:

1. `NODE_ENV` must be `"development"` — blocked in production builds.
2. `X-Seed-Secret` header must match `SEED_SECRET` env var (if set).

Passwords and student emails are no longer exposed in API responses.

### Push Notification Security (HMAC Tokens)

The push reaction flow uses **per-notification HMAC tokens** instead of a shared secret:

1. `push/send` computes `HMAC-SHA256(PUSH_REACT_SECRET, taskId:studentId)` → `reactionToken`
2. The token (not the secret) is embedded in the push payload
3. The SW sends `reactionToken` via `X-Reaction-Token` header
4. `push/react` recomputes the HMAC and uses `timingSafeEqual` to verify
5. Reaction emoji is validated against the 4 allowed values (`👍 🌟 💪 🎉`)

The master `PUSH_REACT_SECRET` never leaves the server.

### Push UX Polish

- **Icons:** Notifications use branded `/icon.svg` (192 × 192 indigo "K" roundrect) and `/badge.svg` (72 × 72 monochrome version). Manifest also references `/icon.svg`.
- **Deep Link:** Tapping a notification body navigates to `/teacher/students/${studentId}` (or falls back to `/teacher` if ID is missing). Existing windows are navigated + focused; otherwise a new window is opened.
- **Debounce:** Client-side 2-second debounce in `useTaskCompletion` batches rapid completions. If a student finishes 3 tasks within 2 s, the teacher receives one notification with body "3 oppgaver fullført" instead of three separate ones.

---

## 6. Persistent Rules

### 6.1 React 19 Strictness

React 19.2.3 enforces stricter rules than React 18:

- **No `setState` in side-effect-like patterns during render** — use `useEffect` or `useState` initializer
- **No ref access during render** — refs must only be read in effects/callbacks
- **Conditional mounting** to avoid ref-during-render: `{condition && <Component />}` instead of passing `isOpen` prop and reading refs internally

### 6.2 Language & Locale

- All user-facing text is in **Norwegian Bokmål (nb)**
- `<html lang="nb">` in root layout
- TTS uses `nb-NO` / `no-NO` voices
- Button labels: "Fullfør" (Submit), "Avbryt" (Cancel), "Ta bilde" (Take photo), "Bruk bilde" (Use photo), etc.

### 6.3 Tailwind Class Safety

- **Never use dynamic template literals** for Tailwind classes (e.g., `` `bg-${color}-500` ``)
- All color variants must be explicitly written so Tailwind's CSS purge retains them
- See `src/utils/subject-colors.ts` for the pattern

### 6.4 Supabase Client Patterns

- **Client (browser):** `import { createClient } from "@/utils/supabase/client"` — uses `createBrowserClient`
- **Server:** `import { createClient } from "@/utils/supabase/server"` — uses `createServerClient` with cookie handling
- All DB calls should use RLS-aware clients (never bypass RLS in application code)

### 6.5 File Organization

- `"use client"` directive on every interactive component
- Components that need `forwardRef` use `forwardRef(function ComponentName(...) { })` pattern
- Imperative handles exported as named types (e.g., `AudioRecorderHandle`, `MediaUploadToolbarHandle`)
- UI primitives in `src/components/ui/`
- Teacher-specific components in `src/components/teacher/`
- Student-specific components in `src/components/student/`
- Shared components in `src/components/shared/`

### 6.6 Documentation Maintenance

When making structural changes, always update:

1. **`FILE_TREE.md`** — if files are added/removed/moved
2. **`supabase/schema.sql`** — if schema changes (this file is for context, not execution)
3. **This file (`PROJECT_DNA.md`)** — if architecture or key patterns change
4. Create a **migration file** in `supabase/migrations/` for any schema changes (naming: `YYYYMMDD######_description.sql`)

### 6.7 Build Checks

- **Do not run** manual build checks (like `npx tsc --noEmit`, `next build`, or similar) **unless** the user explicitly instructs you to exercise extreme caution or gentleness during complex refactoring.
- The developer runs the dev server locally and handles build monitoring.
- Focus purely on code implementation.

### 6.8 Summary Format

Every end-of-turn summary must be delivered inside a **single markdown code block** (` ```markdown ... ``` `) for easy copy-pasting. Rules:

- Use **nested bullet points only** — no tables
- Include: **Created/Modified files**, **SQL migration code**, and **Key logic changes**
- Keep the block self-contained so it can be pasted directly into a changelog or PR description

### 6.9 Rule Change Protocol

- Any future changes to the Persistent Rules (this section 6) **MUST** be immediately updated in this file (`PROJECT_DNA.md`).
- Whenever `PROJECT_DNA.md` is modified, the exact changes must be clearly detailed in the end-of-turn summary so the user is fully aware of updated operating parameters.

### 6.10 Migration File Policy

- **Never run migrations directly.** Only create migration files in `supabase/migrations/` for the user to run manually.
- If a migration file is created, **always flag it in the end-of-turn summary** with a clear reminder (e.g., "⚠️ Migration pending — run `20260224XXXXXX_description.sql` manually").
- The "Tech Lead" AI must be prompted to remind the user to apply pending migrations.

### 6.11 Tech Lead Schema Communication

- When migration files are created, the end-of-turn summary must include enough detail about the schema change (table/column/RPC affected, old vs new behavior) so the "Tech Lead" AI can update its own shadow database reference in persistent memory.
- Include the full SQL in the summary block so the Tech Lead AI has a self-contained reference.

### 6.12 Autonomous Discretion & Reporting

- The agent is empowered to make autonomous architectural, structural, or implementation decisions if it discovers a better approach than what is strictly prompted (since the agent possesses the actual codebase context).
- However, any deviation from the prompt or significant autonomous decision **MUST** be thoroughly documented and justified in a dedicated section of the output summary.

### 6.13 Tech Debt Ledger Maintenance

- You must actively maintain and update `CODE_AUDIT.md` and `TECH_DEBT.md`.
- Whenever technical debt is introduced, resolved, or discovered during a session, you must autonomously update these ledgers to reflect the real-time state of the codebase.
- Expedition completion status, bug-fix resolutions, and dead-code removals must all be recorded in the appropriate ledger immediately upon completion.

---

## 7. Component Inventory — Quick Reference

### Layout & Navigation

- `ConditionalLayout.tsx` — layout wrapper with conditional rendering
- `Navigation.tsx` — navigation bar
- `Sidebar.tsx` — desktop sidebar
- `StudentFooter.tsx` + `StudentFooterWrapper.tsx` — mobile bottom navigation. Includes **Flower Teaser**: a miniature `FlowerPot` (44px) showing the current petal progress, linking to `/belonninger/hage`. Only visible when `show_flower_garden` is true. Bounces on petal change. Five dot indicators below show filled/unfilled petals. Also includes **StreakWidget** (fire icon + streak count + reward progress popover) in the footer bar. `StudentFooterWrapper` orchestrates `StreakMilestoneModal` (waits for `WelcomeOverlay` dismissal via `welcomeDismissed` event before showing).
- `PaintBrushCursor.tsx` — decorative cursor effect

### Student Experience

- `SubjectCard.tsx` — subject grid cards on student dashboard
- `TaskCard.tsx` — individual task cards (TTS, points badge, quiz/standard button). Used by both Container A & B.
- `SubjectProgress.tsx` — reusable progress pill (X/Y with color-themed fill). Used by both Container A & B.
- `ScheduleCard.tsx` — reusable lesson card for fisheye dashboard (emoji, title, time, MissionChip, progress ring)
- `MissionChip.tsx` — task-completion pill (e.g. "2/4"), green when all complete
- `LessonProgress.tsx` — circular SVG progress ring for active lessons
- `CompletionModal.tsx` — task submission confirmation
- `LevelUpModal.tsx` — level-up celebration overlay with 3-step flow: celebration → colorPicker (paint studio) → bloom (flower completion celebration with canvas-confetti + rainbow text + auto-dismiss)
- `HalfwayModal.tsx` — 50% XP milestone celebration overlay with reward teasers, fastest-path task suggestions, and confetti. Triggered once per level via `halfway_celebrated_level` column.
- `WelcomeOverlay.tsx` — welcome screen with daily announcement
- `FlowerPot.tsx` — visual flower/petal XP display with per-petal splash/shake/breathing animations and multi-stage bloom animation (`isBloomAnimating` prop: petals burst → center glow → shrink+float)
- `StudentHelpButton.tsx` — help request trigger
- `StudentQuizView.tsx` — full quiz experience
- `FeedbackBubble.tsx` — messenger-style teacher feedback display with TTS
- `FeedbackSheet.tsx` — "Wall of Praise" sliding sheet; fetches all feedback with subject/task context, renders FeedbackBubble cards, auto-marks as read
- `AvatarPickerModal.tsx` — curated emoji avatar selector (portal + Framer Motion), saves to profiles.avatar_url, refreshes via StudentProfileContext
- `ArchiveDrawer.tsx` + `ResponsiveArchive.tsx` — completed task archive
- `WeeklyLetterCard.tsx` — read-only card rendering the weekly letter (`content_text` from `weekly_updates`); parses `--- Section ---` markers into Beskjeder / Læringsmål / Lekser sections with color-coded headers

### Teacher Experience

- `ActivityDetailSheet.tsx` — grading slide-out panel (50vw desktop)
- `WeeklyScheduleEditor.tsx` — schedule management
- `CreateTaskButton.tsx` + `CreateTaskModal.tsx` (~850L) — 2-step wizard task creation (Step 1: Innhold, Step 2: Tildeling) with step indicator pills; edit mode uses single-step view. Composes QuizBuilder, RecipientPicker, SchedulePicker. Supports **recurring tasks** via progressive disclosure checkbox ("Gjenta denne oppgaven hver uke", visible only when schedule entries are selected): recurring mode links to masterplan `week_number=0` entries; single-week mode (default) links to specific-week entries, cloning/upserting from masterplan if needed.
- `QuizBuilder.tsx` — card-based quiz builder with expandable question cards, pill-button answer type selector (Tekstsvar / Flervalg én riktig / Flervalg flere riktige), visual radio/checkbox indicators, and explicit "+ Legg til alternativ" button
- `RecipientPicker.tsx` — class/student selection with search, grouping, auto-scroll (`forwardRef` with `getSelectedStudentIds()` handle)
- `SchedulePicker.tsx` — week navigation + schedule entry selection Popover (`forwardRef` with `getSelectedEntryIds()`, `getSelectedEntries()`, and `getViewingWeek()` handles; `onSelectionChange` callback for parent notification). Chips display "Mandag 08:30 Norsk" format.
- `StudentTable.tsx` — student list with data table
- `ClassesAccordion.tsx` — class management accordion
- `ClassMonitorToggle.tsx` — live monitoring toggle
- `HelpRequestQueue.tsx` — help request management
- `EditStudentSheet.tsx` — student profile editing
- `AddStudentModal.tsx` — student creation modal with class combobox + generated passwords
- `PreviewScheduleGrid.tsx` — visual timetable grid for AI-parsed weekly plan preview (click-to-edit cards, Pencil hover icon)
- `TeacherSidebar.tsx` — teacher-specific sidebar
- `StudentRewardManager.tsx` — reward assignment modal (list view only) + shared `RewardForm` for creation; fetches live reward data with `.order("created_at", { ascending: false })`
- `TaskAssignmentsSheet.tsx` — slide-out sheet showing all students assigned a task from the library; displays avatar, name, completion status (CheckCircle2/Clock), teacher reaction, and time info; rows navigate to `/teacher/students/[id]`
- `ClassCombobox.tsx` — class search + create with grade inference, Popover-based
- `BulkStudentAssignModal.tsx` — multi-select modal for assigning students to a class (search, checkboxes, batch updateStudentClass)
- `StudentPasswordCard.tsx` — password reset/copy/show-hide card
- `StudentSettingsCard.tsx` — settings card with toggles + welcome message

### UI Primitives

- `AudioRecorder.tsx` — 3-state audio recorder with forwardRef
- `MediaUploadToolbar.tsx` — combined media toolbar with forwardRef
- `WebcamCapture.tsx` — desktop webcam overlay
- `TTSButton.tsx` — text-to-speech trigger button
- `CircularProgress.tsx` — circular progress indicator
- `color-picker-grid.tsx` — color selection grid
- `emoji-picker.tsx` — emoji picker wrapper
- `time-picker.tsx` — time input component
- `alert-dialog.tsx` — Radix AlertDialog wrapper
- `edit-dialog.tsx` — Reusable edit dialog (Portal + Framer Motion, controlled open/close/save)
- `button.tsx` — button primitive
- `dropdown-menu.tsx` — dropdown menu
- `popover.tsx` — Radix Popover wrapper
- `switch.tsx` — toggle switch

### Rewards

- `StreakWidget.tsx` (`src/components/student-footer/`) — fire icon with current streak count in the student footer; Popover shows nearest attendance reward progress (emoji, title, X/Y days)
- `StreakMilestoneModal.tsx` — celebration overlay with confetti when attendance rewards are earned; shows earned reward emoji/title list; coordinated via `pendingMilestoneCelebration` from `useAttendanceStreak`
- `CouponCard.tsx` — reward/coupon display card with ticket-style perforation dots; redeemed cards show pastel gradients at reduced opacity with an emerald "✅ Innløst" pill (no stamp overlay). Attendance rewards (`cost_type='attendance'`) bypass the level-lock check since `earned_at_level` stores streak day, not player level.

---

## 8. Migration History

| Migration        | Description                                                                                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `20260102000000` | Add emoji column to rewards                                                                                                                                 |
| `20260102000001` | Add rewards RLS policies                                                                                                                                    |
| `20260102000002` | Add delete_reward RPC                                                                                                                                       |
| `20260112000000` | Add get_student_schedule RPC                                                                                                                                |
| `20260121000000` | Fix get_student_schedule task counts                                                                                                                        |
| `20260220000000` | Add task_library RLS policies                                                                                                                               |
| `20260220000001` | Rewards multi-student support                                                                                                                               |
| `20260221000001` | Activity feed updates                                                                                                                                       |
| `20260221000002` | Add quiz and media support                                                                                                                                  |
| `20260221000003` | Add feedback task unique constraint                                                                                                                         |
| `20260222000000` | Add earned_at_level to student_rewards                                                                                                                      |
| `20260222000001` | Add max_level_reached column                                                                                                                                |
| `20260222000002` | Create student-media storage bucket                                                                                                                         |
| `20260222100000` | Add teacher_id & read_at to feedback                                                                                                                        |
| `20260222200000` | Add current_password_plaintext column                                                                                                                       |
| `20260228000000` | Add class unique constraint + UPDATE RLS                                                                                                                    |
| `20260228000001` | Add DELETE RLS policy for classes table                                                                                                                     |
| `20260301000002` | Unique constraint on student_rewards                                                                                                                        |
| `20260301000003` | Add pending_reward_levels column                                                                                                                            |
| `20260301000004` | Add completed_flower_colors jsonb column                                                                                                                    |
| `20260301000005` | Add garden_positions jsonb column to student_profiles                                                                                                       |
| `20260301000006` | Fix student RLS policies (profiles, student_profiles, subjects)                                                                                             |
| `20260301000007` | Hotfix: profiles RLS infinite recursion → `is_teacher()` helper                                                                                             |
| `20260301000008` | Add `max_uses` column to rewards (null=unlimited, int=per-student limit)                                                                                    |
| `20260301000009` | Add `halfway_celebrated_level` column to student_profiles (50% milestone tracking)                                                                          |
| `20260318100000` | Attendance reward pivot: add `'attendance'` to `reward_cost_type` enum, drop `streak_stars`/`last_streak_milestone`, add `attendance_reward_progress` jsonb |

---

## 9. Known Patterns & Gotchas

1. **`forwardRef` chain is critical** — `AudioRecorder` → `MediaUploadToolbar` → (consumed in `subject/[id]/page.tsx`). Don't break this chain or smart-stop breaks.

2. **Touch detection is stateful** — `useIsTouchDevice` uses `useState` initializer (not `useEffect`) to avoid React 19 hydration issues. The value is computed once on mount.

3. **`student_profiles` auto-creation** — `StudentProfileContext` handles the case where a profile row doesn't exist (PGRST116 error) by inserting a default row. This means the app doesn't crash for new students.

4. **quiz_data is jsonb** — Both `tasks.quiz_data` and `task_library.quiz_data` store quiz questions as JSON. The shape is `QuizQuestion[]` where each has `id`, `text`, `answerType` (text/radio/checkbox), and `options[]`.

5. **feedback.task_id is UNIQUE** — Each task can have at most one feedback row. This is enforced at the DB level.

6. **Petal colors are an array** — `petal_colors` is `text[]` with 5 elements, defaulting to `#E0E0E0` (gray). Each completed task fills the next petal with the subject's theme color. On flower completion, the 5-color array is appended to `completed_flower_colors` (jsonb) before `petal_colors` resets to `[]`.

7. **Animations are intentionally calm** — No pulse/bounce. The avatar uses a slow breathing scale (`[1, 1.06, 1]` over 3s). This is a deliberate UX decision for the target audience (children).

8. **All state is Supabase** — No local database, no Redux, no external state management. Everything persists via Supabase queries. Context providers cache in-memory for the session only.

9. **Global unread feedback badge + FeedbackSheet** — `Navigation.tsx` polls `feedback` table every 30s for unread teacher feedback (`read_at IS NULL`). Clicking the 💬 badge opens `FeedbackSheet.tsx` (sliding sheet from right) which lists all teacher feedback grouped by subject/task. The sheet auto-marks unread items as read after 2 s and dispatches `window.dispatchEvent(new Event("feedback-read"))` to clear the badge instantly.

10. **Tech Debt Rule** — Any "hack", workaround, or intentional technical debt **MUST** be documented immediately in `TECH_DEBT.md` at the project root. This includes invisible emails, plaintext passwords, or any shortcut that deviates from best practices.

11. **Dual containers — route awareness** — Schedule blocks link to `/student/lesson/[id]` (session-scoped via `task_schedule_entries`). Subject cards link to `/subject/[id]` (global by `subject_id`). Never conflate these routes — they serve different data contexts.

12. **Server Actions for auth mutations** — Creating students, resetting passwords, and updating classes **MUST** use the admin client (`SUPABASE_SERVICE_ROLE_KEY`) via `src/app/actions/student-actions.ts` to avoid logging out the active teacher session.

13. **Class & subject normalization** — `save-weekly-plan.ts` normalizes both class names (`normalizeClassName`: strip non-alphanumeric → uppercase, e.g. "7 a" → "7A") and subject names (`splitAndNormalizeSubject`: alias dictionary + `/`/`og` splitting, e.g. "Nor/bib" → ["Norsk","Bibliotek"]). Hybrid subjects use the first part's `subject_id` and store the full joined name in `custom_title`. If missing classes or subjects are found, the frontend shows an AlertDialog offering to auto-create them before retrying.

14. **Masterplan auto-creation (week_number=0)** — `WeeklyScheduleEditor` fetches `week_number=0` as fallback and `week_number=N` as primary. Entries from the primary query that don't exist in the fallback get `isFallback=false` → displayed with an "Endret" badge. To prevent false badges on first import, `save-weekly-plan.ts` section 6a auto-creates `week_number=0` duplicates for any class that lacks masterplan entries. This is non-blocking — if the masterplan insert fails, the week entries are still saved.

15. **Three student schedule views** — The daily dashboard (`/student`) uses fisheye scroll with `ScheduleCard`. The weekly Timeplan page (`/student/timeplan`) reuses the same `get_student_schedule` RPC but shows all 5 weekdays (swipeable on mobile, 5-col grid on desktop). Both use `formatTime()` and `getSubjectTheme()` from centralized utilities. Lesson clicks route to `/student/lesson/[id]` in both views.

16. **Centralized color system** — `subject-colors.ts` exports `ColorClasses` (12 properties incl. `borderAccent`, `shadowRgb`), `getSubjectTheme()`, and `COLOR_MAP` with 22 Tailwind themes. All schedule cards, progress rings, and glow effects derive colors from this single map. Never duplicate color lookups.

17. **Garden layout is deterministic** — `getFlowerPlacement()` in `/belonninger/hage/page.tsx` uses index-based `Math.sin`/`Math.cos` to compute stable positions, sizes, and rotations for garden flowers. This avoids layout shift on re-renders. Flowers further "back" (higher `y%`) render smaller for a perspective effect, and `zIndex` is derived from `y` so nearer flowers overlap farther ones.

18. **Attendance rewards — `earned_at_level` dual-purpose** — For regular rewards (`cost_type='flowers'|'petals'|'points'|'level'`), `earned_at_level` stores the player level when earned. For attendance rewards (`cost_type='attendance'`), it stores the **streak day number** when the grant occurred. This makes each grant unique under the `UNIQUE(student_id, reward_id, earned_at_level)` constraint. The kuponger page bypasses the `isLocked` level check when `cost_type === 'attendance'`.

19. **Attendance reward progress tracking** — `attendance_reward_progress` (jsonb on `student_profiles`) stores `Record<reward_id, { baseline, last_granted_at }>` where `baseline` is the streak when first observed and `last_granted_at` is the streak day of the most recent grant. On streak reset (`current_streak < last_granted_at`), `baseline` re-initializes to current streak. Rewards with `specific_student_ids` use a three-way `.or()` filter: `is.null`, `eq.{}`, `cs.{id}` to match both NULL and empty arrays.

20. **Attendance rewards are filtered from level-up** — `useAvailableRewards` excludes `cost_type='attendance'` rewards from the `LevelUpModal` picker so students only see regular rewards when leveling up. Attendance rewards are granted automatically via `useAttendanceStreak`.
