# HANDOVER STATE — Klar Education Platform

> **Generated:** 2026-02-25  
> **Purpose:** Comprehensive session handover for any AI agent or developer picking up development tomorrow. Read `PROJECT_DNA.md` first for persistent rules, then this file for current state.

---

## 1. Project Overview

**Klar** is a Norwegian primary school education platform (grades 1–7, ages 6–12). It runs as a Next.js 16.1.1 PWA with Supabase as the backend (Auth, Postgres + RLS, Storage). All user-facing text is in **Norwegian Bokmål**.

### Core Mechanics

- **Teachers** manage classes, create tasks, build weekly schedules (manually or via AI-powered `.docx` import), and grade student submissions.
- **Students** see a daily "quest log" dashboard (fisheye scrollable schedule), open tasks within time-slots, submit work (text, audio, images, quizzes), and earn XP/levels/flower petals.
- **Gamification:** XP points → level ups → flower petal system → reward shop. `useTaskCompletion` hook centralizes all XP/leveling logic.
- **AI Integration:** Teachers upload Word documents → `parseWeeklyPlan` (Mammoth + Gemini 2.5 Flash) extracts structured schedules and lesson plans → previewed → saved to Supabase.

---

## 2. Current Architecture

### Teacher vs. Student Epics

| Epic | Route Prefix | Layout | Key Pages |
|------|-------------|--------|-----------|
| **Teacher** | `/teacher/*` | Fixed sidebar (264px desktop), hamburger drawer (mobile) | Dashboard, Classes, Tasks, Timeplan (schedule editor), Ukebrev/Planer (doc upload), Rewards, Messages, Students/[id] |
| **Student** | `/student/*` + `/` + `/belonninger/*` + `/subject/*` | Top nav (`Navigation.tsx`) + bottom footer (`StudentFooter.tsx`) | Daily dashboard (`/`), Subject library (`/student/fag`), Weekly timeplan (`/student/timeplan`), Lesson detail (`/student/lesson/[id]`), Rewards (`/belonninger`) |

### Routing & Component Reuse

- **Container A** (`/subject/[id]`): Global subject library — shows ALL tasks for a subject regardless of schedule.
- **Container B** (`/student/lesson/[id]`): Session-scoped — shows ONLY tasks linked to a specific schedule entry via `task_schedule_entries` junction table.
- Both containers reuse: `TaskCard`, `useTaskCompletion()`, `SubjectProgress`, `CompletionModal`, `LevelUpModal`, `StudentQuizView`, `MediaUploadToolbar`.
- **Three schedule views** share the same `get_student_schedule` RPC: daily dashboard (fisheye scroll), weekly timeplan (swipe/grid), and `useTimeTracker` (footer widget — BUT this one queries the raw table, not the RPC; see bugs).

### Key Data Flow

```
Teacher uploads .docx
       ↓
parseWeeklyPlan() [Server Action: Mammoth + Gemini 2.5 Flash]
  → Classifies document as "ukebrev" (newsletter) or "ukeplanlegger" (lesson planner)
  → Extracts structured JSON (schedule, goals, homework, tasks)
       ↓
Client receives ScheduleEntry[] or LessonPlanTask[]
  → Class mapping dialog (if multiple classes)
  → PreviewScheduleGrid / inline editing
       ↓
saveWeeklyPlan() [Server Action]
  → Normalizes class/subject names
  → Missing entity detection → auto-create or prompt
  → Inserts schedule_entries + weekly_updates
  → Optionally saves as masterplan (week_number = 0)
```

### Centralized Color System

`src/utils/subject-colors.ts` — 22 `SubjectTheme` variants, each with 12 `ColorClasses` properties (`base`, `light`, `border`, `text`, `textLight`, `gradient`, `icon`, `badge`, `hover`, `progress`, `borderAccent`, `shadowRgb`). All schedule cards, progress rings, and glow effects derive colors from this single map. **Never** use dynamic Tailwind template literals.

---

## 3. Completed Milestones (as of 2026-02-25)

### Teacher Epic — Complete

