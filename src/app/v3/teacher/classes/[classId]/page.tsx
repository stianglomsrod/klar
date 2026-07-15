import Link from "next/link";
import { CreateStudentForm } from "@/components/v3/CreateStudentForm";
import { PublishTaskForm } from "@/components/v3/PublishTaskForm";
import { SmartImportPanel } from "@/components/v3/SmartImportPanel";
import { TeacherHelpQueue } from "@/components/v3/TeacherHelpQueue";
import { TeacherStudentExperienceEditor } from "@/components/v3/TeacherStudentExperienceEditor";
import { getTeacherClassWorkspace } from "@/server/classes/class-service";
import { getTeacherHelpQueue } from "@/server/help/help-service";

export default async function TeacherClassPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const [workspace, helpQueue] = await Promise.all([
    getTeacherClassWorkspace(classId),
    getTeacherHelpQueue(classId),
  ]);

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-8 text-slate-950 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/v3/teacher"
          className="font-semibold text-indigo-700 underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-indigo-600"
        >
          Tilbake til klassene
        </Link>
        <div className="mt-5">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-700">
            Klar 3.0
          </p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight">{workspace.name}</h1>
          {workspace.academicYear && (
            <p className="mt-2 text-slate-600">{workspace.academicYear}</p>
          )}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <CreateStudentForm classId={workspace.id} />
          <PublishTaskForm classId={workspace.id} />
        </div>

        <SmartImportPanel classId={workspace.id} />

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="students-heading" className="rounded-2xl border border-slate-200 bg-white p-5">
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
                      <span className="text-sm text-slate-600">
                        {student.completedTasks}/{student.assignedTasks} ferdige
                      </span>
                    </div>
                    <TeacherStudentExperienceEditor
                      classId={workspace.id}
                      studentId={student.id}
                      studentName={student.displayName}
                      initialSupportLevel={student.supportLevel}
                      initialProgressEnabled={student.progressEnabled}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="tasks-heading" className="rounded-2xl border border-slate-200 bg-white p-5">
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
                          <p className="mt-1 text-sm text-slate-600">{task.subject}</p>
                        )}
                      </div>
                      <span className="text-sm text-slate-600">
                        {task.completedStudents}/{task.assignedStudents}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <TeacherHelpQueue classId={workspace.id} requests={helpQueue} />
      </div>
    </main>
  );
}
