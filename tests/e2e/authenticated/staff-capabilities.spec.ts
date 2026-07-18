import { randomUUID } from "node:crypto";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type Route,
} from "@playwright/test";
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
const wrongClassId = "30000000-0000-4000-8000-000000000001";
const staffId = "10000000-0000-4000-8000-000000000005";
const studentId = "10000000-0000-4000-8000-000000000010";
const retainedCapabilities = [
  "class.workspace.read",
  "plan.preview",
] as const;

type CapturedRawAction = {
  url: string;
  headers: Record<string, string>;
  body: Buffer;
};

type CapturedMultipartPart = {
  name: string;
  filename?: string;
  mimeType?: string;
  bodyStart: number;
  bodyEnd: number;
};

async function captureRawNextServerAction(
  page: Page,
  expectedClassId: string,
  trigger: () => Promise<void>,
): Promise<CapturedRawAction> {
  let captured = false;
  let resolveCapture!: (value: CapturedRawAction) => void;
  const capture = new Promise<CapturedRawAction>((resolve) => {
    resolveCapture = resolve;
  });
  const handler = async (route: Route) => {
    const request = route.request();
    if (captured || request.method() !== "POST") {
      await route.continue();
      return;
    }
    const allHeaders = await request.allHeaders();
    const contentType = allHeaders["content-type"] ?? "";
    if (
      typeof allHeaders["next-action"] === "string" &&
      contentType.startsWith("multipart/form-data")
    ) {
      const body = request.postDataBuffer();
      if (!body) throw new Error("Server Action mangler request-body.");
      if (body.indexOf(expectedClassId, 0, "utf8") < 0) {
        await route.continue();
        return;
      }
      captured = true;
      const headers: Record<string, string> = {};
      for (const name of [
        "accept",
        "content-type",
        "next-action",
        "next-router-state-tree",
        "next-url",
        "x-deployment-id",
      ]) {
        const value = allHeaders[name];
        if (value) headers[name] = value;
      }
      await route.abort("blockedbyclient");
      resolveCapture({ url: request.url(), headers, body });
      return;
    }
    await route.continue();
  };

  await page.route(page.url(), handler);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        await trigger();
        return await capture;
      })(),
      new Promise<CapturedRawAction>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Fangst av Server Action overskred 20 sekunder.")),
          20_000,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
    await page.unrouteAll({ behavior: "wait" });
  }
}

function parseCapturedMultipart(
  body: Buffer,
  contentType: string,
): CapturedMultipartPart[] {
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType);
  const boundary = boundaryMatch?.[1] ?? boundaryMatch?.[2];
  if (!boundary) throw new Error("Multipart-boundary mangler i Server Action.");

  const marker = Buffer.from(`--${boundary}`, "utf8");
  const crlf = Buffer.from("\r\n", "utf8");
  const headerSeparator = Buffer.from("\r\n\r\n", "utf8");
  const nextMarker = Buffer.from(`\r\n--${boundary}`, "utf8");
  let markerOffset = body.indexOf(marker);
  if (markerOffset !== 0) {
    throw new Error("Multipart-body starter ikke med forventet boundary.");
  }

  const parts: CapturedMultipartPart[] = [];
  while (true) {
    const markerEnd = markerOffset + marker.length;
    const markerSuffix = body.subarray(markerEnd, markerEnd + 2);
    if (markerSuffix.equals(Buffer.from("--", "utf8"))) break;
    if (!markerSuffix.equals(crlf)) {
      throw new Error("Multipart-boundary har ugyldig avslutning.");
    }

    const headerStart = markerEnd + crlf.length;
    const headerEnd = body.indexOf(headerSeparator, headerStart);
    if (headerEnd < 0) throw new Error("Multipart-headere er ufullstendige.");
    const bodyStart = headerEnd + headerSeparator.length;
    const bodyEnd = body.indexOf(nextMarker, bodyStart);
    if (bodyEnd < bodyStart) {
      throw new Error("Multipart-delen mangler avsluttende boundary.");
    }

    const headers = body.subarray(headerStart, headerEnd).toString("latin1");
    const disposition =
      /(?:^|\r\n)Content-Disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]*)")?(?:\r\n|$)/i.exec(
        headers,
      );
    if (!disposition) {
      throw new Error("Multipart-delen mangler gyldig Content-Disposition.");
    }
    const mimeType =
      /(?:^|\r\n)Content-Type:\s*([^\r\n]+)/i.exec(headers)?.[1]?.trim();
    parts.push({
      name: disposition[1],
      filename: disposition[2],
      mimeType,
      bodyStart,
      bodyEnd,
    });
    markerOffset = bodyEnd + crlf.length;
  }
  if (parts.length === 0) throw new Error("Multipart-body mangler deler.");
  return parts;
}

