import path from "node:path";
import { expect, test } from "@playwright/test";
import { openLocalDatabase } from "../support/local-database";
import {
  expectNoAxeViolations,
  expectNoHorizontalOverflow,
  observeRuntimeErrors,
} from "../support/quality";

const authDirectory = path.join(process.cwd(), "playwright", ".auth");
const d2ClassId = "30000000-0000-4000-8000-000000000006";
const d2StudentId = "10000000-0000-4000-8000-000000000015";

type SourceFixture = {
  assignment_id: string;
  iteration_id: string;
  plan_task_id: string;
  management_version: number;
  state_version: number;
  schedule_version: number;
  status: "assigned" | "completed" | "reopened";
  points_value_snapshot: number;
  source_revision_session_id: string;
  source_teaching_session_id: string;
  source_starts_at: string;
  target_revision_session_id: string;
  target_teaching_session_id: string;
  target_starts_at: string;
  target_title: string;
  target_plan_lock_version: number;
  xp_balance: number;
};

async function loadSourceFixture(
  title: string,
): Promise<{ database: Awaited<ReturnType<typeof openLocalDatabase>>; row: SourceFixture }> {
  const database = await openLocalDatabase();
  const result = await database.query<SourceFixture>(
    `select
       assignment.id::text as assignment_id,
       assignment.iteration_id::text,
       assignment.plan_task_id::text,
       iteration.management_version::integer,
       state.state_version::integer,
       assignment.schedule_version::integer,
       state.status::text,
       assignment.points_value_snapshot::integer,
       source_session.id::text as source_revision_session_id,
       source_session.teaching_session_id::text as source_teaching_session_id,
       source_session.starts_at::text as source_starts_at,
       target_session.id::text as target_revision_session_id,
       target_session.teaching_session_id::text as target_teaching_session_id,
       target_session.starts_at::text as target_starts_at,
       target_session.title::text as target_title,
       target_plan.lock_version::integer as target_plan_lock_version,
       coalesce(progress.xp_balance, 0)::integer as xp_balance
     from public.task_assignments as assignment
     join public.task_definitions as definition
       on definition.id = assignment.task_definition_id
     join public.task_iterations as iteration
       on iteration.id = assignment.iteration_id
     join public.student_task_state as state
       on state.assignment_id = assignment.id
     join public.plan_revision_sessions as source_session
       on source_session.id = assignment.scheduled_from_revision_session_id
     join lateral (
       select candidate.*
       from public.plan_revision_sessions as candidate
       join public.weekly_plans as plan
         on plan.id = candidate.weekly_plan_id
        and plan.active_revision_id = candidate.revision_id
       where candidate.organization_id = assignment.organization_id
         and candidate.class_id = assignment.class_id
         and candidate.starts_at > source_session.starts_at
         and candidate.starts_at > transaction_timestamp()
         and not exists (
           select 1
           from public.task_assignments as duplicate
           where duplicate.plan_task_id = assignment.plan_task_id
             and duplicate.student_id = assignment.student_id
             and duplicate.scheduled_teaching_session_id =
               candidate.teaching_session_id
         )
       order by candidate.starts_at, candidate.id
       limit 1
     ) as target_session on true
     join public.weekly_plans as target_plan
       on target_plan.id = target_session.weekly_plan_id
     left join public.student_progress as progress
       on progress.organization_id = assignment.organization_id
      and progress.student_id = assignment.student_id
     where assignment.class_id = $1::uuid
       and assignment.student_id = $2::uuid
       and definition.title = $3
     order by source_session.starts_at
     limit 1`,
    [d2ClassId, d2StudentId, title],
  );
  if (!result.rows[0]) {
    await database.end();
    throw new Error(`D2-fixturen mangler ${title}.`);
  }
  return { database, row: result.rows[0] };
}

