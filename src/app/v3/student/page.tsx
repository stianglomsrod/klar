import { StudentTodayPanel } from "@/components/v3/StudentTodayPanel";
import { StudentHelpControl } from "@/components/v3/StudentHelpControl";
import { getStudentHelpState } from "@/server/help/help-service";
import { getStudentToday } from "@/server/tasks/task-service";
import { getOwnStudentExperience } from "@/server/students/experience-service";
import { getOwnStudentSessionDay } from "@/server/plans/student-day-service";

export default async function PrototypeStudentPage() {
  const [today, helpState, experience, sessionDay] = await Promise.all([
    getStudentToday(),
    getStudentHelpState(),
    getOwnStudentExperience(),
    getOwnStudentSessionDay(),
  ]);

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-sky-50 px-4 pb-36 pt-8 text-slate-950 focus:outline-none sm:px-6">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">
          Klar 3.0
        </p>
        <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Hei, {today.displayName}</h1>
        <p className="mt-3 text-lg text-slate-600">
          {sessionDay.sessions.length > 0
            ? "Her er skoledagen din."
            : "Her er det du skal gjøre nå."}
        </p>
        <div className="mt-8">
          <StudentTodayPanel
            tasks={today.tasks}
            initialProgress={today.progress}
            initialExperience={experience}
            sessionDay={sessionDay}
          />
        </div>
        <StudentHelpControl state={helpState} />
      </div>
    </main>
  );
}
