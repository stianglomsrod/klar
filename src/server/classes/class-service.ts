import "server-only";

import {
  requireOrganizationRole,
  requireStaffCapability,
  requireStaffIdentity,
} from "@/server/auth/authorize";
import { isAuthorizationError } from "@/server/auth/errors";
import { PrototypeDataError } from "@/server/data/errors";
import { getSupabaseAdminClient } from "@/server/supabase/admin";
import type { SupportLevel } from "@/server/students/experience-service";
import type { StaffCapability, StaffJobLabel } from "@/server/auth/policy";
import { listActiveStaffClassGrants } from "@/server/staff/staff-service";
import {
  readStudentSupportSettingsAtBoundary,
  resolveStudentSupportSetting,
} from "./support-read-boundary";

export type TeacherClassSummary = {
  id: string;
  name: string;
  academicYear: string | null;
  studentCount: number;
  assignmentId: string;
  jobLabel: StaffJobLabel;
  capabilities: StaffCapability[];
};

export type TeacherDashboard = {
  organizationId: string;
  organizationName: string;
  classes: TeacherClassSummary[];
  isOwner: boolean;
};

export type ClassStudentSummary = {
  id: string;
  displayName: string;
  completedTasks: number | null;
  assignedTasks: number;
  supportLevel: SupportLevel;
  progressEnabled: boolean;
};

export type CompletedTaskAssignmentSummary = {
  assignmentId: string;
  studentName: string;
  completedAt: string;
};

export type PublishedTaskSummary = {
  id: string;
  title: string;
  subject: string | null;
  completedStudents: number | null;
  assignedStudents: number;
  completedAssignments: CompletedTaskAssignmentSummary[];
};

export type TeacherClassWorkspace = {
  id: string;
  organizationId: string;
  name: string;
  academicYear: string | null;
  students: ClassStudentSummary[];
  tasks: PublishedTaskSummary[];
  staffAssignmentId: string;
  capabilities: StaffCapability[];
  isOwner: boolean;
  progressAvailable: boolean;
};

async function retainStudentProgressAccess(classId: string): Promise<boolean> {
  try {
    await requireStaffCapability(classId, "student_progress.read");
    return true;
  } catch (error) {
    if (!isAuthorizationError(error) || error.code !== "STAFF_ACCESS_ENDED") {
      throw error;
    }
    await requireStaffCapability(classId, "class.workspace.read");
    return false;
  }
}

async function retainStudentSupportAccess(classId: string): Promise<boolean> {
  try {
    await requireStaffCapability(classId, "student_support.update");
    return true;
  } catch (error) {
    if (!isAuthorizationError(error) || error.code !== "STAFF_ACCESS_ENDED") {
      throw error;
    }
    await requireStaffCapability(classId, "class.workspace.read");
    return false;
  }
}

export async function getTeacherDashboard(): Promise<TeacherDashboard> {
  const actor = await requireStaffIdentity();
  const grants = await listActiveStaffClassGrants(actor);
  const admin = getSupabaseAdminClient();
  const { data: organization, error: organizationError } = await admin
    .from("organizations")
    .select("name")
    .eq("id", actor.organizationId)
    .single();
  if (organizationError || !organization) throw new PrototypeDataError();

  const classIds = grants.map((grant) => grant.classId);

  if (classIds.length === 0) {
    return {
      organizationId: actor.organizationId,
      organizationName: organization.name,
      classes: [],
      isOwner: actor.organizationRole === "owner",
    };
  }

  let classQuery = admin
    .from("classes")
    .select("id, name, academic_year")
    .eq("organization_id", actor.organizationId)
    .is("archived_at", null)
    .order("name");

  classQuery = classQuery.in("id", classIds);

  const { data: classes, error: classesError } = await classQuery;
  if (classesError) throw new PrototypeDataError();

  const visibleClassIds = classes.map((classRow) => classRow.id);
  const counts = new Map<string, number>();
  if (visibleClassIds.length > 0) {
    const { data: students, error } = await admin
      .from("class_memberships")
      .select("class_id")
      .in("class_id", visibleClassIds)
      .eq("role", "student");
    if (error) throw new PrototypeDataError();
    for (const student of students) {
      counts.set(student.class_id, (counts.get(student.class_id) ?? 0) + 1);
    }
  }

  const confirmedGrants = await listActiveStaffClassGrants(actor);
  const confirmedGrantByClass = new Map(
    confirmedGrants.map((grant) => [grant.classId, grant]),
  );

  return {
    organizationId: actor.organizationId,
    organizationName: organization.name,
    isOwner: actor.organizationRole === "owner",
    classes: classes.filter((classRow) => confirmedGrantByClass.has(classRow.id)).map((classRow) => ({
      id: classRow.id,
      name: classRow.name,
      academicYear: classRow.academic_year,
      studentCount: counts.get(classRow.id) ?? 0,
      assignmentId:
        confirmedGrantByClass.get(classRow.id)?.assignmentId ?? "",
      jobLabel:
        confirmedGrantByClass.get(classRow.id)?.jobLabel ??
        "legacy_teacher",
      capabilities:
        confirmedGrantByClass.get(classRow.id)?.capabilities ?? [],
    })),
  };
}

