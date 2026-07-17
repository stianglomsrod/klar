import { StudentSubjectCatalog } from "@/components/v3/StudentSubjectCatalog";
import { groupStudentTasksBySubject } from "@/lib/student-subjects";
import { getStudentHelpState } from "@/server/help/help-service";
import { getOwnStudentSessionDay } from "@/server/plans/student-day-service";
import { getOwnStudentExperience } from "@/server/students/experience-service";
import { getStudentToday } from "@/server/tasks/task-service";
import { getOwnStudentTaskCatalog } from "@/server/tasks/student-task-catalog-service";

export default async function StudentSubjectsPage() {
  const [today, experience, sessionDay, catalog] = await Promise.all([
    getStudentToday(),
    getOwnStudentExperience(),
    getOwnStudentSessionDay(),
    getOwnStudentTaskCatalog(),
  ]);
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
  const groups = groupStudentTasksBySubject(catalog.tasks);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="min-h-[calc(100dvh-4rem)] scroll-mt-20 bg-sky-50 px-4 pb-36 pt-7 text-slate-950 focus:outline-none sm:px-6 sm:pt-9"
    >
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-700">
          Samlet oversikt
        </p>
        <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
          Fag og oppgaver
        </h1>
        <p className="mb-7 mt-3 max-w-2xl text-lg text-slate-600 sm:mb-9">
          Se oppgavene dine samlet etter fag.
        </p>
        <StudentSubjectCatalog
          groups={groups}
          progress={today.progress}
          experience={experience}
          helpState={helpState}
          helpTransitionAt={
            currentSession?.endsAt ?? nextSession?.startsAt ?? null
          }
        />
      </div>
    </main>
  );
}