- Class management (accordion, student CRUD, generated passwords)
- Subject & task management (task library, quiz builder, audio support)
- Schedule editor (`WeeklyScheduleEditor` — masterplan vs. weekly modes, copy/edit/delete)
- AI document import (`.docx` → parse → preview → save flow for both ukebrev and ukeplanlegger)
- Student grading (`ActivityDetailSheet` — 50vw slide-out, quick reactions, return-task)
- Rewards system (create/manage rewards, per-student targeting, coupon cards)
- Messages (recipient selector, daily announcements)
- Help request queue (live monitoring toggle, realtime channel)
- "Planer" sidebar—renamed from "Ukebrev & Planlegging", icon changed to ClipboardList
- Onboarding guide added to teacher upload page (4 collapsible Norwegian info cards)

### Student Epic — Phase A & B Complete

- **Phase A:** Subject page (`/subject/[id]`) — refactored, extracted `SubjectProgress`, `useTaskCompletion` hook, archive drawer
- **Phase B:** Lesson page (`/student/lesson/[id]`) — session-scoped task view via `task_schedule_entries`

### Student PWA Refactoring — 5-Step Plan Complete

- **Step 1:** Fixed time formatting bug (Postgres `TIME→TEXT` produced "HH:MM:SS" → created `formatTime()` utility). Extracted `getISOWeekNumber()` and `getISODayOfWeek()` to `src/utils/week-number.ts`.
- **Step 2:** Extracted `ScheduleCard`, `MissionChip`, `LessonProgress` to `src/components/student/`. Added `borderAccent` and `shadowRgb` to all 22 COLOR_MAP entries. Refactored student dashboard from 727 → 462 lines.
- **Step 3:** Cleaned up student sidebar — removed broken `/ukebrev` link, fixed routes to `/student/timeplan`, removed unused `Mail` import.
- **Step 4:** Created full weekly Timeplan page at `/student/timeplan` (628 lines). Mobile: swipeable day tabs with Framer Motion drag gestures. Desktop (≥768px): 5-column grid. Day tabs with dot indicators: green (all tasks complete), indigo (today), white/gray (selected/other).
- **Step 5:** Added gamification: today's progress pill in header ("X/Y oppgaver fullført i dag" + celebration when 100%), "NÅ" pulse badge on active lessons, green dots on day tabs for complete days.

---

## 4. Current State & Identified Issues

### 4.1 Critical Bugs

#### BUG: `getLessonState()` uses `new Date()` instead of `currentTime` state
- **Files:** `src/app/(dashboard)/student/timeplan/page.tsx` (line 27–40), `src/app/(dashboard)/student/page.tsx` (line 218–228)
- **Impact:** The component state `currentTime` updates every 30s and drives re-renders, but `getLessonState()` creates its own `new Date()` on each call. At lesson-transition boundaries, `getLessonState` and `getLessonProgressPercent` can briefly disagree — progress may show 100% while state is still `"active"` (or vice versa) because they operate on different timestamps.
- **Fix:** Pass `currentTime` (or a `now` parameter) to `getLessonState()`, matching how `getLessonProgressPercent()` already works in the timeplan page.

#### BUG: `useTimeTracker` does NOT filter by `week_number`
- **File:** `src/hooks/useTimeTracker.ts` (line 82–86)
- **Impact:** Queries `schedule_entries` with only `day_of_week` and `class_id`/`student_id` — no `week_number` filter. Returns ALL entries ever created for today's weekday across all weeks (masterplan week 0 + every weekly override). Students may see wrong/duplicate lessons in the time tracker widget.
- **Additional:** Also queries the raw `schedule_entries` table instead of the `get_student_schedule` RPC, bypassing any server-side schedule resolution logic.
- **Fix:** Add `week_number` filter using `getISOWeekNumber()`, or preferably refactor to use the `get_student_schedule` RPC.

### 4.2 High-Severity Issues

#### Past days show as "upcoming" instead of "finished"
- **File:** `src/app/(dashboard)/student/timeplan/page.tsx` (line 340–345 in `DayScheduleList`)
- **Impact:** Non-today lessons are forced to `state = "upcoming"` (the guard is `isToday ? getLessonState(...) : "upcoming"`). This means Monday's lessons still show dashed circles and no line-through when viewing on Tuesday+. Past days look like they haven't happened.
- **Fix:** Determine if the viewed day is in the past (check `dayIndex < todayDayIndex`) and force `"finished"` for past days, `"upcoming"` for future days, computed for today. Same applies to `DesktopWeekGrid`.

