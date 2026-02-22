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
