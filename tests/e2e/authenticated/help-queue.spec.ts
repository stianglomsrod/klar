import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { openLocalDatabase } from "../support/local-database";
import {
  applyTextSpacingOverride,
  expectMinimumTargetSize,
  expectNoAxeViolations,
  expectNoHorizontalOverflow,
  observeRuntimeErrors,
} from "../support/quality";

const authDirectory = path.join(process.cwd(), "playwright", ".auth");
const primaryClassId = "30000000-0000-4000-8000-000000000001";
const helpClassId = "30000000-0000-4000-8000-000000000005";
const helpStudentId = "10000000-0000-4000-8000-000000000012";
const lifecycleHelpStudentId = "10000000-0000-4000-8000-000000000013";
const captureChromiumEvidence = process.env.KLAR_E2E_BROWSER === "chromium";

async function resetHelpQueueFixture() {
  const database = await openLocalDatabase();
  try {
    await database.query("begin");
    await database.query(
      "delete from public.help_queue_signals where class_id = $1::uuid",
      [helpClassId],
    );
    await database.query(
      `
        delete from public.help_queue_command_receipts
        where queue_session_id in (
          select id from public.help_queue_sessions where class_id = $1::uuid
        )
      `,
      [helpClassId],
    );
    await database.query(
      `
        delete from public.help_requests
        where queue_session_id in (
          select id from public.help_queue_sessions where class_id = $1::uuid
        )
      `,
      [helpClassId],
    );
    await database.query(
      "delete from public.help_queue_sessions where class_id = $1::uuid",
      [helpClassId],
    );
    await database.query(
      `delete from public.class_memberships
       where class_id = $1::uuid and user_id = $2::uuid`,
      [primaryClassId, helpStudentId],
    );
    await database.query("commit");
  } catch (error) {
    await database.query("rollback");
    throw error;
  } finally {
    await database.end();
  }
}

