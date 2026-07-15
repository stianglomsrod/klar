import Link from "next/link";
import { CreateClassForm } from "@/components/v3/CreateClassForm";
import { getTeacherDashboard } from "@/server/classes/class-service";

const JOB_LABELS = {
  contact_teacher: "Kontaktlærer",
  subject_teacher: "Faglærer",
  special_educator: "ITO / spesialpedagog",
  substitute: "Vikar",
  legacy_teacher: "Overført lærertilgang",
  operational_owner: "Operativ eiertilgang",
} as const;

export default async function PrototypeTeacherPage() {
  const dashboard = await getTeacherDashboard();

  return (
    <main id="main-content" tabIndex={-1} className="focus:outline-none">
      <div className="max-w-5xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-700">
          Klar 3.0
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">
          {dashboard.organizationName}
        </h1>
        <p className="mt-3 text-slate-600">
          Her vises klassene du har et aktivt oppdrag i.
        </p>

        {dashboard.isOwner && (
          <div className="mt-8">
            <CreateClassForm organizationId={dashboard.organizationId} />
          </div>
        )}

        <section aria-labelledby="classes-heading" className="mt-8">
          <h2 id="classes-heading" className="text-2xl font-bold">
            Klasser
          </h2>
          {dashboard.classes.length === 0 ? (
            <p className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-slate-600">
              Du har ingen aktive klasseoppdrag akkurat nå.
            </p>
          ) : (
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
              {dashboard.classes.map((classRow) => (
                <li key={classRow.id}>
                  <Link
                    href={`/v3/teacher/classes/${classRow.id}`}
                    className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
                  >
                    <h3 className="text-xl font-bold">{classRow.name}</h3>
                    <p className="mt-2 text-sm text-slate-600">
                      {classRow.studentCount}{" "}
                      {classRow.studentCount === 1 ? "elev" : "elever"}
                      {classRow.academicYear ? ` · ${classRow.academicYear}` : ""}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-indigo-700">
                      {JOB_LABELS[classRow.jobLabel]}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
