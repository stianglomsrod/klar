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
      name: "Din fremdrift",
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
