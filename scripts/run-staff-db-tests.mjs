import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scenario =
  process.argv.find((argument) => argument.startsWith("--scenario="))?.split("=")[1] ??
  "all";

if (!["all", "empty", "upgrade"].includes(scenario)) {
  throw new Error("Database-scenario må være all, empty eller upgrade.");
}

const preA1Migrations = [
  "20260714000000_initial_core.sql",
  "20260714000001_authorization.sql",
  "20260714000002_prototype_auth.sql",
  "20260714000003_core_operations.sql",
  "20260714000004_help_queue_operations.sql",
  "20260714000005_plan_import_operations.sql",
  "20260714000006_student_experience.sql",
];
const a1Migration = "20260715000000_staff_assignments.sql";
const a1FollowupMigrations = [
  "20260715000001_staff_support_read_hardening.sql",
];
const postA1Migrations = [
  "20260716000000_staff_capability_v2.sql",
  "20260716000001_progress_core.sql",
  "20260716000002_weekly_plan_sessions.sql",
  "20260717000000_session_help_queues.sql",
];
const e2Migration = "20260717000001_help_queue_staff_controls.sql";
const d2Migration = "20260717000002_task_iteration_scheduling.sql";
const d3Migration = "20260717000003_student_task_catalog.sql";
const b2Migration = "20260717000004_flower_rewards.sql";
const activeContainers = new Set();

function runDocker(args, options = {}) {
  const result = spawnSync("docker", args, {
    cwd: root,
    encoding: "utf8",
    input: options.input,
    stdio: options.inherit ? "inherit" : [options.input ? "pipe" : "ignore", "pipe", "pipe"],
    shell: false,
    timeout: options.timeout ?? 120_000,
  });
  if (result.error || result.status !== 0) {
    const detail = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
    throw result.error ?? new Error(`docker ${args[0]} feilet: ${detail.slice(-4_000)}`);
  }
  return (result.stdout ?? "").trim();
}

function cleanupContainer(name) {
  if (!activeContainers.delete(name)) return;
  spawnSync("docker", ["rm", "-f", name], {
    cwd: root,
    stdio: "ignore",
    shell: false,
    timeout: 30_000,
  });
}

function cleanupAll() {
  for (const name of [...activeContainers]) cleanupContainer(name);
}

process.once("SIGINT", () => {
  cleanupAll();
  process.exit(130);
});
process.once("SIGTERM", () => {
  cleanupAll();
  process.exit(143);
});

