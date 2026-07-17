import { randomUUID } from "node:crypto";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { openLocalDatabase } from "../support/local-database";
import {
  expectNoAxeViolations,
  expectNoHorizontalOverflow,
  observeRuntimeErrors,
} from "../support/quality";

const authDirectory = path.join(process.cwd(), "playwright", ".auth");
const returnStudentId = "10000000-0000-4000-8000-000000000011";
const primaryClassId = "30000000-0000-4000-8000-000000000001";
const returnMessage = "Se på de siste linjene én gang til.";

test("AAL2-læreren åpner en fullført oppgave igjen i eget omfang", async ({
  browser,
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error("Playwright baseURL mangler.");
  const database = await openLocalDatabase();
  const expectNoRuntimeErrors = observeRuntimeErrors(page);
  let assignmentId: string | null = null;

  try {
    const fixture = await database.query<{
      assignment_id: string;
      status: string;
      xp_balance: number;
    }>(
      `
        select
          assignment.id::text as assignment_id,
          state.status::text,
          progress.xp_balance::integer
        from public.task_assignments as assignment
        join public.task_definitions as task
          on task.id = assignment.task_definition_id
        join public.student_task_state as state
          on state.assignment_id = assignment.id
        join public.student_progress as progress
          on progress.organization_id = assignment.organization_id
          and progress.student_id = assignment.student_id
        where assignment.student_id = $1::uuid
          and task.title = 'Oppgave klar for retur'
      `,
      [returnStudentId],
    );
    assignmentId = fixture.rows[0]?.assignment_id ?? null;
    if (!assignmentId) throw new Error("Retur-fixturen mangler.");
    expect(fixture.rows[0]).toMatchObject({ status: "completed", xp_balance: 10 });

    await page.goto("/v3/teacher");
    await expect(page.getByRole("heading", { name: "Klar E2E" })).toBeVisible();
    await page.getByRole("link", { name: /Testklasse 3A/ }).click();
    await expect(page.getByRole("heading", { name: "Testklasse 3A" })).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Elever" })
        .getByText("Testelev", { exact: true }),
    ).toBeVisible();

    const taskSection = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Publiserte oppgaver" }),
    });
    const taskRow = taskSection
      .locator(":scope > ul > li")
      .filter({ hasText: "Oppgave klar for retur" });
    await expect(taskRow).toBeVisible();
    await taskRow.getByText("Ferdige elever (1)", { exact: true }).click();
    await taskRow
      .getByText("Åpne igjen for Returelev", { exact: true })
      .click();
    await taskRow
      .getByLabel("Hva skal eleven gjøre?")
      .selectOption("needs_review");
    await taskRow.getByLabel(/Kort beskjed til eleven/).fill(returnMessage);
    await expectNoAxeViolations(page);
    await taskRow.getByRole("button", { name: "Åpne igjen", exact: true }).click();
    await expect(taskRow.getByText("Ferdige elever (1)", { exact: true })).toHaveCount(0);

    const studentContext = await browser.newContext({
      baseURL,
      storageState: path.join(authDirectory, "return-student.json"),
    });
    const studentPage = await studentContext.newPage();
    await studentPage.goto("/v3/student");
    await expect(
      studentPage.getByRole("heading", { name: "Hei, Returelev" }),
    ).toBeVisible();
    await studentPage
      .getByText(/Se \d+ (?:annen oppgave|andre oppgaver)/)
      .click();
    const reopenedCard = studentPage
      .getByRole("article")
      .filter({ hasText: "Oppgave klar for retur" });
    await expect(reopenedCard.getByText("Åpnet igjen", { exact: true })).toBeVisible();
    await reopenedCard
      .getByRole("button", { name: "Åpne oppgaven Oppgave klar for retur" })
      .click();
    await expect(
      studentPage
        .getByRole("dialog", { name: "Oppgave klar for retur" })
        .getByText(returnMessage, { exact: true }),
    ).toBeVisible();
    const progressDock = studentPage.getByRole("region", {
      name: "Din fremdrift og hjelp",
      exact: true,
    });
    await expect(progressDock.getByText("Nivå 1", { exact: true })).toBeVisible();
    await expect(progressDock.getByText("0 poeng", { exact: true })).toBeVisible();
    await expectNoHorizontalOverflow(studentPage);
    await expectNoAxeViolations(studentPage);
    await studentContext.close();

    const proof = await database.query<{
      status: string;
      xp_balance: number;
      reversals: number;
      reason_code: string;
      authorizing_capability: string;
      authorizing_staff_assignment_id: string | null;
      audit_metadata: string;
    }>(
      `
        select
          state.status::text,
          progress.xp_balance::integer,
          (
            select count(*)::integer
            from public.student_xp_ledger
            where assignment_id = $1::uuid and entry_kind = 'reversal'
          ) as reversals,
          transition.reason_code::text,
          audit.authorizing_capability::text,
          audit.authorizing_staff_assignment_id::text,
          audit.metadata::text as audit_metadata
        from public.student_task_state as state
        join public.student_progress as progress
          on progress.organization_id = state.organization_id
          and progress.student_id = state.student_id
        join public.task_state_transitions as transition
          on transition.id = state.last_transition_id
        join public.audit_events as audit
          on audit.event_name = 'task.reopened'
          and audit.entity_id = state.assignment_id
          and audit.metadata ->> 'request_id' = transition.request_id::text
        where state.assignment_id = $1::uuid
      `,
      [assignmentId],
    );
    expect(proof.rows[0]).toMatchObject({
      status: "reopened",
      xp_balance: 0,
      reversals: 1,
      reason_code: "needs_review",
      authorizing_capability: "task.return",
    });
    expect(proof.rows[0]?.authorizing_staff_assignment_id).not.toBeNull();
    expect(proof.rows[0]?.audit_metadata).not.toContain(returnMessage);

    await expectNoHorizontalOverflow(page);
    expectNoRuntimeErrors();

    await page.goto("/v3/student");
    await expect(page).toHaveURL(/\/login$/);
  } finally {
    if (assignmentId) {
      const current = await database.query<{ status: string }>(
        "select status::text from public.student_task_state where assignment_id = $1::uuid",
        [assignmentId],
      );
      if (current.rows[0]?.status !== "completed") {
        await database.query(
          "select public.complete_student_task($1::uuid, $2::uuid, $3::uuid)",
          [assignmentId, returnStudentId, randomUUID()],
        );
      }
    }
    await database.end();
  }
});

