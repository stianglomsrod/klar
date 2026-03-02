# Tech Debt Log — Klar Education Platform

> **Rule:** Any "hack", workaround, or intentional technical debt **MUST** be documented here immediately.

---

## Resolved Debt

### ~~Chunk 3B — Teacher Page Decomposition (timeplan + ukebrev)~~ ✅ RESOLVED (2026-03-02)

Two large teacher page-level components were decomposed:

| Extraction                  | Before    | After     | New Files                                                                           |
| --------------------------- | --------- | --------- | ----------------------------------------------------------------------------------- |
| `teacher/timeplan/page.tsx` | 961 lines | 598 lines | `useClassStudentSelection.ts`, `ClassStudentSelector.tsx`, `UploadPreviewPanel.tsx` |
| `teacher/ukebrev/page.tsx`  | 933 lines | 522 lines | `OnboardingGuide.tsx`, `useUkebrevMutators.ts`, `UkebrevPreview.tsx`                |

### ~~Chunk 3A — Teacher Mega-Monolith Decomposition~~ ✅ RESOLVED (2026-03-03)

Two large teacher-facing components were decomposed into focused sub-components:

| Extraction                 | Before     | After     | New Files                                                                                                                               |
| -------------------------- | ---------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `WeeklyScheduleEditor.tsx` | 1136 lines | 577 lines | `schedule-editor/types.ts`, `schedule-helpers.ts`, `ScheduleEntryModal.tsx`, `ScheduleEntryCard.tsx`, `ScheduleHeader.tsx`              |
| `ClassesAccordion.tsx`     | 1146 lines | 773 lines | `classes-accordion/types.ts`, `class-helpers.ts`, `CreateClassDialog.tsx`, `MoveStudentDialog.tsx`, `ContextMenu.tsx`, `StudentRow.tsx` |

### ~~Chunk 2A — Student-Side Monolith Extraction~~ ✅ RESOLVED (2026-03-02)

Six student-facing files were decomposed to improve maintainability and reduce file sizes:

| Extraction                                             | Before                       | After            | New Files                                                                                                 |
| ------------------------------------------------------ | ---------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------- |
| `LevelUpModal.tsx` step JSX                            | ~700 lines                   | 278 lines        | `level-up/CelebrationStep.tsx`, `ColorPickerStep.tsx`, `BloomStep.tsx`                                    |
| `StudentFooter.tsx` sections                           | 465 lines                    | 169 lines        | `student-footer/XpProgressBar.tsx`, `FlowerTeaser.tsx`, `PendingRewardBadge.tsx`, `TimeTrackerWidget.tsx` |
| Archive duplication (subject + lesson pages)           | ~65 lines duplicated in each | Shared component | `student/ArchiveModal.tsx` (exports `ArchiveModal`, `ArchiveButton`, `useArchivePulse`)                   |
| Reward fetch duplication (LevelUpModal + HalfwayModal) | ~40 lines duplicated in each | Shared hook      | `hooks/useAvailableRewards.ts`                                                                            |

Additional fixes included in this chunk:

- **StudentQuizView crash fix:** `currentQuestion.options.length` and `.map()` crashed on text-type questions where `options` is `undefined`. Guarded with optional chaining (`?.`).
- **FlowerTeaser React 19 fix:** Deferred `setState` in effect body via `setTimeout` to satisfy React 19 strict-mode rules (no synchronous `setState` inside effects).
- **HalfwayModal emoji fallback:** Added `reward.emoji || "🎁"` guard after switching to shared `useAvailableRewards` hook.

### ~~Garden Visual Overhaul — Hardcoded Palettes & Dashboard Cruft~~ ✅ RESOLVED (2026-02-28)

The `/belonninger/hage` garden page was a static, text-heavy dashboard with hardcoded rotating color palettes (`gardenPalettes[]`), numerical progress bars ("2 av 5 kronblader"), and status cards. Completed flowers had no color memory — they cycled through 3 fixed palettes.