function startContainer(label) {
  const suffix = randomBytes(5).toString("hex");
  const name = `klar-a1-${label}-${process.pid}-${suffix}`;
  const password = `synthetic-${randomBytes(18).toString("base64url")}`;
  runDocker([
    "run",
    "--rm",
    "-d",
    "--name",
    name,
    "-e",
    `POSTGRES_PASSWORD=${password}`,
    "-p",
    "127.0.0.1::5432",
    "postgres:17",
  ]);
  activeContainers.add(name);

  let ready = false;
  let consecutiveReadyProbes = 0;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const probe = spawnSync("docker", [
      "exec",
      name,
      "psql",
      "-X",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-Atqc",
      "select 1",
    ], {
      cwd: root,
      stdio: "ignore",
      shell: false,
      timeout: 5_000,
    });
    consecutiveReadyProbes = !probe.error && probe.status === 0
      ? consecutiveReadyProbes + 1
      : 0;
    if (consecutiveReadyProbes >= 6) {
      ready = true;
      break;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  if (!ready) throw new Error(`Lokal PostgreSQL-container ${name} ble ikke klar.`);

  const mapping = runDocker(["port", name, "5432/tcp"]);
  const port = Number(mapping.match(/127\.0\.0\.1:(\d+)/)?.[1]);
  if (!Number.isInteger(port) || port < 1) {
    throw new Error(`Docker publiserte ikke PostgreSQL på loopback: ${mapping}`);
  }
  return {
    name,
    config: {
      host: "127.0.0.1",
      port,
      user: "postgres",
      password,
      database: "postgres",
      connectionTimeoutMillis: 5_000,
      statement_timeout: 15_000,
    },
  };
}

function sqlPath(relativePath) {
  return path.join(root, relativePath);
}

function runSql(containerName, relativePath, { expectFailure = false } = {}) {
  const sql = readFileSync(sqlPath(relativePath), "utf8");
  const result = spawnSync(
    "docker",
    [
      "exec",
      "-i",
      containerName,
      "psql",
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      "postgres",
    ],
    {
      cwd: root,
      encoding: "utf8",
      input: sql,
      stdio: ["pipe", "pipe", "pipe"],
      shell: false,
      timeout: 120_000,
    },
  );
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (expectFailure) {
    assert.notEqual(result.status, 0, `${relativePath} skulle ha feilet.`);
    return output;
  }
  if (result.error || result.status !== 0) {
    throw result.error ?? new Error(`${relativePath} feilet:\n${output.slice(-6_000)}`);
  }
  return output;
}

function applyPreA1(containerName) {
  runSql(containerName, "supabase/verification/bootstrap_supabase_stub.sql");
  for (const migration of preA1Migrations) {
    runSql(containerName, `supabase/migrations/${migration}`);
  }
}

function applyPostA1(containerName) {
  for (const migration of postA1Migrations) {
    runSql(containerName, `supabase/migrations/${migration}`);
  }
}

function applyE2(containerName) {
  runSql(containerName, `supabase/migrations/${e2Migration}`);
}

function applyD2(containerName) {
  runSql(containerName, `supabase/migrations/${d2Migration}`);
}

function applyD3(containerName) {
  runSql(containerName, `supabase/migrations/${d3Migration}`);
}

function applyB2(containerName) {
  runSql(containerName, `supabase/migrations/${b2Migration}`);
}

function applyA1Followups(containerName) {
  for (const migration of a1FollowupMigrations) {
    runSql(containerName, `supabase/migrations/${migration}`);
  }
}

async function withClient(config, applicationName, callback) {
  const client = new Client({ ...config, application_name: applicationName });
  await client.connect();
  try {
    return await callback(client);
  } finally {
    await client.end();
  }
}

async function synchronizedPair(config, label, first, second) {
  const lockKey = 1_000_000 + Math.floor(Math.random() * 1_000_000_000);
  const firstName = `klar-a1-${label}-first`;
  const secondName = `klar-a1-${label}-second`;
  const coordinator = new Client({ ...config, application_name: `klar-a1-${label}-coordinator` });
  const firstClient = new Client({ ...config, application_name: firstName });
  const secondClient = new Client({ ...config, application_name: secondName });
  await Promise.all([coordinator.connect(), firstClient.connect(), secondClient.connect()]);
  try {
    await coordinator.query("select pg_advisory_lock($1)", [lockKey]);
    await Promise.all([firstClient.query("begin"), secondClient.query("begin")]);

    const runWorker = async (client, operation) => {
      try {
        await client.query("select pg_advisory_xact_lock_shared($1)", [lockKey]);
        const result = await operation(client);
        await client.query("commit");
        return result;
      } catch (error) {
        await client.query("rollback").catch(() => undefined);
        throw error;
      }
    };

    const firstPromise = runWorker(firstClient, first);
    const secondPromise = runWorker(secondClient, second);
    let waiting = false;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const result = await coordinator.query(
        `select count(*)::integer as count
         from pg_stat_activity
         where application_name = any($1::text[])
           and wait_event = 'advisory'`,
        [[firstName, secondName]],
      );
      if (result.rows[0].count === 2) {
        waiting = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.equal(waiting, true, `${label}: begge databasesesjoner nådde ikke startbarrieren.`);
    await coordinator.query("select pg_advisory_unlock($1)", [lockKey]);
    return await Promise.allSettled([firstPromise, secondPromise]);
  } finally {
    await Promise.allSettled([firstClient.end(), secondClient.end(), coordinator.end()]);
  }
}

async function runConcurrency(config) {
  const organizationId = "b0000000-0000-4000-8000-000000000001";
  const ownerId = "a0000000-0000-4000-8000-000000000001";
  const retryUserId = "a0000000-0000-4000-8000-000000000002";
  const revokeUserId = "a0000000-0000-4000-8000-000000000003";
  const raceUserId = "a0000000-0000-4000-8000-000000000004";
  const demoteUserId = "a0000000-0000-4000-8000-000000000005";
  const classId = "c0000000-0000-4000-8000-000000000001";
  const startsAt = new Date(Date.now() - 60_000).toISOString();
  const endsAt = new Date(Date.now() + 3_600_000).toISOString();

  const createSql = `select public.create_staff_assignment(
    $1, $2, $3, $4, $5::public.staff_job_label, $6, $7, $8
  ) as id`;

  const sameKey = "e0000000-0000-4000-8000-000000000001";
  const samePayload = [
    organizationId,
    ownerId,
    retryUserId,
    classId,
    "substitute",
    startsAt,
    endsAt,
    sameKey,
  ];
  const sameResults = await synchronizedPair(
    config,
    "same-create",
    (client) => client.query(createSql, samePayload),
    (client) => client.query(createSql, samePayload),
  );
  assert(sameResults.every((result) => result.status === "fulfilled"));
  const sameIds = sameResults.map((result) => result.value.rows[0].id);
  assert.equal(sameIds[0], sameIds[1]);

  await withClient(config, "klar-a1-assert-same", async (client) => {
    const result = await client.query(
      `select
         (select count(*)::integer from public.staff_assignments where id = $1) as assignments,
         (select count(*)::integer from public.staff_assignment_class_scopes where assignment_id = $1) as scopes,
         (select count(*)::integer from public.staff_assignment_capabilities where assignment_id = $1) as capabilities,
         (select count(*)::integer from public.audit_events where event_name = 'staff_assignment.created' and entity_id = $1) as audits`,
      [sameIds[0]],
    );
    assert.deepEqual(result.rows[0], { assignments: 1, scopes: 1, capabilities: 8, audits: 1 });
  });

  const conflictKey = "e0000000-0000-4000-8000-000000000002";
  const conflictResults = await synchronizedPair(
    config,
    "conflict-create",
    (client) =>
      client.query(createSql, [
        organizationId,
        ownerId,
        retryUserId,
        classId,
        "contact_teacher",
        startsAt,
        endsAt,
        conflictKey,
      ]),
    (client) =>
      client.query(createSql, [
        organizationId,
        ownerId,
        retryUserId,
        classId,
        "subject_teacher",
        startsAt,
        endsAt,
        conflictKey,
      ]),
  );
  assert.equal(conflictResults.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(conflictResults.filter((result) => result.status === "rejected").length, 1);

  const revokeAssignmentId = await withClient(config, "klar-a1-find-revoke", async (client) => {
    const result = await client.query(
      "select id from public.staff_assignments where user_id = $1 and revoked_at is null",
      [revokeUserId],
    );
    return result.rows[0].id;
  });
  const revokeSql =
    "select (public.revoke_staff_assignment($1,$2,$3)).revoked_at as revoked_at";
  const revokeResults = await synchronizedPair(
    config,
    "parallel-revoke",
    (client) => client.query(revokeSql, [organizationId, ownerId, revokeAssignmentId]),
    (client) => client.query(revokeSql, [organizationId, ownerId, revokeAssignmentId]),
  );
  assert(revokeResults.every((result) => result.status === "fulfilled"));
  assert.equal(
    new Date(revokeResults[0].value.rows[0].revoked_at).toISOString(),
    new Date(revokeResults[1].value.rows[0].revoked_at).toISOString(),
  );
  await withClient(config, "klar-a1-assert-revoke", async (client) => {
    const result = await client.query(
      "select count(*)::integer as count from public.audit_events where event_name = 'staff_assignment.revoked' and entity_id = $1",
      [revokeAssignmentId],
    );
    assert.equal(result.rows[0].count, 1);
  });

  const expiryAssignmentId = await withClient(config, "klar-a1-create-expiry", async (client) => {
    const result = await client.query(createSql, [
      organizationId,
      ownerId,
      retryUserId,
      classId,
      "substitute",
      new Date(Date.now() - 120_000).toISOString(),
      new Date(Date.now() - 60_000).toISOString(),
      "e0000000-0000-4000-8000-000000000003",
    ]);
    return result.rows[0].id;
  });
  const expiryResults = await synchronizedPair(
    config,
    "parallel-expiry",
    (client) => client.query("select public.reconcile_expired_staff_assignments($1) as count", [organizationId]),
    (client) => client.query("select public.reconcile_expired_staff_assignments($1) as count", [organizationId]),
  );
  assert(expiryResults.every((result) => result.status === "fulfilled"));
  assert.deepEqual(
    expiryResults.map((result) => result.value.rows[0].count).sort(),
    [0, 1],
  );
  await withClient(config, "klar-a1-assert-expiry", async (client) => {
    const result = await client.query(
      `select
         assignment.ends_at,
         assignment.expiry_audited_at,
         audit.actor_id,
         audit.authorizing_staff_assignment_id,
         audit.authorizing_capability,
         audit.metadata ->> 'effective_at' as effective_at,
         audit.metadata ->> 'recorded_at' as recorded_at
       from public.staff_assignments as assignment
       join public.audit_events as audit
         on audit.entity_id = assignment.id
        and audit.event_name = 'staff_assignment.expired'
       where assignment.id = $1`,
      [expiryAssignmentId],
    );
    assert.equal(result.rows.length, 1);
    const row = result.rows[0];
    assert.notEqual(row.expiry_audited_at, null);
    assert.equal(
      new Date(row.effective_at).toISOString(),
      new Date(row.ends_at).toISOString(),
    );
    assert.equal(
      new Date(row.recorded_at).toISOString(),
      new Date(row.expiry_audited_at).toISOString(),
    );
    assert.equal(row.actor_id, null);
    assert.equal(row.authorizing_staff_assignment_id, null);
    assert.equal(row.authorizing_capability, null);
  });

  const raceAssignmentId = await withClient(config, "klar-a1-find-race", async (client) => {
    const result = await client.query(
      "select id from public.staff_assignments where user_id = $1 and revoked_at is null",
      [raceUserId],
    );
    return result.rows[0].id;
  });
  const raceTitle = "Samtidig revoke og publisering";
  const raceResults = await synchronizedPair(
    config,
    "revoke-mutation",
    (client) => client.query(revokeSql, [organizationId, ownerId, raceAssignmentId]),
    (client) =>
      client.query(
        "select public.publish_task_to_class($1,$2,$3,$4) as id",
        [classId, raceUserId, raceAssignmentId, raceTitle],
      ),
  );
  assert.equal(raceResults[0].status, "fulfilled");
  const publishSucceeded = raceResults[1].status === "fulfilled";
  await withClient(config, "klar-a1-assert-race", async (client) => {
    const result = await client.query(
      `select
        (select count(*)::integer from public.task_definitions where title = $1) as tasks,
        (select count(*)::integer from public.audit_events where event_name = 'task.published' and metadata ->> 'class_id' = $2 and authorizing_staff_assignment_id = $3) as audits`,
      [raceTitle, classId, raceAssignmentId],
    );
    assert.equal(result.rows[0].tasks, publishSucceeded ? 1 : 0);
    assert.equal(result.rows[0].audits, publishSucceeded ? 1 : 0);
    await assert.rejects(
      client.query(
        "select public.publish_task_to_class($1,$2,$3,$4)",
        [classId, raceUserId, raceAssignmentId, "Stale grant skal avvises"],
      ),
    );
  });

  const demotionKey = "e0000000-0000-4000-8000-000000000004";
  const demotionResults = await synchronizedPair(
    config,
    "create-demotion",
    (client) =>
      client.query(createSql, [
        organizationId,
        ownerId,
        demoteUserId,
        classId,
        "substitute",
        startsAt,
        endsAt,
        demotionKey,
      ]),
    (client) =>
      client.query(
        "update public.memberships set role = 'student' where organization_id = $1 and user_id = $2 returning role",
        [organizationId, demoteUserId],
      ),
  );
  assert.equal(demotionResults.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(demotionResults.filter((result) => result.status === "rejected").length, 1);
  await withClient(config, "klar-a1-assert-demotion", async (client) => {
    const result = await client.query(
      `select membership.role::text as role,
        count(assignment.id) filter (
          where assignment.revoked_at is null
            and assignment.starts_at <= transaction_timestamp()
            and transaction_timestamp() < assignment.ends_at
        )::integer as active_assignments
       from public.memberships as membership
       left join public.staff_assignments as assignment
         on assignment.organization_id = membership.organization_id
         and assignment.user_id = membership.user_id
       where membership.organization_id = $1 and membership.user_id = $2
       group by membership.role`,
      [organizationId, demoteUserId],
    );
    assert.notDeepEqual(result.rows[0], { role: "student", active_assignments: 1 });
  });
}

async function runProgressConcurrency(config) {
  const organizationId = "b0000000-0000-4000-8000-000000000001";
  const studentId = "a0000000-0000-4000-8000-000000000006";
  const staffId = "a0000000-0000-4000-8000-000000000002";
  const classId = "c0000000-0000-4000-8000-000000000001";
  const completeSql =
    `select public.complete_student_task_v2(
      $1,$2,$3,$4,$5,$6
    ) as result`;

  async function readTaskVersions(assignmentId) {
    return withClient(
      config,
      `klar-b1-versions-${assignmentId.slice(-4)}`,
      async (client) => {
        const result = await client.query(
          `select state.state_version::integer as state_version,
             assignment.schedule_version::integer as schedule_version
           from public.task_assignments as assignment
           join public.student_task_state as state
             on state.assignment_id = assignment.id
           where assignment.id = $1`,
          [assignmentId],
        );
        assert.equal(result.rowCount, 1);
        return result.rows[0];
      },
    );
  }

  const distinctVersions = await readTaskVersions(
    "f2000000-0000-4000-8000-000000000001",
  );

  const distinctRequestResults = await synchronizedPair(
    config,
    "progress-distinct-requests",
    (client) =>
      client.query(completeSql, [
        organizationId,
        "f2000000-0000-4000-8000-000000000001",
        studentId,
        "f3000000-0000-4000-8000-000000000001",
        distinctVersions.state_version,
        distinctVersions.schedule_version,
      ]),
    (client) =>
      client.query(completeSql, [
        organizationId,
        "f2000000-0000-4000-8000-000000000001",
        studentId,
        "f3000000-0000-4000-8000-000000000002",
        distinctVersions.state_version,
        distinctVersions.schedule_version,
      ]),
  );
  assert.equal(
    distinctRequestResults.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(
    distinctRequestResults.filter((result) => result.status === "rejected").length,
    1,
  );
  assert.equal(
    distinctRequestResults.find((result) => result.status === "fulfilled")
      .value.rows[0].result.changed,
    true,
  );
  assert.match(
    distinctRequestResults.find((result) => result.status === "rejected")
      .reason.message,
    /changed after it was opened/i,
  );

  const sameRequestVersions = await readTaskVersions(
    "f2000000-0000-4000-8000-000000000005",
  );
  const sameRequestPayload = [
    organizationId,
    "f2000000-0000-4000-8000-000000000005",
    studentId,
    "f3000000-0000-4000-8000-000000000003",
    sameRequestVersions.state_version,
    sameRequestVersions.schedule_version,
  ];
  const sameRequestResults = await synchronizedPair(
    config,
    "progress-same-request",
    (client) => client.query(completeSql, sameRequestPayload),
    (client) => client.query(completeSql, sameRequestPayload),
  );
  assert(sameRequestResults.every((result) => result.status === "fulfilled"));
  assert.deepEqual(
    sameRequestResults[0].value.rows[0].result,
    sameRequestResults[1].value.rows[0].result,
  );

  const [parallelFirstVersions, parallelSecondVersions] = await Promise.all([
    readTaskVersions("f2000000-0000-4000-8000-000000000002"),
    readTaskVersions("f2000000-0000-4000-8000-000000000003"),
  ]);
  const parallelAssignments = await synchronizedPair(
    config,
    "progress-parallel-assignments",
    (client) =>
      client.query(completeSql, [
        organizationId,
        "f2000000-0000-4000-8000-000000000002",
        studentId,
        "f3000000-0000-4000-8000-000000000004",
        parallelFirstVersions.state_version,
        parallelFirstVersions.schedule_version,
      ]),
    (client) =>
      client.query(completeSql, [
        organizationId,
        "f2000000-0000-4000-8000-000000000003",
        studentId,
        "f3000000-0000-4000-8000-000000000005",
        parallelSecondVersions.state_version,
        parallelSecondVersions.schedule_version,
      ]),
  );
  assert(parallelAssignments.every((result) => result.status === "fulfilled"));
  assert(parallelAssignments.every((result) => result.value.rows[0].result.changed === true));

  const staffAssignmentId = await withClient(
    config,
    "klar-b1-find-active-staff",
    async (client) => {
      const result = await client.query(
        `select assignment.id
         from public.staff_assignments as assignment
         join public.staff_assignment_class_scopes as scope
           on scope.assignment_id = assignment.id
         join public.staff_assignment_capabilities as capability
           on capability.assignment_id = assignment.id
          and capability.profile_version = assignment.profile_version
         where assignment.user_id = $1
           and scope.class_id = $2
           and capability.capability = 'task.return'
           and assignment.revoked_at is null
           and assignment.starts_at <= transaction_timestamp()
           and transaction_timestamp() < assignment.ends_at
         order by assignment.starts_at desc, assignment.id
         limit 1`,
        [staffId, classId],
      );
      return result.rows[0].id;
    },
  );

  const reversalVersions = await readTaskVersions(
    "f2000000-0000-4000-8000-000000000004",
  );
  await withClient(config, "klar-b1-prime-reversal-race", async (client) => {
    const result = await client.query(completeSql, [
      organizationId,
      "f2000000-0000-4000-8000-000000000004",
      studentId,
      "f3000000-0000-4000-8000-000000000006",
      reversalVersions.state_version,
      reversalVersions.schedule_version,
    ]);
    assert.equal(result.rows[0].result.changed, true);
  });

  const completedReversalVersions = await readTaskVersions(
    "f2000000-0000-4000-8000-000000000004",
  );

  const reversalRace = await synchronizedPair(
    config,
    "progress-undo-reopen",
    (client) =>
      client.query(
        `select public.undo_student_task_completion_v2(
          $1,$2,$3,$4,$5,$6
        ) as result`,
        [
          organizationId,
          "f2000000-0000-4000-8000-000000000004",
          studentId,
          "f3000000-0000-4000-8000-000000000007",
          completedReversalVersions.state_version,
          completedReversalVersions.schedule_version,
        ],
      ),
    (client) =>
      client.query(
        `select public.reopen_student_task_for_staff(
          $1,$2,$3,$4,$5::public.task_reopen_reason,$6
        ) as result`,
        [
          "f2000000-0000-4000-8000-000000000004",
          staffId,
          staffAssignmentId,
          "f3000000-0000-4000-8000-000000000008",
          "continue_working",
          null,
        ],
      ),
  );
  const fulfilledReversals = reversalRace.filter(
    (result) => result.status === "fulfilled",
  );
  assert.equal(
    fulfilledReversals.filter((result) => result.value.rows[0].result.changed).length,
    1,
  );
  const rejectedReversal = reversalRace.find(
    (result) => result.status === "rejected",
  );
  if (rejectedReversal) {
    assert.match(rejectedReversal.reason.message, /changed after it was opened/i);
  } else {
    assert.deepEqual(
      fulfilledReversals.map((result) => result.value.rows[0].result.changed).sort(),
      [false, true],
    );
  }

  await withClient(config, "klar-b1-assert-progress-races", async (client) => {
    const result = await client.query(
      `select
        progress.xp_balance::integer as xp_balance,
        progress.current_level::integer as current_level,
        progress.highest_level::integer as highest_level,
        state.status::text as raced_status,
        (select count(*)::integer
         from public.task_completion_attempts
         where assignment_id = 'f2000000-0000-4000-8000-000000000001') as distinct_attempts,
        (select count(*)::integer
         from public.progress_command_receipts
         where assignment_id = 'f2000000-0000-4000-8000-000000000001') as distinct_receipts,
        (select count(*)::integer
         from public.task_completion_attempts
         where assignment_id = 'f2000000-0000-4000-8000-000000000005') as same_attempts,
        (select count(*)::integer
         from public.progress_command_receipts
         where assignment_id = 'f2000000-0000-4000-8000-000000000005') as same_receipts,
        (select count(*)::integer
         from public.student_xp_ledger
         where assignment_id = 'f2000000-0000-4000-8000-000000000004'
           and entry_kind = 'reversal') as raced_reversals,
        (select coalesce(sum(points_delta), 0)::integer
         from public.student_xp_ledger
         where organization_id = progress.organization_id
           and student_id = progress.student_id) as ledger_balance,
        progress.updated_at >= (
          select max(occurred_at)
          from public.student_xp_ledger
          where organization_id = progress.organization_id
            and student_id = progress.student_id
        ) as monotonic_updated_at
       from public.student_progress as progress
       join public.student_task_state as state
         on state.assignment_id = 'f2000000-0000-4000-8000-000000000004'
       where progress.organization_id = 'b0000000-0000-4000-8000-000000000001'
         and progress.student_id = $1`,
      [studentId],
    );
    assert.deepEqual(result.rows[0], {
      xp_balance: 40,
      current_level: 1,
      highest_level: 1,
      raced_status: ["assigned", "reopened"].includes(result.rows[0].raced_status)
        ? result.rows[0].raced_status
        : "unexpected",
      distinct_attempts: 1,
      distinct_receipts: 1,
      same_attempts: 1,
      same_receipts: 1,
      raced_reversals: 1,
      ledger_balance: 40,
      monotonic_updated_at: true,
    });
    assert(["assigned", "reopened"].includes(result.rows[0].raced_status));
  });

  await withClient(config, "klar-b1-rollback-and-retry", async (client) => {
    await client.query(`create function public.b1_force_progress_audit_failure()
      returns trigger
      language plpgsql
      set search_path = ''
      as $$
      begin
        if new.event_name = 'task.completed'
          and new.entity_id = 'f2000000-0000-4000-8000-000000000006'
        then
          raise exception 'forced B1 audit failure';
        end if;
        return new;
      end;
      $$`);
    await client.query(`create trigger b1_force_progress_audit_failure
      before insert on public.audit_events
      for each row execute function public.b1_force_progress_audit_failure()`);

    const retryVersions = await client.query(
      `select state.state_version::integer as state_version,
         assignment.schedule_version::integer as schedule_version
       from public.task_assignments as assignment
       join public.student_task_state as state
         on state.assignment_id = assignment.id
       where assignment.id = $1`,
      ["f2000000-0000-4000-8000-000000000006"],
    );
    const retryPayload = [
      organizationId,
      "f2000000-0000-4000-8000-000000000006",
      studentId,
      "f3000000-0000-4000-8000-000000000009",
      retryVersions.rows[0].state_version,
      retryVersions.rows[0].schedule_version,
    ];
    await assert.rejects(client.query(completeSql, retryPayload), /forced B1 audit failure/);

    const beforeRetry = await client.query(
      `select
        (select count(*)::integer from public.task_completion_attempts where assignment_id = $1) as attempts,
        (select count(*)::integer from public.task_state_transitions where assignment_id = $1) as transitions,
        (select count(*)::integer from public.student_xp_ledger where assignment_id = $1) as ledger,
        (select count(*)::integer from public.progress_command_receipts where assignment_id = $1) as receipts,
        (select status::text from public.student_task_state where assignment_id = $1) as status`,
      [retryPayload[1]],
    );
    assert.deepEqual(beforeRetry.rows[0], {
      attempts: 0,
      transitions: 0,
      ledger: 0,
      receipts: 0,
      status: "assigned",
    });

    await client.query("drop trigger b1_force_progress_audit_failure on public.audit_events");
    await client.query("drop function public.b1_force_progress_audit_failure()");
    const retry = await client.query(completeSql, retryPayload);
    assert.equal(retry.rows[0].result.changed, true);
    assert.equal(retry.rows[0].result.xp_balance, 50);
  });

  const undoSql = `select public.undo_student_task_completion_v2(
    $1,$2,$3,$4,$5,$6
  ) as result`;
  const completedRetryVersions = await readTaskVersions(
    "f2000000-0000-4000-8000-000000000006",
  );
  const sameUndoPayload = [
    organizationId,
    "f2000000-0000-4000-8000-000000000006",
    studentId,
    "f3000000-0000-4000-8000-000000000010",
    completedRetryVersions.state_version,
    completedRetryVersions.schedule_version,
  ];
  const sameUndoResults = await synchronizedPair(
    config,
    "progress-same-undo-request",
    (client) => client.query(undoSql, sameUndoPayload),
    (client) => client.query(undoSql, sameUndoPayload),
  );
  assert(sameUndoResults.every((result) => result.status === "fulfilled"));
  assert.deepEqual(
    sameUndoResults[0].value.rows[0].result,
    sameUndoResults[1].value.rows[0].result,
  );

  const recompleteVersions = await readTaskVersions(
    "f2000000-0000-4000-8000-000000000006",
  );
  await withClient(config, "klar-b1-recomplete-for-undo-race", (client) =>
    client.query(completeSql, [
      organizationId,
      "f2000000-0000-4000-8000-000000000006",
      studentId,
      "f3000000-0000-4000-8000-000000000011",
      recompleteVersions.state_version,
      recompleteVersions.schedule_version,
    ]),
  );
  const distinctUndoVersions = await readTaskVersions(
    "f2000000-0000-4000-8000-000000000006",
  );
  const distinctUndoArguments = (requestId) => [
    organizationId,
    "f2000000-0000-4000-8000-000000000006",
    studentId,
    requestId,
    distinctUndoVersions.state_version,
    distinctUndoVersions.schedule_version,
  ];
  const distinctUndoResults = await synchronizedPair(
    config,
    "progress-distinct-undo-requests",
    (client) =>
      client.query(
        undoSql,
        distinctUndoArguments("f3000000-0000-4000-8000-000000000012"),
      ),
    (client) =>
      client.query(
        undoSql,
        distinctUndoArguments("f3000000-0000-4000-8000-000000000013"),
      ),
  );
  assert.equal(
    distinctUndoResults.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.match(
    distinctUndoResults.find((result) => result.status === "rejected").reason.message,
    /changed after it was opened/i,
  );
  await withClient(config, "klar-b1-assert-undo-cas", async (client) => {
    const proof = await client.query(
      `select
         state.status::text,
         state.state_version::integer,
         (select count(*)::integer from public.task_undo_v2_receipts
          where assignment_id = state.assignment_id) as receipts,
         (select count(*)::integer from public.student_xp_ledger
          where assignment_id = state.assignment_id and entry_kind = 'reversal') as reversals
       from public.student_task_state as state
       where state.assignment_id = $1`,
      ["f2000000-0000-4000-8000-000000000006"],
    );
    assert.deepEqual(proof.rows[0], {
      status: "assigned",
      state_version: distinctUndoVersions.state_version + 1,
      receipts: 2,
      reversals: 2,
    });
  });
}

function weeklyCandidate(prefix, title, date, taskCount = 1) {
  return {
    schema_version: "weekly_plan_v1",
    sessions: [
      {
        logical_key: `${prefix}1000000-0000-4000-8000-000000000001`,
        title,
        subject: "Norsk",
        starts_at: `${date}T08:00:00.000Z`,
        ends_at: `${date}T09:00:00.000Z`,
        tasks: Array.from({ length: taskCount }, (_, index) => ({
          logical_key: `${prefix}2000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
          title: `${title} oppgave ${index + 1}`,
          description: null,
          subject: "Norsk",
          estimated_minutes: 10,
          support_level: 2,
        })),
      },
    ],
  };
}

async function runFlowerRewardConcurrency(config) {
  const organizationId = "b0000000-0000-4000-8000-000000000001";
  const studentId = "b2e00000-0000-4000-8000-000000000001";
  const assignments = [
    "b2f10000-0000-4000-8000-000000000001",
    "b2f10000-0000-4000-8000-000000000002",
    "b2f10000-0000-4000-8000-000000000003",
  ];

  async function completeTask(assignmentId, requestId) {
    return withClient(
      config,
      `klar-b2-complete-${assignmentId.slice(-4)}`,
      async (client) => {
        const versions = await client.query(
          `select state.state_version::integer as state_version,
             assignment.schedule_version::integer as schedule_version
           from public.task_assignments as assignment
           join public.student_task_state as state
             on state.assignment_id = assignment.id
           where assignment.id = $1`,
          [assignmentId],
        );
        assert.equal(versions.rowCount, 1);
        const result = await client.query(
          `select public.complete_student_task_v2(
            $1,$2,$3,$4,$5,$6
          ) as result`,
          [
            organizationId,
            assignmentId,
            studentId,
            requestId,
            versions.rows[0].state_version,
            versions.rows[0].schedule_version,
          ],
        );
        assert.equal(result.rows[0].result.changed, true);
      },
    );
  }

  async function readEntitlement(level) {
    return withClient(
      config,
      `klar-b2-entitlement-${level}`,
      async (client) => {
        const result = await client.query(
          `select id
           from public.level_reward_entitlements
           where organization_id = $1 and student_id = $2 and level = $3`,
          [organizationId, studentId, level],
        );
        assert.equal(result.rowCount, 1);
        return result.rows[0].id;
      },
    );
  }

  const claimSql = `select public.claim_student_flower_reward_v1(
    $1,$2,$3,$3,$4,$5::public.flower_reward_color
  ) as result`;

  await completeTask(
    assignments[0],
    "b2f20000-0000-4000-8000-000000000001",
  );
  const firstEntitlementId = await readEntitlement(2);
  const sameRequestPayload = [
    organizationId,
    firstEntitlementId,
    studentId,
    "b2f20000-0000-4000-8000-000000000002",
    "red",
  ];
  const sameRequest = await synchronizedPair(
    config,
    "flower-same-request",
    (client) => client.query(claimSql, sameRequestPayload),
    (client) => client.query(claimSql, sameRequestPayload),
  );
  assert(sameRequest.every((result) => result.status === "fulfilled"));
  assert.deepEqual(
    sameRequest[0].value.rows[0].result,
    sameRequest[1].value.rows[0].result,
  );

  await withClient(config, "klar-b2-assert-same-request", async (client) => {
    const result = await client.query(
      `select
        (select count(*)::integer from public.reward_claims where entitlement_id = $1) as claims,
        (select count(*)::integer from public.audit_events where event_name = 'reward.claimed' and metadata ->> 'entitlement_id' = $1::text) as audits`,
      [firstEntitlementId],
    );
    assert.deepEqual(result.rows[0], { claims: 1, audits: 1 });
  });

  await completeTask(
    assignments[1],
    "b2f20000-0000-4000-8000-000000000003",
  );
  const secondEntitlementId = await readEntitlement(3);
  const differentChoices = await synchronizedPair(
    config,
    "flower-different-choice",
    (client) => client.query(claimSql, [
      organizationId,
      secondEntitlementId,
      studentId,
      "b2f20000-0000-4000-8000-000000000004",
      "blue",
    ]),
    (client) => client.query(claimSql, [
      organizationId,
      secondEntitlementId,
      studentId,
      "b2f20000-0000-4000-8000-000000000005",
      "green",
    ]),
  );
  assert.equal(
    differentChoices.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(
    differentChoices.filter((result) => result.status === "rejected").length,
    1,
  );
  assert.match(
    differentChoices.find((result) => result.status === "rejected").reason.message,
    /reward entitlement is unavailable/i,
  );

  await withClient(config, "klar-b2-assert-different-choice", async (client) => {
    const result = await client.query(
      `select collection_sequence::integer as collection_sequence,
         flower_color::text as flower_color
       from public.reward_claims
       where organization_id = $1 and student_id = $2
       order by collection_sequence`,
      [organizationId, studentId],
    );
    assert.equal(result.rows.length, 2);
    assert.deepEqual(
      result.rows.map((row) => row.collection_sequence),
      [1, 2],
    );
    assert(["blue", "green"].includes(result.rows[1].flower_color));
  });

  await completeTask(
    assignments[2],
    "b2f20000-0000-4000-8000-000000000006",
  );
  const thirdEntitlementId = await readEntitlement(4);
  const claimUndoRace = await synchronizedPair(
    config,
    "flower-claim-undo",
    (client) => client.query(claimSql, [
      organizationId,
      thirdEntitlementId,
      studentId,
      "b2f20000-0000-4000-8000-000000000007",
      "purple",
    ]),
    (client) => client.query(
      `select public.undo_student_task_completion_v2(
        $1,$2,$3,$4,$5,$6
      ) as result`,
      [
        organizationId,
        assignments[2],
        studentId,
        "b2f20000-0000-4000-8000-000000000008",
        2,
        1,
      ],
    ),
  );
  assert.equal(claimUndoRace[1].status, "fulfilled");
  if (claimUndoRace[0].status === "rejected") {
    assert.match(
      claimUndoRace[0].reason.message,
      /reward entitlement is unavailable/i,
    );
  }

  await withClient(config, "klar-b2-assert-claim-undo", async (client) => {
    const result = await client.query(
      `select
        progress.xp_balance::integer as xp_balance,
        progress.current_level::integer as current_level,
        entitlement.status::text as entitlement_status,
        entitlement.selected_at,
        claim.claimed_at,
        (select count(*)::integer from public.reward_claims where organization_id = $1 and student_id = $2) as claims,
        (select count(*)::integer from public.audit_events where event_name = 'reward.claimed' and organization_id = $1 and actor_id = $2) as audits
       from public.student_progress as progress
       join public.level_reward_entitlements as entitlement
         on entitlement.organization_id = progress.organization_id
        and entitlement.student_id = progress.student_id
        and entitlement.id = $3
       left join public.reward_claims as claim
         on claim.entitlement_id = entitlement.id
       where progress.organization_id = $1 and progress.student_id = $2`,
      [organizationId, studentId, thirdEntitlementId],
    );
    assert.equal(result.rowCount, 1);
    const row = result.rows[0];
    assert.deepEqual(
      { xp_balance: row.xp_balance, current_level: row.current_level },
      { xp_balance: 2000, current_level: 3 },
    );
    if (claimUndoRace[0].status === "fulfilled") {
      assert.equal(row.entitlement_status, "selected");
      assert.equal(
        new Date(row.selected_at).toISOString(),
        new Date(row.claimed_at).toISOString(),
      );
      assert.equal(row.claims, 3);
    } else {
      assert.equal(row.entitlement_status, "pending");
      assert.equal(row.claimed_at, null);
      assert.equal(row.claims, 2);
    }
    assert.equal(row.audits, row.claims);
  });
}

async function runTaskScheduleConcurrency(config) {
  const organizationId = "b0000000-0000-4000-8000-000000000001";
  const classId = "c0000000-0000-4000-8000-000000000001";
  const actorId = "a0000000-0000-4000-8000-000000000004";
  const primaryStudentId = "a0000000-0000-4000-8000-000000000006";
  const planWeek = "2099-07-13";
  const fixture = await withClient(
    config,
    "klar-d2-load-concurrency-fixture",
    async (client) => {
      const [staff, plan, sessions, assignments] = await Promise.all([
        client.query(
          `select assignment.id::text
           from public.staff_assignments as assignment
           join public.staff_assignment_class_scopes as scope
             on scope.assignment_id = assignment.id
            and scope.organization_id = assignment.organization_id
           where assignment.user_id = $1
             and scope.class_id = $2
             and assignment.revoked_at is null
             and assignment.starts_at <= transaction_timestamp()
             and transaction_timestamp() < assignment.ends_at
           order by assignment.starts_at desc, assignment.id
           limit 1`,
          [actorId, classId],
        ),
        client.query(
          `select plan.id::text, plan.lock_version::integer
           from public.weekly_plans as plan
           where plan.class_id = $1 and plan.week_start_date = $2::date`,
          [classId, planWeek],
        ),
        client.query(
          `select session.id::text,
             session.teaching_session_id::text,
             session.position::integer
           from public.plan_revision_sessions as session
           join public.weekly_plans as plan on plan.id = session.weekly_plan_id
           where plan.class_id = $1 and plan.week_start_date = $2::date
           order by session.position`,
          [classId, planWeek],
        ),
        client.query(
          `select assignment.id::text as assignment_id,
             assignment.student_id::text,
             assignment.iteration_id::text,
             assignment.schedule_version::integer,
             state.state_version::integer,
             iteration.management_version::integer,
             revision_session.position::integer as session_position
           from public.task_assignments as assignment
           join public.student_task_state as state
             on state.assignment_id = assignment.id
           join public.task_iterations as iteration
             on iteration.id = assignment.iteration_id
           join public.plan_revision_tasks as revision_task
             on revision_task.id = assignment.source_plan_revision_task_id
           join public.plan_revision_sessions as revision_session
             on revision_session.id = revision_task.revision_session_id
           join public.weekly_plans as plan
             on plan.id = revision_task.weekly_plan_id
           where plan.class_id = $1 and plan.week_start_date = $2::date
           order by revision_session.position, assignment.student_id`,
          [classId, planWeek],
        ),
      ]);
      assert.equal(staff.rowCount, 1);
      assert.equal(plan.rowCount, 1);
      assert.equal(sessions.rowCount, 4);
      assert.equal(assignments.rowCount, 6);
      return {
        staffAssignmentId: staff.rows[0].id,
        planLockVersion: plan.rows[0].lock_version,
        sessions: sessions.rows,
        assignments: assignments.rows,
      };
    },
  );

  const sourceFor = (sessionPosition, studentId = primaryStudentId) => {
    const source = fixture.assignments.find(
      (assignment) =>
        assignment.session_position === sessionPosition &&
        assignment.student_id === studentId,
    );
    assert(source, `D2-kilden for økt ${sessionPosition} mangler.`);
    return source;
  };
  const targetFor = (position) => {
    const target = fixture.sessions.find((session) => session.position === position);
    assert(target, `D2-måløkten ${position} mangler.`);
    return target;
  };
  const moveSql =
    `select public.move_task_iteration_v1(
       $1,$2,$3::uuid[],$4::integer[],$5::integer[],$6,$7,$8,$9,$10,$11
     ) as result`;
  const reissueSql =
    `select public.reissue_task_iteration_v1(
       $1,$2,$3::uuid[],$4::integer[],$5::integer[],$6,$7,$8,$9,$10,$11
     ) as result`;
  const commandArguments = (source, target, requestId) => [
    classId,
    source.iteration_id,
    [source.assignment_id],
    [source.state_version],
    [source.schedule_version],
    target.id,
    source.management_version,
    fixture.planLockVersion,
    actorId,
    fixture.staffAssignmentId,
    requestId,
  ];

  const moveSource = sourceFor(0);
  const moveTargets = [targetFor(1), targetFor(2)];
  const moveRequestIds = [
    "d2100000-0000-4000-8000-000000000001",
    "d2100000-0000-4000-8000-000000000002",
  ];
  const competingMoves = await synchronizedPair(
    config,
    "d2-competing-moves",
    (client) =>
      client.query(
        moveSql,
        commandArguments(moveSource, moveTargets[0], moveRequestIds[0]),
      ),
    (client) =>
      client.query(
        moveSql,
        commandArguments(moveSource, moveTargets[1], moveRequestIds[1]),
      ),
  );
  assert.equal(
    competingMoves.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(
    competingMoves.filter((result) => result.status === "rejected").length,
    1,
  );
  assert.match(
    competingMoves.find((result) => result.status === "rejected").reason.message,
    /Task iteration changed after preview/i,
  );
  const moveWinner = competingMoves.find(
    (result) => result.status === "fulfilled",
  ).value.rows[0].result;
  assert(moveRequestIds.includes(moveWinner.request_id));
  assert(
    moveTargets.some(
      (target) => target.teaching_session_id === moveWinner.target_teaching_session_id,
    ),
  );
  await withClient(config, "klar-d2-assert-competing-moves", async (client) => {
    const proof = await client.query(
      `select iteration.management_version::integer,
         assignment.schedule_version::integer,
         assignment.scheduled_teaching_session_id::text,
         state.state_version::integer,
         state.status::text,
         (select count(*)::integer from public.task_schedule_events
          where source_assignment_id = assignment.id and command = 'move') as events,
         (select count(*)::integer from public.task_schedule_command_receipts
          where request_id = any($2::uuid[])) as receipts,
         (select count(*)::integer from public.audit_events
          where event_name = 'task.iteration_moved'
            and metadata ->> 'request_id' = $3) as audits
       from public.task_assignments as assignment
       join public.task_iterations as iteration on iteration.id = assignment.iteration_id
       join public.student_task_state as state on state.assignment_id = assignment.id
       where assignment.id = $1`,
      [moveSource.assignment_id, moveRequestIds, moveWinner.request_id],
    );
    assert.deepEqual(proof.rows[0], {
      management_version: moveSource.management_version + 1,
      schedule_version: moveSource.schedule_version + 1,
      scheduled_teaching_session_id: moveWinner.target_teaching_session_id,
      state_version: moveSource.state_version,
      status: "assigned",
      events: 1,
      receipts: 1,
      audits: 1,
    });
  });

  const reissueSource = sourceFor(1);
  const reissueTargets = [targetFor(2), targetFor(3)];
  const reissueRequestIds = [
    "d2100000-0000-4000-8000-000000000003",
    "d2100000-0000-4000-8000-000000000004",
  ];
  const competingReissues = await synchronizedPair(
    config,
    "d2-competing-reissues",
    (client) =>
      client.query(
        reissueSql,
        commandArguments(reissueSource, reissueTargets[0], reissueRequestIds[0]),
      ),
    (client) =>
      client.query(
        reissueSql,
        commandArguments(reissueSource, reissueTargets[1], reissueRequestIds[1]),
      ),
  );
  assert.equal(
    competingReissues.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(
    competingReissues.filter((result) => result.status === "rejected").length,
    1,
  );
  assert.match(
    competingReissues.find((result) => result.status === "rejected").reason.message,
    /Task iteration changed after preview/i,
  );
  const reissueWinner = competingReissues.find(
    (result) => result.status === "fulfilled",
  ).value.rows[0].result;
  assert(reissueRequestIds.includes(reissueWinner.request_id));
  assert.notEqual(reissueWinner.result_iteration_id, reissueSource.iteration_id);
  await withClient(config, "klar-d2-assert-competing-reissues", async (client) => {
    const proof = await client.query(
      `select source_iteration.management_version::integer,
         source_assignment.schedule_version::integer as source_schedule_version,
         source_state.state_version::integer as source_state_version,
         source_state.status::text as source_status,
         result_iteration.reissued_from_iteration_id::text,
         result_iteration.management_version::integer as result_management_version,
         result_assignment.schedule_version::integer as result_schedule_version,
         result_state.state_version::integer as result_state_version,
         result_state.status::text as result_status,
         (select count(*)::integer from public.task_schedule_events
          where source_assignment_id = source_assignment.id and command = 'reissue') as events,
         (select count(*)::integer from public.task_schedule_command_receipts
          where request_id = any($3::uuid[])) as receipts,
         (select count(*)::integer from public.audit_events
          where event_name = 'task.iteration_reissued'
            and metadata ->> 'request_id' = $4) as audits
       from public.task_assignments as source_assignment
       join public.task_iterations as source_iteration
         on source_iteration.id = source_assignment.iteration_id
       join public.student_task_state as source_state
         on source_state.assignment_id = source_assignment.id
       join public.task_assignments as result_assignment
         on result_assignment.id = $2
       join public.task_iterations as result_iteration
         on result_iteration.id = result_assignment.iteration_id
       join public.student_task_state as result_state
         on result_state.assignment_id = result_assignment.id
       where source_assignment.id = $1`,
      [
        reissueSource.assignment_id,
        reissueWinner.assignments[0].assignment_id,
        reissueRequestIds,
        reissueWinner.request_id,
      ],
    );
    assert.deepEqual(proof.rows[0], {
      management_version: reissueSource.management_version + 1,
      source_schedule_version: reissueSource.schedule_version,
      source_state_version: reissueSource.state_version,
      source_status: "assigned",
      reissued_from_iteration_id: reissueSource.iteration_id,
      result_management_version: 1,
      result_schedule_version: 1,
      result_state_version: 1,
      result_status: "assigned",
      events: 1,
      receipts: 1,
      audits: 1,
    });
  });

  const retrySource = sourceFor(2);
  const retryTarget = targetFor(3);
  const retryRequestId = "d2100000-0000-4000-8000-000000000005";
  const retryArguments = commandArguments(retrySource, retryTarget, retryRequestId);
  const sameRequest = await synchronizedPair(
    config,
    "d2-same-reissue-request",
    (client) => client.query(reissueSql, retryArguments),
    (client) => client.query(reissueSql, retryArguments),
  );
  assert(sameRequest.every((result) => result.status === "fulfilled"));
  assert.deepEqual(
    sameRequest[0].value.rows[0].result,
    sameRequest[1].value.rows[0].result,
  );
  const retryResult = sameRequest[0].value.rows[0].result;
  await withClient(config, "klar-d2-assert-same-reissue", async (client) => {
    const proof = await client.query(
      `select
         (select count(*)::integer from public.task_iterations
          where reissued_from_iteration_id = $1) as iterations,
         (select count(*)::integer from public.task_assignments
          where id = $2) as assignments,
         (select count(*)::integer from public.task_schedule_events
          where request_id = $3) as events,
         (select count(*)::integer from public.task_schedule_command_receipts
          where request_id = $3) as receipts,
         (select count(*)::integer from public.audit_events
          where event_name = 'task.iteration_reissued'
            and metadata ->> 'request_id' = $3::text) as audits`,
      [
        retrySource.iteration_id,
        retryResult.assignments[0].assignment_id,
        retryRequestId,
      ],
    );
    assert.deepEqual(proof.rows[0], {
      iterations: 1,
      assignments: 1,
      events: 1,
      receipts: 1,
      audits: 1,
    });
  });

  const completionRace = await withClient(
    config,
    "klar-d2-load-completion-race",
    async (client) => {
      const result = await client.query(
        `select assignment.id::text as assignment_id,
           assignment.iteration_id::text,
           assignment.scheduled_teaching_session_id::text as source_teaching_session_id,
           assignment.schedule_version::integer,
           state.state_version::integer,
           iteration.management_version::integer,
           target_session.id::text as target_revision_session_id,
           target_session.teaching_session_id::text as target_teaching_session_id,
           target_session.starts_at::text as target_starts_at,
           (target_session.starts_at > transaction_timestamp()) as target_is_future,
           transaction_timestamp()::text as database_now,
           target_plan.lock_version::integer as target_plan_lock_version
         from public.task_assignments as assignment
         join public.task_definitions as definition
           on definition.id = assignment.task_definition_id
         join public.student_task_state as state
           on state.assignment_id = assignment.id
         join public.task_iterations as iteration
           on iteration.id = assignment.iteration_id
         join public.plan_revision_tasks as source_task
           on source_task.id = assignment.source_plan_revision_task_id
         join public.weekly_plans as source_plan
           on source_plan.id = source_task.weekly_plan_id
         join public.weekly_plans as target_plan
           on target_plan.organization_id = assignment.organization_id
          and target_plan.class_id = assignment.class_id
          and target_plan.week_start_date > source_plan.week_start_date
          and target_plan.active_revision_id is not null
         join public.plan_revision_sessions as target_session
           on target_session.weekly_plan_id = target_plan.id
          and target_session.revision_id = target_plan.active_revision_id
         where assignment.student_id = $1
           and definition.title = 'D2 current completion race'
           and target_session.title = 'D2 framtidig måløkt'
         order by target_session.starts_at
         limit 1`,
        ["a0000000-0000-4000-8000-000000000015"],
      );
      assert.equal(result.rowCount, 1);
      assert.equal(
        result.rows[0].target_is_future,
        true,
        `D2 race target is not future: ${JSON.stringify(result.rows[0])}`,
      );
      return result.rows[0];
    },
  );
  const completionMoveRequestId = "d2f00000-0000-4000-8000-000000000001";
  const completionRequestId = "d2f00000-0000-4000-8000-000000000002";
  const moveCompletionRace = await synchronizedPair(
    config,
    "d2-move-versus-completion",
    (client) =>
      client.query(moveSql, [
        classId,
        completionRace.iteration_id,
        [completionRace.assignment_id],
        [completionRace.state_version],
        [completionRace.schedule_version],
        completionRace.target_revision_session_id,
        completionRace.management_version,
        completionRace.target_plan_lock_version,
        actorId,
        fixture.staffAssignmentId,
        completionMoveRequestId,
      ]),
    (client) =>
      client.query(
        `select public.complete_student_task_v2(
          $1,$2,$3,$4,$5,$6
        ) as result`,
        [
          organizationId,
          completionRace.assignment_id,
          "a0000000-0000-4000-8000-000000000015",
          completionRequestId,
          completionRace.state_version,
          completionRace.schedule_version,
        ],
      ),
  );
  assert.equal(
    moveCompletionRace.filter((result) => result.status === "fulfilled").length,
    1,
  );
  assert.equal(
    moveCompletionRace.filter((result) => result.status === "rejected").length,
    1,
  );
  const completionWon =
    moveCompletionRace[1].status === "fulfilled";
  assert.match(
    moveCompletionRace.find((result) => result.status === "rejected").reason.message,
    completionWon
      ? /Task assignment changed after preview/i
      : /Task assignment changed after it was opened/i,
  );
  await withClient(config, "klar-d2-assert-move-completion-race", async (client) => {
    const proof = await client.query(
      `select iteration.management_version::integer,
         assignment.schedule_version::integer,
         assignment.scheduled_teaching_session_id::text,
         state.state_version::integer,
         state.status::text,
         (select count(*)::integer from public.task_schedule_events
          where request_id = $2) as schedule_events,
         (select count(*)::integer from public.task_schedule_command_receipts
          where request_id = $2) as schedule_receipts,
         (select count(*)::integer from public.audit_events
          where event_name = 'task.iteration_moved'
            and metadata ->> 'request_id' = $2::text) as schedule_audits,
         (select count(*)::integer from public.task_completion_attempts
          where assignment_id = assignment.id) as attempts,
         (select count(*)::integer from public.student_xp_ledger
          where assignment_id = assignment.id) as ledger_entries,
         (select count(*)::integer from public.progress_command_receipts
          where request_id = $3) as progress_receipts,
         (select count(*)::integer from public.task_completion_v2_receipts
          where request_id = $3) as completion_receipts
       from public.task_assignments as assignment
       join public.task_iterations as iteration
         on iteration.id = assignment.iteration_id
       join public.student_task_state as state
         on state.assignment_id = assignment.id
       where assignment.id = $1`,
      [
        completionRace.assignment_id,
        completionMoveRequestId,
        completionRequestId,
      ],
    );
    assert.deepEqual(
      proof.rows[0],
      completionWon
        ? {
            management_version: completionRace.management_version,
            schedule_version: completionRace.schedule_version,
            scheduled_teaching_session_id:
              completionRace.source_teaching_session_id,
            state_version: completionRace.state_version + 1,
            status: "completed",
            schedule_events: 0,
            schedule_receipts: 0,
            schedule_audits: 0,
            attempts: 1,
            ledger_entries: 1,
            progress_receipts: 1,
            completion_receipts: 1,
          }
        : {
            management_version: completionRace.management_version + 1,
            schedule_version: completionRace.schedule_version + 1,
            scheduled_teaching_session_id:
              completionRace.target_teaching_session_id,
            state_version: completionRace.state_version,
            status: "assigned",
            schedule_events: 1,
            schedule_receipts: 1,
            schedule_audits: 1,
            attempts: 0,
            ledger_entries: 0,
            progress_receipts: 0,
            completion_receipts: 0,
          },
    );
  });
}

async function runWeeklyPlanConcurrency(config) {
  const organizationId = "b0000000-0000-4000-8000-000000000001";
  const classId = "c0000000-0000-4000-8000-000000000001";
  const actorId = "a0000000-0000-4000-8000-000000000004";
  const joiningStudentId = "a0000000-0000-4000-8000-000000000007";
  const staffAssignmentId = await withClient(
    config,
    "klar-c1-resolve-assignment",
    async (client) => {
      const result = await client.query(
        `select assignment.id
         from public.staff_assignments as assignment
         join public.staff_assignment_class_scopes as scope
           on scope.assignment_id = assignment.id
         where assignment.user_id = $1 and scope.class_id = $2
           and assignment.revoked_at is null`,
        [actorId, classId],
      );
      return result.rows[0].id;
    },
  );
  const publishSql = `select public.publish_initial_weekly_plan(
    $1,$2,$3,$4::date,'Europe/Oslo',0,$5,$6,$7::jsonb
  ) as result`;
  const publishArgs = (week, requestId, hash, candidate) => [
    classId,
    actorId,
    staffAssignmentId,
    week,
    requestId,
    hash,
    JSON.stringify(candidate),
  ];

  const sameWeek = "2099-07-20";
  const sameCandidate = weeklyCandidate("d", "Lik kandidat", "2099-07-21");
  const sameResults = await synchronizedPair(
    config,
    "weekly-same-candidate",
    (client) => client.query(publishSql, publishArgs(
      sameWeek,
      "d3000000-0000-4000-8000-000000000001",
      "c".repeat(64),
      sameCandidate,
    )),
    (client) => client.query(publishSql, publishArgs(
      sameWeek,
      "d3000000-0000-4000-8000-000000000002",
      "c".repeat(64),
      sameCandidate,
    )),
  );
  assert(sameResults.every((result) => result.status === "fulfilled"));
  assert.deepEqual(
    sameResults.map((result) => result.value.rows[0].result.already_published).sort(),
    [false, true],
  );
  assert.equal(
    sameResults[0].value.rows[0].result.weekly_plan_id,
    sameResults[1].value.rows[0].result.weekly_plan_id,
  );

  await withClient(config, "klar-c1-assert-same", async (client) => {
    const result = await client.query(
      `select
        (select count(*)::integer from public.weekly_plans where class_id = $1 and week_start_date = $2) as plans,
        (select count(*)::integer from public.plan_revisions as revision join public.weekly_plans as plan on plan.id = revision.weekly_plan_id where plan.class_id = $1 and plan.week_start_date = $2) as revisions,
        (select count(*)::integer from public.weekly_plan_publish_receipts as receipt join public.weekly_plans as plan on plan.id = receipt.weekly_plan_id where plan.class_id = $1 and plan.week_start_date = $2) as receipts,
        (select count(*)::integer from public.audit_events where event_name = 'weekly_plan.published' and metadata ->> 'week_start_date' = $2::text) as audits`,
      [classId, sameWeek],
    );
    assert.deepEqual(result.rows[0], { plans: 1, revisions: 1, receipts: 2, audits: 1 });
  });

  const conflictWeek = "2099-07-27";
  const conflictResults = await synchronizedPair(
    config,
    "weekly-conflict",
    (client) => client.query(publishSql, publishArgs(
      conflictWeek,
      "e3000000-0000-4000-8000-000000000001",
      "d".repeat(64),
      weeklyCandidate("e", "Kandidat A", "2099-07-28"),
    )),
    (client) => client.query(publishSql, publishArgs(
      conflictWeek,
      "f3000000-0000-4000-8000-000000000001",
      "e".repeat(64),
      weeklyCandidate("f", "Kandidat B", "2099-07-28"),
    )),
  );
  assert.equal(conflictResults.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(conflictResults.filter((result) => result.status === "rejected").length, 1);
  await withClient(config, "klar-c1-assert-conflict", async (client) => {
    const result = await client.query(
      `select
        (select count(*)::integer from public.weekly_plans where class_id = $1 and week_start_date = $2) as plans,
        (select count(*)::integer from public.plan_revisions as revision join public.weekly_plans as plan on plan.id = revision.weekly_plan_id where plan.class_id = $1 and plan.week_start_date = $2) as revisions,
        (select count(*)::integer from public.weekly_plan_publish_receipts as receipt join public.weekly_plans as plan on plan.id = receipt.weekly_plan_id where plan.class_id = $1 and plan.week_start_date = $2) as receipts,
        (select count(*)::integer from public.audit_events where event_name = 'weekly_plan.published' and metadata ->> 'week_start_date' = $2::text) as audits`,
      [classId, conflictWeek],
    );
    assert.deepEqual(result.rows[0], { plans: 1, revisions: 1, receipts: 1, audits: 1 });
  });

  const rosterWeek = "2099-08-03";
  const rosterTaskCount = 3;
  const rosterResults = await synchronizedPair(
    config,
    "weekly-roster-snapshot",
    (client) => client.query(publishSql, publishArgs(
      rosterWeek,
      "a3000000-0000-4000-8000-000000000009",
      "f".repeat(64),
      weeklyCandidate("a", "Mottakerliste", "2099-08-04", rosterTaskCount),
    )),
    (client) => client.query(
      `insert into public.class_memberships (
        class_id, organization_id, user_id, role, created_by
      ) values ($1,$2,$3,'student',$4)`,
      [classId, organizationId, joiningStudentId, actorId],
    ),
  );
  assert(rosterResults.every((result) => result.status === "fulfilled"));
  await withClient(config, "klar-c1-assert-roster", async (client) => {
    const result = await client.query(
      `select count(*)::integer as assignments
       from public.task_assignments as assignment
       join public.plan_tasks as plan_task on plan_task.id = assignment.plan_task_id
       join public.weekly_plans as plan on plan.id = plan_task.weekly_plan_id
       where plan.class_id = $1 and plan.week_start_date = $2
         and assignment.student_id = $3`,
      [classId, rosterWeek, joiningStudentId],
    );
    assert(
      [0, rosterTaskCount].includes(result.rows[0].assignments),
      `Opptaksracet ga delvis ukeplan: ${result.rows[0].assignments}/${rosterTaskCount}`,
    );
  });
}

async function runHelpQueueConcurrency(config) {
  const organizationId = "b0000000-0000-4000-8000-000000000001";
  const classId = "c0000000-0000-4000-8000-000000000001";
  const firstStudentId = "a0000000-0000-4000-8000-000000000006";
  const secondStudentId = "a0000000-0000-4000-8000-000000000009";
  const firstStaffId = "a0000000-0000-4000-8000-000000000003";
  const secondStaffId = "a0000000-0000-4000-8000-000000000004";
  const revocationStaffId = "a0000000-0000-4000-8000-00000000000a";
  const requestSql =
    "select public.request_student_help_v2($1,$2,$3,$4) as result";

  const state = await withClient(config, "klar-e1-load-fixture", async (client) => {
    const queue = await client.query(
      `select id, lock_version
       from public.help_queue_sessions
       where organization_id = $1 and class_id = $2 and status = 'open'`,
      [organizationId, classId],
    );
    const assignments = await client.query(
      `select distinct on (assignment.user_id)
          assignment.id, assignment.user_id
       from public.staff_assignments as assignment
       join public.memberships as membership
         on membership.organization_id = assignment.organization_id
        and membership.user_id = assignment.user_id
        and membership.role in ('owner', 'teacher')
       join public.staff_assignment_class_scopes as scope
         on scope.assignment_id = assignment.id
        and scope.organization_id = assignment.organization_id
       join public.staff_assignment_capabilities as capability
         on capability.assignment_id = assignment.id
        and capability.profile_version = assignment.profile_version
        and capability.capability = 'help_queue.manage'
       where assignment.user_id = any($1::uuid[])
         and scope.class_id = $2
         and assignment.revoked_at is null
         and assignment.starts_at <= transaction_timestamp()
         and (
           assignment.ends_at is null
           or transaction_timestamp() < assignment.ends_at
         )
       order by assignment.user_id, assignment.starts_at desc, assignment.id`,
      [[firstStaffId, secondStaffId, revocationStaffId], classId],
    );
    assert.equal(assignments.rows.length, 3);
    return {
      queueId: queue.rows[0].id,
      assignmentByStaff: new Map(
        assignments.rows.map((row) => [row.user_id, row.id]),
      ),
    };
  });

  const sameRequestId = "e1a00000-0000-4000-8000-000000000001";
  const sameRetry = await synchronizedPair(
    config,
    "help-same-request",
    (client) => client.query(requestSql, [
      state.queueId,
      firstStudentId,
      sameRequestId,
      null,
    ]),
    (client) => client.query(requestSql, [
      state.queueId,
      firstStudentId,
      sameRequestId,
      null,
    ]),
  );
  assert(sameRetry.every((result) => result.status === "fulfilled"));
  assert.equal(
    sameRetry[0].value.rows[0].result.request_id,
    sameRetry[1].value.rows[0].result.request_id,
  );
  await withClient(config, "klar-e1-assert-same-request", async (client) => {
    const result = await client.query(
      `select
         (select count(*)::integer from public.help_requests
          where queue_session_id = $1 and student_id = $2
            and status in ('waiting','claimed')) as requests,
         (select count(*)::integer from public.help_queue_command_receipts
          where actor_id = $2 and request_id = $3) as receipts,
         (select count(*)::integer from public.audit_events
          where event_name = 'help.requested'
            and entity_id = $4) as audits`,
      [
        state.queueId,
        firstStudentId,
        sameRequestId,
        sameRetry[0].value.rows[0].result.request_id,
      ],
    );
    assert.deepEqual(result.rows[0], { requests: 1, receipts: 1, audits: 1 });
  });

  const activeRequestId = sameRetry[0].value.rows[0].result.request_id;
  const activeOwnershipVersion =
    sameRetry[0].value.rows[0].result.ownership_version;
  const claimRace = await synchronizedPair(
    config,
    "help-claim",
    (client) => client.query(
      "select public.claim_student_help_v3($1,$2,$3,$4,$5) as result",
      [
        activeRequestId,
        activeOwnershipVersion,
        firstStaffId,
        state.assignmentByStaff.get(firstStaffId),
        "e1b00000-0000-4000-8000-000000000001",
      ],
    ),
    (client) => client.query(
      "select public.claim_student_help_v3($1,$2,$3,$4,$5) as result",
      [
        activeRequestId,
        activeOwnershipVersion,
        secondStaffId,
        state.assignmentByStaff.get(secondStaffId),
        "e1b00000-0000-4000-8000-000000000002",
      ],
    ),
  );
  assert.equal(claimRace.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(claimRace.filter((result) => result.status === "rejected").length, 1);

  const claimOwner = await withClient(config, "klar-e1-resolve-claim", async (client) => {
    const owner = await client.query(
      "select claimed_by, ownership_version from public.help_requests where id = $1",
      [activeRequestId],
    );
    const staffId = owner.rows[0].claimed_by;
    await client.query(
      "select public.resolve_student_help_v3($1,$2,$3,$4,$5)",
      [
        activeRequestId,
        owner.rows[0].ownership_version,
        staffId,
        state.assignmentByStaff.get(staffId),
        "e1b00000-0000-4000-8000-000000000003",
      ],
    );
    return staffId;
  });
  assert([firstStaffId, secondStaffId].includes(claimOwner));
  await withClient(config, "klar-e1-assert-claim", async (client) => {
    const result = await client.query(
      `select
        (select status::text from public.help_requests where id = $1) as status,
        (select count(*)::integer from public.audit_events
         where entity_id = $1 and event_name = 'help.claimed') as claim_audits,
        (select count(*)::integer from public.audit_events
         where entity_id = $1 and event_name = 'help.resolved') as resolve_audits`,
      [activeRequestId],
    );
    assert.deepEqual(result.rows[0], {
      status: "resolved",
      claim_audits: 1,
      resolve_audits: 1,
    });
  });

  const distinctRequests = await synchronizedPair(
    config,
    "help-distinct-request",
    (client) => client.query(requestSql, [
      state.queueId,
      secondStudentId,
      "e1c00000-0000-4000-8000-000000000001",
      null,
    ]),
    (client) => client.query(requestSql, [
      state.queueId,
      secondStudentId,
      "e1c00000-0000-4000-8000-000000000002",
      null,
    ]),
  );
  assert(distinctRequests.every((result) => result.status === "fulfilled"));
  assert.equal(
    distinctRequests[0].value.rows[0].result.request_id,
    distinctRequests[1].value.rows[0].result.request_id,
  );
  await withClient(config, "klar-e1-cancel-distinct", async (client) => {
    const requestId = distinctRequests[0].value.rows[0].result.request_id;
    const result = await client.query(
      "select public.cancel_student_help_v2($1,$2,$3) as result",
      [
        requestId,
        secondStudentId,
        "e1c00000-0000-4000-8000-000000000003",
      ],
    );
    assert.equal(result.rows[0].result.status, "cancelled");
    const counts = await client.query(
      `select
        (select count(*)::integer from public.help_requests
         where queue_session_id = $1 and student_id = $2 and id = $3) as requests,
        (select count(*)::integer from public.audit_events
         where entity_id = $3 and event_name = 'help.requested') as audits,
        (select count(*)::integer from public.help_queue_command_receipts
         where actor_id = $2 and command = 'request_help'
           and request_id = any($4::uuid[])) as receipts`,
      [
        state.queueId,
        secondStudentId,
        requestId,
        [
          "e1c00000-0000-4000-8000-000000000001",
          "e1c00000-0000-4000-8000-000000000002",
        ],
      ],
    );
    assert.deepEqual(counts.rows[0], { requests: 1, audits: 1, receipts: 2 });
  });

  const revokeRaceRequest = await withClient(
    config,
    "klar-e1-revoke-race-request",
    async (client) => {
      const result = await client.query(requestSql, [
        state.queueId,
        firstStudentId,
        "e1c00000-0000-4000-8000-000000000004",
        null,
      ]);
      return result.rows[0].result.request_id;
    },
  );
  const revokeRace = await synchronizedPair(
    config,
    "help-claim-revoke",
    (client) => client.query(
      "select public.claim_student_help_v3($1,$2,$3,$4,$5) as result",
      [
        revokeRaceRequest,
        1,
        revocationStaffId,
        state.assignmentByStaff.get(revocationStaffId),
        "e1c00000-0000-4000-8000-000000000005",
      ],
    ),
    (client) => client.query(
      "select public.revoke_staff_assignment($1,$2,$3)",
      [
        organizationId,
        "a0000000-0000-4000-8000-000000000001",
        state.assignmentByStaff.get(revocationStaffId),
      ],
    ),
  );
  assert.equal(revokeRace[1].status, "fulfilled");
  const claimWonRevocationRace = revokeRace[0].status === "fulfilled";
  await withClient(config, "klar-e1-assert-revoke-race", async (client) => {
    const result = await client.query(
      `select
         (select status::text from public.help_requests where id = $1) as status,
         (select claimed_by from public.help_requests where id = $1) as claimed_by,
         (select count(*)::integer from public.audit_events
          where entity_id = $1 and event_name = 'help.requeued'
            and metadata ->> 'reason' = 'claimant_assignment_inactive') as requeues,
         (select count(*)::integer from public.help_queue_command_receipts
          where actor_id = $2 and request_id = $3 and command = 'claim_help') as receipts`,
      [
        revokeRaceRequest,
        revocationStaffId,
        "e1c00000-0000-4000-8000-000000000005",
      ],
    );
    assert.deepEqual(result.rows[0], {
      status: "waiting",
      claimed_by: null,
      requeues: claimWonRevocationRace ? 1 : 0,
      receipts: claimWonRevocationRace ? 1 : 0,
    });
    await client.query(
      "select public.cancel_student_help_v2($1,$2,$3)",
      [
        revokeRaceRequest,
        firstStudentId,
        "e1c00000-0000-4000-8000-000000000006",
      ],
    );
  });

  const membershipRequestId = "e1c00000-0000-4000-8000-000000000007";
  const membershipRace = await synchronizedPair(
    config,
    "help-request-membership-delete",
    (client) => client.query(requestSql, [
      state.queueId,
      secondStudentId,
      membershipRequestId,
      null,
    ]),
    (client) => client.query(
      `delete from public.class_memberships
       where organization_id = $1 and class_id = $2 and user_id = $3`,
      [organizationId, classId, secondStudentId],
    ),
  );
  assert.equal(membershipRace[1].status, "fulfilled");
  const requestWonMembershipRace = membershipRace[0].status === "fulfilled";
  const membershipRaceEntityId = requestWonMembershipRace
    ? membershipRace[0].value.rows[0].result.request_id
    : null;
  await withClient(config, "klar-e1-assert-membership-race", async (client) => {
    const result = await client.query(
      `select
         (select count(*)::integer from public.class_memberships
          where organization_id = $1 and class_id = $2 and user_id = $3) as memberships,
         (select count(*)::integer from public.help_requests
          where queue_session_id = $4 and student_id = $3
            and status in ('waiting','claimed')) as active,
         (select count(*)::integer from public.help_requests
          where id = $6::uuid and queue_session_id = $4 and student_id = $3
            and status = 'expired') as expired,
         (select count(*)::integer from public.audit_events
          where entity_id = $6::uuid and actor_id = $3
            and event_name = 'help.requested') as request_audits,
         (select count(*)::integer from public.audit_events
          where entity_id = $6::uuid and event_name = 'help.expired'
            and metadata ->> 'reason' = 'class_membership_removed') as expiry_audits,
         (select count(*)::integer from public.help_queue_command_receipts
          where actor_id = $3 and request_id = $5 and command = 'request_help') as receipts`,
      [
        organizationId,
        classId,
        secondStudentId,
        state.queueId,
        membershipRequestId,
        membershipRaceEntityId,
      ],
    );
    const expectedTerminalized = requestWonMembershipRace ? 1 : 0;
    assert.deepEqual(result.rows[0], {
      memberships: 0,
      active: 0,
      expired: expectedTerminalized,
      request_audits: expectedTerminalized,
      expiry_audits: expectedTerminalized,
      receipts: expectedTerminalized,
    });
  });

  const roleRaceRequestId = "e1c00000-0000-4000-8000-000000000008";
  const roleRaceSignalId = await withClient(
    config,
    "klar-e1-role-race-signal",
    async (client) => {
      const signal = await client.query(
        `select id
         from public.help_queue_signals
         where organization_id = $1 and class_id = $2
           and queue_session_id = $3 and student_id = $4`,
        [organizationId, classId, state.queueId, firstStudentId],
      );
      assert.equal(signal.rows.length, 1);
      return signal.rows[0].id;
    },
  );
  const roleRace = await synchronizedPair(
    config,
    "help-request-organization-role",
    (client) => client.query(requestSql, [
      state.queueId,
      firstStudentId,
      roleRaceRequestId,
      null,
    ]),
    (client) => client.query(
      `update public.memberships
       set role = 'teacher'
       where organization_id = $1 and user_id = $2`,
      [organizationId, firstStudentId],
    ),
  );
  assert.equal(roleRace[1].status, "fulfilled");
  const requestWonRoleRace = roleRace[0].status === "fulfilled";
  const roleRaceEntityId = requestWonRoleRace
    ? roleRace[0].value.rows[0].result.request_id
    : null;
  await withClient(config, "klar-e1-assert-role-race", async (client) => {
    const result = await client.query(
      `select
         (select role::text from public.memberships
          where organization_id = $1 and user_id = $2) as organization_role,
         (select role::text from public.class_memberships
          where organization_id = $1 and class_id = $3 and user_id = $2) as class_role,
         (select count(*)::integer from public.help_requests
          where queue_session_id = $4 and student_id = $2
            and status in ('waiting','claimed')) as active,
         (select count(*)::integer from public.help_requests
          where id = $6::uuid and queue_session_id = $4 and student_id = $2
            and status = 'expired') as expired,
         (select count(*)::integer from public.audit_events
          where entity_id = $6::uuid and actor_id = $2
            and event_name = 'help.requested') as request_audits,
         (select count(*)::integer from public.audit_events
          where entity_id = $6::uuid and event_name = 'help.expired'
            and metadata ->> 'reason' = 'organization_role_changed') as expiry_audits,
         (select count(*)::integer from public.help_queue_command_receipts
          where actor_id = $2 and request_id = $5 and command = 'request_help') as receipts,
         (select count(*)::integer from public.help_queue_signals
          where id = $7 and queue_session_id = $4 and student_id is null) as tombstones,
         (select count(*)::integer from public.help_queue_signals
          where organization_id = $1 and class_id = $3
            and queue_session_id = $4 and student_id = $2) as live_signals`,
      [
        organizationId,
        firstStudentId,
        classId,
        state.queueId,
        roleRaceRequestId,
        roleRaceEntityId,
        roleRaceSignalId,
      ],
    );
    const expectedTerminalized = requestWonRoleRace ? 1 : 0;
    assert.deepEqual(result.rows[0], {
      organization_role: "teacher",
      class_role: "student",
      active: 0,
      expired: expectedTerminalized,
      request_audits: expectedTerminalized,
      expiry_audits: expectedTerminalized,
      receipts: expectedTerminalized,
      tombstones: 1,
      live_signals: 0,
    });
    await client.query(
      `update public.memberships
       set role = 'student'
       where organization_id = $1 and user_id = $2`,
      [organizationId, firstStudentId],
    );
  });

  const queueBeforeClose = await withClient(
    config,
    "klar-e1-version-before-close",
    async (client) => {
      const result = await client.query(
        "select lock_version from public.help_queue_sessions where id = $1",
        [state.queueId],
      );
      return result.rows[0].lock_version;
    },
  );
  const closeRace = await synchronizedPair(
    config,
    "help-close-request",
    (client) => client.query(
      "select public.begin_close_help_queue_session($1,$2,$3,$4,$5) as result",
      [
        state.queueId,
        queueBeforeClose,
        secondStaffId,
        state.assignmentByStaff.get(secondStaffId),
        "e1d00000-0000-4000-8000-000000000001",
      ],
    ),
    (client) => client.query(requestSql, [
      state.queueId,
      firstStudentId,
      "e1d00000-0000-4000-8000-000000000002",
      null,
    ]),
  );
  assert.equal(
    closeRace[0].status,
    "fulfilled",
    closeRace[0].status === "rejected"
      ? `Close race failed: ${closeRace[0].reason.message}`
      : undefined,
  );
  const requestWon = closeRace[1].status === "fulfilled";
  await withClient(config, "klar-e1-assert-close-race", async (client) => {
    const queue = await client.query(
      "select status::text as status from public.help_queue_sessions where id = $1",
      [state.queueId],
    );
    if (requestWon) {
      assert.equal(queue.rows[0].status, "closing");
      const requestId = closeRace[1].value.rows[0].result.request_id;
      await client.query(
        "select public.cancel_student_help_v2($1,$2,$3)",
        [
          requestId,
          firstStudentId,
          "e1d00000-0000-4000-8000-000000000003",
        ],
      );
    } else {
      assert.match(closeRace[1].reason.message, /not open/i);
    }
    const finalQueue = await client.query(
      `select status::text as status,
        (select count(*)::integer from public.help_requests
         where queue_session_id = $1 and status in ('waiting','claimed')) as active
       from public.help_queue_sessions where id = $1`,
      [state.queueId],
    );
    assert.deepEqual(finalQueue.rows[0], { status: "closed", active: 0 });
  });
}

async function runHelpQueueStaffControlConcurrency(config) {
  const organizationId = "b0000000-0000-4000-8000-000000000001";
  const classId = "c0000000-0000-4000-8000-000000000001";
  const firstStudentId = "a0000000-0000-4000-8000-000000000006";
  const secondStudentId = "a0000000-0000-4000-8000-000000000009";
  const firstStaffId = "a0000000-0000-4000-8000-000000000003";
  const secondStaffId = "a0000000-0000-4000-8000-000000000004";
  const firstCommandId = "e2900000-0000-4000-8000-000000000001";
  const secondCommandId = "e2900000-0000-4000-8000-000000000002";

  const state = await withClient(config, "klar-e2-reorder-race-setup", async (client) => {
    const queue = await client.query(
      `select id
       from public.help_queue_sessions
       where organization_id = $1 and class_id = $2 and status = 'open'`,
      [organizationId, classId],
    );
    assert.equal(queue.rows.length, 1);
    const assignments = await client.query(
      `select distinct on (assignment.user_id)
          assignment.id, assignment.user_id
       from public.staff_assignments as assignment
       join public.staff_assignment_class_scopes as scope
         on scope.assignment_id = assignment.id
        and scope.organization_id = assignment.organization_id
       join public.staff_assignment_capabilities as capability
         on capability.assignment_id = assignment.id
        and capability.profile_version = assignment.profile_version
        and capability.capability = 'help_queue.manage'
       where assignment.organization_id = $1
         and assignment.user_id = any($2::uuid[])
         and scope.class_id = $3
         and assignment.revoked_at is null
         and assignment.starts_at <= transaction_timestamp()
         and (assignment.ends_at is null or transaction_timestamp() < assignment.ends_at)
       order by assignment.user_id, assignment.starts_at desc, assignment.id`,
      [organizationId, [firstStaffId, secondStaffId], classId],
    );
    assert.equal(assignments.rows.length, 2);
    const assignmentByStaff = new Map(
      assignments.rows.map((row) => [row.user_id, row.id]),
    );
    const firstRequest = await client.query(
      "select public.request_student_help_v2($1,$2,$3,$4) as result",
      [
        queue.rows[0].id,
        firstStudentId,
        "e2910000-0000-4000-8000-000000000001",
        null,
      ],
    );
    const secondRequest = await client.query(
      "select public.request_student_help_v2($1,$2,$3,$4) as result",
      [
        queue.rows[0].id,
        secondStudentId,
        "e2910000-0000-4000-8000-000000000002",
        null,
      ],
    );
    const version = await client.query(
      "select activity_version from public.help_queue_sessions where id = $1",
      [queue.rows[0].id],
    );
    return {
      queueId: queue.rows[0].id,
      firstRequestId: firstRequest.rows[0].result.request_id,
      secondRequestId: secondRequest.rows[0].result.request_id,
      activityVersion: version.rows[0].activity_version,
      assignmentByStaff,
    };
  });

  const reorderSql = `select public.reorder_student_help_v1(
    $1,$2,$3,$4::public.help_queue_priority_reason,$5,$6,$7,$8
  ) as result`;
  const race = await synchronizedPair(
    config,
    "help-e2-reorder",
    (client) => client.query(reorderSql, [
      state.queueId,
      state.firstRequestId,
      "down",
      "staff_coordination",
      state.activityVersion,
      firstStaffId,
      state.assignmentByStaff.get(firstStaffId),
      firstCommandId,
    ]),
    (client) => client.query(reorderSql, [
      state.queueId,
      state.secondRequestId,
      "first",
      "support_needed_now",
      state.activityVersion,
      secondStaffId,
      state.assignmentByStaff.get(secondStaffId),
      secondCommandId,
    ]),
  );
  assert.equal(race.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(race.filter((result) => result.status === "rejected").length, 1);
  const rejected = race.find((result) => result.status === "rejected");
  assert.match(rejected.reason.message, /activity version is stale/i);

  await withClient(config, "klar-e2-reorder-race-assert", async (client) => {
    const result = await client.query(
      `select
        (select array_agg(request_id order by position)
         from public.help_queue_request_order
         where queue_session_id = $1 and active) as ordered_requests,
        (select activity_version from public.help_queue_sessions where id = $1) as activity_version,
        (select count(*)::integer from public.audit_events
         where event_name = 'help.reordered'
           and entity_id = any($2::uuid[])) as audits,
        (select count(*)::integer from public.help_queue_command_receipts
         where request_id = any($3::uuid[]) and command = 'reorder_help') as receipts,
        (select count(*)::integer from public.help_queue_signals
         where queue_session_id = $1 and staff_only) as staff_signals`,
      [
        state.queueId,
        [state.firstRequestId, state.secondRequestId],
        [firstCommandId, secondCommandId],
      ],
    );
    assert.deepEqual(result.rows[0], {
      ordered_requests: [state.secondRequestId, state.firstRequestId],
      activity_version: String(BigInt(state.activityVersion) + 1n),
      audits: 1,
      receipts: 1,
      staff_signals: 1,
    });

    await client.query(
      "select public.cancel_student_help_v2($1,$2,$3)",
      [
        state.firstRequestId,
        firstStudentId,
        "e2920000-0000-4000-8000-000000000001",
      ],
    );
    await client.query(
      "select public.cancel_student_help_v2($1,$2,$3)",
      [
        state.secondRequestId,
        secondStudentId,
        "e2920000-0000-4000-8000-000000000002",
      ],
    );
    const active = await client.query(
      `select count(*)::integer as requests
       from public.help_requests
       where queue_session_id = $1 and status in ('waiting','claimed')`,
      [state.queueId],
    );
    assert.equal(active.rows[0].requests, 0);
  });
}

async function runEmptyScenario() {
  const container = startContainer("empty");
  try {
    applyPreA1(container.name);
    runSql(container.name, `supabase/migrations/${a1Migration}`);
    applyA1Followups(container.name);
    applyPostA1(container.name);
    applyE2(container.name);
    applyD2(container.name);
    applyD3(container.name);
    applyB2(container.name);
    runSql(container.name, "supabase/verification/rls_smoke.sql");
    runSql(container.name, "supabase/verification/staff_rls_rpc_smoke.sql");
    runSql(container.name, "supabase/verification/progress_rls_rpc_smoke.sql");
    runSql(container.name, "supabase/verification/flower_reward_rpc_smoke.sql");
    runSql(container.name, "supabase/verification/staff_concurrency_fixture.sql");
    runSql(container.name, "supabase/verification/progress_concurrency_fixture.sql");
    runSql(container.name, "supabase/verification/flower_reward_concurrency_fixture.sql");
    runSql(container.name, "supabase/verification/weekly_plan_rpc_smoke.sql");
    runSql(container.name, "supabase/verification/task_iteration_concurrency_fixture.sql");
    runSql(container.name, "supabase/verification/help_queue_concurrency_fixture.sql");
    runSql(container.name, "supabase/verification/task_iteration_rpc_smoke.sql");
    // D3 intentionally runs after the D2 fixture so the catalog smoke can
    // prove both a visible historical plan task and a future hidden plan task.
    runSql(container.name, "supabase/verification/student_task_catalog_rpc_smoke.sql");
    runSql(container.name, "supabase/verification/help_queue_session_rpc_smoke.sql");
    runSql(container.name, "supabase/verification/help_queue_staff_controls_rpc_smoke.sql");
    await runHelpQueueStaffControlConcurrency(container.config);
    await runHelpQueueConcurrency(container.config);
    await runWeeklyPlanConcurrency(container.config);
    await runTaskScheduleConcurrency(container.config);
    await runConcurrency(container.config);
    await runProgressConcurrency(container.config);
    await runFlowerRewardConcurrency(container.config);
    console.log("A1 database empty + RLS/RPC + concurrency: PASS");
  } finally {
    cleanupContainer(container.name);
  }
}

function runUpgradeScenario() {
  const positive = startContainer("upgrade-positive");
  try {
    applyPreA1(positive.name);
    runSql(positive.name, "supabase/verification/staff_upgrade_fixture.sql");
    runSql(positive.name, `supabase/migrations/${a1Migration}`);
    applyA1Followups(positive.name);
    applyPostA1(positive.name);
    runSql(positive.name, "supabase/verification/staff_upgrade_smoke.sql");
    runSql(positive.name, "supabase/verification/progress_upgrade_smoke.sql");
    runSql(positive.name, "supabase/verification/weekly_plan_upgrade_smoke.sql");
    runSql(positive.name, "supabase/verification/help_queue_upgrade_smoke.sql");
    runSql(positive.name, "supabase/verification/help_queue_staff_upgrade_fixture.sql");
    applyE2(positive.name);
    runSql(positive.name, "supabase/verification/help_queue_staff_upgrade_smoke.sql");
    runSql(positive.name, "supabase/verification/task_iteration_upgrade_fixture.sql");
    applyD2(positive.name);
    runSql(positive.name, "supabase/verification/task_iteration_upgrade_smoke.sql");
    applyD3(positive.name);
    runSql(positive.name, "supabase/verification/student_task_catalog_upgrade_smoke.sql");
    runSql(positive.name, "supabase/verification/flower_reward_upgrade_fixture.sql");
    const invalidFlowerUpgrade = runSql(
      positive.name,
      `supabase/migrations/${b2Migration}`,
      { expectFailure: true },
    );
    assert.match(
      invalidFlowerUpgrade,
      /selected reward entitlements require an explicit reward migration/i,
    );
    runSql(positive.name, "supabase/verification/flower_reward_upgrade_restore.sql");
    applyB2(positive.name);
    runSql(positive.name, "supabase/verification/flower_reward_upgrade_smoke.sql");
  } finally {
    cleanupContainer(positive.name);
  }

  const invalid = startContainer("upgrade-invalid");
  try {
    applyPreA1(invalid.name);
    runSql(invalid.name, "supabase/verification/staff_invalid_legacy_fixture.sql");
    const output = runSql(invalid.name, `supabase/migrations/${a1Migration}`, {
      expectFailure: true,
    });
    assert.match(
      output,
      /legacy teacher class membership has no current adult organization membership/i,
    );
    runSql(invalid.name, "supabase/verification/staff_invalid_legacy_assert.sql");
  } finally {
    cleanupContainer(invalid.name);
  }

  const invalidE2 = startContainer("upgrade-e2-invalid");
  try {
    applyPreA1(invalidE2.name);
    runSql(invalidE2.name, "supabase/verification/staff_upgrade_fixture.sql");
    runSql(invalidE2.name, `supabase/migrations/${a1Migration}`);
    applyA1Followups(invalidE2.name);
    applyPostA1(invalidE2.name);
    runSql(invalidE2.name, "supabase/verification/help_queue_staff_upgrade_fixture.sql");
    runSql(invalidE2.name, "supabase/verification/help_queue_staff_invalid_scope_fixture.sql");
    const output = runSql(invalidE2.name, `supabase/migrations/${e2Migration}`, {
      expectFailure: true,
    });
    assert.match(
      output,
      /help queue signal scope is inconsistent with its queue session/i,
    );
    runSql(invalidE2.name, "supabase/verification/help_queue_staff_invalid_scope_assert.sql");
  } finally {
    cleanupContainer(invalidE2.name);
  }
  console.log("A1 database representative upgrade + atomic preflight: PASS");
}

try {
  const docker = spawnSync("docker", ["info"], {
    cwd: root,
    stdio: "ignore",
    shell: false,
    timeout: 15_000,
  });
  if (docker.error || docker.status !== 0) {
    throw new Error("Docker er ikke tilgjengelig. Ingen ekstern database ble berørt.");
  }
  if (scenario === "all" || scenario === "empty") await runEmptyScenario();
  if (scenario === "all" || scenario === "upgrade") runUpgradeScenario();
} finally {
  cleanupAll();
}