async function expectStudentPrivacy(page: Page) {
  await expect(page.locator('[aria-label^="Køplass "]')).toHaveCount(0);
  await expect(
    page.getByRole("list", { name: "Intern kørekkefølge" }),
  ).toHaveCount(0);
  await expect(page.getByText(/elev(?:er)? i kø/i)).toHaveCount(0);
  await expect(page.getByText("Hjelpeelev", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Livsløpselev", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Køplass|Nettopp|Hos deg/i)).toHaveCount(0);
}

async function expectVisibleKeyboardFocus(locator: Locator) {
  await expect(locator).toBeFocused();
  expect(await locator.evaluate((element) => element.matches(":focus-visible"))).toBe(
    true,
  );
}

async function moveKeyboardFocusTo(page: Page, locator: Locator) {
  for (let step = 0; step < 20; step += 1) {
    await page.keyboard.press("Tab");
    if (await locator.evaluate((element) => element === document.activeElement)) {
      await expectVisibleKeyboardFocus(locator);
      return;
    }
  }
  throw new Error("Fant ikke det forventede kontrollpunktet i Tab-rekkefølgen.");
}

async function claimAndResolve(
  page: Page,
  queue: Locator,
  studentName: string,
  afterResolve: () => Locator,
) {
  const claim = queue.getByRole("button", {
    name: `Jeg tar denne – ${studentName}`,
  });
  await expect(claim).toBeVisible();
  await moveKeyboardFocusTo(page, claim);
  await claim.press("Enter");
  await expect(queue.getByText("Hos deg", { exact: true })).toBeVisible();

  const resolve = queue.getByRole("button", {
    name: `Ferdig hjulpet – ${studentName}`,
  });
  await expect(resolve).toBeVisible();
  await expectVisibleKeyboardFocus(resolve);
  await resolve.press("Enter");
  await expectVisibleKeyboardFocus(afterResolve());
}

test.beforeEach(async () => {
  await resetHelpQueueFixture();
});

test("elev og AAL2-ansatt fullfører en øktbundet hjelpekø", async ({
  browser,
  baseURL,
}) => {
  test.slow();
  if (!baseURL) throw new Error("Playwright baseURL mangler.");
  const database = await openLocalDatabase();
  const studentContext = await browser.newContext({
    baseURL,
    storageState: path.join(authDirectory, "help-student.json"),
    viewport: { width: 360, height: 640 },
    hasTouch: true,
    locale: "nb-NO",
    timezoneId: "Europe/Oslo",
    reducedMotion: "reduce",
    serviceWorkers: "block",
  });
  const teacherContext = await browser.newContext({
    baseURL,
    storageState: path.join(authDirectory, "owner-aal2.json"),
    viewport: { width: 1440, height: 900 },
    locale: "nb-NO",
    timezoneId: "Europe/Oslo",
    reducedMotion: "reduce",
    serviceWorkers: "block",
  });
  const studentPage = await studentContext.newPage();
  const secondStudentPage = await studentContext.newPage();
  const teacherPage = await teacherContext.newPage();
  const studentRuntime = observeRuntimeErrors(studentPage);
  const secondStudentRuntime = observeRuntimeErrors(secondStudentPage);
  const teacherRuntime = observeRuntimeErrors(teacherPage);
  let intentionallyOffline = false;
  let studentRscRequestsWhileOffline = 0;
  studentContext.on("request", (request) => {
    if (
      intentionallyOffline &&
      request.url().includes("/v3/student") &&
      request.url().includes("_rsc=")
    ) {
      studentRscRequestsWhileOffline += 1;
    }
  });

  try {
    await Promise.all([
      studentPage.goto("/v3/student"),
      secondStudentPage.goto("/v3/student"),
    ]);
    await expect(
      studentPage.getByRole("heading", { name: "Hei, Hjelpeelev" }),
    ).toBeVisible();
    await expect(
      studentPage.getByRole("button", { name: "Be om hjelp", exact: true }),
    ).toHaveCount(0);

    await teacherPage.goto(`/v3/teacher/classes/${helpClassId}`);
    await expect(
      teacherPage.getByRole("heading", { name: "Hjelpekøklasse 5D" }),
    ).toBeVisible();
    const queue = teacherPage.getByRole("region", { name: "Hjelpekø" });
    const openQueue = queue.getByRole("button", { name: "Åpne kø" });
    await expectMinimumTargetSize(openQueue);
    await openQueue.focus();
    await expectVisibleKeyboardFocus(openQueue);
    await openQueue.press("Enter");
    await expect(queue.getByText("Åpen", { exact: true })).toBeVisible();
    await expectVisibleKeyboardFocus(
      queue.getByRole("heading", { name: "Hjelpekø" }),
    );

    const queueSession = await database.query<{ id: string }>(
      `
        select id::text
        from public.help_queue_sessions
        where class_id = $1::uuid
          and status = 'open'
      `,
      [helpClassId],
    );
    const queueSessionId = queueSession.rows[0]?.id;
    expect(queueSessionId).toBeTruthy();
    await database.query(
      "select public.request_student_help_v2($1::uuid,$2::uuid,$3::uuid,null)",
      [
        queueSessionId,
        lifecycleHelpStudentId,
        "e1e00000-0000-4000-8000-000000000001",
      ],
    );
    await expect(
      queue.getByRole("listitem").filter({ hasText: "Livsløpselev" }),
    ).toBeVisible();

    const helpDock = studentPage.getByRole("region", { name: "Hjelp" });
    const secondHelpDock = secondStudentPage.getByRole("region", {
      name: "Hjelp",
    });
    const requestHelp = helpDock.getByRole("button", {
      name: "Be om hjelp",
      exact: true,
    });
    const secondRequestHelp = secondHelpDock.getByRole("button", {
      name: "Be om hjelp",
      exact: true,
    });
    await studentPage.bringToFront();
    await expect(requestHelp).toBeVisible();
    await secondStudentPage.bringToFront();
    await expect(secondRequestHelp).toBeVisible();
    await expectMinimumTargetSize(requestHelp);
    await expectStudentPrivacy(studentPage);

    await Promise.all([requestHelp.click(), secondRequestHelp.click()]);
    const activeHelp = helpDock.getByRole("button", {
      name: "Står i kø. Åpne avmelding",
    });
    const secondActiveHelp = secondHelpDock.getByRole("button", {
      name: "Står i kø. Åpne avmelding",
    });
    await expect(activeHelp).toBeVisible();
    await expect(secondActiveHelp).toBeVisible();
    await expect(helpDock.getByRole("alert")).toHaveCount(0);
    await expect(secondHelpDock.getByRole("alert")).toHaveCount(0);
    const activeCount = await database.query<{
      count: number;
      requested_audits: number;
    }>(
      `
        with active_request as (
          select request.id
          from public.help_requests as request
          join public.help_queue_sessions as queue
            on queue.id = request.queue_session_id
          where queue.class_id = $1::uuid
            and request.student_id = $2::uuid
            and request.status in ('waiting', 'claimed')
        )
        select
          (select count(*)::integer from active_request) as count,
          (
            select count(*)::integer
            from public.audit_events as audit
            where audit.event_name = 'help.requested'
              and audit.actor_id = $2::uuid
              and audit.entity_id in (select id from active_request)
          ) as requested_audits
      `,
      [helpClassId, helpStudentId],
    );
    expect(activeCount.rows[0]).toEqual({ count: 1, requested_audits: 1 });
    await expectStudentPrivacy(studentPage);
    const textSpacingOverride = await applyTextSpacingOverride(studentPage);
    const simulatedSafeArea = await studentPage.addStyleTag({
      content: ".student-progress-dock { padding-bottom: 24px !important; }",
    });
    await expectNoHorizontalOverflow(studentPage);
    const hasDockClearance = await studentPage.evaluate(() => {
      const main = document.getElementById("main-content");
      const dock = document.querySelector<HTMLElement>(".student-progress-dock");
      if (!main || !dock) return false;
      return (
        Number.parseFloat(getComputedStyle(main).paddingBottom) >=
        dock.getBoundingClientRect().height
      );
    });
    expect(hasDockClearance).toBe(true);
    await Promise.all([
      textSpacingOverride.evaluate((element) => element.parentNode?.removeChild(element)),
      simulatedSafeArea.evaluate((element) => element.parentNode?.removeChild(element)),
    ]);
    if (captureChromiumEvidence) {
      await studentPage.screenshot({
        path: "docs/qa/evidence/E1/student-hand-360x640.png",
        animations: "disabled",
      });
    }

    await activeHelp.click();
    const cancelDialog = studentPage.getByRole("dialog", {
      name: "Gå ut av køen?",
    });
    await expect(cancelDialog).toBeVisible();
    await expect(
      cancelDialog.getByRole("button", { name: "Bli i køen" }),
    ).toBeFocused();
    await expectNoAxeViolations(studentPage);
    await studentPage.keyboard.press("Escape");
    await expect(cancelDialog).toBeHidden();
    await expect(activeHelp).toBeFocused();

    await activeHelp.click();
    await cancelDialog.getByRole("button", { name: "Gå ut" }).click();
    await expect(requestHelp).toBeVisible();
    await expect(requestHelp).toBeFocused();
    await expect(
      queue.getByRole("listitem").filter({ hasText: "Livsløpselev" }),
    ).toBeVisible();
    await expect(secondRequestHelp).toBeVisible();
    await expect(secondActiveHelp).toHaveCount(0);

    await requestHelp.click();
    await expect(activeHelp).toBeVisible();
    const generalRequest = await database.query<{
      id: string;
      requested_at: string;
      task_assignment_id: string | null;
    }>(
      `
        select request.id::text, request.requested_at::text, request.task_assignment_id::text
        from public.help_requests as request
        join public.help_queue_sessions as queue
          on queue.id = request.queue_session_id
        where queue.class_id = $1::uuid
          and request.student_id = $2::uuid
          and request.status in ('waiting', 'claimed')
      `,
      [helpClassId, helpStudentId],
    );
    expect(generalRequest.rows[0]?.task_assignment_id).toBeNull();

    const currentSession = studentPage.getByRole("region", {
      name: "Hjelp arbeidsøkt",
    });
    await currentSession
      .getByRole("button", { name: "Åpne oppgaven Hjelp øktoppgave" })
      .click();
    const taskDialog = studentPage.getByRole("dialog", {
      name: "Hjelp øktoppgave",
    });
    const contextualize = taskDialog.getByRole("button", {
      name: "Knytt til oppgaven",
    });
    await expect(contextualize).toBeVisible();
    await expectMinimumTargetSize(contextualize);
    await contextualize.click();
    const activeTaskHelp = taskDialog.getByRole("button", {
      name: "Står i kø. Åpne avmelding",
    });
    await expect(activeTaskHelp).toBeFocused();
    const contextualRequest = await database.query<{
      id: string;
      requested_at: string;
      task_assignment_id: string | null;
    }>(
      `
        select request.id::text, request.requested_at::text, request.task_assignment_id::text
        from public.help_requests as request
        where request.id = $1::uuid
      `,
      [generalRequest.rows[0]?.id],
    );
    expect(contextualRequest.rows[0]).toMatchObject({
      id: generalRequest.rows[0]?.id,
      requested_at: generalRequest.rows[0]?.requested_at,
    });
    expect(contextualRequest.rows[0]?.task_assignment_id).not.toBeNull();
    await expect(
      queue.getByText("Norsk: Hjelp øktoppgave", { exact: true }),
    ).toBeVisible();
    await studentPage.setViewportSize({ width: 768, height: 1024 });
    if (captureChromiumEvidence) {
      await studentPage.screenshot({
        path: "docs/qa/evidence/E1/student-task-help-768x1024.png",
        animations: "disabled",
      });
    }
    await studentPage.setViewportSize({ width: 360, height: 640 });

    await activeTaskHelp.click();
    const inlineCancel = taskDialog.getByRole("group", {
      name: "Gå ut av køen?",
    });
    await expect(
      inlineCancel.getByRole("button", { name: "Bli i køen" }),
    ).toBeFocused();
    await expectNoAxeViolations(studentPage);
    await inlineCancel.getByRole("button", { name: "Bli i køen" }).click();
    await expect(activeTaskHelp).toBeFocused();

    for (const viewport of [
      { width: 360, height: 640 },
      { width: 640, height: 360 },
      { width: 720, height: 450 },
      { width: 768, height: 1024 },
      { width: 1024, height: 768 },
      { width: 1440, height: 900 },
    ]) {
      await teacherPage.setViewportSize(viewport);
      await expect(
        queue.getByRole("listitem").filter({ hasText: "Hjelpeelev" }),
      ).toBeVisible();
      await expectNoHorizontalOverflow(teacherPage);
      await expectNoAxeViolations(teacherPage);
      if (
        captureChromiumEvidence &&
        (viewport.width === 360 && viewport.height === 640) ||
        (captureChromiumEvidence &&
          viewport.width === 1024 &&
          viewport.height === 768) ||
        (captureChromiumEvidence &&
          viewport.width === 1440 &&
          viewport.height === 900)
      ) {
        await teacherPage.screenshot({
          path: `docs/qa/evidence/E1/teacher-active-${viewport.width}x${viewport.height}.png`,
          animations: "disabled",
        });
      }
    }

    await queue.getByRole("button", { name: "Steng kø" }).click();
    await expect(queue.getByText("Stenger", { exact: true })).toBeVisible();
    await expect(activeTaskHelp).toBeVisible();
    await expectNoAxeViolations(teacherPage);
    intentionallyOffline = true;
    await studentContext.setOffline(true);
    await claimAndResolve(teacherPage, queue, "Livsløpselev", () =>
      queue.getByRole("listitem").filter({ hasText: "Hjelpeelev" }),
    );
    await expect(queue.getByText("Stenger", { exact: true })).toBeVisible();
    await expect(activeTaskHelp).toBeVisible();
    await claimAndResolve(teacherPage, queue, "Hjelpeelev", () =>
      queue.getByRole("heading", { name: "Hjelpekø" }),
    );
    await expect(queue.getByText("Stengt", { exact: true })).toBeVisible();
    await expect(
      queue.getByText("Køen er stengt for denne undervisningsøkten."),
    ).toBeVisible();
    await teacherPage.evaluate(() => window.scrollTo(0, 0));
    if (captureChromiumEvidence) {
      await teacherPage.screenshot({
        path: "docs/qa/evidence/E1/teacher-natural-closed-1024x768.png",
        animations: "disabled",
      });
    }
    await expect(queue.getByRole("button", { name: "Åpne kø" })).toHaveCount(0);
    await expect(activeTaskHelp).toBeVisible();
    intentionallyOffline = false;
    await studentContext.setOffline(false);
    await expect(activeTaskHelp).toHaveCount(0);
    await expect(secondActiveHelp).toHaveCount(0);
    expect(studentRscRequestsWhileOffline).toBe(0);

    await expectNoHorizontalOverflow(studentPage);
    await expectNoHorizontalOverflow(teacherPage);
    await expectNoAxeViolations(studentPage);
    await expectNoAxeViolations(teacherPage);
    studentRuntime();
    secondStudentRuntime();
    teacherRuntime();
  } finally {
    await Promise.all([
      database.end(),
      studentContext.close(),
      teacherContext.close(),
    ]);
  }
});

test("aktiv hånd overlever klassebytte og naturlig øktslutt", async ({
  browser,
  baseURL,
}) => {
  if (!baseURL) throw new Error("Playwright baseURL mangler.");
  const database = await openLocalDatabase();
  const studentContext = await browser.newContext({
    baseURL,
    storageState: path.join(authDirectory, "help-student.json"),
    viewport: { width: 360, height: 640 },
    hasTouch: true,
    locale: "nb-NO",
    timezoneId: "Europe/Oslo",
    reducedMotion: "reduce",
    serviceWorkers: "block",
  });
  const teacherContext = await browser.newContext({
    baseURL,
    storageState: path.join(authDirectory, "owner-aal2.json"),
    viewport: { width: 1024, height: 768 },
    locale: "nb-NO",
    timezoneId: "Europe/Oslo",
    reducedMotion: "reduce",
    serviceWorkers: "block",
  });
  const studentPage = await studentContext.newPage();
  const teacherPage = await teacherContext.newPage();
  const studentRuntime = observeRuntimeErrors(studentPage);
  const teacherRuntime = observeRuntimeErrors(teacherPage);
  let revisionSessionId: string | null = null;
  let originalSessionEndsAt: string | null = null;
  let addedPrimaryMembership = false;

  try {
    await Promise.all([
      studentPage.goto("/v3/student"),
      teacherPage.goto(`/v3/teacher/classes/${helpClassId}`),
    ]);
    const queue = teacherPage.getByRole("region", { name: "Hjelpekø" });
    await queue.getByRole("button", { name: "Åpne kø" }).click();

    const helpDock = studentPage.getByRole("region", { name: "Hjelp" });
    const requestHelp = helpDock.getByRole("button", {
      name: "Be om hjelp",
      exact: true,
    });
    await expect(requestHelp).toBeVisible();
    await requestHelp.click();
    const activeHelp = helpDock.getByRole("button", {
      name: "Står i kø. Åpne avmelding",
    });
    await expect(activeHelp).toBeVisible();

    const queueSession = await database.query<{
      id: string;
      revision_session_id: string;
      original_ends_at: string;
    }>(
      `select
         queue.id::text,
         queue.revision_session_id::text,
         session.ends_at::text as original_ends_at
       from public.help_queue_sessions as queue
       join public.plan_revision_sessions as session
         on session.id = queue.revision_session_id
       where queue.class_id = $1::uuid and queue.status = 'open'`,
      [helpClassId],
    );
    expect(queueSession.rows[0]).toBeTruthy();
    revisionSessionId = queueSession.rows[0]?.revision_session_id ?? null;
    originalSessionEndsAt = queueSession.rows[0]?.original_ends_at ?? null;
    const membershipInsert = await database.query(
      `insert into public.class_memberships (
         class_id, organization_id, user_id, role, created_by
       ) values (
         $1::uuid,
         '20000000-0000-4000-8000-000000000001',
         $2::uuid,
         'student',
         '10000000-0000-4000-8000-000000000001'
       ) on conflict (class_id, user_id) do nothing
       returning user_id`,
      [primaryClassId, helpStudentId],
    );
    addedPrimaryMembership = membershipInsert.rowCount === 1;
    await database.query("begin");
    try {
      await database.query("set local session_replication_role = replica");
      await database.query(
        `update public.plan_revision_sessions
         set ends_at = clock_timestamp() - interval '1 second'
         where id = $1::uuid`,
        [revisionSessionId],
      );
      await database.query("commit");
    } catch (error) {
      await database.query("rollback");
      throw error;
    }

    await studentPage.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(
      studentPage.getByRole("region", { name: "Dagens arbeidsøkt" }),
    ).toBeVisible();
    await expect(activeHelp).toBeVisible();
    await expectStudentPrivacy(studentPage);

    await teacherPage.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(queue.getByText("Stenger", { exact: true })).toBeVisible();
    await expect(
      queue.getByRole("listitem").filter({ hasText: "Hjelpeelev" }),
    ).toBeVisible();

    await activeHelp.click();
    const cancelDialog = studentPage.getByRole("dialog", {
      name: "Gå ut av køen?",
    });
    await cancelDialog.getByRole("button", { name: "Gå ut" }).click();
    await expect(activeHelp).toHaveCount(0);
    await expect(queue.getByText("Stengt", { exact: true })).toBeVisible();
    await expect(
      queue.getByText("Køen er stengt for denne undervisningsøkten."),
    ).toBeVisible();
    await expectNoAxeViolations(studentPage);
    await expectNoAxeViolations(teacherPage);
    studentRuntime();
    teacherRuntime();
  } finally {
    try {
      await database.query("begin");
      try {
        await database.query("set local session_replication_role = replica");
        if (revisionSessionId && originalSessionEndsAt) {
          await database.query(
            `update public.plan_revision_sessions
             set ends_at = $2::timestamptz
             where id = $1::uuid`,
            [revisionSessionId, originalSessionEndsAt],
          );
        }
        if (addedPrimaryMembership) {
          await database.query(
            `delete from public.class_memberships
             where class_id = $1::uuid and user_id = $2::uuid`,
            [primaryClassId, helpStudentId],
          );
        }
        await database.query("commit");
      } catch (error) {
        await database.query("rollback");
        throw error;
      }
    } finally {
      await Promise.all([
        database.end(),
        studentContext.close(),
        teacherContext.close(),
      ]);
    }
  }
});