test("læreren flytter samme oppgave og en gammel elevfane kan ikke fullføre", async ({
  browser,
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error("Playwright baseURL mangler.");
  test.slow();
  const { database, row } = await loadSourceFixture("D2 flytteoppgave");
  const studentContext = await browser.newContext({
    baseURL,
    storageState: path.join(authDirectory, "d2-student.json"),
    locale: "nb-NO",
    timezoneId: "Europe/Oslo",
    colorScheme: "light",
    reducedMotion: "reduce",
    serviceWorkers: "block",
    viewport: { width: 360, height: 640 },
    hasTouch: true,
  });
  const studentPage = await studentContext.newPage();
  const expectNoRuntimeErrors = observeRuntimeErrors(page);
  const expectNoStudentRuntimeErrors = observeRuntimeErrors(studentPage);

  try {
    await studentPage.goto("/v3/student");
    const compactSession = studentPage.getByRole("button", {
      name: /Vis oppgavene|Se \d+ oppgave/,
    });
    if (await compactSession.count()) {
      let contentId = await compactSession.first().getAttribute("aria-controls");
      expect(contentId).toMatch(/^task-group-/);
      let compactPanel = studentPage.locator(`#${contentId}`);
      await expect(compactPanel).toHaveCount(1);
      await expect(compactSession.first()).toHaveAttribute("aria-expanded", "false");
      await expect(compactPanel).toBeHidden();
      await compactSession.first().click();
      await expect(compactSession.first()).toHaveAttribute("aria-expanded", "true");
      await expect(compactPanel).toBeVisible();
      const freshStudentPage = await studentContext.newPage();
      const expectNoFreshStudentRuntimeErrors = observeRuntimeErrors(freshStudentPage);
      try {
        await freshStudentPage.goto("/v3/student");
        const freshCompactSession = freshStudentPage.getByRole("button", {
          name: /Vis oppgavene|Se \d+ oppgave/,
        });
        contentId = await freshCompactSession.first().getAttribute("aria-controls");
        expect(contentId).toMatch(/^task-group-/);
        compactPanel = freshStudentPage.locator(`#${contentId}`);
        await expect(compactPanel).toHaveCount(1);
        await expect(freshCompactSession.first()).toHaveAttribute(
          "aria-expanded",
          "false",
        );
        await expect(compactPanel).toBeHidden();
        await freshCompactSession.first().click();
        await expect(compactPanel).toBeVisible();
        expectNoFreshStudentRuntimeErrors();
      } finally {
        await freshStudentPage.close();
      }
      expectNoStudentRuntimeErrors();
    }
    const staleTaskButton = studentPage.getByRole("button", {
      name: "Åpne oppgaven D2 flytteoppgave",
    });
    await expect(staleTaskButton).toBeVisible();
    await staleTaskButton.click();
    const staleTaskDialog = studentPage.getByRole("dialog", {
      name: "D2 flytteoppgave",
    });
    await expect(
      staleTaskDialog.getByRole("heading", { name: "D2 flytteoppgave" }),
    ).toBeVisible();

    await page.goto(`/v3/teacher/classes/${d2ClassId}`);
    const publishedRegion = page.getByRole("region", {
      name: "Publiserte oppgaver",
    });
    const article = publishedRegion.getByRole("article", {
      name: "D2 flytteoppgave, utsending 1",
    });
    await expect(article).toBeVisible();
    await expect(article.getByText("D2 elev", { exact: true })).toBeVisible();
    await expect(
      article.getByText("Tidligere D2-elev", { exact: true }),
    ).toHaveCount(0);
    const membershipBoundary = await database.query<{
      historical_assignments: number;
      current_students: number;
    }>(
      `select
         (select count(*)::integer from public.task_assignments
          where iteration_id = $1::uuid) as historical_assignments,
         (select count(*)::integer
          from public.task_assignments as assignment
          join public.memberships as membership
            on membership.organization_id = assignment.organization_id
           and membership.user_id = assignment.student_id
           and membership.role = 'student'
          join public.class_memberships as class_membership
            on class_membership.organization_id = assignment.organization_id
           and class_membership.class_id = assignment.class_id
           and class_membership.user_id = assignment.student_id
           and class_membership.role = 'student'
          where assignment.iteration_id = $1::uuid) as current_students`,
      [row.iteration_id],
    );
    expect(membershipBoundary.rows[0]).toEqual({
      historical_assignments: 2,
      current_students: 1,
    });
    await article
      .getByRole("button", { name: "Flytt eller send ut på nytt" })
      .click();

    const dialog = page.getByRole("dialog", {
      name: "Flytt eller send ut på nytt D2 flytteoppgave",
    });
    await expect(dialog).toBeVisible();
    await dialog
      .getByRole("radio", { name: "Flytt samme oppgave", exact: false })
      .check();
    await dialog
      .getByLabel("Ny undervisningsøkt")
      .selectOption(row.target_revision_session_id);
    await dialog
      .getByRole("checkbox", { name: "D2 elev", exact: false })
      .check();
    await expectNoHorizontalOverflow(page);
    await expectNoAxeViolations(page);
    await dialog.getByRole("button", { name: "Flytt oppgaven" }).click();
    await expect(
      publishedRegion.getByRole("status"),
    ).toContainText("Oppgaven er flyttet for 1 elev.");
    await expect(dialog).not.toBeVisible();
    await expect(article.getByText(row.target_title, { exact: false })).toBeVisible();
    await expect(
      article.getByRole("button", { name: "Flytt eller send ut på nytt" }),
    ).toBeFocused();

    const moved = await database.query<{
      iteration_id: string;
      management_version: number;
      scheduled_teaching_session_id: string;
      scheduled_from_revision_session_id: string;
      schedule_version: number;
      state_version: number;
      status: string;
      xp_balance: number;
      attempts: number;
      events: number;
    }>(
      `select
         assignment.iteration_id::text,
         iteration.management_version::integer,
         assignment.scheduled_teaching_session_id::text,
         assignment.scheduled_from_revision_session_id::text,
         assignment.schedule_version::integer,
         state.state_version::integer,
         state.status::text,
         coalesce(progress.xp_balance, 0)::integer as xp_balance,
         (select count(*)::integer from public.task_completion_attempts
          where assignment_id = assignment.id) as attempts,
         (select count(*)::integer from public.task_schedule_events
          where source_assignment_id = assignment.id and command = 'move') as events
       from public.task_assignments as assignment
       join public.task_iterations as iteration
         on iteration.id = assignment.iteration_id
       join public.student_task_state as state
         on state.assignment_id = assignment.id
       left join public.student_progress as progress
         on progress.organization_id = assignment.organization_id
        and progress.student_id = assignment.student_id
       where assignment.id = $1::uuid`,
      [row.assignment_id],
    );
    expect(moved.rows[0]).toEqual({
      iteration_id: row.iteration_id,
      management_version: row.management_version + 1,
      scheduled_teaching_session_id: row.target_teaching_session_id,
      scheduled_from_revision_session_id: row.target_revision_session_id,
      schedule_version: row.schedule_version + 1,
      state_version: row.state_version,
      status: row.status,
      xp_balance: row.xp_balance,
      attempts: 0,
      events: 1,
    });

    const staleCompleteButton = staleTaskDialog.getByRole("button", {
      name: "Fullfør",
    });
    try {
      await staleCompleteButton.click({ timeout: 5_000 });
    } catch (error) {
      // A live projection may remove the moved task before the stale command
      // reaches the server. That is an equally safe outcome; an unchanged,
      // interactive stale dialog is not.
      if (await staleTaskDialog.isVisible()) throw error;
    }
    const completionDialog = studentPage.getByRole("dialog", {
      name: "Er du ferdig?",
    });
    const readStaleUiOutcome = async () => {
      if (await completionDialog.isVisible()) return "checkpoint";
      if ((await staleTaskButton.count()) === 0) return "removed";
      return "pending";
    };
    await expect
      .poll(readStaleUiOutcome, { timeout: 5_000 })
      .not.toBe("pending");
    if ((await readStaleUiOutcome()) === "checkpoint") {
      try {
        await completionDialog
          .getByRole("button", { name: "Ferdig", exact: true })
          .click({ timeout: 5_000 });
      } catch (error) {
        if (await completionDialog.isVisible()) throw error;
      }
    }
    const staleAlert = completionDialog.getByRole("alert");
    const readTerminalOutcome = async () => {
      if (await staleAlert.isVisible()) return "rejected";
      if (
        (await staleTaskButton.count()) === 0 &&
        !(await staleTaskDialog.isVisible())
      ) {
        return "removed";
      }
      return "pending";
    };
    await expect
      .poll(readTerminalOutcome, { timeout: 5_000 })
      .not.toBe("pending");
    if ((await readTerminalOutcome()) === "rejected") {
      await expect(staleAlert).toContainText(
        "Oppgaven er flyttet eller oppdatert",
      );
      await expect(
        completionDialog.getByRole("heading", { name: "Er du ferdig?" }),
      ).toBeVisible();
    } else {
      await expect(staleTaskDialog).not.toBeVisible();
      await expect(staleTaskButton).toHaveCount(0);
    }

    await studentPage.reload();
    await expect(
      studentPage.getByRole("button", {
        name: "Åpne oppgaven D2 flytteoppgave",
      }),
    ).toHaveCount(0);

    const afterStaleCompletion = await database.query<{
      status: string;
      xp_balance: number;
      attempts: number;
      transitions: number;
      ledger_entries: number;
      completion_receipts: number;
      progress_receipts: number;
    }>(
      `select
         state.status::text,
         coalesce(progress.xp_balance, 0)::integer as xp_balance,
         (select count(*)::integer from public.task_completion_attempts
          where assignment_id = assignment.id) as attempts,
         (select count(*)::integer from public.task_state_transitions
          where assignment_id = assignment.id) as transitions,
         (select count(*)::integer from public.student_xp_ledger
          where assignment_id = assignment.id) as ledger_entries,
         (select count(*)::integer from public.task_completion_v2_receipts
          where assignment_id = assignment.id) as completion_receipts,
         (select count(*)::integer from public.progress_command_receipts
          where assignment_id = assignment.id) as progress_receipts
       from public.task_assignments as assignment
       join public.student_task_state as state
         on state.assignment_id = assignment.id
       left join public.student_progress as progress
         on progress.organization_id = assignment.organization_id
        and progress.student_id = assignment.student_id
       where assignment.id = $1::uuid`,
      [row.assignment_id],
    );
    expect(afterStaleCompletion.rows[0]).toEqual({
      status: row.status,
      xp_balance: row.xp_balance,
      attempts: 0,
      transitions: 0,
      ledger_entries: 0,
      completion_receipts: 0,
      progress_receipts: 0,
    });
    expectNoRuntimeErrors();
    expectNoStudentRuntimeErrors();
  } finally {
    await studentContext.close();
    await database.end();
  }
});

test("læreren sender oppgaven ut på nytt uten å endre originalen", async ({
  browserName,
  page,
}) => {
  test.slow();
  const { database, row } = await loadSourceFixture("D2 nyutsending");
  const expectNoRuntimeErrors = observeRuntimeErrors(
    page,
    browserName === "chromium"
      ? ["console: Failed to load resource: net::ERR_FAILED"]
      : [],
  );

  try {
    await page.goto(`/v3/teacher/classes/${d2ClassId}`);
    const publishedRegion = page.getByRole("region", {
      name: "Publiserte oppgaver",
    });
    const article = publishedRegion.getByRole("article", {
      name: "D2 nyutsending, utsending 1",
    });
    await article
      .getByRole("button", { name: "Flytt eller send ut på nytt" })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Flytt eller send ut på nytt D2 nyutsending",
    });
    await dialog
      .getByRole("radio", { name: "Send ut på nytt", exact: false })
      .check();
    await dialog
      .getByLabel("Ny undervisningsøkt")
      .selectOption(row.target_revision_session_id);
    await dialog
      .getByRole("checkbox", { name: "D2 elev", exact: false })
      .check();
    const submit = dialog.locator("footer button").last();
    await expect(submit).toHaveText("Send ut på nytt");
    let actionRequestCount = 0;
    let releaseAction = () => {};
    let reportActionStarted = () => {};
    const actionStarted = new Promise<void>((resolve) => {
      reportActionStarted = resolve;
    });
    const actionRelease = new Promise<void>((resolve) => {
      releaseAction = resolve;
    });
    await page.route("**/*", async (route) => {
      const request = route.request();
      if (
        request.method() === "POST" &&
        typeof request.headers()["next-action"] === "string"
      ) {
        actionRequestCount += 1;
        reportActionStarted();
        await actionRelease;
        await route.abort("failed");
        return;
      }
      await route.continue();
    });
    await submit.click();
    await actionStarted;
    await expect(submit).toBeDisabled();
    await expect(submit).toHaveText("Lagrer …");
    await submit.click({ force: true });
    expect(actionRequestCount).toBe(1);
    releaseAction();
    await expect(dialog.getByRole("alert")).toContainText(
      "Kunne ikke lagre akkurat nå. Prøv igjen.",
    );
    await expect(submit).toBeEnabled();
    await page.unroute("**/*");
    await submit.click();
    await expect(publishedRegion.getByRole("status")).toContainText(
      "Oppgaven er sendt ut på nytt til 1 elev.",
    );
    await expect(dialog).not.toBeVisible();
    await expect(article).toBeVisible();
    const newArticle = publishedRegion.getByRole("article", {
      name: "D2 nyutsending, utsending 2",
    });
    await expect(newArticle).toBeVisible();
    await expect(newArticle.getByText(row.target_title, { exact: false })).toBeVisible();
    await expect(
      article.getByRole("button", { name: "Flytt eller send ut på nytt" }),
    ).toBeFocused();

    const proof = await database.query<{
      original_iteration_id: string;
      original_management_version: number;
      original_schedule_version: number;
      original_state_version: number;
      original_status: string;
      original_teaching_session_id: string;
      new_iteration_count: number;
      new_iteration_id: string;
      reissued_from_iteration_id: string;
      new_iteration_management_version: number;
      new_assignment_count: number;
      new_status: string;
      new_schedule_version: number;
      new_state_version: number;
      new_points: number;
      new_ledger: number;
      events: number;
    }>(
      `select
         original.iteration_id::text as original_iteration_id,
         source_iteration.management_version::integer as original_management_version,
         original.schedule_version::integer as original_schedule_version,
         original_state.state_version::integer as original_state_version,
         original_state.status::text as original_status,
         original.scheduled_teaching_session_id::text as original_teaching_session_id,
         (select count(*)::integer from public.task_iterations
          where plan_task_id = original.plan_task_id and iteration_number = 2) as new_iteration_count,
         created.iteration_id::text as new_iteration_id,
         created_iteration.reissued_from_iteration_id::text,
         created_iteration.management_version::integer as new_iteration_management_version,
         (select count(*)::integer from public.task_assignments as created
          where created.plan_task_id = original.plan_task_id
            and created.student_id = original.student_id
            and created.scheduled_teaching_session_id = $2::uuid) as new_assignment_count,
         created_state.status::text as new_status,
         created.schedule_version::integer as new_schedule_version,
         created_state.state_version::integer as new_state_version,
         created.points_value_snapshot::integer as new_points,
         (select count(*)::integer from public.student_xp_ledger
          where assignment_id = created.id) as new_ledger,
         (select count(*)::integer from public.task_schedule_events
          where source_assignment_id = original.id and command = 'reissue') as events
       from public.task_assignments as original
       join public.task_iterations as source_iteration
         on source_iteration.id = original.iteration_id
       join public.student_task_state as original_state
         on original_state.assignment_id = original.id
       join public.task_assignments as created
         on created.plan_task_id = original.plan_task_id
        and created.student_id = original.student_id
        and created.scheduled_teaching_session_id = $2::uuid
       join public.task_iterations as created_iteration
         on created_iteration.id = created.iteration_id
       join public.student_task_state as created_state
         on created_state.assignment_id = created.id
       where original.id = $1::uuid`,
      [row.assignment_id, row.target_teaching_session_id],
    );
    expect(proof.rows[0]).toEqual({
      original_iteration_id: row.iteration_id,
      original_management_version: row.management_version + 1,
      original_schedule_version: row.schedule_version,
      original_state_version: row.state_version,
      original_status: row.status,
      original_teaching_session_id: row.source_teaching_session_id,
      new_iteration_count: 1,
      new_iteration_id: expect.any(String),
      reissued_from_iteration_id: row.iteration_id,
      new_iteration_management_version: 1,
      new_assignment_count: 1,
      new_status: "assigned",
      new_schedule_version: 1,
      new_state_version: 1,
      new_points: row.points_value_snapshot,
      new_ledger: 0,
      events: 1,
    });
    expectNoRuntimeErrors();
  } finally {
    await database.end();
  }
});