#### Weekend behavior — all lessons appear "upcoming"
- **File:** `src/app/(dashboard)/student/timeplan/page.tsx` (line 74)
- **Impact:** On Saturday/Sunday, `todayDayIndex` = 5 or 6, which gets clamped to Friday (index 4) for `selectedDay`. But `isToday(idx)` checks `dayIdx === todayDayIndex` — which never matches any tab (0–4), so NO day gets the "I dag" badge and all lessons show as `"upcoming"` (no finished states shown).
- **Fix:** Detect weekends explicitly; either force all Mon–Fri to `"finished"` or show a "God helg!" banner.

#### Schedule fetched once on mount with no refresh
- **Files:** `src/app/(dashboard)/student/timeplan/page.tsx`, `src/app/(dashboard)/student/page.tsx`
- **Impact:** Both pages use `useEffect(() => { ... }, [])` (empty deps, eslint-disable). If a teacher changes the schedule mid-day, the student sees stale data until page reload. No Supabase realtime subscription or polling.
- **Fix:** Add periodic refetch (e.g., 5-minute interval) or subscribe to `schedule_entries` changes via Supabase realtime.

### 4.3 Medium-Severity Issues

#### `getLessonProgressPercent` has different API signatures
- **Dashboard:** `getLessonProgressPercent(start, end)` — captures `currentTime` from closure.
- **Timeplan:** `getLessonProgressPercent(start, end, now)` — pure function with explicit `now` parameter.
- **Fix:** Extract to a shared utility in `src/utils/` with the pure signature.

#### `getISOWeekNumber()` duplicated in teacher pages
- **Files:** `src/app/(dashboard)/teacher/timeplan/page.tsx`, `src/components/teacher/WeeklyScheduleEditor.tsx`
- **Impact:** Both define `getISOWeekNumber()` identically. The shared utility `src/utils/week-number.ts` exists but isn't imported.
- **Fix:** Replace duplicates with `import { getISOWeekNumber } from "@/utils/week-number"`.

#### Verbose debug console.error in student dashboard
- **File:** `src/app/(dashboard)/student/page.tsx` (line 88–96)
- **Impact:** Four consecutive `console.error` calls dump the full RPC error structure. Not harmful but exposes implementation details in the browser console.

#### `save-weekly-plan.ts` — no deduplication on insert
- **File:** `src/app/actions/save-weekly-plan.ts`
- **Impact:** Uploading the same week twice creates duplicate `schedule_entries` and `weekly_updates` rows. No `DELETE` of existing week data before insert, no UPSERT logic.
- **Fix:** Delete existing entries for the target `week_number` + `class_id` before inserting.

#### Masterplan save failures are silently swallowed
- **File:** `src/app/actions/save-weekly-plan.ts`
- **Impact:** If the auto-create of week_number=0 masterplan entries fails, it's only logged via `console.warn` — no error surfaced to the teacher.

### 4.4 Low-Severity Issues

#### Unused props in Timeplan sub-components
- `TimeplanCard` and `DesktopLessonRow` declare `isToday: boolean` in their props type but never use it.
- `DesktopWeekGrid` accepts `selectedDay` and `onSelectDay` props but never uses them.
- Harmless but confusing; clean up to match actual usage.

#### `selectedDay` won't auto-update at midnight
- `selectedDay` is initialized once via `useState`. If a student leaves the tab open past midnight, the "I dag" badge moves to the new day but the view stays on the old day.

#### Stale console.log statements
- `StudentFooter.tsx`: `console.log` in render JSX (line ~150)
- `useStudentProfile.ts`: `console.log` during profile auto-creation
- `useTaskCompletion.ts`: `console.log` in audio play catch handler
- Remove for production.

#### `window.__refreshStudentProfile` global hack
- `Navigation.tsx` exposes `window.__refreshStudentProfile = refresh` — brittle cross-component communication. Should use context or custom event.

#### `useTaskCompletion.ts` — TODO comment
- Line 238: `// TODO: Implement reward claim logic` — reward purchasing not yet wired up.

### 4.5 Security & Tech Debt (Active)

Documented in `TECH_DEBT.md`:

1. **Invisible Email Hack:** Student usernames silently get `@skole.klar.app` appended for Supabase Auth.
2. **Plaintext Password Column:** `current_password_plaintext` on `student_profiles` stores passwords in clear text so teachers can help young students log in.
3. **RLS Disabled on 6 Tables:** `tasks`, `feedback`, `weekly_updates`, `push_subscriptions`, `student_teacher_settings`, `task_schedule_entries` have RLS disabled. The `anon` key grants unrestricted read/write.
4. **Mutable Search Paths:** 3 RPC functions (`delete_reward_and_transactions`, `auto_link_task_subject`, `get_student_schedule`) have unset `search_path`.
5. **Permissive Class Policies:** `classes` table uses `USING (true)` for UPDATE/DELETE.
6. **Leaked Password Protection Disabled** in Supabase Auth settings.

