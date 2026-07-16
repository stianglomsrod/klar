import { randomUUID } from "node:crypto";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { assertLocalSupabaseUrl } from "../../../scripts/e2e/local-safety.mjs";
import {
  expectNoAxeViolations,
  expectNoHorizontalOverflow,
} from "../support/quality";
import {
  openLocalDatabase,
  restoreCapabilityProfile,
  retainOnlyCapabilities,
  STAFF_CAPABILITIES,
} from "../support/local-database";
import {
  createSyntheticWeeklyPlanDocx,
  DOCX_MIME,
} from "../support/synthetic-docx";

const authDirectory = path.join(process.cwd(), "playwright", ".auth");
const organizationId = "20000000-0000-4000-8000-000000000002";
const classId = "30000000-0000-4000-8000-000000000003";
const staffId = "10000000-0000-4000-8000-000000000005";
const studentId = "10000000-0000-4000-8000-000000000010";
const helpRequestId = "70000000-0000-4000-8000-000000000004";
const retainedCapabilities = [
  "class.workspace.read",
  "plan.preview",
] as const;

test.use({
  storageState: path.join(authDirectory, "other-org-staff-aal2.json"),
});

test.setTimeout(90_000);

test("et aktivt oppdrag håndhever hver tildelt kapabilitet", async ({
  context,
  page,
}) => {
  const database = await openLocalDatabase();
  const apiUrl = assertLocalSupabaseUrl(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  );
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error("Lokal service-role-nøkkel mangler.");
  const admin = createClient(apiUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const token = randomUUID().slice(0, 8);
  const deniedTaskTitle = `Avvist oppgave ${token}`;
  const deniedPlanTitles = [
    `Avvist plan ${token} A`,
    `Avvist plan ${token} B`,
  ];
  const directTaskTitle = `Avvist direkte oppgave ${token}`;
  const directPlanTitle = `Avvist direkte plan ${token}`;
  const weeklyPlanDocx = await createSyntheticWeeklyPlanDocx();
  let assignmentId: string | null = null;

  async function readProtectedState() {
    const { rows } = await database.query<{
      task_count: number;
      task_audits: number;
      plan_audits: number;
      help_audits: number;
      support_audits: number;
      help_status: string;
      claimed_by: string | null;
      support_level: number;
      progress_enabled: boolean;
    }>(
      `
        select
          (
            select count(*)::integer
            from public.task_definitions
            where class_id = $1::uuid
          ) as task_count,
          (
            select count(*)::integer
            from public.audit_events
            where event_name = 'task.published'
              and metadata ->> 'class_id' = $1::text
          ) as task_audits,
          (
            select count(*)::integer
            from public.audit_events
            where event_name = 'plan.published'
              and entity_id = $1::uuid
          ) as plan_audits,
          (
            select count(*)::integer
            from public.audit_events
            where event_name = 'help.claimed'
              and entity_id = $2::uuid
          ) as help_audits,
          (
            select count(*)::integer
            from public.audit_events
            where event_name = 'student.experience.updated'
              and entity_id = $3::uuid
          ) as support_audits,
          (
            select status::text
            from public.help_requests
            where id = $2::uuid
          ) as help_status,
          (
            select claimed_by::text
            from public.help_requests
            where id = $2::uuid
          ) as claimed_by,
          (
            select support_level::integer
            from public.student_experience_settings
            where organization_id = $4::uuid
              and student_id = $3::uuid
          ) as support_level,
          (
            select progress_enabled
            from public.student_experience_settings
            where organization_id = $4::uuid
              and student_id = $3::uuid
          ) as progress_enabled
      `,
      [classId, helpRequestId, studentId, organizationId],
    );
    return rows[0];
  }

  try {
    const assignmentResult = await database.query<{ id: string }>(
      `
        select assignment.id::text
        from public.staff_assignments as assignment
        join public.staff_assignment_class_scopes as scope
          on scope.assignment_id = assignment.id
        where assignment.organization_id = $1::uuid
          and assignment.user_id = $2::uuid
          and scope.class_id = $3::uuid
          and assignment.revoked_at is null
          and assignment.starts_at <= transaction_timestamp()
          and transaction_timestamp() < assignment.ends_at
        order by assignment.starts_at desc, assignment.id
        limit 1
      `,
      [organizationId, staffId, classId],
    );
    assignmentId = assignmentResult.rows[0]?.id ?? null;
    if (!assignmentId) throw new Error("Kapabilitetsoppdraget mangler.");
    await restoreCapabilityProfile(database, assignmentId);

    await page.goto(`/v3/teacher/classes/${classId}`);
    await expect(page.getByRole("heading", { name: "Annen skole 5C" })).toBeVisible();
    await expect(page.getByText("Elev ved annen skole", { exact: true })).toBeVisible();
    await expect(page.getByText("Oppgave ved annen skole", { exact: true })).toBeVisible();
    await page.getByLabel("Tittel").fill(deniedTaskTitle);

    const planPage = await context.newPage();
    await planPage.goto(`/v3/teacher/classes/${classId}`);
    const stalePlanPanel = planPage.getByRole("region", { name: "Smart Import" });
    await stalePlanPanel.getByLabel("Ukeplan, maks 2 MB").setInputFiles({
      name: "syntetisk-kapabilitet.docx",
      mimeType: DOCX_MIME,
      buffer: weeklyPlanDocx,
    });
    await stalePlanPanel
      .getByRole("button", { name: "Lag forhåndsvisning" })
      .click();
    await stalePlanPanel
      .getByRole("textbox", { name: "Oppgave 1", exact: true })
      .fill(deniedPlanTitles[0]);
    await stalePlanPanel
      .getByRole("textbox", { name: "Oppgave 2", exact: true })
      .fill(deniedPlanTitles[1]);
    const stalePlanPublish = stalePlanPanel.getByRole("button", {
      name: "Bekreft og publiser 2",
    });
    await expect(stalePlanPublish).toBeVisible();

    const helpPage = await context.newPage();
    await helpPage.goto(`/v3/teacher/classes/${classId}`);
    const staleHelpClaim = helpPage.getByRole("button", {
      name: "Jeg tar denne",
    });
    await expect(staleHelpClaim).toBeVisible();

    const supportPage = await context.newPage();
    await supportPage.goto(`/v3/teacher/classes/${classId}`);
    await supportPage.getByText("Tilpass visning", { exact: true }).click();
    await supportPage
      .getByLabel("Støtte for Elev ved annen skole")
      .selectOption("3");
    const staleSupportSave = supportPage.getByRole("button", {
      name: "Lagre",
      exact: true,
    });
    await expect(staleSupportSave).toBeVisible();

    const baseline = await readProtectedState();
    expect(baseline).toMatchObject({
      task_count: 1,
      help_status: "waiting",
      claimed_by: null,
      support_level: 2,
      progress_enabled: true,
    });

    await retainOnlyCapabilities(
      database,
      assignmentId,
      retainedCapabilities,
    );

    const capabilityRows = await database.query<{ capability: string }>(
      `
        select capability::text
        from public.staff_assignment_capabilities
        where assignment_id = $1::uuid
        order by capability
      `,
      [assignmentId],
    );
    expect(capabilityRows.rows.map((row) => row.capability)).toEqual(
      [...retainedCapabilities].sort(),
    );

    const resolutionRows = await database.query<{
      capability: string;
      assignment_id: string | null;
    }>(
      `
        select
          capability::text,
          public.resolve_active_staff_assignment(
            $1::uuid,
            $2::uuid,
            capability
          )::text as assignment_id
        from unnest($3::public.staff_capability[]) as capability
        order by capability
      `,
      [staffId, classId, STAFF_CAPABILITIES],
    );
    const resolution = new Map(
      resolutionRows.rows.map((row) => [row.capability, row.assignment_id]),
    );
    expect(resolution.get("class.workspace.read")).toBe(assignmentId);
    expect(resolution.get("plan.preview")).toBe(assignmentId);
    for (const capability of STAFF_CAPABILITIES.filter(
      (candidate) => !retainedCapabilities.includes(candidate as never),
    )) {
      expect(resolution.get(capability)).toBeNull();
    }

    const reducedPage = await context.newPage();
    await reducedPage.goto(`/v3/teacher/classes/${classId}`);
    await expect(
      reducedPage.getByRole("heading", { name: "Annen skole 5C" }),
    ).toBeVisible();
    await expect(
      reducedPage.getByText("Elev ved annen skole", { exact: true }),
    ).toBeVisible();
    await expect(
      reducedPage.getByText("Oppgave ved annen skole", { exact: true }),
    ).toBeVisible();
    await expect(
      reducedPage.getByRole("heading", { name: "Publiser oppgave" }),
    ).toHaveCount(0);
    await expect(
      reducedPage.getByRole("heading", { name: "Hjelpekø" }),
    ).toHaveCount(0);
    await expect(
      reducedPage.getByText("Tilpass visning", { exact: true }),
    ).toHaveCount(0);

    const reducedPlanPanel = reducedPage.getByRole("region", {
      name: "Smart Import",
    });
    await expect(reducedPlanPanel).toBeVisible();
    await reducedPlanPanel.getByLabel("Ukeplan, maks 2 MB").setInputFiles({
      name: "syntetisk-lesbar.docx",
      mimeType: DOCX_MIME,
      buffer: weeklyPlanDocx,
    });
    await reducedPlanPanel
      .getByRole("button", { name: "Lag forhåndsvisning" })
      .click();
    await expect(
      reducedPlanPanel.getByRole("textbox", {
        name: "Oppgave 1",
        exact: true,
      }),
    ).toHaveValue("E2E import: les side 12");
    await expect(
      reducedPlanPanel.getByText(/gir ikke tilgang til å publisere dem/),
    ).toBeVisible();
    await expect(
      reducedPlanPanel.getByRole("button", { name: /Bekreft og publiser/ }),
    ).toHaveCount(0);
    expect((await readProtectedState()).task_count).toBe(baseline.task_count);
    await expectNoHorizontalOverflow(reducedPage);
    await expectNoAxeViolations(reducedPage);

    await page.getByRole("button", { name: "Publiser til klassen" }).click();
    await expect(page).toHaveURL(new RegExp(`${classId}\\?access=ended$`));
    await expect(
      page.getByRole("heading", { name: "Publiser oppgave" }),
    ).toHaveCount(0);

    await stalePlanPublish.click();
    await expect(planPage).toHaveURL(new RegExp(`${classId}\\?access=ended$`));
    await expect(
      planPage.getByRole("button", { name: /Bekreft og publiser/ }),
    ).toHaveCount(0);

    await staleHelpClaim.click();
    await expect(helpPage).toHaveURL(new RegExp(`${classId}\\?access=ended$`));
    await expect(
      helpPage.getByRole("heading", { name: "Hjelpekø" }),
    ).toHaveCount(0);

    await staleSupportSave.click();
    await expect(supportPage).toHaveURL(
      new RegExp(`${classId}\\?access=ended$`),
    );
    await expect(
      supportPage.getByText("Tilpass visning", { exact: true }),
    ).toHaveCount(0);

    const [taskRpc, planRpc, helpRpc, supportRpc] = await Promise.all([
      admin.rpc("publish_task_to_class", {
        p_class_id: classId,
        p_actor_id: staffId,
        p_staff_assignment_id: assignmentId,
        p_title: directTaskTitle,
      }),
      admin.rpc("publish_plan_to_class", {
        p_class_id: classId,
        p_actor_id: staffId,
        p_staff_assignment_id: assignmentId,
        p_tasks: [{ title: directPlanTitle }],
      }),
      admin.rpc("claim_student_help", {
        p_request_id: helpRequestId,
        p_teacher_id: staffId,
        p_staff_assignment_id: assignmentId,
      }),
      admin.rpc("update_student_experience_for_staff", {
        p_organization_id: organizationId,
        p_class_id: classId,
        p_student_id: studentId,
        p_actor_id: staffId,
        p_staff_assignment_id: assignmentId,
        p_support_level: 3,
        p_progress_enabled: false,
      }),
    ]);
    expect(
      [taskRpc, planRpc, helpRpc, supportRpc].every(
        (result) => result.error !== null,
      ),
    ).toBe(true);

    const postState = await readProtectedState();
    expect(postState).toEqual(baseline);
    const deniedRows = await database.query<{ count: number }>(
      `
        select count(*)::integer
        from public.task_definitions
        where class_id = $1::uuid
          and title = any($2::text[])
      `,
      [
        classId,
        [
          deniedTaskTitle,
          ...deniedPlanTitles,
          directTaskTitle,
          directPlanTitle,
        ],
      ],
    );
    expect(deniedRows.rows[0].count).toBe(0);
    const assignmentState = await database.query<{
      is_active: boolean;
    }>(
      `
        select (
          revoked_at is null
          and starts_at <= transaction_timestamp()
          and transaction_timestamp() < ends_at
        ) as is_active
        from public.staff_assignments
        where id = $1::uuid
      `,
      [assignmentId],
    );
    expect(assignmentState.rows[0]?.is_active).toBe(true);
  } finally {
    if (assignmentId) {
      await restoreCapabilityProfile(database, assignmentId);
    }
    await database.end();
  }
});
