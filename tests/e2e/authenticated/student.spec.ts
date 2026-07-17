import { randomUUID } from "node:crypto";
import { expect, test, type Page, type Route } from "@playwright/test";
import { openLocalDatabase } from "../support/local-database";
import {
  expectNoAxeViolations,
  expectNoHorizontalOverflow,
  observeRuntimeErrors,
} from "../support/quality";

const studentId = "10000000-0000-4000-8000-000000000002";

async function revealLegacyTasks(page: Page) {
  const summary = page.getByText(/Se \d+ (?:annen oppgave|andre oppgaver)/);
  const details = summary.locator("..");
  if (!(await details.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await summary.click();
  }
}

async function expectDurableTaskStatus(
  sourcePage: Page,
  taskTitle: string,
  status: string,
) {
  const durabilityPage = await sourcePage.context().newPage();
  const expectNoRuntimeErrors = observeRuntimeErrors(durabilityPage);
  try {
    await durabilityPage.goto("/v3/student");
    await revealLegacyTasks(durabilityPage);
    const taskCard = durabilityPage
      .getByRole("article")
      .filter({ hasText: taskTitle });
    await expect(taskCard.getByText(status, { exact: true })).toBeVisible();
    expectNoRuntimeErrors();
  } finally {
    await durabilityPage.close();
  }
}

test("elevsesjonen fullfører og angrer med autoritativ XP", async ({ page }) => {
  const database = await openLocalDatabase();
  let assignmentId: string | null = null;

  try {
    const assignment = await database.query<{ id: string }>(
      `
        select assignment.id::text
        from public.task_assignments as assignment
        join public.task_definitions as task
          on task.id = assignment.task_definition_id
        where assignment.student_id = $1::uuid
          and task.title = 'Les fem linjer'
      `,
      [studentId],
    );
    assignmentId = assignment.rows[0]?.id ?? null;
    if (!assignmentId) throw new Error("Elevens testoppgave mangler.");

    const baseline = await database.query<{
      status: string;
      xp_balance: number;
    }>(
      `
        select state.status::text, progress.xp_balance::integer
        from public.student_task_state as state
        join public.student_progress as progress
          on progress.organization_id = state.organization_id
          and progress.student_id = state.student_id
        where state.assignment_id = $1::uuid
      `,
      [assignmentId],
    );
    expect(baseline.rows[0]).toEqual({ status: "assigned", xp_balance: 10 });

    await page.goto("/v3/student");
    await expect(page.getByRole("heading", { name: "Hei, Testelev" })).toBeVisible();
    await revealLegacyTasks(page);
    await expect(page.getByRole("heading", { name: "Regn tre stykker" })).toBeVisible();
    const taskCard = page.getByRole("article").filter({ hasText: "Les fem linjer" });
    await expect(taskCard.getByRole("heading", { name: "Les fem linjer" })).toBeVisible();
    const openTaskButton = taskCard.getByRole("button", {
      name: "Åpne oppgaven Les fem linjer",
    });
    await openTaskButton.click();
    const taskDialog = page.getByRole("dialog", { name: "Les fem linjer" });
    await taskDialog.getByRole("button", { name: "Fullfør" }).click();
    const checkpoint = page.getByRole("dialog", { name: "Er du ferdig?" });
    await expect(checkpoint).toBeVisible();
    await expect(
      checkpoint.getByRole("heading", { name: "Er du ferdig?" }),
    ).toBeFocused();

    const beforeConfirmation = await database.query<{ status: string }>(
      "select status::text from public.student_task_state where assignment_id = $1::uuid",
      [assignmentId],
    );
    expect(beforeConfirmation.rows[0]?.status).toBe("assigned");
    await expectNoAxeViolations(page);

    let releaseFailedRequest = () => {};
    let markRequestObserved = () => {};
    const failedRequestReleased = new Promise<void>((resolve) => {
      releaseFailedRequest = resolve;
    });
    const failedRequestObserved = new Promise<void>((resolve) => {
      markRequestObserved = resolve;
    });
    let interceptedAction = false;
    const actionRoute = async (route: Route) => {
      const request = route.request();
      if (
        !interceptedAction &&
        request.method() === "POST" &&
        request.headers()["next-action"]
      ) {
        interceptedAction = true;
        markRequestObserved();
        await failedRequestReleased;
        await route.abort("failed");
        return;
      }
      await route.continue();
    };
    await page.route("**/*", actionRoute);
    const confirmButton = checkpoint.getByRole("button", {
      name: /^(Ferdig|Lagrer …)$/,
    });
    await confirmButton.focus();
    await expect(confirmButton).toBeFocused();
    await page.keyboard.press("Enter");
    await failedRequestObserved;
    const closeButton = checkpoint.getByRole("button", { name: "Lukk oppgaven" });
    await expect(closeButton).toBeDisabled();
    await expect(confirmButton).toHaveAttribute("aria-disabled", "true");
    await expect(confirmButton).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(checkpoint).toBeVisible();
    await expect(confirmButton).toBeFocused();
    releaseFailedRequest();
    await expect(
      checkpoint.getByText("Kunne ikke lagre akkurat nå. Prøv igjen."),
    ).toBeVisible();
    await expect(closeButton).toBeEnabled();
    await expect(confirmButton).toHaveAttribute("aria-disabled", "false");
    await expect(confirmButton).toBeFocused();
    await page.unroute("**/*", actionRoute);
    await page.keyboard.press("Escape");
    await expect(checkpoint).toBeHidden();
    await expect(openTaskButton).toBeFocused();

    const expectNoRuntimeErrors = observeRuntimeErrors(page);
    await page.keyboard.press("Enter");
    const retryTaskDialog = page.getByRole("dialog", { name: "Les fem linjer" });
    const retryCheckpointButton = retryTaskDialog.getByRole("button", {
      name: "Fullfør",
    });
    await retryCheckpointButton.focus();
    await page.keyboard.press("Enter");
    await expect(
      checkpoint.getByRole("heading", { name: "Er du ferdig?" }),
    ).toBeFocused();
    const retryConfirmButton = checkpoint.getByRole("button", { name: "Ferdig" });
    await retryConfirmButton.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Oppgaven er ferdig. Du fikk 10 poeng.")).toBeVisible();
    const progressDock = page.getByRole("region", { name: "Din fremdrift" });
    await expect(progressDock.getByText("Nivå 1", { exact: true })).toBeVisible();
    await expect(progressDock.getByText("20 poeng", { exact: true })).toBeVisible();

    await expectDurableTaskStatus(page, "Les fem linjer", "Ferdig");
    await revealLegacyTasks(page);
    const completedCard = page
      .getByRole("article")
      .filter({ hasText: "Les fem linjer" });
    await expect(completedCard.getByText("Ferdig", { exact: true })).toBeVisible();
    await completedCard
      .getByRole("button", { name: "Åpne oppgaven Les fem linjer" })
      .click();
    await page
      .getByRole("dialog", { name: "Les fem linjer" })
      .getByRole("button", { name: "Angre fullføring" })
      .click();
    await expect(page.getByText("Oppgaven er klar igjen. Poengene er justert.")).toBeVisible();
    await expect(progressDock.getByText("10 poeng", { exact: true })).toBeVisible();

    await expectDurableTaskStatus(page, "Les fem linjer", "Klar");
    await revealLegacyTasks(page);
    const reopenedForCompletion = page
      .getByRole("article")
      .filter({ hasText: "Les fem linjer" });
    await reopenedForCompletion
      .getByRole("button", { name: "Åpne oppgaven Les fem linjer" })
      .click();
    await page
      .getByRole("dialog", { name: "Les fem linjer" })
      .getByRole("button", { name: "Fullfør" })
      .click();
    await page
      .getByRole("dialog", { name: "Er du ferdig?" })
      .getByRole("button", { name: "Ferdig" })
      .click();
    await expect(progressDock.getByText("20 poeng", { exact: true })).toBeVisible();
    await reopenedForCompletion
      .getByRole("button", { name: "Åpne oppgaven Les fem linjer" })
      .click();
    await page
      .getByRole("dialog", { name: "Les fem linjer" })
      .getByRole("button", { name: "Angre fullføring" })
      .click();
    await expect(progressDock.getByText("10 poeng", { exact: true })).toBeVisible();

    const proof = await database.query<{
      status: string;
      xp_balance: number;
      attempts: number;
      credits: number;
      reversals: number;
      task_balance: number;
      receipts: number;
    }>(
      `
        select
          state.status::text,
          progress.xp_balance::integer,
          (
            select count(*)::integer
            from public.task_completion_attempts
            where assignment_id = $1::uuid
          ) as attempts,
          (
            select count(*)::integer
            from public.student_xp_ledger
            where assignment_id = $1::uuid and entry_kind = 'credit'
          ) as credits,
          (
            select count(*)::integer
            from public.student_xp_ledger
            where assignment_id = $1::uuid and entry_kind = 'reversal'
          ) as reversals,
          (
            select coalesce(sum(points_delta), 0)::integer
            from public.student_xp_ledger
            where assignment_id = $1::uuid
          ) as task_balance,
          (
            select count(*)::integer
            from public.progress_command_receipts
            where assignment_id = $1::uuid and actor_id = $2::uuid
          ) as receipts
        from public.student_task_state as state
        join public.student_progress as progress
          on progress.organization_id = state.organization_id
          and progress.student_id = state.student_id
        where state.assignment_id = $1::uuid
      `,
      [assignmentId, studentId],
    );
    expect(proof.rows[0]).toEqual({
      status: "assigned",
      xp_balance: 10,
      attempts: 2,
      credits: 2,
      reversals: 2,
      task_balance: 0,
      receipts: 4,
    });

    await expectNoHorizontalOverflow(page);
    expectNoRuntimeErrors();

    await page.goto("/v3/teacher");
    await expect(page).toHaveURL(/\/login$/);
  } finally {
    if (assignmentId) {
      const current = await database.query<{ status: string }>(
        "select status::text from public.student_task_state where assignment_id = $1::uuid",
        [assignmentId],
      );
      if (current.rows[0]?.status === "completed") {
        await database.query(
          "select public.undo_student_task_completion($1::uuid, $2::uuid, $3::uuid)",
          [assignmentId, studentId, randomUUID()],
        );
      }
    }
    await database.end();
  }
});