export async function createTeacherClass(input: {
  organizationId: string;
  name: string;
  academicYear?: string;
}): Promise<string> {
  const actor = await requireOrganizationRole(input.organizationId, [
    "owner",
  ]);
  const name = input.name.trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 80) {
    throw new PrototypeDataError("Klassenavnet må være mellom 1 og 80 tegn.");
  }

  const academicYear = input.academicYear?.trim() || null;
  if (academicYear && academicYear.length > 20) {
    throw new PrototypeDataError("Skoleåret kan ikke være lengre enn 20 tegn.");
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc("create_class_for_teacher", {
    p_organization_id: actor.organizationId,
    p_actor_id: actor.userId,
    p_name: name,
    p_academic_year: academicYear,
  });
  if (error || !data) throw new PrototypeDataError("Kunne ikke opprette klassen.");
  return data;
}

export async function getTeacherClassWorkspace(
  classId: string,
): Promise<TeacherClassWorkspace> {
  const actor = await requireStaffCapability(classId, "class.workspace.read");
  const admin = getSupabaseAdminClient();
  const { data: classRow, error: classError } = await admin
    .from("classes")
    .select("id, organization_id, name, academic_year")
    .eq("id", actor.classId)
    .eq("organization_id", actor.organizationId)
    .single();
  if (classError || !classRow) throw new PrototypeDataError();

  const { data: organizationMembership, error: membershipError } = await admin
    .from("memberships")
    .select("role")
    .eq("organization_id", actor.organizationId)
    .eq("user_id", actor.userId)
    .maybeSingle();
  if (membershipError || !organizationMembership) {
    throw new PrototypeDataError();
  }

  const { data: studentMemberships, error: studentMembershipError } =
    await admin
      .from("class_memberships")
      .select("user_id")
      .eq("class_id", actor.classId)
      .eq("role", "student");
  if (studentMembershipError) throw new PrototypeDataError();

  const studentIds = studentMemberships.map((membership) => membership.user_id);
  const profiles = studentIds.length
    ? await admin.from("profiles").select("id, display_name").in("id", studentIds)
    : { data: [], error: null };
  if (profiles.error) throw new PrototypeDataError();

  const supportSettings = actor.capabilities.includes("student_support.update")
    ? await readStudentSupportSettingsAtBoundary({
        organizationId: actor.organizationId,
        studentIds,
        authorize: () => retainStudentSupportAccess(classId),
        select: async ({ organizationId, studentIds: scopedStudentIds }) => {
          const result = await admin
            .from("student_experience_settings")
            .select("student_id, support_level, progress_enabled")
            .eq("organization_id", organizationId)
            .in("student_id", scopedStudentIds);
          if (result.error) throw new PrototypeDataError();
          return result.data;
        },
      })
    : { available: false, rows: [] };
  const experienceByStudent = new Map(
    supportSettings.rows.map((settings) => [settings.student_id, settings]),
  );

  const { data: tasks, error: tasksError } = await admin
    .from("task_definitions")
    .select("id, title, subject")
    .eq("class_id", actor.classId)
    .eq("publication_status", "published")
    .order("created_at", { ascending: false });
  if (tasksError) throw new PrototypeDataError();

  const { data: assignments, error: assignmentsError } = await admin
    .from("task_assignments")
    .select("id, task_definition_id, student_id")
    .eq("class_id", actor.classId);
  if (assignmentsError) throw new PrototypeDataError();

  const assignmentIds = assignments.map((assignment) => assignment.id);
  let progressAvailable =
    actor.capabilities.includes("student_progress.read") &&
    (await retainStudentProgressAccess(classId));
  let stateRows: Array<{
    assignment_id: string;
    status: "assigned" | "completed" | "reopened";
    completed_at: string | null;
  }> = [];
  if (progressAvailable && assignmentIds.length > 0) {
    const states = await admin
      .from("student_task_state")
      .select("assignment_id, status, completed_at")
      .eq("organization_id", actor.organizationId)
      .in("assignment_id", assignmentIds);
    if (states.error) throw new PrototypeDataError();
    stateRows = states.data;

    progressAvailable = await retainStudentProgressAccess(classId);
    if (!progressAvailable) stateRows = [];
  }

  const statusByAssignment = new Map(
    stateRows.map((state) => [state.assignment_id, state.status]),
  );
  const stateByAssignment = new Map(
    stateRows.map((state) => [state.assignment_id, state]),
  );
  const studentNameById = new Map(
    profiles.data.map((profile) => [profile.id, profile.display_name]),
  );

  const confirmedActor = await requireStaffCapability(
    classId,
    "class.workspace.read",
  );
  const supportSettingsAvailable =
    supportSettings.available &&
    confirmedActor.capabilities.includes("student_support.update");
  if (!supportSettingsAvailable) experienceByStudent.clear();

  return {
    id: classRow.id,
    organizationId: classRow.organization_id,
    name: classRow.name,
    academicYear: classRow.academic_year,
    students: profiles.data
      .map((profile) => {
        const studentAssignments = assignments.filter(
          (assignment) => assignment.student_id === profile.id,
        );
        const experience = resolveStudentSupportSetting(
          experienceByStudent,
          profile.id,
        );
        return {
          id: profile.id,
          displayName: profile.display_name,
          assignedTasks: studentAssignments.length,
          completedTasks: progressAvailable
            ? studentAssignments.filter(
                (assignment) =>
                  statusByAssignment.get(assignment.id) === "completed",
              ).length
            : null,
          supportLevel: experience.supportLevel as SupportLevel,
          progressEnabled: experience.progressEnabled,
        };
      })
      .sort((first, second) =>
        first.displayName.localeCompare(second.displayName, "nb"),
      ),
    tasks: tasks.map((task) => {
      const taskAssignments = assignments.filter(
        (assignment) => assignment.task_definition_id === task.id,
      );
      return {
        id: task.id,
        title: task.title,
        subject: task.subject,
        assignedStudents: taskAssignments.length,
        completedStudents: progressAvailable
          ? taskAssignments.filter(
              (assignment) =>
                statusByAssignment.get(assignment.id) === "completed",
            ).length
          : null,
        completedAssignments: progressAvailable
          ? taskAssignments.flatMap((assignment) => {
              const state = stateByAssignment.get(assignment.id);
              const studentName = studentNameById.get(assignment.student_id);
              if (
                state?.status !== "completed" ||
                !state.completed_at ||
                !studentName
              ) {
                return [];
              }
              return [
                {
                  assignmentId: assignment.id,
                  studentName,
                  completedAt: state.completed_at,
                },
              ];
            })
          : [],
      };
    }),
    staffAssignmentId: confirmedActor.staffAssignmentId,
    capabilities: confirmedActor.capabilities,
    isOwner: organizationMembership.role === "owner",
    progressAvailable,
  };
}
