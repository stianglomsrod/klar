export default function PilotUnavailablePage() {
  return (
    <main className="min-h-screen bg-slate-100 px-5 py-12 text-slate-950">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-xl items-center">
        <section
          aria-labelledby="pilot-unavailable-heading"
          className="w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-sm"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-700">
            Klar 3.0
          </p>
          <h1 id="pilot-unavailable-heading" className="mt-2 text-3xl font-bold">
            Piloten er midlertidig stengt
          </h1>
          <p className="mt-4 leading-7 text-slate-700">
            Ingen handling er nødvendig. Prøv igjen senere, eller spør læreren hvis
            du trenger hjelp.
          </p>
        </section>
      </div>
    </main>
  );
}
