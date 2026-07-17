import { randomUUID } from "node:crypto";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Route } from "@playwright/test";
import { assertLocalSupabaseUrl } from "../../../scripts/e2e/local-safety.mjs";
import {
  expectNoAxeViolations,
  expectNoHorizontalOverflow,
  observeRuntimeErrors,
} from "../support/quality";
import {
  createSyntheticWeeklyPlanDocx,
  DOCX_MIME,
} from "../support/synthetic-docx";

const authDirectory = path.join(process.cwd(), "playwright", ".auth");
const classId = "30000000-0000-4000-8000-000000000001";
const organizationId = "20000000-0000-4000-8000-000000000001";
const studentId = "10000000-0000-4000-8000-000000000002";
const lifecycleHelpStudentId = "10000000-0000-4000-8000-000000000013";
const substituteId = "10000000-0000-4000-8000-000000000003";

function state(name: string) {
  return path.join(authDirectory, name);
}

function delayedServerAction() {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let delayed = false;
  const handler = async (route: Route) => {
    if (
      !delayed &&
      route.request().method() === "POST" &&
      route.request().headers()["next-action"]
    ) {
      delayed = true;
      await gate;
    }
    await route.continue();
  };
  return { handler, release };
}

test("owner oppretter, vikar bruker og owner tilbakekaller klasseoppdrag", async ({
  browser,
  baseURL,
}) => {
  test.setTimeout(90_000);
  if (!baseURL) throw new Error("Playwright baseURL mangler.");
  const apiUrl = assertLocalSupabaseUrl(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  );
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error("Lokal service-role-nøkkel mangler.");
  const admin = createClient(apiUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  async function requestStudentHelp() {
    const { data: queue, error: queueError } = await admin
      .from("help_queue_sessions")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("class_id", classId)
      .eq("status", "open")
      .single();
    if (queueError || !queue) {
      throw queueError ?? new Error("Den åpne E2E-hjelpekøen mangler.");
    }
    const { data: request, error: requestError } = await admin.rpc(
      "request_student_help_v2",
      {
        p_queue_session_id: queue.id,
        p_student_id: lifecycleHelpStudentId,
        p_request_id: randomUUID(),
        p_task_assignment_id: null,
      },
    );
    if (requestError || !request || typeof request.request_id !== "string") {
      throw (
        requestError ??
        new Error("Den øktbundne E2E-hjelpeforespørselen mangler.")
      );
    }
    return request.request_id;
  }
  const importToken = randomUUID().slice(0, 8);
  const weeklyPlanDocx = await createSyntheticWeeklyPlanDocx();

  const ownerAal1 = await browser.newContext({
    baseURL,
    storageState: state("owner-aal1.json"),
  });
  const ownerAal1Page = await ownerAal1.newPage();
  await ownerAal1Page.goto("/v3/teacher/access");
  await expect(ownerAal1Page).toHaveURL(/\/v3\/mfa\/challenge$/);
  await expect(ownerAal1Page.getByText("Livsløpsvikar")).toHaveCount(0);
  await ownerAal1.close();

  const substituteAal1 = await browser.newContext({
    baseURL,
    storageState: state("substitute-aal1.json"),
  });
  const substituteAal1Page = await substituteAal1.newPage();
  await substituteAal1Page.goto(`/v3/teacher/classes/${classId}`);
  await expect(substituteAal1Page).toHaveURL(/\/v3\/mfa\/challenge$/);
  await expect(substituteAal1Page.getByText("Testelev", { exact: true })).toHaveCount(0);
  await substituteAal1.close();

  const substitute = await browser.newContext({
    baseURL,
    storageState: state("substitute-aal2.json"),
  });
  const substitutePage = await substitute.newPage();
  await substitutePage.goto("/v3/teacher/access");
  await expect(substitutePage.getByRole("heading", { name: "Tilganger" })).toHaveCount(0);
  await expect(substitutePage.getByText("Testeier", { exact: true })).toHaveCount(0);
  expect(await substitutePage.content()).not.toMatch(
    /staff_assignments|operational_owner|legacy_teacher/,
  );

  const otherStaff = await browser.newContext({
    baseURL,
    storageState: state("other-org-staff-aal2.json"),
  });
  const otherPage = await otherStaff.newPage();
  await otherPage.goto(`/v3/teacher/classes/${classId}`);
  await expect(otherPage.getByRole("heading", { name: "Tilgangen er avsluttet" })).toBeVisible();
  await expect(otherPage.getByText("Testelev", { exact: true })).toHaveCount(0);
  await otherPage.goto("/v3/teacher/access");
  await expect(otherPage.getByRole("heading", { name: "Tilganger" })).toHaveCount(0);
  await expect(otherPage.getByText("Livsløpsvikar", { exact: true })).toHaveCount(0);
  await otherStaff.close();

  const student = await browser.newContext({
    baseURL,
    storageState: state("student.json"),
  });
  const studentPage = await student.newPage();
  await studentPage.goto("/v3/teacher/access");
  await expect(studentPage).toHaveURL(/\/login$/);
  await expect(studentPage.getByText("Livsløpsvikar", { exact: true })).toHaveCount(0);
  await student.close();

  const owner = await browser.newContext({
    baseURL,
    storageState: state("owner-aal2.json"),
  });
  const ownerPage = await owner.newPage();
  const ownerRuntime = observeRuntimeErrors(ownerPage);
  await ownerPage.goto("/v3/teacher/access");
  await expect(ownerPage.getByRole("heading", { name: "Tilganger" })).toBeVisible();
  await ownerPage.getByRole("button", { name: "Gi tilgang" }).click();
  const createDialog = ownerPage.getByRole("dialog", { name: "Gi tilgang" });
  await createDialog.getByLabel("Ansatt").selectOption({ label: "Livsløpsvikar" });
  await createDialog.getByLabel("Rolle i oppdraget").selectOption("substitute");
  await createDialog.getByLabel("Klasse").selectOption({ label: "Testklasse 3A" });
  const createDelay = delayedServerAction();
  await ownerPage.route("**/*", createDelay.handler);
  await createDialog.getByRole("button", { name: "Bekreft oppdrag" }).click();
  await expect(createDialog.getByRole("button", { name: "Oppretter …" })).toBeVisible();
  await ownerPage.keyboard.press("Escape");
  await expect(createDialog).toBeVisible();
  createDelay.release();
  await expect(ownerPage.getByRole("status")).toContainText("Oppdraget er opprettet");
  await expect(ownerPage.getByRole("status")).toBeFocused();
  await ownerPage.unroute("**/*", createDelay.handler);

  // Den owner-only siden svarer med en forventet 404 over. Observer resten av
  // den autoriserte flaten uten å skjule reelle runtime-feil der.
  const substituteRuntime = observeRuntimeErrors(substitutePage);
  await substitutePage.goto("/v3/teacher");
  await expect(substitutePage.getByRole("link", { name: /Testklasse 3A/ })).toBeVisible();
  await expect(substitutePage.getByRole("link", { name: /Visuell klasse 4B/ })).toHaveCount(0);
  await expect(substitutePage.getByRole("link", { name: "Tilganger" })).toHaveCount(0);
  const deniedClassPage = await substitute.newPage();
  await deniedClassPage.goto("/v3/teacher/classes/30000000-0000-4000-8000-000000000002");
  await expect(
    deniedClassPage.getByRole("heading", { name: "Tilgangen er avsluttet" }),
  ).toBeVisible();
  await expect(deniedClassPage.getByText("Visuell elev", { exact: true })).toHaveCount(0);
  await expect(deniedClassPage.getByText("Visuell klasse 4B", { exact: true })).toHaveCount(0);
  await expect(
    deniedClassPage.getByText("Visuell arbeidsoppgave", { exact: true }),
  ).toHaveCount(0);
  await expect(
    deniedClassPage.getByRole("region", { name: "Importer oppgaveforslag" }),
  ).toHaveCount(0);
  await expect(
    deniedClassPage.getByRole("button", { name: "Publiser løs oppgave" }),
  ).toHaveCount(0);
  expect(await deniedClassPage.content()).not.toMatch(
    /Visuell elev|Visuell klasse 4B|Visuell arbeidsoppgave|staff_assignments|operational_owner|legacy_teacher/,
  );
  await deniedClassPage.close();
  await substitutePage.getByRole("link", { name: /Testklasse 3A/ }).click();
  await expect(
    substitutePage
      .getByRole("region", { name: "Elever" })
      .getByText("Testelev", { exact: true }),
  ).toBeVisible();

  await requestStudentHelp();
  await substitutePage
    .getByRole("button", {
      name: "Jeg tar denne – Livsløpselev",
    })
    .click();
  const resolveHelpButton = substitutePage.getByRole("button", {
    name: "Ferdig hjulpet – Livsløpselev",
  });
  await expect(resolveHelpButton).toBeVisible();
  await resolveHelpButton.click();
  await expect(substitutePage.getByText("Ingen venter på hjelp.")).toBeVisible();

  const testStudentRow = substitutePage
    .getByRole("region", { name: "Elever" })
    .getByRole("listitem")
    .filter({ hasText: "Testelev" });
  await testStudentRow.getByText("Tilpass visning", { exact: true }).click();
  await testStudentRow.getByLabel("Støtte for Testelev").selectOption("1");
  await testStudentRow.getByRole("button", { name: "Lagre", exact: true }).click();
  await expect(substitutePage.getByText("Lagret.", { exact: true })).toBeVisible();

  await substitutePage.locator("#task-title").fill("Oppgave publisert av vikar");
  await substitutePage.getByRole("button", { name: "Publiser løs oppgave" }).click();
  await expect(
    substitutePage.getByRole("status").filter({ hasText: "Den løse oppgaven er publisert" }),
  ).toBeVisible();

  const importPanel = substitutePage.getByRole("region", {
    name: "Importer oppgaveforslag",
  });
  const { count: importedBeforePreview, error: importedBeforePreviewError } =
    await admin
      .from("task_definitions")
      .select("id", { count: "exact", head: true })
      .eq("class_id", classId)
      .like("title", "E2E import%");
  if (importedBeforePreviewError) throw importedBeforePreviewError;
  await importPanel.getByLabel("Ukeplan, maks 2 MB").setInputFiles({
    name: "syntetisk-ukeplan.docx",
    mimeType: DOCX_MIME,
    buffer: weeklyPlanDocx,
  });
  await importPanel
    .getByRole("button", { name: "Lag forhåndsvisning" })
    .click();
  await expect(
    importPanel.getByRole("textbox", { name: "Oppgave 1", exact: true }),
  ).toHaveValue(
    "E2E import: les side 12",
  );
  await expect(
    importPanel.getByRole("textbox", { name: "Oppgave 2", exact: true }),
  ).toHaveValue(
    "E2E import: regn oppgave 4.12",
  );
  await expect(importPanel.getByLabel("Fag").nth(0)).toHaveValue("Norsk");
  await expect(importPanel.getByLabel("Fag").nth(1)).toHaveValue("Matematikk");
  const { count: importedAfterPreview, error: importedAfterPreviewError } =
    await admin
      .from("task_definitions")
      .select("id", { count: "exact", head: true })
      .eq("class_id", classId)
      .like("title", "E2E import%");
  if (importedAfterPreviewError) throw importedAfterPreviewError;
  expect(importedAfterPreview).toBe(importedBeforePreview);
  await importPanel
    .getByRole("textbox", { name: "Oppgave 1", exact: true })
    .fill(`E2E import kontrollert ${importToken}: les side 12`);
  await importPanel
    .getByRole("textbox", { name: "Oppgave 2", exact: true })
    .fill(`E2E import kontrollert ${importToken}: regn oppgave 4.12`);
  await importPanel
    .getByRole("button", { name: "Publiser 2 som løse oppgaver" })
    .click();
  await expect(importPanel.getByRole("status")).toHaveText(
    "2 oppgaver er publisert.",
  );

  const importedTitles = [
    `E2E import kontrollert ${importToken}: les side 12`,
    `E2E import kontrollert ${importToken}: regn oppgave 4.12`,
  ];
  const { data: runtimeAssignments, error: runtimeAssignmentError } =
    await admin
      .from("staff_assignments")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", substituteId)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(1);
  if (runtimeAssignmentError || runtimeAssignments.length !== 1) {
    throw runtimeAssignmentError ?? new Error("Vikaroppdraget mangler.");
  }
  const runtimeAssignmentId = runtimeAssignments[0].id;
  const { data: importedTasks, error: importedTaskError } = await admin
    .from("task_definitions")
    .select("id, title")
    .eq("organization_id", organizationId)
    .eq("class_id", classId)
    .in("title", importedTitles)
    .order("title");
  if (importedTaskError) throw importedTaskError;
  expect(importedTasks.map((task) => task.title).sort()).toEqual(
    [...importedTitles].sort(),
  );
  const importedTaskIds = importedTasks.map((task) => task.id);
  const { data: importedAssignments, error: importedAssignmentError } =
    await admin
      .from("task_assignments")
      .select("id, task_definition_id, student_id")
      .eq("class_id", classId)
      .eq("student_id", studentId)
      .in("task_definition_id", importedTaskIds);
  if (importedAssignmentError) throw importedAssignmentError;
  expect(importedAssignments).toHaveLength(2);
  const { data: importedStates, error: importedStateError } = await admin
    .from("student_task_state")
    .select("assignment_id, status")
    .in(
      "assignment_id",
      importedAssignments.map((assignment) => assignment.id),
    );
  if (importedStateError) throw importedStateError;
  expect(importedStates).toHaveLength(2);
  expect(importedStates.every((state) => state.status === "assigned")).toBe(
    true,
  );
  const { data: importedTaskAudits, error: importedTaskAuditError } =
    await admin
      .from("audit_events")
      .select(
        "entity_id, authorizing_staff_assignment_id, authorizing_capability",
      )
      .eq("event_name", "task.published")
      .eq("authorizing_staff_assignment_id", runtimeAssignmentId)
      .eq("authorizing_capability", "plan.publish")
      .in("entity_id", importedTaskIds);
  if (importedTaskAuditError) throw importedTaskAuditError;
  expect(importedTaskAudits).toHaveLength(2);
  const { data: planAudits, error: planAuditError } = await admin
    .from("audit_events")
    .select(
      "metadata, authorizing_staff_assignment_id, authorizing_capability",
    )
    .eq("event_name", "plan.published")
    .eq("entity_id", classId)
    .eq("authorizing_staff_assignment_id", runtimeAssignmentId)
    .eq("authorizing_capability", "plan.publish");
  if (planAuditError) throw planAuditError;
  expect(planAudits).toHaveLength(1);
  const planTaskIds = (planAudits[0].metadata as { task_ids?: unknown })
    .task_ids;
  expect(Array.isArray(planTaskIds) ? [...planTaskIds].sort() : []).toEqual(
    [...importedTaskIds].sort(),
  );
  await expectNoHorizontalOverflow(substitutePage);
  await expectNoAxeViolations(substitutePage);

  const staleHelpId = await requestStudentHelp();

  const staleHelpPage = await substitute.newPage();
  await staleHelpPage.goto(`/v3/teacher/classes/${classId}`);
  const staleHelpButton = staleHelpPage.getByRole("button", {
    name: "Jeg tar denne – Livsløpselev",
  });
  await expect(staleHelpButton).toBeVisible();

  const staleSupportPage = await substitute.newPage();
  await staleSupportPage.goto(`/v3/teacher/classes/${classId}`);
  const staleTestStudentRow = staleSupportPage
    .getByRole("region", { name: "Elever" })
    .getByRole("listitem")
    .filter({ hasText: "Testelev" });
  await staleTestStudentRow
    .getByText("Tilpass visning", { exact: true })
    .click();
  await staleTestStudentRow.getByLabel("Støtte for Testelev").selectOption("3");

  const stalePlanPage = await substitute.newPage();
  await stalePlanPage.goto(`/v3/teacher/classes/${classId}`);
  await stalePlanPage.getByLabel("Ukeplan, maks 2 MB").setInputFiles({
    name: "syntetisk.docx",
    mimeType: DOCX_MIME,
    buffer: weeklyPlanDocx,
  });

  const stalePlanPublishPage = await substitute.newPage();
  await stalePlanPublishPage.goto(`/v3/teacher/classes/${classId}`);
  const stalePublishPanel = stalePlanPublishPage.getByRole("region", {
    name: "Importer oppgaveforslag",
  });
  await stalePublishPanel.getByLabel("Ukeplan, maks 2 MB").setInputFiles({
    name: "syntetisk-publish.docx",
    mimeType: DOCX_MIME,
    buffer: weeklyPlanDocx,
  });
  await stalePublishPanel
    .getByRole("button", { name: "Lag forhåndsvisning" })
    .click();
  await expect(
    stalePublishPanel.getByRole("textbox", {
      name: "Oppgave 1",
      exact: true,
    }),
  ).toHaveValue(
    "E2E import: les side 12",
  );
  await stalePublishPanel
    .getByRole("textbox", { name: "Oppgave 1", exact: true })
    .fill("Avvist import etter tilbakekalling 1");
  await stalePublishPanel
    .getByRole("textbox", { name: "Oppgave 2", exact: true })
    .fill("Avvist import etter tilbakekalling 2");
  const stalePublishButton = stalePublishPanel.getByRole("button", {
    name: "Publiser 2 som løse oppgaver",
  });
  await expect(stalePublishButton).toBeVisible();

  await ownerPage.reload();
  const assignmentRow = ownerPage
    .getByRole("listitem")
    .filter({ hasText: "Livsløpsvikar" })
    .filter({ hasText: "Testklasse 3A" });
  await expect(assignmentRow).toHaveCount(1);
  await assignmentRow.getByRole("button", { name: "Trekk tilbake" }).click();
  const revokeDialog = ownerPage.getByRole("dialog", {
    name: "Trekk tilbake oppdrag?",
  });
  await expect(revokeDialog).toContainText("Livsløpsvikar");
  const revokeDelay = delayedServerAction();
  await ownerPage.route("**/*", revokeDelay.handler);
  await revokeDialog.getByRole("button", { name: "Trekk tilbake" }).click();
  await expect(
    revokeDialog.getByRole("button", { name: "Trekker tilbake …" }),
  ).toBeVisible();
  await ownerPage.keyboard.press("Escape");
  await expect(revokeDialog).toBeVisible();
  revokeDelay.release();
  await expect(ownerPage.getByRole("status")).toContainText(
    "Oppdraget er trukket tilbake",
  );
  await expect(ownerPage.getByRole("status")).toBeFocused();
  await ownerPage.unroute("**/*", revokeDelay.handler);

  const [taskAuditBaseline, planAuditBaseline, supportAuditBaseline] =
    await Promise.all([
      admin
        .from("audit_events")
        .select("id", { count: "exact", head: true })
        .eq("event_name", "task.published")
        .contains("metadata", { class_id: classId }),
      admin
        .from("audit_events")
        .select("id", { count: "exact", head: true })
        .eq("event_name", "plan.published")
        .eq("entity_id", classId),
      admin
        .from("audit_events")
        .select("id", { count: "exact", head: true })
        .eq("event_name", "student.experience.updated")
        .eq("entity_id", studentId),
    ]);
  if (
    taskAuditBaseline.error ||
    planAuditBaseline.error ||
    supportAuditBaseline.error ||
    taskAuditBaseline.count === null ||
    planAuditBaseline.count === null ||
    supportAuditBaseline.count === null
  ) {
    throw (
      taskAuditBaseline.error ??
      planAuditBaseline.error ??
      supportAuditBaseline.error ??
      new Error("Kunne ikke lese audit-baseline før stale handlinger.")
    );
  }
  const auditsBefore = taskAuditBaseline.count;
  const planAuditsBefore = planAuditBaseline.count;
  const supportAuditsBefore = supportAuditBaseline.count;

  await substitutePage.locator("#task-title").fill("Avvist etter tilbakekalling");
  await substitutePage.getByRole("button", { name: "Publiser løs oppgave" }).click();
  await expect(
    substitutePage.getByRole("heading", { name: "Tilgangen er avsluttet" }),
  ).toBeVisible();
  await expect(
    substitutePage.getByRole("heading", { name: "Tilgangen er avsluttet" }),
  ).toBeFocused();
  await expect(substitutePage.getByText("Testelev", { exact: true })).toHaveCount(0);
  await expect(substitutePage.getByText("Oppgave publisert av vikar", { exact: true })).toHaveCount(0);

  await staleHelpButton.click();
  await expect(
    staleHelpPage.getByRole("heading", { name: "Tilgangen er avsluttet" }),
  ).toBeVisible();
  await staleSupportPage.getByRole("button", { name: "Lagre", exact: true }).click();
  await expect(
    staleSupportPage.getByRole("heading", { name: "Tilgangen er avsluttet" }),
  ).toBeVisible();
  await stalePlanPage.getByRole("button", { name: "Lag forhåndsvisning" }).click();
  await expect(
    stalePlanPage.getByRole("heading", { name: "Tilgangen er avsluttet" }),
  ).toBeVisible();
  await stalePublishButton.click();
  await expect(
    stalePlanPublishPage.getByRole("heading", {
      name: "Tilgangen er avsluttet",
    }),
  ).toBeVisible();
  await expect(
    stalePlanPublishPage.getByRole("heading", {
      name: "Tilgangen er avsluttet",
    }),
  ).toBeFocused();

  await expect(
    substitutePage.getByRole("heading", { name: "Tilgangen er avsluttet" }),
  ).toBeVisible();

  const [
    { count: deniedTasks, error: taskError },
    { count: auditsAfter, error: auditAfterError },
    { count: deniedImportedTasks, error: deniedImportedTaskError },
    { count: planAuditsAfter, error: planAuditAfterError },
    { data: staleHelp, error: staleHelpReadError },
    { count: staleHelpAudits, error: staleHelpAuditError },
    { data: supportSettings, error: supportReadError },
    { count: supportAuditsAfter, error: supportAuditError },
  ] = await Promise.all([
      admin
        .from("task_definitions")
        .select("id", { count: "exact", head: true })
        .eq("title", "Avvist etter tilbakekalling"),
      admin
        .from("audit_events")
        .select("id", { count: "exact", head: true })
        .eq("event_name", "task.published")
        .contains("metadata", { class_id: classId }),
      admin
        .from("task_definitions")
        .select("id", { count: "exact", head: true })
        .eq("class_id", classId)
        .like("title", "Avvist import etter tilbakekalling%"),
      admin
        .from("audit_events")
        .select("id", { count: "exact", head: true })
        .eq("event_name", "plan.published")
        .eq("entity_id", classId),
      admin
        .from("help_requests")
        .select("status, claimed_by")
        .eq("id", staleHelpId)
        .single(),
      admin
        .from("audit_events")
        .select("id", { count: "exact", head: true })
        .eq("event_name", "help.claimed")
        .eq("entity_id", staleHelpId),
      admin
        .from("student_experience_settings")
        .select("support_level, progress_enabled")
        .eq("organization_id", organizationId)
        .eq("student_id", studentId)
        .single(),
      admin
        .from("audit_events")
        .select("id", { count: "exact", head: true })
        .eq("event_name", "student.experience.updated")
        .eq("entity_id", studentId),
    ]);
  if (
    taskError ||
    auditAfterError ||
    deniedImportedTaskError ||
    planAuditAfterError ||
    staleHelpReadError ||
    staleHelpAuditError ||
    supportReadError ||
    supportAuditError
  ) {
    throw (
      taskError ??
      auditAfterError ??
      deniedImportedTaskError ??
      planAuditAfterError ??
      staleHelpReadError ??
      staleHelpAuditError ??
      supportReadError ??
      supportAuditError
    );
  }
  expect(deniedTasks).toBe(0);
  expect(auditsAfter).toBe(auditsBefore);
  expect(deniedImportedTasks).toBe(0);
  expect(planAuditsAfter).toBe(planAuditsBefore);
  expect(staleHelp).toEqual({ status: "waiting", claimed_by: null });
  expect(staleHelpAudits).toBe(0);
  expect(supportSettings).toEqual({ support_level: 1, progress_enabled: true });
  expect(supportAuditsAfter).toBe(supportAuditsBefore);

  await expectNoHorizontalOverflow(ownerPage);
  await expectNoAxeViolations(ownerPage);
  ownerRuntime();
  substituteRuntime();
  await Promise.all([owner.close(), substitute.close()]);
});