function forgeCapturedMultipartClassAction(
  body: Buffer,
  contentType: string,
  fieldName: string,
  expectedMimeType: string,
  fileBytes: Buffer,
  fromClassId: string,
  toClassId: string,
): Buffer {
  const parts = parseCapturedMultipart(body, contentType);
  const roots = parts.filter((part) => part.name === "0" && !part.filename);
  expect(roots, "Server Action skal ha ett metadatafelt").toHaveLength(1);
  const root = roots[0];
  if (!root) throw new Error("Server Action mangler metadatafeltet 0.");

  const rootBody = body.subarray(root.bodyStart, root.bodyEnd);
  let actionMetadata: unknown;
  try {
    actionMetadata = JSON.parse(rootBody.toString("utf8"));
  } catch {
    throw new Error("Server Action-metadata kunne ikke dekodes som JSON.");
  }
  if (!Array.isArray(actionMetadata) || actionMetadata.length !== 2) {
    throw new Error("Server Action-metadata har uventet form.");
  }
  expect(actionMetadata[0]).toBe(fromClassId);
  const fileReference =
    typeof actionMetadata[1] === "string"
      ? /^\$K([0-9a-f]+)$/i.exec(actionMetadata[1])
      : null;
  if (!fileReference) {
    throw new Error("Server Action-metadata mangler filreferanse.");
  }

  const wireFieldName = `_${fileReference[1]}_${fieldName}`;
  const fileParts = parts.filter(
    (part) => part.name === wireFieldName && part.filename !== undefined,
  );
  expect(fileParts, `Filfeltet ${wireFieldName} skal forekomme én gang`).toHaveLength(
    1,
  );
  const filePart = fileParts[0];
  if (!filePart) throw new Error(`Filfeltet ${wireFieldName} mangler.`);
  expect(filePart.filename).toBeTruthy();
  expect(filePart.mimeType).toBe(expectedMimeType);
  expect(fileBytes.length).toBeGreaterThan(0);

  const sourceId = Buffer.from(fromClassId, "utf8");
  const targetId = Buffer.from(toClassId, "utf8");
  expect(sourceId.length).toBe(targetId.length);
  const classOffset = rootBody.indexOf(sourceId);
  expect(classOffset, "Kildeklassen mangler i metadatafeltet").toBeGreaterThanOrEqual(
    0,
  );
  expect(
    rootBody.indexOf(sourceId, classOffset + sourceId.length),
    "Kildeklassen forekommer flere ganger i metadatafeltet",
  ).toBe(-1);

  const forged = Buffer.from(body);
  targetId.copy(forged, root.bodyStart + classOffset);
  return Buffer.concat([
    forged.subarray(0, filePart.bodyStart),
    fileBytes,
    forged.subarray(filePart.bodyEnd),
  ]);
}

async function replayRawAction(
  context: BrowserContext,
  baseURL: string,
  action: CapturedRawAction,
  body: Buffer,
) {
  return context.request.fetch(action.url, {
    method: "POST",
    headers: {
      ...action.headers,
      origin: new URL(baseURL).origin,
    },
    data: body,
    maxRedirects: 0,
    timeout: 20_000,
  });
}

test.use({
  storageState: path.join(authDirectory, "other-org-staff-aal2.json"),
});

test.setTimeout(120_000);

