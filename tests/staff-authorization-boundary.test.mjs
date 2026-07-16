import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function occurrences(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

const pedagogicalServices = [
  "src/server/classes/class-service.ts",
  "src/server/tasks/task-service.ts",
  "src/server/import/import-service.ts",
  "src/server/help/help-service.ts",
  "src/server/students/experience-service.ts",
];

describe("staff authorization boundary", () => {
  test("keeps adult pedagogical services off legacy role helpers", () => {
    for (const relativePath of pedagogicalServices) {
      const source = read(relativePath);
      assert.doesNotMatch(
        source,
        /requireAnyTeacherActor/,
        `${relativePath} uses the removed global teacher helper`,
      );
      assert.doesNotMatch(
        source,
        /requireClassRole\([\s\S]{0,160}?["']teacher["']/,
        `${relativePath} authorizes adult pedagogy with class membership`,
      );
      assert.doesNotMatch(
        source,
        /\.eq\(["']role["'],\s*["']teacher["']\)/,
        `${relativePath} queries teacher membership as an authorization boundary`,
      );
    }

    const capabilityContracts = [
      ["src/server/tasks/task-service.ts", "task.publish", 2],
      ["src/server/import/import-service.ts", "plan.preview", 2],
      ["src/server/import/import-service.ts", "plan.publish", 2],
      ["src/server/help/help-service.ts", "help_queue.manage", 4],
      ["src/server/students/experience-service.ts", "student_support.update", 2],
      ["src/server/tasks/task-service.ts", "task.return", 2],
    ];
    for (const [relativePath, capability, minimum] of capabilityContracts) {
      const source = read(relativePath);
      assert.ok(
        occurrences(
          source,
          new RegExp(`requireStaffCapability\\([\\s\\S]{0,80}?["']${capability.replace(".", "\\.")}["']`, "g"),
        ) >= minimum,
        `${relativePath} does not revalidate ${capability} at every service boundary`,
      );
      assert.doesNotMatch(
        source,
        /requireOrganizationRole/,
        `${relativePath} uses organization roles for adult pedagogy`,
      );
    }

    const classService = read("src/server/classes/class-service.ts");
    const workspaceService = classService.slice(
      classService.indexOf("export async function getTeacherClassWorkspace"),
    );
    assert.equal(
      occurrences(
        workspaceService,
        /requireStaffCapability\([\s\S]{0,80}?["']class\.workspace\.read["']/g,
      ),
      2,
    );
    assert.match(
      workspaceService,
      /retainStudentProgressAccess\(classId\)[\s\S]*?from\(["']student_task_state["']\)[\s\S]*?retainStudentProgressAccess\(classId\)/,
    );
    const supportReadBoundary = read(
      "src/server/classes/support-read-boundary.ts",
    );
    assert.match(
      workspaceService,
      /readStudentSupportSettingsAtBoundary\([\s\S]*?authorize:\s*\(\)\s*=>\s*retainStudentSupportAccess\(classId\)[\s\S]*?from\(["']student_experience_settings["']\)/,
    );
    assert.match(
      supportReadBoundary,
      /if \(!\(await authorize\(\)\)\)[\s\S]*?await select\([\s\S]*?if \(!\(await authorize\(\)\)\)/,
    );
    assert.doesNotMatch(workspaceService, /requireOrganizationRole/);
    assert.equal(occurrences(classService, /requireOrganizationRole\(/g), 1);
    assert.match(
      classService,
      /createTeacherClass[\s\S]{0,240}?requireOrganizationRole\([\s\S]{0,80}?["']owner["']/,
    );
  });

  test("keeps runtime SQL free of teacher-membership fallback", () => {
    const migration = read(
      "supabase/migrations/20260715000000_staff_assignments.sql",
    );
    const runtimeStart = migration.indexOf(
      "create function public.staff_assignment_authorizes",
    );
    assert.notEqual(runtimeStart, -1);
    const runtime = migration.slice(runtimeStart);

    assert.doesNotMatch(runtime, /class_membership\.role\s*=\s*'teacher'/);
    assert.doesNotMatch(runtime, /enum_range\(null::public\.staff_capability\)/);
    assert.match(runtime, /lock_staff_assignment_authorization/);
    assert.match(runtime, /for share of assignment, membership/);
    assert.match(
      migration,
      /drop function public\.publish_task_to_class\([\s\S]*?timestamptz\s*\);/,
    );

    const supportReadHardening = read(
      "supabase/migrations/20260715000001_staff_support_read_hardening.sql",
    );
    assert.match(
      supportReadHardening,
      /student_experience_select_authorized[\s\S]*?student_support\.update/,
    );
    assert.doesNotMatch(
      supportReadHardening,
      /student_experience_select_authorized[\s\S]*?class\.workspace\.read/,
    );
    assert.match(
      supportReadHardening,
      /create trigger staff_assignment_scopes_guard_insert[\s\S]*?before insert on public\.staff_assignment_class_scopes/,
    );
    assert.match(
      supportReadHardening,
      /create trigger staff_assignment_capabilities_guard_insert[\s\S]*?before insert on public\.staff_assignment_capabilities/,
    );
    assert.match(
      supportReadHardening,
      /add column profile_sealed_at timestamptz[\s\S]*?create constraint trigger staff_assignment_requires_sealed_profile/,
    );
    assert.match(
      supportReadHardening,
      /profile_sealed_at is not null[\s\S]*?immutable after creation/,
    );
    assert.match(
      supportReadHardening,
      /try_seal_staff_assignment_profile[\s\S]*?count\(\*\) = cardinality\(expected_capabilities\)[\s\S]*?set profile_sealed_at = transaction_timestamp\(\)/,
    );
    assert.match(
      supportReadHardening,
      /revoke all on function public\.try_seal_staff_assignment_profile\(\)[\s\S]*?service_role/,
    );
  });

  test("keeps the historical v1 profile and current v2 profile explicit", () => {
    const policy = read("src/server/auth/policy.ts");
    assert.match(policy, /CLASS_PEDAGOGY_V1_CAPABILITIES\s*=\s*\[/);
    assert.match(policy, /CLASS_PEDAGOGY_V2_CAPABILITIES\s*=\s*\[/);
    assert.match(
      policy,
      /CLASS_PEDAGOGY_PROFILE\s*=\s*\{[\s\S]{0,160}version:\s*["']class_pedagogy_v2["']/,
    );
    assert.doesNotMatch(
      policy,
      /CLASS_PEDAGOGY_PROFILE\s*=\s*\{[\s\S]{0,160}capabilities:\s*STAFF_CAPABILITIES/,
    );
  });
});