**These MUST be addressed before any multi-school or production deployment.**

---

## 5. File Inventory — Key Files

### Created During Recent Refactoring

| File | Purpose | Lines |
|------|---------|-------|
| `src/utils/format-time.ts` | `formatTime()` — trims "HH:MM:SS" → "HH:MM" | 16 |
| `src/utils/week-number.ts` | `getISOWeekNumber()`, `getISODayOfWeek()` — ISO 8601 helpers | 29 |
| `src/components/student/ScheduleCard.tsx` | Fisheye lesson card for daily dashboard | ~165 |
| `src/components/student/MissionChip.tsx` | Task completion pill ("2/4"), green when all done | ~55 |
| `src/components/student/LessonProgress.tsx` | 44px SVG circular progress ring | ~55 |
| `src/app/(dashboard)/student/timeplan/page.tsx` | Full weekly schedule page (swipe + grid) | 629 |

### Recently Modified

| File | Changes |
|------|---------|
| `src/utils/subject-colors.ts` | Added `borderAccent` and `shadowRgb` to `ColorClasses` interface + all 22 COLOR_MAP entries |
| `src/app/(dashboard)/student/page.tsx` | Refactored 727 → 462 lines; imports extracted components |
| `src/app/(dashboard)/student/lesson/[id]/page.tsx` | `.slice(0,5)` → `formatTime()` |
| `src/components/Sidebar.tsx` | Removed unused `Mail` import; updated nav to 4 clean links |
| `src/components/StudentFooterWrapper.tsx` | Removed debug console.logs |
| `PROJECT_DNA.md` | Added §6.12 (autonomous discretion), timeplan route, gotchas #15–16 |

### Large/Complex Files (potential refactor targets)

| File | Lines | Notes |
|------|-------|-------|
| `src/app/(dashboard)/teacher/timeplan/page.tsx` | ~1,177 | Schedule management; contains duplicated `getISOWeekNumber()` |
| `src/app/(dashboard)/teacher/ukebrev/page.tsx` | ~1,187 | Planer page; handles both doc types |
| `src/components/teacher/WeeklyScheduleEditor.tsx` | ~1,183 | Full schedule grid editor; duplicated week number calc |
| `src/app/subject/[id]/page.tsx` | ~746 | Global subject library (Container A) |
| `src/app/(dashboard)/student/timeplan/page.tsx` | 629 | Weekly schedule (just created) |
| `src/components/teacher/ActivityDetailSheet.tsx` | ~554 | Teacher grading panel |

---

## 6. Next Logical Steps

Based on code analysis, these are the highest-impact tasks in priority order:

### Priority 1 — Bug Fixes (Must Do)

1. **Fix `useTimeTracker` week_number filtering** — Add `.eq("week_number", currentWeekNumber)` or `.in("week_number", [0, currentWeekNumber])` to the query, or refactor to use `get_student_schedule` RPC. Currently shows wrong lessons.
2. **Fix `getLessonState()` time source** — Accept a `now: Date` parameter in both dashboard and timeplan. Pass `currentTime` from state to ensure consistency with progress calculations.
3. **Fix past-day lesson states in Timeplan** — Add day comparison logic: past days → `"finished"`, today → computed, future days → `"upcoming"`. Handle weekends gracefully.

### Priority 2 — Data Integrity

4. **Add schedule deduplication in `save-weekly-plan.ts`** — Delete existing `schedule_entries` for the target `week_number + class_id` before inserting new ones.
5. **Add schedule refresh mechanism** — Either periodic polling (5-minute interval) or Supabase realtime subscription in student pages.

### Priority 3 — Cleanup

6. **Deduplicate `getISOWeekNumber()`** — Replace copies in teacher timeplan page and `WeeklyScheduleEditor` with import from `src/utils/week-number.ts`.
7. **Extract `getLessonProgressPercent()`** to a shared utility (pure function with `now` parameter).
8. **Remove debug logging** — Clean up all `console.log`/`console.error` in student-facing files. Replace with structured error handling or a logging utility.
9. **Clean up unused props** — Remove `isToday` from `TimeplanCard`/`DesktopLessonRow` types, `selectedDay`/`onSelectDay` from `DesktopWeekGrid`.
10. **Wire up reward claim logic** — The TODO at `useTaskCompletion.ts:238` indicates reward purchasing is not yet implemented.