test("et aktivt oppdrag håndhever hver tildelt kapabilitet", async ({
  context,
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error("Playwright baseURL mangler.");
  const database = await openLocalDatabase();
  const apiUrl = assertLocalSupabaseUrl(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  );
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new Error("Lokal service-role-nøkkel mangler.");
  const admin = createClient(apiUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: seededHelpRequest, error: seededHelpRequestError } = await admin
    .from("help_requests")
    .select("id, ownership_version, queue_session_id")
    .eq("organization_id", organizationId)
    .eq("class_id", classId)
    .eq("student_id", studentId)
    .eq("status", "waiting")
    .single();
  if (seededHelpRequestError || !seededHelpRequest) {
    throw (
      seededHelpRequestError ??
      new Error("Den øktbundne E2E-hjelpeforespørselen mangler.")
    );
  }
  const helpRequestId = seededHelpRequest.id;
  const helpOwnershipVersion = seededHelpRequest.ownership_version;
  const helpQueueSessionId = seededHelpRequest.queue_session_id;
  if (!helpQueueSessionId) {
    throw new Error("Den øktbundne E2E-hjelpeforespørselen mangler kø-ID.");
  }
  const token = randomUUID().slice(0, 8);
  const deniedTaskTitle = `Avvist oppgave ${token}`;
  const deniedPlanTitles = [
    `Avvist plan ${token} A`,
    `Avvist plan ${token} B`,
  ];
  const directTaskTitle = `Avvist direkte oppgave ${token}`;
  const directPlanTitle = `Avvist direkte plan ${token}`;
  const directWeeklyTitle = `Avvist direkte klasseuke ${token}`;
  const weeklyPlanDocx = await createSyntheticWeeklyPlanDocx();
  let assignmentId: string | null = null;

  async function readProtectedState() {
    const { rows } = await database.query<{
      task_count: number;
      task_audits: number;
      plan_audits: number;
      weekly_plan_count: number;
      weekly_plan_audits: number;
      help_audits: number;
      participant_count: number;
      participant_audits: number;
      participant_receipts: number;
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
            from public.weekly_plans
            where class_id = $1::uuid
          ) as weekly_plan_count,
          (
            select count(*)::integer
            from public.audit_events
            where event_name = 'weekly_plan.published'
              and metadata ->> 'class_id' = $1::text
          ) as weekly_plan_audits,
          (
            select count(*)::integer
            from public.audit_events
            where event_name = 'help.claimed'
              and entity_id = $2::uuid
          ) as help_audits,
          (
            select count(*)::integer
            from public.help_queue_staff_participants
            where class_id = $1::uuid
              and user_id = $5::uuid
          ) as participant_count,
          (
            select count(*)::integer
            from public.audit_events
            where event_name = 'help_queue.staff_joined'
              and actor_id = $5::uuid
              and metadata ->> 'class_id' = $1::text
          ) as participant_audits,
          (
            select count(*)::integer
            from public.help_queue_command_receipts
            where actor_id = $5::uuid
              and command = 'join_queue'
          ) as participant_receipts,
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
      [classId, helpRequestId, studentId, organizationId, staffId],
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
    await expect(
      page
        .getByRole("region", { name: "Elever" })
        .getByText("Elev ved annen skole", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Oppgave ved annen skole", { exact: true })).toBeVisible();
    await page.locator("#task-title").fill(deniedTaskTitle);

    const planPage = await context.newPage();
    await planPage.goto(`/v3/teacher/classes/${classId}`);
    const stalePlanPanel = planPage.getByRole("region", { name: "Importer oppgaveforslag" });
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
      name: "Publiser 2 som løse oppgaver",
    });
    await expect(stalePlanPublish).toBeVisible();

    const structuredPlanPage = await context.newPage();
    await structuredPlanPage.goto(`/v3/teacher/classes/${classId}`);
    const structuredPlanBuilder = structuredPlanPage.getByRole("region", {
      name: "Planlegg undervisningsøktene",
    });
    await structuredPlanBuilder.getByLabel("Uken starter").fill("2099-09-07");
    await structuredPlanBuilder
      .getByLabel("Tittel")
      .fill(`Avvist klasseuke ${token}`);
    await structuredPlanBuilder.getByLabel("Fag").fill("Norsk");
    await structuredPlanBuilder.getByLabel("Dato").fill("2099-09-08");
    await structuredPlanBuilder
      .getByLabel("Start", { exact: true })
      .fill("09:00");
    await structuredPlanBuilder
      .getByLabel("Slutt", { exact: true })
      .fill("09:45");
    await structuredPlanBuilder
      .getByLabel("Oppgave 1", { exact: true })
      .fill(`Avvist ukeoppgave ${token}`);
    await structuredPlanBuilder
      .getByRole("button", { name: "Kontroller klasseuken" })
      .click();
    const staleStructuredPublish = structuredPlanBuilder.getByRole("button", {
      name: "Publiser klasseuken",
    });
    await expect(staleStructuredPublish).toBeVisible();

    const helpPage = await context.newPage();
    await helpPage.goto(`/v3/teacher/classes/${classId}`);
    const staleHelpClaim = helpPage.getByRole("button", {
      name: "Jeg tar denne – Elev ved annen skole",
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
      weekly_plan_count: 1,
      weekly_plan_audits: 1,
      help_status: "waiting",
      claimed_by: null,
      support_level: 2,
      progress_enabled: true,
    });

    const wrongClassPreviewPage = await context.newPage();
    await wrongClassPreviewPage.goto(`/v3/teacher/classes/${classId}`);
    const wrongClassPreviewPanel = wrongClassPreviewPage.getByRole("region", {
      name: "Importer oppgaveforslag",
    });
    await wrongClassPreviewPanel
      .getByLabel("Ukeplan, maks 2 MB")
      .setInputFiles({
        name: "syntetisk-feil-klasse.docx",
        mimeType: DOCX_MIME,
        buffer: weeklyPlanDocx,
      });
    const capturedPreview = await captureRawNextServerAction(
      wrongClassPreviewPage,
      classId,
      () =>
        wrongClassPreviewPanel
          .getByRole("button", { name: "Lag forhåndsvisning" })
          .click(),
    );
    expect(capturedPreview.headers["content-type"]).toContain(
      "multipart/form-data",
    );
    const wrongClassResponse = await replayRawAction(
      context,
      baseURL,
      capturedPreview,
      forgeCapturedMultipartClassAction(
        capturedPreview.body,
        capturedPreview.headers["content-type"],
        "plan",
        DOCX_MIME,
        weeklyPlanDocx,
        classId,
        wrongClassId,
      ),
    );
    expect(wrongClassResponse.status()).toBe(200);
    expect(wrongClassResponse.headers()["content-type"]).toContain(
      "text/x-component",
    );
    expect(await wrongClassResponse.text()).toContain(
      "Tilgangen til denne klassen er avsluttet.",
    );
    expect(await readProtectedState()).toEqual(baseline);

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
      reducedPage
        .getByRole("region", { name: "Elever" })
        .getByText("Elev ved annen skole", { exact: true }),
    ).toBeVisible();
    await expect(
      reducedPage.getByText("Oppgave ved annen skole", { exact: true }),
    ).toBeVisible();
    await expect(
      reducedPage.getByRole("heading", { name: "Publiser løs oppgave" }),
    ).toHaveCount(0);
    await expect(
      reducedPage.getByRole("heading", { name: "Hjelpekø" }),
    ).toHaveCount(0);
    await expect(
      reducedPage.getByText("Tilpass visning", { exact: true }),
    ).toHaveCount(0);
    await expect(
      reducedPage.getByRole("region", {
        name: "Planlegg undervisningsøktene",
      }),
    ).toHaveCount(0);

    const reducedPlanPanel = reducedPage.getByRole("region", {
      name: "Importer oppgaveforslag",
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
      reducedPlanPanel.getByRole("button", { name: /Publiser .* som løse oppgaver/ }),
    ).toHaveCount(0);
    expect((await readProtectedState()).task_count).toBe(baseline.task_count);
    await expectNoHorizontalOverflow(reducedPage);
    await expectNoAxeViolations(reducedPage);

    await page.getByRole("button", { name: "Publiser løs oppgave" }).click();
    await expect(page).toHaveURL(new RegExp(`${classId}\\?access=ended$`));
    await expect(
      page.getByRole("heading", { name: "Publiser løs oppgave" }),
    ).toHaveCount(0);

    await stalePlanPublish.click();
    await expect(planPage).toHaveURL(new RegExp(`${classId}\\?access=ended$`));
    await expect(
      planPage.getByRole("button", { name: /Publiser .* som løse oppgaver/ }),
    ).toHaveCount(0);

    await staleStructuredPublish.click();
    await expect(structuredPlanPage).toHaveURL(
      new RegExp(`${classId}\\?access=ended$`),
    );
    await expect(
      structuredPlanPage.getByRole("region", {
        name: "Planlegg undervisningsøktene",
      }),
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

    const [taskRpc, planRpc, weeklyPlanRpc, helpRpc, joinHelpRpc, supportRpc] =
      await Promise.all([
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
        admin.rpc("publish_initial_weekly_plan", {
          p_class_id: classId,
          p_actor_id: staffId,
          p_staff_assignment_id: assignmentId,
          p_week_start_date: "2099-09-14",
          p_timezone_name: "Europe/Oslo",
          p_expected_lock_version: 0,
          p_request_id: randomUUID(),
          p_semantic_hash: "a".repeat(64),
          p_candidate: {
            schema_version: "weekly_plan_v1",
            sessions: [
              {
                logical_key: randomUUID(),
                title: directWeeklyTitle,
                subject: "Norsk",
                starts_at: "2099-09-15T08:00:00.000Z",
                ends_at: "2099-09-15T09:00:00.000Z",
                tasks: [
                  {
                    logical_key: randomUUID(),
                    title: directWeeklyTitle,
                    description: null,
                    subject: "Norsk",
                    estimated_minutes: 10,
                    support_level: 2,
                  },
                ],
              },
            ],
          },
        }),
        admin.rpc("claim_student_help_v3", {
          p_request_id: helpRequestId,
          p_expected_ownership_version: helpOwnershipVersion,
          p_actor_id: staffId,
          p_staff_assignment_id: assignmentId,
          p_command_request_id: randomUUID(),
        }),
        admin.rpc("join_help_queue_staff_v1", {
          p_queue_session_id: helpQueueSessionId,
          p_actor_id: staffId,
          p_staff_assignment_id: assignmentId,
          p_request_id: randomUUID(),
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
    for (const [result, expectedMessage] of [
      [taskRpc, "Staff assignment does not authorize task publishing"],
      [planRpc, "Staff assignment does not authorize plan publishing"],
      [
        weeklyPlanRpc,
        "Staff assignment does not authorize weekly plan publishing",
      ],
      [
        joinHelpRpc,
        "Staff assignment does not authorize help queue management",
      ],
      [
        helpRpc,
        "Staff assignment does not authorize help queue management",
      ],
      [
        supportRpc,
        "Staff assignment does not authorize student support updates",
      ],
    ] as const) {
      expect(result.error?.code).toBe("P0001");
      expect(result.error?.message).toBe(expectedMessage);
    }

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
          directWeeklyTitle,
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

    await restoreCapabilityProfile(database, assignmentId);
    const stalePreviewPage = await context.newPage();
    const initialQueueSync = stalePreviewPage.waitForResponse(
      (response) => {
        const request = response.request();
        return (
          request.method() === "GET" &&
          new URL(response.url()).pathname ===
            `/v3/teacher/classes/${classId}` &&
          request.headers().rsc === "1" &&
          (response.headers()["content-type"] ?? "").includes(
            "text/x-component",
          )
        );
      },
    );
    await stalePreviewPage.goto(`/v3/teacher/classes/${classId}`);
    await initialQueueSync;
    const stalePreviewPanel = stalePreviewPage.getByRole("region", {
      name: "Importer oppgaveforslag",
    });
    await stalePreviewPanel.getByLabel("Ukeplan, maks 2 MB").setInputFiles({
      name: "syntetisk-forhandsvisning.docx",
      mimeType: DOCX_MIME,
      buffer: weeklyPlanDocx,
    });
    const beforePreviewDenial = await readProtectedState();
    const withoutPlanPreview = STAFF_CAPABILITIES.filter(
      (capability) => capability !== "plan.preview",
    ) as [string, ...string[]];
    await retainOnlyCapabilities(
      database,
      assignmentId,
      withoutPlanPreview,
    );
    await stalePreviewPanel
      .getByRole("button", { name: "Lag forhåndsvisning" })
      .click();
    await expect(stalePreviewPage).toHaveURL(
      new RegExp(`${classId}\\?access=ended$`),
    );
    expect(await readProtectedState()).toEqual(beforePreviewDenial);

    const withoutPreviewPage = await context.newPage();
    await withoutPreviewPage.goto(`/v3/teacher/classes/${classId}`);
    await expect(
      withoutPreviewPage.getByRole("heading", { name: "Annen skole 5C" }),
    ).toBeVisible();
    await expect(
      withoutPreviewPage
        .getByRole("region", { name: "Elever" })
        .getByText("Elev ved annen skole", { exact: true }),
    ).toBeVisible();
    await expect(
      withoutPreviewPage.getByText("Oppgave ved annen skole", { exact: true }),
    ).toBeVisible();
    await expect(
      withoutPreviewPage.getByRole("region", { name: "Importer oppgaveforslag" }),
    ).toHaveCount(0);

    await restoreCapabilityProfile(database, assignmentId);
    const withoutWorkspace = STAFF_CAPABILITIES.filter(
      (capability) => capability !== "class.workspace.read",
    ) as [string, ...string[]];
    await retainOnlyCapabilities(database, assignmentId, withoutWorkspace);
    const dashboardWithoutWorkspace = await context.newPage();
    await dashboardWithoutWorkspace.goto("/v3/teacher");
    await expect(
      dashboardWithoutWorkspace.getByText("Annen skole 5C", { exact: true }),
    ).toHaveCount(0);

    const classWithoutWorkspace = await context.newPage();
    await classWithoutWorkspace.goto(`/v3/teacher/classes/${classId}`);
    await expect(
      classWithoutWorkspace.getByRole("heading", {
        name: "Tilgangen er avsluttet",
      }),
    ).toBeVisible();
    await expect(
      classWithoutWorkspace.getByText("Elev ved annen skole", { exact: true }),
    ).toHaveCount(0);
    await expect(
      classWithoutWorkspace.getByText("Oppgave ved annen skole", {
        exact: true,
      }),
    ).toHaveCount(0);
  } finally {
    if (assignmentId) {
      await restoreCapabilityProfile(database, assignmentId);
    }
    await database.end();
  }
});
