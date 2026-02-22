# Tech Debt Log — Klar Education Platform

> **Rule:** Any "hack", workaround, or intentional technical debt **MUST** be documented here immediately.

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

| Field      | Detail                                          |
| ---------- | ----------------------------------------------- |
| **Added**  | 2026-02-22                                      |
| **Status** | Active                                          |
| **Area**   | Database (Supabase Postgres — all public tables) |

### Problem

We are running the MVP with **RLS disabled** on several public tables and with overly permissive policies on others to facilitate rapid development. Three RPC functions also have mutable search paths. The Supabase Security Advisor flags **7 errors** and **5 warnings**.

### Errors — RLS Disabled in Public

The following tables have RLS **not enabled**, meaning the Supabase `anon` and `authenticated` keys grant unrestricted read/write access:

| Table                          | Issue                   |
| ------------------------------ | ----------------------- |
| `public.tasks`                 | RLS Disabled in Public  |
| `public.feedback`              | RLS Disabled in Public  |
| `public.weekly_updates`        | RLS Disabled in Public  |
| `public.push_subscriptions`    | RLS Disabled in Public  |
| `public.student_teacher_settings` | RLS Disabled in Public |
| `public.task_schedule_entries` | RLS Disabled in Public  |

Additionally, `public.tasks` has a separate "Policy Exists RLS Disabled" error — policies have been written for the table but RLS itself was never turned on, so the policies are inert.

### Warnings

| Entity/Item                          | Issue                          | Detail                                                                                       |
| ------------------------------------ | ------------------------------ | -------------------------------------------------------------------------------------------- |
| `public.delete_reward_and_transactions` | Function Search Path Mutable | `search_path` parameter is not set — vulnerable to search-path hijacking.                    |
| `public.auto_link_task_subject`      | Function Search Path Mutable   | Same issue.                                                                                  |
| `public.get_student_schedule`        | Function Search Path Mutable   | Same issue.                                                                                  |
| `public.classes`                     | RLS Policy Always True         | Uses overly permissive `USING (true)` / `WITH CHECK (true)` for UPDATE, DELETE, or INSERT.   |
| Auth                                 | Leaked Password Protection Disabled | Supabase's built-in leaked-password check is currently turned off.                       |

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
   ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
   ALTER TABLE public.student_teacher_settings ENABLE ROW LEVEL SECURITY;
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
