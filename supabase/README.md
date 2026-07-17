# Klar 3.0 database

This directory is the only migration source for a new Klar 3.0 Supabase
project. The former 2.x schema and its dashboard-era policy history are kept
under `../supabase-2x/` for reference and must not be pushed to a 3.0 project.

Principles:

- every schema and policy change is committed as a migration;
- authenticated browser clients receive read-only table grants;
- mutations go through authorized server operations using the service role;
- every domain row is scoped to an organization and, where relevant, a class;
- anonymous users have no table or function access;
- optional features start disabled and add their own migrations later.

Local verification, when Docker is available:

```sh
npx supabase start
npx supabase db reset
```

The dependency-free smoke test in `verification/rls_smoke.sql` can be run
with `psql -v ON_ERROR_STOP=1 -f` after applying the migrations. It verifies
anonymous denial, read-only authenticated grants, cross-organization RLS, and
teacher/student class visibility in one rolled-back transaction.