test("fullført mottaker er utilgjengelig for flytt, mens gjenåpnet oppgave kan flyttes", async ({
  page,
}) => {
  test.slow();
  const completedFixture = await loadSourceFixture("D2 ferdig oppgave");
  const reopenedFixture = await loadSourceFixture("D2 gjenåpnet oppgave");
  const database = completedFixture.database;
  await reopenedFixture.database.end();

  try {
    expect(completedFixture.row.status).toBe("completed");
    expect(reopenedFixture.row.status).toBe("reopened");
    await page.goto(`/v3/teacher/classes/${d2ClassId}`);
    const publishedRegion = page.getByRole("region", {
      name: "Publiserte oppgaver",
    });

    const completedArticle = publishedRegion.getByRole("article", {
      name: "D2 ferdig oppgave, utsending 1",
    });
    await expect(
      completedArticle.locator("li").filter({ hasText: "D2 elev" }),
    ).toContainText("Ferdig");
    await completedArticle
      .getByRole("button", { name: "Flytt eller send ut på nytt" })
      .click();
    const completedDialog = page.getByRole("dialog", {
      name: "Flytt eller send ut på nytt D2 ferdig oppgave",
    });
    await completedDialog
      .getByRole("radio", { name: "Flytt samme oppgave", exact: false })
      .check();
    await completedDialog
      .getByLabel("Ny undervisningsøkt")
      .selectOption(completedFixture.row.target_revision_session_id);
    const completedRecipient = completedDialog.getByRole("checkbox", {
      name: "D2 elev",
      exact: false,
    });
    await expect(completedRecipient).toBeDisabled();
    await expect(
      completedDialog.getByText(
        "Ferdige oppgaver kan ikke flyttes. Velg «Send ut på nytt».",
        { exact: true },
      ),
    ).toBeVisible();
    await completedDialog
      .getByRole("radio", { name: "Send ut på nytt", exact: false })
      .check();
    await completedDialog
      .getByLabel("Ny undervisningsøkt")
      .selectOption(completedFixture.row.target_revision_session_id);
    await expect(completedRecipient).toBeEnabled();
    await completedDialog.getByRole("button", { name: "Avbryt" }).click();

    const reopenedArticle = publishedRegion.getByRole("article", {
      name: "D2 gjenåpnet oppgave, utsending 1",
    });
    await expect(
      reopenedArticle.locator("li").filter({ hasText: "D2 elev" }),
    ).toContainText("Åpnet igjen");
    await reopenedArticle
      .getByRole("button", { name: "Flytt eller send ut på nytt" })
      .click();
    const reopenedDialog = page.getByRole("dialog", {
      name: "Flytt eller send ut på nytt D2 gjenåpnet oppgave",
    });
    await reopenedDialog
      .getByRole("radio", { name: "Flytt samme oppgave", exact: false })
      .check();
    await reopenedDialog
      .getByLabel("Ny undervisningsøkt")
      .selectOption(reopenedFixture.row.target_revision_session_id);
    const reopenedRecipient = reopenedDialog.getByRole("checkbox", {
      name: "D2 elev",
      exact: false,
    });
    await expect(reopenedRecipient).toBeEnabled();
    await reopenedRecipient.check();
    await reopenedDialog.getByRole("button", { name: "Flytt oppgaven" }).click();
    await expect(publishedRegion.getByRole("status")).toContainText(
      "Oppgaven er flyttet for 1 elev.",
    );

    const proof = await database.query<{
      status: string;
      state_version: number;
      schedule_version: number;
      teaching_session_id: string;
    }>(
      `select
         state.status::text,
         state.state_version::integer,
         assignment.schedule_version::integer,
         assignment.scheduled_teaching_session_id::text as teaching_session_id
       from public.task_assignments as assignment
       join public.student_task_state as state on state.assignment_id = assignment.id
       where assignment.id = $1::uuid`,
      [reopenedFixture.row.assignment_id],
    );
    expect(proof.rows[0]).toEqual({
      status: "reopened",
      state_version: reopenedFixture.row.state_version,
      schedule_version: reopenedFixture.row.schedule_version + 1,
      teaching_session_id: reopenedFixture.row.target_teaching_session_id,
    });
  } finally {
    await database.end();
  }
});

test("AAL1 kan ikke åpne D2-flaten eller skape planleggingssideeffekter", async ({
  browser,
  baseURL,
}) => {
  if (!baseURL) throw new Error("Playwright baseURL mangler.");
  const database = await openLocalDatabase();
  const before = await database.query<{ events: number; receipts: number }>(
    `select
       (select count(*)::integer from public.task_schedule_events) as events,
       (select count(*)::integer from public.task_schedule_command_receipts) as receipts`,
  );
  const context = await browser.newContext({
    baseURL,
    storageState: path.join(authDirectory, "owner-aal1.json"),
    locale: "nb-NO",
    timezoneId: "Europe/Oslo",
  });
  try {
    const aal1Page = await context.newPage();
    await aal1Page.goto(`/v3/teacher/classes/${d2ClassId}`);
    await expect(aal1Page).toHaveURL(/\/v3\/mfa\/challenge$/);
    const after = await database.query<{ events: number; receipts: number }>(
      `select
         (select count(*)::integer from public.task_schedule_events) as events,
         (select count(*)::integer from public.task_schedule_command_receipts) as receipts`,
    );
    expect(after.rows[0]).toEqual(before.rows[0]);
  } finally {
    await context.close();
    await database.end();
  }
});