### Priority 4 — Features / Polish

11. **Weekend UX** — Show a "God helg!" state or auto-select next Monday when viewing on Saturday/Sunday.
12. **Stale `klar/klar/` subfolder** — The workspace has a `klar/` subdirectory with an old copy of the project. Should be removed to avoid confusion.
13. **RLS hardening** — Begin enabling RLS on the 6 unprotected tables (per TECH_DEBT.md §3).

---

## 7. Architecture Reference

### Student Navigation

```
Navigation.tsx (top header bar)
  ├── Hamburger → Sidebar.tsx (root page; 4 links)
  │     ├── Dagen i dag → /
  │     ├── Fag & Oppgaver → /student/fag
  │     ├── Timeplan → /student/timeplan
  │     └── Belønninger → /belonninger
  ├── Back button (sub-pages like /student/lesson/[id])
  └── 💬 FeedbackSheet with unread badge (polls every 30s)

StudentFooterWrapper → StudentFooter (fixed bottom bar)
  ├── XP progress bar with avatar marker (animated position)
  ├── Timer button → CircularProgress popover (useTimeTracker)
  └── StudentHelpButton (if class queue is open)
```

### Teacher Sidebar

```
TeacherSidebar.tsx
  ├── Oversikt       → /teacher
  ├── Mine Klasser   → /teacher/classes
  ├── Fag & Oppgaver → /teacher/tasks
  ├── Timeplaner     → /teacher/timeplan
  ├── Belønninger    → /teacher/rewards
  ├── Meldinger      → /teacher/messages
  └── Planer         → /teacher/ukebrev
```

### Imperative Handle Chain (Smart Audio Submission)

```
CompletionModal.onBeforeConfirm (async)
  └── MediaUploadToolbar.stopRecordingIfActive()
        └── AudioRecorder.stopAndFinalize() → Promise<Blob | null>
              └── MediaRecorder.stop() → onstop → resolve(blob)
```

### XP / Leveling Formula

```
Complete task → points_value (default 10) added to current_xp
current_xp >= current_goal_total → level up → LevelUpModal → current_goal_total increases
Every 5 tasks across different subjects → 1 flower petal (up to 5 → flower collected)
Flowers + petals + levels → can be spent in reward shop
```

---

## 8. Environment & Tooling

| Item | Value |
|------|-------|
| **Node/Next.js** | Next.js 16.1.1, React 19.2.3, TypeScript ^5 |
| **CSS** | Tailwind 3.4.17 — STRICT: no dynamic template literals |
| **Animation** | Framer Motion ^12.23.26 |
| **Backend** | Supabase (Auth, Postgres, Storage, Realtime) |
| **AI** | Google Generative AI (Gemini 2.5 Flash) via `@google/generative-ai` |
| **Doc Parsing** | Mammoth ^1.11.0 (`.docx` → raw text) |
| **All UI text** | Norwegian Bokmål (lang="nb") |
| **Dev Scripts** | `npm run dev`, `npm run build`, `npm run lint` |
| **Env vars** | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `GEMINI_API_KEY` |

---

## 9. Rules to Remember

1. **Never use dynamic Tailwind classes** (template literals). All classes must be explicit strings.
2. **Never run migrations directly.** Create migration files in `supabase/migrations/` for the user.
3. **React 19 strictness:** No setState during render, no ref access during render, conditional mounting.
4. **All text in Norwegian Bokmål.** TTS uses `nb-NO` / `no-NO`.
5. **forwardRef chain is critical** for smart audio submission — don't break `AudioRecorder → MediaUploadToolbar → Container`.
6. **Two task containers:** `/subject/[id]` (global) vs. `/student/lesson/[id]` (session-scoped). Never conflate.
7. **Server Actions for auth mutations** — use admin/service-role client to avoid logging out the active teacher.
8. **Document all tech debt** in `TECH_DEBT.md` immediately.
9. **Summary format:** End-of-turn summaries in a single markdown code block with nested bullets.
10. **Build checks disabled** unless the user explicitly asks for them.

---

*End of handover. All information derived from direct codebase exploration on 2026-02-25.*
