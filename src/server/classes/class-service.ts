import "server-only";

import {
  requireAnyTeacherActor,
  requireClassRole,
  requireOrganizationRole,
} from "@/server/auth/authorize";
import { PrototypeDataError } from "@/server/data/errors";
import { getSupabaseAdminClient } from "@/server/supabase/admin";
import type { SupportLevel } from "@/server/students/experience-service";

export type TeacherClassSummary = {
  id: string;
  name: string;
  academicYear: string | null;
  studentCount: number;
};

export type TeacherDashboard = {
  organizationId: string;
  organizationName: string;
  classes: TeacherClassSummary[];
};

export type ClassStudentSummary = {
  id: string;
  displayName: string;
  completedTasks: number;
  assignedTasks: number;
  supportLevel: SupportLevel;
  progressEnabled: boolean;
};

export type PublishedTaskSummary = {
  id: string;
  title: string;
  subject: string | null;
  completedStudents: number;
  assignedStudents: number;
};

export type TeacherClassWorkspace = {
  id: string;
  organizationId: string;
  name: string;
  academicYear: string | null;
  students: ClassStudentSummary[];
  tasks: PublishedTaskSummary[];
};

export async function getTeacherDashboard(): Promise<TeacherDashboard> {
  const actor = await requireAnyTeacherActor();
  const admin = getSupabaseAdminClient();
  const { data: organization, error: organizationError } = await admin
    .from("organizations")
    .select("name")
    .eq("id", actor.organizationId)
    .single();
  if (organizationError || !organization) throw new PrototypeDataError();

  let classIds: string[] | null = null;
  if (actor.organizationRole === "teacher") {
    const { data: memberships, error } = await admin
      .from("class_memberships")
      .select("class_id")
      .eq("organization_id", actor.organizationId)
      .eq("user_id", actor.userId)
      .eq("role", "teacher");
    if (error) throw new PrototypeDataError();
    classIds = memberships.map((membership) => membership.class_id);
  }

  let classQuery = admin
    .from("classes")
    .select("id, name, academic_year")
    .eq("organization_id", actor.organizationId)
    .is("archived_at", null)
    .order("name");

  if (classIds) {
    if (classIds.length === 0) {
      return {
        organizationId: actor.organizationId,
        organizationName: organization.name,
        classes: [],
      };
    }
    classQuery = classQuery.in("id", classIds);
  }

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

  return {
    organizationId: actor.organizationId,
    organizationName: organization.name,
    classes: classes.map((classRow) => ({
      id: classRow.id,
      name: classRow.name,
      academicYear: classRow.academic_year,
      studentCount: counts.get(classRow.id) ?? 0,
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
    "teacher",
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
  const actor = await requireClassRole(classId, ["teacher"]);
  const admin = getSupabaseAdminClient();
  const { data: classRow, error: classError } = await admin
    .from("classes")
    .select("id, organization_id, name, academic_year")
    .eq("id", actor.classId)
    .eq("organization_id", actor.organizationId)
    .single();
  if (classError || !classRow) throw new PrototypeDataError();

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

  const experienceSettings = studentIds.length
    ? await admin
        .from("student_experience_settings")
        .select("student_id, support_level, progress_enabled")
        .eq("organization_id", actor.organizationId)
        .in("student_id", studentIds)
    : { data: [], error: null };
  if (experienceSettings.error) throw new PrototypeDataError();
  const experienceByStudent = new Map(
    experienceSettings.data.map((settings) => [settings.student_id, settings]),
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
  const states = assignmentIds.length
    ? await admin
        .from("student_task_state")
        .select("assignment_id, status")
        .in("assignment_id", assignmentIds)
    : { data: [], error: null };
  if (states.error) throw new PrototypeDataError();

  const statusByAssignment = new Map(
    states.data.map((state) => [state.assignment_id, state.status]),
  );

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
        const experience = experienceByStudent.get(profile.id);
        return {
          id: profile.id,
          displayName: profile.display_name,
          assignedTasks: studentAssignments.length,
          completedTasks: studentAssignments.filter(
            (assignment) => statusByAssignment.get(assignment.id) === "completed",
          ).length,
          supportLevel: (experience?.support_level ?? 2) as SupportLevel,
          progressEnabled: experience?.progress_enabled ?? false,
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
        completedStudents: taskAssignments.filter(
          (assignment) => statusByAssignment.get(assignment.id) === "completed",
        ).length,
      };
    }),
  };
}
