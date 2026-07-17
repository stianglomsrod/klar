import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { StudentTaskList } from "@/components/v3/StudentTaskList";
import {
  getStudentSubjectPresentation,
  groupStudentTasksBySubject,
} from "@/lib/student-subjects";
import { getStudentHelpState } from "@/server/help/help-service";
import { getOwnStudentSessionDay } from "@/server/plans/student-day-service";
import { getOwnStudentExperience } from "@/server/students/experience-service";
import { getStudentToday } from "@/server/tasks/task-service";
import { getOwnStudentTaskCatalog } from "@/server/tasks/student-task-catalog-service";

export default async function StudentSubjectPage({
  params,
}: {
  params: Promise<{ subjectKey: string }>;
}) {
  const [{ subjectKey }, today, experience, sessionDay, catalog] =
    await Promise.all([
      params,
      getStudentToday(),
      getOwnStudentExperience(),
      getOwnStudentSessionDay(),
      getOwnStudentTaskCatalog(),
    ]);
  const group = groupStudentTasksBySubject(catalog.tasks).find(
    (candidate) => candidate.key === subjectKey,
  );
  if (!group) notFound();

  const currentSession =
    sessionDay.sessions.find((session) => session.relation === "current") ?? null;
  const nextSession = sessionDay.sessions
    .filter((session) => session.relation === "next")
    .sort(
      (first, second) =>
        new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime(),
    )[0] ?? null;
  const helpState = await getStudentHelpState(
    currentSession?.id ?? null,
    currentSession?.classId ?? null,
  );
  const presentation = getStudentSubjectPresentation(group.name);
  const progressLabel = `${group.completedCount} av ${group.totalCount} oppgaver ferdige`;

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-[calc(100dvh-4rem)] scroll-mt-20 bg-sky-50 px-4 pb-36 pt-5 text-slate-950 focus:outline-none sm:px-6 sm:pt-7"
    >
      <div className="mx-auto max-w-5xl">
        <Link
          href="/v3/student/subjects"
          aria-label="Tilbake til fag og oppgaver"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 py-2 font-bold text-indigo-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 focus-visible:ring-offset-2"
        >
          <ArrowLeft aria-hidden="true" className="h-5 w-5" />
          Fag og oppgaver
        </Link>

        <header
          className={`mt-4 rounded-3xl border bg-gradient-to-br px-5 py-6 shadow-sm sm:px-7 sm:py-7 ${presentation.surface} ${presentation.border}`}
        >
          <div className="flex items-center gap-4 sm:gap-5">
            <span aria-hidden="true" className="text-5xl sm:text-6xl">
              {presentation.emoji}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-600">
                Fag
              </p>
              <h1
                className={`mt-1 break-words text-4xl font-black tracking-tight sm:text-5xl ${presentation.accent}`}
              >
                {group.name}
              </h1>
              <p className="mt-2 font-semibold text-slate-700">
                {experience.progressEnabled
                  ? progressLabel
                  : `${group.totalCount} ${group.totalCount === 1 ? "oppgave" : "oppgaver"}`}
              </p>
            </div>
          </div>
        </header>

        <div className="mt-7 sm:mt-9">
          <StudentTaskList
            initialTasks={catalog.tasks}
            initialProgress={today.progress}
            experience={experience}
            helpState={helpState}
            displayAssignmentIds={group.tasks.map((task) => task.assignmentId)}
            singleGroup={{
              id: group.key,
              name: "Oppgaver",
              subject: group.name,
            }}
            helpEligibleAssignmentIds={
              currentSession?.tasks.map((task) => task.assignmentId) ?? []
            }
            helpTransitionAt={
              currentSession?.endsAt ?? nextSession?.startsAt ?? null
            }
            highlightNextTask={false}
          />
        </div>
      </div>
    </main>
  );
}
