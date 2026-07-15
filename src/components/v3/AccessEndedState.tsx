"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { ShieldOff } from "lucide-react";

export function AccessEndedState() {
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  return (
    <section
      aria-labelledby="access-ended-heading"
      role="status"
      aria-live="assertive"
      className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-10"
    >
      <span
        aria-hidden="true"
        className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-700"
      >
        <ShieldOff size={28} />
      </span>
      <h1
        ref={heading}
        id="access-ended-heading"
        tabIndex={-1}
        className="mt-5 text-3xl font-bold tracking-tight focus:outline-none"
      >
        Tilgangen er avsluttet
      </h1>
      <p className="mt-3 leading-7 text-slate-600">
        Klasseoppdraget er ikke aktivt lenger. Innholdet fra klassen er fjernet
        fra denne siden.
      </p>
      <Link
        href="/v3/teacher"
        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-700 px-5 py-3 font-semibold text-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
      >
        Til oversikten
      </Link>
    </section>
  );
}