**Resolution:** Complete rewrite as "The Living Meadow" — a full-screen landscape with sky gradient, drifting SVG clouds, rolling green hills, and a rotating sun. Historical flowers now render from `completed_flower_colors` (Chunk 3 data) with their actual student-chosen colors. Flowers are organically scattered using deterministic pseudo-random positioning (`getFlowerPlacement()`), with gentle sway animations and tap-to-sparkle micro-interactions. The current in-progress flower sits prominently in the foreground as the sole progress indicator (Show, Don't Tell).

### ~~Reward Persistence — Lost Level-Up Rewards~~ ✅ RESOLVED (2026-03-01)

Students could lose their earned reward by closing the `LevelUpModal` (backdrop click, X button, or browser refresh) before selecting a reward. The reward opportunity was silently discarded.

| Change           | File(s)                                                   | Detail                                                                                                                                                                                                                                   |
| ---------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DB column        | Migration `20260301000003_add_pending_reward_levels.sql`  | `pending_reward_levels integer[] NOT NULL DEFAULT '{}'` on `student_profiles`                                                                                                                                                            |
| Atomic tracking  | `useTaskCompletion.ts` `completeTask`                     | New levels appended to `pending_reward_levels` in same profile update as the level-up                                                                                                                                                    |
| Clearing         | `useTaskCompletion.ts` `selectReward`                     | New `forLevel` parameter; clears the level from `pending_reward_levels` on success                                                                                                                                                       |
| Undo cleanup     | `useTaskCompletion.ts` `undoTask`                         | Removes demoted levels from `pending_reward_levels`                                                                                                                                                                                      |
| Modal hardening  | `LevelUpModal.tsx`                                        | Backdrop click disabled (prevents accidental dismiss for young students)                                                                                                                                                                 |
| Dashboard banner | ~~`PendingRewardClaim.tsx`~~ → `StudentFooterWrapper.tsx` | Replaced dashboard-only floating banner with global footer gift icon (🎁). Glowing/pulsing indicator visible on all student pages. Opens `LevelUpModal` for `Math.min(...pendingLevels)`. Badge count shown for multiple pending levels. |
| Context type     | `StudentProfileContext.tsx`                               | `pending_reward_levels: number[]` added to `StudentProfile` type and all queries                                                                                                                                                         |
| Flow wiring      | `useTaskFlow.ts`                                          | Passes `newLevel` as `forLevel` to `selectReward`                                                                                                                                                                                        |

### ~~Schedule & TimeTracker Logic~~ ✅ RESOLVED (2026-02-28)

The following critical schedule bugs were identified in CODE_AUDIT.md §3.2–§3.5 and resolved:

| Bug                                                | Description                                                                                      | Resolution                                                                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| §3.2 `useTimeTracker` missing `week_number` filter | Could return entries from wrong weeks                                                            | Already had correct filter with masterplan fallback; verified and confirmed. Added 5-min periodic refetch.                  |
| §3.3 Past days shown as "upcoming" in Timeplan     | Monday's lessons showed dashed circles on Tuesday+                                               | Already fixed via `getDayRelation()` helper; verified and confirmed.                                                        |
| §3.4 No schedule deduplication on import           | Uploading the same week twice created duplicate `schedule_entries`                               | Added `DELETE` before `INSERT` in `save-weekly-plan.ts` for the target `week_number + class_id` combination.                |
| §3.5 Schedule fetched once with no refresh         | Teacher schedule changes not reflected until page reload                                         | Added 5-min periodic refetch to `useTimeTracker.ts`, `student/page.tsx`, and `student/timeplan/page.tsx`.                   |
| (new) RPC returned duplicate entries               | `get_student_schedule` returned both week-specific and masterplan entries for the same time slot | Updated RPC with `DISTINCT ON` CTE to prefer week-specific entries. Migration: `20260228000000_fix_schedule_rpc_dedup.sql`. |

### ~~Task Duplication in Student Views~~ ✅ RESOLVED (2026-02-28)

Both Container A (`subject/[id]/page.tsx`) and Container B (`student/lesson/[id]/page.tsx`) fetched tasks without filtering by `student_id`. Since the `tasks` table has no RLS (see §3 below), all N copies of each task were returned (one per student in the class), causing visual duplication.

| Container           | File                                               | Resolution                                                                                                                                           |
| ------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — Subject library | `src/app/subject/[id]/page.tsx`                    | Added `supabase.auth.getUser()` + `.eq("student_id", user.id)` to both incomplete and completed task queries. Null-user guard redirects to `/login`. |
| B — Lesson view     | `src/app/(dashboard)/student/lesson/[id]/page.tsx` | Added `supabase.auth.getUser()` + `.eq("student_id", user.id)` to the junction-fetched task query. Null-user guard redirects to `/login`.            |

### ~~Reward Evolution — One-Time vs. Recurring Rewards~~ ✅ RESOLVED (2026-02-28)

Added `is_recurring` boolean column (default `true`) to the `rewards` table. When `is_recurring = false`, a reward is a one-time reward that disappears from the level-up selection after a student picks it once. **Upgraded (2026-03-01):** Added `max_uses integer DEFAULT NULL` column. `null` = unlimited, positive integer = per-student claim limit. The `is_recurring` column is kept in sync (`max_uses=1` → `is_recurring=false`) but `max_uses` is now the source of truth for `LevelUpModal` filtering.

| Component                  | Change                                     | Detail                                                                          |
| -------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------- |
| Migration                  | `20260301000001_add_reward_recurrence.sql` | Adds `is_recurring boolean NOT NULL DEFAULT true` to `rewards`                  |
| Migration                  | `20260301000008_add_reward_max_uses.sql`   | Adds `max_uses integer DEFAULT NULL` + CHECK constraint + backfill              |
| `LevelUpModal.tsx`         | Filter by earned count vs max_uses         | Counts earned per reward_id; hides rewards where count >= max_uses              |
| `StudentRewardManager.tsx` | Create/display limited-use rewards         | "Ubegrenset"/"Begrenset" toggle + number input; badges show "Engangs"/"Maks N×" |

### ~~Data Integrity — Reward Duplication & Logic Alignment~~ ✅ RESOLVED (2026-03-01)

Six data-integrity and code-quality issues were closed:

| ID  | Vulnerability                                                            | Resolution                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C4  | Reward duplication — no DB constraint prevented double-claiming          | Migration `20260301000002_student_rewards_one_time_unique.sql` adds `UNIQUE(student_id, reward_id, earned_at_level)` with pre-migration dedup                                       |
| H1  | `useTimeTracker` diverged from `get_student_schedule` RPC                | Refactored to use `get_student_schedule` RPC when `studentId` is available; raw fallback for class-only mode. Removed stale `subjects` state.                                       |
| H2  | `undoTask` demoted level but didn't revoke earned rewards                | Added `DELETE FROM student_rewards WHERE student_id = ? AND earned_at_level > newLevel` after level demotion                                                                        |
| H3  | Reward insert lived in `LevelUpModal.tsx` instead of `useTaskCompletion` | Moved insert to `selectReward("database", ...)` in `useTaskCompletion.ts` with `upsert` + `onConflict` for idempotency. `LevelUpModal` now delegates via `onSelectReward` callback. |
| M1  | `createClient()` called in render scope on every render                  | Memoized via `useMemo(() => createClient(), [])` + `useRef` for stable IDs                                                                                                          |
| M2  | Dead `window.__refreshStudentProfile` global hack in `Navigation.tsx`    | Removed entirely — context-based refresh is already available                                                                                                                       |

### ~~Route Protection & API Security~~ ✅ RESOLVED (2026-02-28)

Three critical security gaps were closed:

| Vulnerability                  | Description                                                                                      | Resolution                                                                                                                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No role-based route protection | Students could navigate to `/teacher` and access the full teacher dashboard                      | Added `src/middleware.ts` — checks `profiles.role` for `/teacher/*` and teacher API routes. Students → redirect to `/student`. Unauthenticated → redirect to `/login`. API routes → 401/403 JSON.               |
| Seed API unguarded             | `/api/seed` had no auth — anyone could wipe+recreate users and read passwords via GET response   | Added dual guard: `NODE_ENV === 'development'` + `X-Seed-Secret` header. Removed password/email leaks from GET/POST responses. Fixed O(n²) `listUsers` call.                                                    |
| Push secret leaked in payload  | `PUSH_REACT_SECRET` was embedded in push notification payload, exposable on the teacher's device | Replaced with per-notification HMAC tokens: `HMAC-SHA256(secret, taskId:studentId)`. Master secret never leaves server. Added `timingSafeEqual` verification + emoji allowlist validation in `/api/push/react`. |

---

## 1. Student Auth Hack: Invisible Emails

| Field      | Detail                         |
| ---------- | ------------------------------ |
| **Added**  | 2026-02-22                     |
| **Status** | Active                         |
| **Area**   | Authentication (Supabase Auth) |

### Problem

Supabase Auth requires a unique email address for every user. Students, however, log in with simple usernames (e.g., "ole") — they don't have or need real email addresses.

### Current Workaround

During student creation and login, the frontend silently appends a dummy domain to turn the username into a valid email:

```
username → username@skole.klar.app
```

This "invisible email" is never shown to students or teachers. It exists solely to satisfy Supabase's email requirement.

### Risks

- If the dummy domain ever becomes a real domain, emails could leak.
- Password-reset flows (if ever enabled for students) would send mail to non-existent addresses.
- Any Supabase dashboard query filtering by email must account for the synthetic suffix.

### Future Fix

Migrate to Supabase custom auth providers or anonymous sign-in once the platform scales beyond single-school deployments.

---

## 2. Plaintext Password Column (`current_password_plaintext`)

| Field      | Detail                        |
| ---------- | ----------------------------- |
| **Added**  | 2026-02-22                    |
| **Status** | Active                        |
| **Area**   | Database (`student_profiles`) |

### Problem

Teachers need to see a student's current password so they can help young students (ages 6-12) who forget their login credentials. Supabase Auth only stores hashed passwords, which cannot be retrieved.

### Current Workaround

A `current_password_plaintext` column on `student_profiles` stores the student's password in plain text. This column is updated whenever a student is created or their password is reset.

### Risks

- Plaintext passwords in the database are a security concern.
- If RLS policies are misconfigured, passwords could be exposed to students.

### Future Fix

Replace with a teacher-initiated password-reset flow (e.g., generate a temporary code) once the platform matures. Consider encrypting the column at rest via `pgcrypto` as an interim step.

---

## 3. Security: Row Level Security (RLS) & Database Hardening

| Field      | Detail                                           |
| ---------- | ------------------------------------------------ |
| **Added**  | 2026-02-22                                       |
| **Status** | Active                                           |
| **Area**   | Database (Supabase Postgres — all public tables) |

### Problem

We are running the MVP with **RLS disabled** on several public tables and with overly permissive policies on others to facilitate rapid development. Three RPC functions also have mutable search paths. The Supabase Security Advisor flags **7 errors** and **5 warnings**.

### Errors — RLS Disabled in Public

The following tables have RLS **not enabled**, meaning the Supabase `anon` and `authenticated` keys grant unrestricted read/write access:

| Table                                 | Issue                                                                              |
| ------------------------------------- | ---------------------------------------------------------------------------------- |
| `public.tasks`                        | RLS Disabled in Public                                                             |
| `public.feedback`                     | RLS Disabled in Public                                                             |
| `public.weekly_updates`               | RLS Disabled in Public                                                             |
| ~~`public.push_subscriptions`~~       | ~~RLS Disabled in Public~~ ✅ RLS enabled via `20260301000000_push_tables_rls.sql` |
| ~~`public.student_teacher_settings`~~ | ~~RLS Disabled in Public~~ ✅ RLS enabled via `20260301000000_push_tables_rls.sql` |
| `public.task_schedule_entries`        | RLS Disabled in Public                                                             |

Additionally, `public.tasks` has a separate "Policy Exists RLS Disabled" error — policies have been written for the table but RLS itself was never turned on, so the policies are inert.

### ~~Critical: `profiles` & `student_profiles` — RLS enabled but no student policies~~ ✅ RESOLVED (2026-03-01)

RLS was enabled on both `profiles` and `student_profiles` but **no policies existed for the student role**. This caused a showstopper: all student SELECTs returned zero rows, `StudentProfileContext` fell through to Level 1 / Unicorn / 0 XP defaults, and `handleConfirmCompletion` silently early-returned on `!profile`, making the FULLFØR button completely dead. Teachers were unaffected because they had working policies or bypassed via service-role.

| Change                                                    | Detail                                                                                                                                                                                                                                                         |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migration `20260301000006_fix_student_rls_policies.sql`   | Drops broken policies, creates SELECT/INSERT/UPDATE for students (`auth.uid() = id`) and SELECT/UPDATE/INSERT for teachers on both `profiles` and `student_profiles`. Adds missing student SELECT on `subjects`.                                               |
| Migration `20260301000007_fix_profiles_rls_recursion.sql` | Hotfix: the teacher policies on `profiles` self-referenced `profiles` in their USING clause, causing infinite recursion (500 on login). Fixed by creating a `SECURITY DEFINER` helper `is_teacher()` that bypasses RLS, then replacing the recursive policies. |
| `StudentProfileContext.tsx`                               | Added `console.error` logging when profile fetch fails — no more silent swallowing.                                                                                                                                                                            |
| `useTaskFlow.ts`                                          | `handleConfirmCompletion` and `handleQuizSubmit` now show error toast when profile is null instead of silent return.                                                                                                                                           |

### Warnings

| Entity/Item                             | Issue                               | Detail                                                                                     |
| --------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------ |
| `public.delete_reward_and_transactions` | Function Search Path Mutable        | `search_path` parameter is not set — vulnerable to search-path hijacking.                  |
| `public.auto_link_task_subject`         | Function Search Path Mutable        | Same issue.                                                                                |
| `public.get_student_schedule`           | Function Search Path Mutable        | Same issue.                                                                                |
| `public.classes`                        | RLS Policy Always True              | Uses overly permissive `USING (true)` / `WITH CHECK (true)` for UPDATE, DELETE, or INSERT. |
| Auth                                    | Leaked Password Protection Disabled | Supabase's built-in leaked-password check is currently turned off.                         |

### Risks

- **Data exposure:** Anyone with the `anon` key (visible in client-side JS) can theoretically read/write data across all schools and users on the unprotected tables.
- **Cross-tenant leakage:** Without RLS, a student could read another student's tasks, feedback, or push subscriptions.
- **Search-path hijacking:** Mutable search paths on functions could allow a malicious actor with `CREATE` privilege to shadow public schema objects.
- **Permissive class policies:** The `USING (true)` policy on `classes` allows any authenticated user to modify or delete any class.

### Future Fix

Before **any** production or multi-school deployment, we **MUST**:

1. **Enable RLS** on every table listed above:

   ```sql
   ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
   ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
   ALTER TABLE public.weekly_updates ENABLE ROW LEVEL SECURITY;
   -- push_subscriptions & student_teacher_settings: ✅ Done (20260301000000_push_tables_rls.sql)
   ALTER TABLE public.task_schedule_entries ENABLE ROW LEVEL SECURITY;
   ```

2. **Write strict policies** scoped to user roles:
   - Teachers may only access data for students linked to their classes.
   - Students may only read/write their own `tasks`, `feedback`, and `student_profiles`.
   - Service-role operations (server actions) bypass RLS automatically.

3. **Harden RPC functions** by pinning the search path:

   ```sql
   ALTER FUNCTION public.delete_reward_and_transactions SET search_path = '';
   ALTER FUNCTION public.auto_link_task_subject SET search_path = '';
   ALTER FUNCTION public.get_student_schedule SET search_path = '';
   ```

4. **Tighten the `classes` policy** — replace `USING (true)` with a teacher-ownership check.

5. **Enable leaked-password protection** in Supabase Dashboard → Auth → Settings.
