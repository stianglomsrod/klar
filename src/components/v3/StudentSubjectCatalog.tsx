import Link from "next/link";
import { ChevronRight } from "lucide-react";
import {
  getStudentSubjectPresentation,
  type StudentSubjectGroup,
} from "@/lib/student-subjects";
import type { StudentHelpState } from "@/server/help/help-service";
import type { StudentExperience } from "@/server/students/experience-service";
import type { StudentProgressSummary } from "@/server/tasks/task-service";
import type { StudentCatalogTask } from "@/server/tasks/student-task-catalog-service";
import { StudentProgressDock } from "./StudentTaskList";
import { StudentHelpQueueRealtime } from "./useHelpQueueRealtime";

export function StudentSubjectCatalog({
  groups,
  progress,
  experience,
  helpState,
  helpTransitionAt,
}: {
  groups: StudentSubjectGroup<StudentCatalogTask>[];
  progress: StudentProgressSummary;
  experience: StudentExperience;
  helpState: StudentHelpState;
  helpTransitionAt: string | null;
}) {
  const completedCount = groups.reduce(
    (sum, group) => sum + group.completedCount,
    0,
  );
  const taskCount = groups.reduce((sum, group) => sum + group.totalCount, 0);

  return (
    <>
      <StudentHelpQueueRealtime
        classId={helpState.classId}
        transitionAt={helpTransitionAt}
      />
      {groups.length > 0 ? (
        <ul
          role="list"
          className="grid list-none gap-4 p-0 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3"
        >
          {groups.map((group) => {
            const presentation = getStudentSubjectPresentation(group.name);
            const progressLabel = `${group.completedCount} av ${group.totalCount} oppgaver ferdige`;
            const accessibleName = experience.progressEnabled
              ? `${group.name}, ${progressLabel}, ${group.statusLabel}`
              : `${group.name}, ${group.totalCount} ${group.totalCount === 1 ? "oppgave" : "oppgaver"}`;
            return (
              <li key={group.key}>
                <Link
                  href={`/v3/student/subjects/${group.key}`}
                  aria-label={accessibleName}
                  className={`group flex min-h-44 flex-col rounded-3xl border bg-gradient-to-br p-5 shadow-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 sm:min-h-56 sm:p-6 ${presentation.surface} ${presentation.border}`}
                >
                  <span aria-hidden="true" className="text-4xl sm:text-5xl">
                    {presentation.emoji}
                  </span>
                  <div className="mt-auto pt-7">
                    <div className="flex items-end justify-between gap-3">
                      <div className="min-w-0">
                        <h2
                          className={`break-words text-2xl font-black tracking-tight ${presentation.accent}`}
                        >
                          {group.name}
                        </h2>
                        {experience.progressEnabled ? (
                          <>
                            <p className="mt-1 font-semibold text-slate-700">
                              {progressLabel}
                            </p>
                            <p className="mt-1 text-sm font-bold text-slate-600">
                              {group.statusLabel}
                            </p>
                          </>
                        ) : (
                          <p className="mt-1 font-semibold text-slate-700">
                            {group.totalCount}{" "}
                            {group.totalCount === 1 ? "oppgave" : "oppgaver"}
                          </p>
                        )}
                      </div>
                      <ChevronRight
                        aria-hidden="true"
                        className="mb-1 h-6 w-6 shrink-0 text-slate-600"
                      />
                    </div>
                    {experience.progressEnabled && (
                      <progress
                        value={group.completedCount}
                        max={group.totalCount}
                        aria-label={`${group.name}: ${progressLabel}`}
                        className={`mt-4 h-2.5 w-full ${presentation.progress}`}
                      />
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-3xl border border-sky-100 bg-white p-8 text-center shadow-sm">
          <span aria-hidden="true" className="text-5xl">
            📚
          </span>
          <h2 className="mt-4 text-2xl font-black">Ingen oppgaver her ennå</h2>
          <p className="mt-2 text-slate-600">
            Gå tilbake til dagen din når læreren har lagt ut noe nytt.
          </p>
          <Link
            href="/v3/student"
            className="mt-5 inline-flex min-h-11 items-center rounded-xl px-4 py-2 font-bold text-indigo-800 underline decoration-2 underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-700 focus-visible:ring-offset-2"
          >
            Til dagen i dag
          </Link>
        </div>
      )}

      {(experience.progressEnabled || helpState.queue) && (
        <StudentProgressDock
          progress={progress}
          completedCount={completedCount}
          taskCount={taskCount}
          showProgress={experience.progressEnabled}
          helpState={helpState}
        />
      )}
    </>
  );
}
