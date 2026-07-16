import { randomUUID } from "node:crypto";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { openLocalDatabase } from "../support/local-database";

const authDirectory = path.join(process.cwd(), "playwright", ".auth");
const ownerId = "10000000-0000-4000-8000-000000000001";
const substituteId = "10000000-0000-4000-8000-000000000003";

test.use({
  storageState: path.join(authDirectory, "substitute-aal2.json"),
});

test.setTimeout(100_000);

test("utløp av et åpent oppdrag avviser handlingen og auditeres én gang", async ({
  page,
}) => {
  const database = await openLocalDatabase();
  const organizationId = `f${randomUUID().slice(1)}`;
  const className = `Utløpsklasse ${randomUUID().slice(0, 8)}`;
  const deniedTitle = `Skal ikke publiseres ${randomUUID().slice(0, 8)}`;
  let classId: string | null = null;
  let longAssignmentId: string | null = null;
  let shortAssignmentId: string | null = null;

  try {
    await database.query("begin");
    try {
      await database.query(
        `
          insert into public.organizations (id, name, created_by)
          values ($1::uuid, $2, $3::uuid)
        `,
        [organizationId, `Syntetisk utløpsorg ${organizationId.slice(0, 8)}`, ownerId],
      );
      await database.query(
        `
          insert into public.memberships (
            organization_id,
            user_id,
            role,
            created_by
          ) values
            ($1::uuid, $2::uuid, 'owner', $2::uuid),
            ($1::uuid, $3::uuid, 'teacher', $2::uuid)
        `,
        [organizationId, ownerId, substituteId],
      );
      const classResult = await database.query<{ class_id: string }>(
        `
          select public.create_class_for_teacher(
            $1::uuid,
            $2::uuid,
            $3,
            '2026/2027'
          )::text as class_id
        `,
        [organizationId, ownerId, className],
      );
      classId = classResult.rows[0]?.class_id ?? null;
      if (!classId) throw new Error("Isolert utløpsklasse ble ikke opprettet.");
      const longAssignment = await database.query<{ assignment_id: string }>(
        `
          select public.create_staff_assignment(
            $1::uuid,
            $2::uuid,
            $3::uuid,
            $4::uuid,
            'substitute'::public.staff_job_label,
            transaction_timestamp() - interval '10 minutes',
            transaction_timestamp() + interval '1 hour',
            $5::uuid
          )::text as assignment_id
        `,
        [organizationId, ownerId, substituteId, classId, randomUUID()],
      );
      longAssignmentId = longAssignment.rows[0]?.assignment_id ?? null;
      if (!longAssignmentId) throw new Error("Langt oppdrag ble ikke opprettet.");
      await database.query("commit");
    } catch (error) {
      await database.query("rollback");
      throw error;
    }

    await page.goto(`/v3/teacher/classes/${classId}`);
    await expect(page.getByRole("heading", { name: className })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Publiser til klassen" }),
    ).toBeVisible();

    await database.query("begin");
    try {
      const shortAssignment = await database.query<{
        assignment_id: string;
      }>(
        `
          select public.create_staff_assignment(
            $1::uuid,
            $2::uuid,
            $3::uuid,
            $4::uuid,
            'substitute'::public.staff_job_label,
            transaction_timestamp() - interval '1 minute',
            transaction_timestamp() + interval '30 seconds',
            $5::uuid
          )::text as assignment_id
        `,
        [organizationId, ownerId, substituteId, classId, randomUUID()],
      );
      shortAssignmentId = shortAssignment.rows[0]?.assignment_id ?? null;
      if (!shortAssignmentId) throw new Error("Kort oppdrag ble ikke opprettet.");
      await database.query(
        `select public.revoke_staff_assignment($1::uuid, $2::uuid, $3::uuid)`,
        [organizationId, ownerId, longAssignmentId],
      );
      await database.query("commit");
    } catch (error) {
      await database.query("rollback");
      throw error;
    }

    await page.reload();
    await expect(page.getByRole("heading", { name: className })).toBeVisible();
    const activeBeforeExpiry = await database.query<{
      assignment_id: string | null;
      before_end: boolean;
      expiry_audited_at: string | null;
    }>(
      `
        select
          public.resolve_active_staff_assignment(
            $1::uuid,
            $2::uuid,
            'task.publish'
          )::text as assignment_id,
          clock_timestamp() < assignment.ends_at as before_end,
          assignment.expiry_audited_at::text
        from public.staff_assignments as assignment
        where assignment.id = $3::uuid
      `,
      [substituteId, classId, shortAssignmentId],
    );
    expect(activeBeforeExpiry.rows[0]).toEqual({
      assignment_id: shortAssignmentId,
      before_end: true,
      expiry_audited_at: null,
    });
    await page.getByLabel("Tittel").fill(deniedTitle);

    await expect
      .poll(
        async () => {
          const { rows } = await database.query<{ expired: boolean }>(
            `
              select clock_timestamp() >= ends_at + interval '500 milliseconds'
                as expired
              from public.staff_assignments
              where id = $1::uuid
            `,
            [shortAssignmentId],
          );
          return rows[0]?.expired ?? false;
        },
        { timeout: 45_000, intervals: [100, 250, 500, 1_000] },
      )
      .toBe(true);

    const beforeAction = await database.query<{
      assignment_id: string | null;
      expiry_audited_at: string | null;
      expiry_audits: number;
    }>(
      `
        select
          public.resolve_active_staff_assignment(
            $1::uuid,
            $2::uuid,
            'task.publish'
          )::text as assignment_id,
          assignment.expiry_audited_at::text,
          (
            select count(*)::integer
            from public.audit_events
            where event_name = 'staff_assignment.expired'
              and entity_id = assignment.id
          ) as expiry_audits
        from public.staff_assignments as assignment
        where assignment.id = $3::uuid
      `,
      [substituteId, classId, shortAssignmentId],
    );
    expect(beforeAction.rows[0]).toEqual({
      assignment_id: null,
      expiry_audited_at: null,
      expiry_audits: 0,
    });

    await page.getByRole("button", { name: "Publiser til klassen" }).click();
    await expect(page).toHaveURL(new RegExp(`${classId}\\?access=ended$`));
    const endedHeading = page.getByRole("heading", {
      name: "Tilgangen er avsluttet",
    });
    await expect(endedHeading).toBeVisible();
    await expect(endedHeading).toBeFocused();
    await expect(page.getByText(className, { exact: true })).toHaveCount(0);

    const afterAction = await database.query<{
      ends_at: string;
      expiry_audited_at: string;
      expiry_audits: number;
      effective_matches: boolean;
      recorded_matches: boolean;
      recorded_after_effective: boolean;
      actor_id: string | null;
      authorizing_staff_assignment_id: string | null;
      authorizing_capability: string | null;
      denied_tasks: number;
      task_audits: number;
      short_assignment_audits: number;
    }>(
      `
        select
          assignment.ends_at::text,
          assignment.expiry_audited_at::text,
          count(audit.id)::integer as expiry_audits,
          bool_and(
            (audit.metadata ->> 'effective_at')::timestamptz = assignment.ends_at
          ) as effective_matches,
          bool_and(
            (audit.metadata ->> 'recorded_at')::timestamptz
              = assignment.expiry_audited_at
          ) as recorded_matches,
          bool_and(
            (audit.metadata ->> 'recorded_at')::timestamptz
              >= (audit.metadata ->> 'effective_at')::timestamptz
          ) as recorded_after_effective,
          max(audit.actor_id::text) as actor_id,
          max(audit.authorizing_staff_assignment_id::text)
            as authorizing_staff_assignment_id,
          max(audit.authorizing_capability::text) as authorizing_capability,
          (
            select count(*)::integer
            from public.task_definitions
            where class_id = $1::uuid
              and title = $3
          ) as denied_tasks,
          (
            select count(*)::integer
            from public.audit_events
            where event_name = 'task.published'
              and metadata ->> 'class_id' = $1::text
          ) as task_audits,
          (
            select count(*)::integer
            from public.audit_events
            where authorizing_staff_assignment_id = $2::uuid
          ) as short_assignment_audits
        from public.staff_assignments as assignment
        left join public.audit_events as audit
          on audit.entity_id = assignment.id
         and audit.event_name = 'staff_assignment.expired'
        where assignment.id = $2::uuid
        group by assignment.id
      `,
      [classId, shortAssignmentId, deniedTitle],
    );
    const audited = afterAction.rows[0];
    expect(audited.expiry_audited_at).toBeTruthy();
    expect(audited).toMatchObject({
      expiry_audits: 1,
      effective_matches: true,
      recorded_matches: true,
      recorded_after_effective: true,
      actor_id: null,
      authorizing_staff_assignment_id: null,
      authorizing_capability: null,
      denied_tasks: 0,
      task_audits: 0,
      short_assignment_audits: 0,
    });
    const firstExpiryMarker = audited.expiry_audited_at;

    await page.reload();
    await expect(endedHeading).toBeVisible();
    const afterReload = await database.query<{
      expiry_audited_at: string;
      expiry_audits: number;
    }>(
      `
        select
          assignment.expiry_audited_at::text,
          (
            select count(*)::integer
            from public.audit_events
            where event_name = 'staff_assignment.expired'
              and entity_id = assignment.id
          ) as expiry_audits
        from public.staff_assignments as assignment
        where assignment.id = $1::uuid
      `,
      [shortAssignmentId],
    );
    expect(afterReload.rows[0]).toEqual({
      expiry_audited_at: firstExpiryMarker,
      expiry_audits: 1,
    });
  } finally {
    await database.end();
  }
});
