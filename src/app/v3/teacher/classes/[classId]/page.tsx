import Link from "next/link";
import { notFound } from "next/navigation";
import { AccessEndedState } from "@/components/v3/AccessEndedState";
import { CreateStudentForm } from "@/components/v3/CreateStudentForm";
import { PublishTaskForm } from "@/components/v3/PublishTaskForm";
import { SmartImportPanel } from "@/components/v3/SmartImportPanel";
import { TeacherHelpQueue } from "@/components/v3/TeacherHelpQueue";
import { TeacherStudentExperienceEditor } from "@/components/v3/TeacherStudentExperienceEditor";
import { TeacherTaskReopenControl } from "@/components/v3/TeacherTaskReopenControl";
import { WeeklyPlanBuilder } from "@/components/v3/WeeklyPlanBuilder";
import { isAuthorizationError } from "@/server/auth/errors";
import { getTeacherClassWorkspace } from "@/server/classes/class-service";
import { getTeacherHelpQueue } from "@/server/help/help-service";
import { getPublishedWeeklyPlanSummaries } from "@/server/plans/weekly-plan-service";

async function loadClassPage(classId: string) {
  try {
    const workspace = await getTeacherClassWorkspace(classId);
    const canManageHelp = workspace.capabilities.includes("help_queue.manage");
    const helpQueue = canManageHelp ? await getTeacherHelpQueue(classId) : [];
    const publishedPlans = workspace.capabilities.includes("plan.publish")
      ? await getPublishedWeeklyPlanSummaries(classId)
      : [];
    return { status: "ready" as const, workspace, helpQueue, publishedPlans };
  } catch (error) {
    if (isAuthorizationError(error) && error.code === "STAFF_ACCESS_ENDED") {
      return { status: "access-ended" as const };
    }
    if (
      isAuthorizationError(error) &&
      (error.code === "INVALID_RESOURCE_ID" || error.code === "FORBIDDEN")
    ) {
      notFound();
    }
    throw error;
  }
}

export default async function TeacherClassPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const page = await loadClassPage(classId);

  if (page.status === "access-ended") {
    return (
      <main id="main-content" tabIndex={-1} className="focus:outline-none">
        <AccessEndedState />
      </main>
    );
  }

  const { workspace, helpQueue, publishedPlans } = page;
  const canPublishTask = workspace.capabilities.includes("task.publish");
  const canPreviewPlan = workspace.capabilities.includes("plan.preview");
  const canPublishPlan = workspace.capabilities.includes("plan.publish");
  const canManageHelp = workspace.capabilities.includes("help_queue.manage");
  const canUpdateSupport = workspace.capabilities.includes(
    "student_support.update",
  );
  const canReadProgress =
    workspace.progressAvailable &&
    workspace.capabilities.includes("student_progress.read");
  const canReturnTask =
    canReadProgress && workspace.capabilities.includes("task.return");

  return (
    <main id="main-content" tabIndex={-1} className="focus:outline-none">
      <div className="max-w-6xl">
        <Link
          href="/v3/teacher"
          className="inline-flex min-h-11 items-center font-semibold text-indigo-700 underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-indigo-600"
        >
          Tilbake til klassene
        </Link>
        <div className="mt-5">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-700">
            Klar 3.0
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">
            {workspace.name}
          </h1>
          {workspace.academicYear && (
            <p className="mt-2 text-slate-600">{workspace.academicYear}</p>
          )}
        </div>

        {canPublishPlan && (
          <div className="mt-8">
            <WeeklyPlanBuilder
              classId={workspace.id}
              publishedPlans={publishedPlans}
            />
          </div>
        )}

        {(workspace.isOwner || canPublishTask) && (
          <div className="mt-8 grid gap-6 xl:grid-cols-2">
            {workspace.isOwner && <CreateStudentForm classId={workspace.id} />}
            {canPublishTask && <PublishTaskForm classId={workspace.id} />}
          </div>
        )}

        <SmartImportPanel
          classId={workspace.id}
          canPreview={canPreviewPlan}
          canPublish={canPublishPlan}
        />

        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          <section
            aria-labelledby="students-heading"
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <h2 id="students-heading" className="text-xl font-bold">
              Elever
            </h2>
            {workspace.students.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">Ingen elever ennå.</p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-200">
                {workspace.students.map((student) => (
                  <li key={student.id} className="py-3">
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-semibold">{student.displayName}</span>
                      {canReadProgress && student.completedTasks !== null && (
                        <span className="text-sm text-slate-600">
                          {student.completedTasks}/{student.assignedTasks} ferdige
                        </span>
                      )}
                    </div>
                    {canUpdateSupport && (
                      <TeacherStudentExperienceEditor
                        classId={workspace.id}
                        studentId={student.id}
                        studentName={student.displayName}
                        initialSupportLevel={student.supportLevel}
                        initialProgressEnabled={student.progressEnabled}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            aria-labelledby="tasks-heading"
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <h2 id="tasks-heading" className="text-xl font-bold">
              Publiserte oppgaver
            </h2>
            {workspace.tasks.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">Ingen oppgaver ennå.</p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-200">
                {workspace.tasks.map((task) => (
                  <li key={task.id} className="py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold">{task.title}</p>
                        {task.subject && (
                          <p className="mt-1 text-sm text-slate-600">
                            {task.subject}
                          </p>
                        )}
                      </div>
                      {canReadProgress && task.completedStudents !== null && (
                        <span className="text-sm text-slate-600">
                          {task.completedStudents}/{task.assignedStudents}
                        </span>
                      )}
                    </div>
                    {canReturnTask && task.completedAssignments.length > 0 && (
                      <details className="mt-3 rounded-xl bg-slate-50 p-3">
                        <summary className="min-h-11 cursor-pointer rounded-lg py-2 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2">
                          Ferdige elever ({task.completedAssignments.length})
                        </summary>
                        <ul className="mt-2 divide-y divide-slate-200">
                          {task.completedAssignments.map((assignment) => (
                            <li key={assignment.assignmentId} className="py-3">
                              <p className="font-semibold">{assignment.studentName}</p>
                              <p className="mt-1 text-sm text-slate-600">
                                Ferdig {new Intl.DateTimeFormat("nb-NO", {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                  timeZone: "Europe/Oslo",
                                }).format(new Date(assignment.completedAt))}
                              </p>
                              <TeacherTaskReopenControl
                                classId={workspace.id}
                                assignmentId={assignment.assignmentId}
                                taskTitle={task.title}
                                studentName={assignment.studentName}
                              />
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {canManageHelp && (
          <TeacherHelpQueue classId={workspace.id} requests={helpQueue} />
        )}
      </div>
    </main>
  );
}
