import { StudentTodayPanel } from "@/components/v3/StudentTodayPanel";
import { StudentHelpControl } from "@/components/v3/StudentHelpControl";
import { getStudentHelpState } from "@/server/help/help-service";
import { getStudentToday } from "@/server/tasks/task-service";
import { getOwnStudentExperience } from "@/server/students/experience-service";

export default async function PrototypeStudentPage() {
  const [today, helpState, experience] = await Promise.all([
    getStudentToday(),
    getStudentHelpState(),
    getOwnStudentExperience(),
  ]);

  return (
    <main className="min-h-screen bg-sky-50 px-5 py-8 text-slate-950">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-700">
          Klar 3.0
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">Hei, {today.displayName}</h1>
        <p className="mt-3 text-lg text-slate-600">Her er det du skal gjøre nå.</p>
        <div className="mt-8">
          <StudentTodayPanel tasks={today.tasks} initialExperience={experience} />
        </div>
        <StudentHelpControl state={helpState} />
      </div>
    </main>
  );
}