test("læreren kontrollerer og publiserer en strukturert klasseuke atomisk", async ({
  page,
}, testInfo) => {
  const database = await openLocalDatabase();
  const expectNoRuntimeErrors = observeRuntimeErrors(page);
  const weekOffset = 2 + testInfo.retry;

  try {
    const dateResult = await database.query<{
      week_start: string;
      session_date: string;
    }>(
      `select
        (date_trunc('week', transaction_timestamp() at time zone 'Europe/Oslo')::date
          + ($1::integer * 7))::text as week_start,
        (date_trunc('week', transaction_timestamp() at time zone 'Europe/Oslo')::date
          + ($1::integer * 7) + 1)::text as session_date`,
      [weekOffset],
    );
    const { week_start: weekStart, session_date: sessionDate } = dateResult.rows[0];
    const sessionTitle = `Lesestund ${weekStart}`;
    const taskTitle = `Les side 12 ${weekStart}`;

    const initialQueueSync = page.waitForResponse(
      (response) => {
        const request = response.request();
        return (
          request.method() === "GET" &&
          new URL(response.url()).pathname ===
            `/v3/teacher/classes/${primaryClassId}` &&
          request.headers().rsc === "1" &&
          (response.headers()["content-type"] ?? "").includes(
            "text/x-component",
          )
        );
      },
    );
    await page.goto(`/v3/teacher/classes/${primaryClassId}`);
    await initialQueueSync;
    const builder = page.getByRole("region", {
      name: "Planlegg undervisningsøktene",
    });
    await expect(builder).toBeVisible();
    await builder.getByLabel("Uken starter").fill(weekStart);
    await builder.getByLabel("Tittel").fill(sessionTitle);
    await builder.getByLabel("Fag").fill("Norsk");
    await builder.getByLabel("Dato").fill(sessionDate);
    await builder.getByLabel("Start", { exact: true }).fill("09:00");
    await builder.getByLabel("Slutt", { exact: true }).fill("08:45");
    await builder.getByLabel("Oppgave 1", { exact: true }).fill(taskTitle);
    await builder
      .getByLabel(/Kort instruksjon/)
      .fill("Arbeid i den syntetiske leseboka.");
    await expect(builder.getByLabel("Uken starter")).toHaveValue(weekStart);
    await expect(builder.getByLabel("Dato")).toHaveValue(sessionDate);
    await expect(builder.getByLabel("Start", { exact: true })).toHaveValue(
      "09:00",
    );
    await expect(builder.getByLabel("Slutt", { exact: true })).toHaveValue(
      "08:45",
    );
    await builder.getByRole("button", { name: "Kontroller klasseuken" }).click();
    const validationAlert = builder.getByRole("alert");
    await expect(validationAlert).toHaveText(
      "Sluttidspunktet for økt 1 må være etter starttidspunktet.",
    );
    await expect(validationAlert).toBeFocused();
    await builder.getByLabel("Slutt", { exact: true }).fill("09:45");
    await builder.getByRole("button", { name: "Kontroller klasseuken" }).click();

    const review = builder.getByRole("region", {
      name: "Kontroller før publisering",
    });
    await expect(review).toBeVisible();
    await expect(review.getByRole("heading", { name: "Kontroller før publisering" })).toBeFocused();
    await expect(review.getByText(sessionTitle, { exact: false })).toBeVisible();
    await expect(review.getByText(taskTitle, { exact: false })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);

    await review.getByRole("button", { name: "Publiser klasseuken" }).click();
    const publishStatus = builder.getByRole("status");
    await expect(publishStatus).toContainText(
      "1 økt og 1 oppgave er publisert.",
    );
    await expect(publishStatus).toBeFocused();

    const proof = await database.query<{
      plans: number;
      active_revisions: number;
      revision_sessions: number;
      revision_tasks: number;
      linked_definitions: number;
      assignments: number;
      states: number;
      roster: number;
      complete_provenance: boolean;
      receipts: number;
      audits: number;
    }>(
      `with target_plan as (
         select id, active_revision_id
         from public.weekly_plans
         where class_id = $1 and week_start_date = $2::date
       )
       select
         (select count(*)::integer from target_plan) as plans,
         (select count(*)::integer from target_plan where active_revision_id is not null) as active_revisions,
         (select count(*)::integer from public.plan_revision_sessions where revision_id = (select active_revision_id from target_plan)) as revision_sessions,
         (select count(*)::integer from public.plan_revision_tasks where revision_id = (select active_revision_id from target_plan)) as revision_tasks,
         (select count(*)::integer from public.task_definitions as task join public.plan_revision_tasks as revision_task on revision_task.task_definition_id = task.id where revision_task.revision_id = (select active_revision_id from target_plan)) as linked_definitions,
         (select count(*)::integer from public.task_assignments as assignment join public.plan_tasks as plan_task on plan_task.id = assignment.plan_task_id where plan_task.weekly_plan_id = (select id from target_plan)) as assignments,
         (select count(*)::integer from public.student_task_state as state join public.task_assignments as assignment on assignment.id = state.assignment_id join public.plan_tasks as plan_task on plan_task.id = assignment.plan_task_id where plan_task.weekly_plan_id = (select id from target_plan)) as states,
         (select count(*)::integer from public.class_memberships where class_id = $1 and role = 'student') as roster,
         coalesce((select bool_and(assignment.plan_task_id is not null and assignment.source_plan_revision_task_id is not null) from public.task_assignments as assignment join public.plan_tasks as plan_task on plan_task.id = assignment.plan_task_id where plan_task.weekly_plan_id = (select id from target_plan)), false) as complete_provenance,
         (select count(*)::integer from public.weekly_plan_publish_receipts where weekly_plan_id = (select id from target_plan)) as receipts,
         (select count(*)::integer from public.audit_events where event_name = 'weekly_plan.published' and entity_id = (select active_revision_id from target_plan)) as audits`,
      [primaryClassId, weekStart],
    );
    expect(proof.rows[0]).toMatchObject({
      plans: 1,
      active_revisions: 1,
      revision_sessions: 1,
      revision_tasks: 1,
      linked_definitions: 1,
      states: proof.rows[0].roster,
      assignments: proof.rows[0].roster,
      complete_provenance: true,
      receipts: 1,
      audits: 1,
    });
    expectNoRuntimeErrors();
  } finally {
    await database.end();
  }
});
