const classRoute = (classId) => `/v3/teacher/classes/${classId}`;

export const manualTestScenarios = Object.freeze([
  {
    id: "day",
    label: "Dagen og oppgaver",
    description: "Lærerens klasseflate og elevens dagsflate i samme klasse.",
    sessions: [
      {
        label: "Lærer – Visuell klasse 4B",
        actorId: "10000000-0000-4000-8000-000000000004",
        state: "visual-staff-aal2.json",
        route: classRoute("30000000-0000-4000-8000-000000000002"),
        heading: "Visuell klasse 4B",
      },
      {
        label: "Elev – dagsflate",
        actorId: "10000000-0000-4000-8000-000000000007",
        state: "visual-student.json",
        route: "/v3/student",
        heading: "Hei, Visuell elev",
      },
    ],
  },
  {
    id: "subjects",
    label: "Fag og oppgaver",
    description: "Samme lærer og elev, med elevens fagoversikt som startpunkt.",
    sessions: [
      {
        label: "Lærer – Visuell klasse 4B",
        actorId: "10000000-0000-4000-8000-000000000004",
        state: "visual-staff-aal2.json",
        route: classRoute("30000000-0000-4000-8000-000000000002"),
        heading: "Visuell klasse 4B",
      },
      {
        label: "Elev – fagoversikt",
        actorId: "10000000-0000-4000-8000-000000000007",
        state: "visual-student.json",
        route: "/v3/student/subjects",
        heading: "Fag og oppgaver",
      },
    ],
  },
  {
    id: "help",
    label: "Hjelpekø",
    description: "Lærer og elev i en klasse med syntetisk hjelpekøfixture.",
    sessions: [
      {
        label: "Lærer – Hjelpekøklasse 5D",
        actorId: "10000000-0000-4000-8000-000000000001",
        state: "owner-aal2.json",
        route: classRoute("30000000-0000-4000-8000-000000000005"),
        heading: "Hjelpekøklasse 5D",
      },
      {
        label: "Elev – hjelp",
        actorId: "10000000-0000-4000-8000-000000000012",
        state: "help-student.json",
        route: "/v3/student",
        heading: "Hei, Hjelpeelev",
      },
    ],
  },
  {
    id: "help-team",
    label: "Hjelpekø med to ansatte",
    description: "Eier, hjelpelærer og elev for prioritering og overføring.",
    sessions: [
      {
        label: "Eier – Hjelpekøklasse 5D",
        actorId: "10000000-0000-4000-8000-000000000001",
        state: "owner-aal2.json",
        route: classRoute("30000000-0000-4000-8000-000000000005"),
        heading: "Hjelpekøklasse 5D",
      },
      {
        label: "Hjelpelærer – Hjelpekøklasse 5D",
        actorId: "10000000-0000-4000-8000-000000000014",
        state: "help-staff-aal2.json",
        route: classRoute("30000000-0000-4000-8000-000000000005"),
        heading: "Hjelpekøklasse 5D",
      },
      {
        label: "Elev – hjelp",
        actorId: "10000000-0000-4000-8000-000000000012",
        state: "help-student.json",
        route: "/v3/student",
        heading: "Hei, Hjelpeelev",
      },
    ],
  },
  {
    id: "return",
    label: "Fullført oppgave og retur",
    description: "Lærer og elev rundt en ferdigstilt oppgave som kan sendes tilbake.",
    sessions: [
      {
        label: "Lærer – Testklasse 3A",
        actorId: "10000000-0000-4000-8000-000000000001",
        state: "owner-aal2.json",
        route: classRoute("30000000-0000-4000-8000-000000000001"),
        heading: "Testklasse 3A",
      },
      {
        label: "Elev – returflyt",
        actorId: "10000000-0000-4000-8000-000000000011",
        state: "return-student.json",
        route: "/v3/student",
        heading: "Hei, Returelev",
      },
    ],
  },
  {
    id: "rewards",
    label: "Blomsterhage og poeng",
    description: "Oppgavefullføring, nivågrense, kronblad og tilbakeføring.",
    sessions: [
      {
        label: "Lærer – Belønningsklasse 2B",
        actorId: "10000000-0000-4000-8000-000000000001",
        state: "owner-aal2.json",
        route: classRoute("30000000-0000-4000-8000-000000000007"),
        heading: "Belønningsklasse 2B",
      },
      {
        label: "Elev – belønningsflyt",
        actorId: "10000000-0000-4000-8000-000000000017",
        state: "reward-student.json",
        route: "/v3/student",
        heading: "Hei, Belønningselev",
      },
    ],
  },
  {
    id: "iterations",
    label: "Flytt eller send ut på nytt",
    description: "Lærerens oppgaveiterasjoner sammen med den berørte eleven.",
    sessions: [
      {
        label: "Lærer – D2 kontrollklasse 6A",
        actorId: "10000000-0000-4000-8000-000000000004",
        state: "visual-staff-aal2.json",
        route: classRoute("30000000-0000-4000-8000-000000000006"),
        heading: "D2 kontrollklasse 6A",
      },
      {
        label: "Elev – D2-oppgaver",
        actorId: "10000000-0000-4000-8000-000000000015",
        state: "d2-student.json",
        route: "/v3/student",
        heading: "Hei, D2 elev",
      },
    ],
  },
  {
    id: "access",
    label: "Tilganger og vikar",
    description: "Eierens tilgangskontroll og en separat vikarkontekst.",
    sessions: [
      {
        label: "Eier – tilganger",
        actorId: "10000000-0000-4000-8000-000000000001",
        state: "owner-aal2.json",
        route: "/v3/teacher/access",
        heading: "Tilganger",
      },
      {
        label: "Vikar – ansattoversikt",
        actorId: "10000000-0000-4000-8000-000000000003",
        state: "substitute-aal2.json",
        route: "/v3/teacher",
        heading: "Klar E2E",
      },
    ],
  },
  {
    id: "garden-preview",
    label: "Blomsterhage – visuell forhåndsvisning",
    description: "Én ferdig elevflate for rask visuell inspeksjon av hagen.",
    sessions: [
      {
        label: "Elev – ferdig blomsterhage",
        actorId: "10000000-0000-4000-8000-000000000018",
        state: "reward-visual-student.json",
        route: "/v3/student/rewards",
        heading: "Blomsterhagen",
      },
    ],
  },
  {
    id: "progress-preview",
    label: "Poeng og progresjon – visuell forhåndsvisning",
    description: "Én elevflate med poeng, nivå og fremdriftsdock.",
    sessions: [
      {
        label: "Elev – progresjonsflate",
        actorId: "10000000-0000-4000-8000-000000000019",
        state: "progress-visual-student.json",
        route: "/v3/student",
        heading: "Hei, Visuell progresjonselev",
      },
    ],
  },
]);

export const manualTestStateFiles = Object.freeze([
  ...new Set(
    manualTestScenarios.flatMap((scenario) =>
      scenario.sessions.map((session) => session.state),
    ),
  ),
]);

export function getManualTestScenario(id) {
  const scenario = manualTestScenarios.find((candidate) => candidate.id === id);
  if (!scenario) {
    throw new Error(
      `Ukjent lokalt testscenario «${id}». Bruk --list-scenarios for å se valgene.`,
    );
  }
  return scenario;
}

export function formatManualTestScenarios() {
  return manualTestScenarios
    .map(
      (scenario, index) =>
        `  ${index + 1}. ${scenario.label}\n     ${scenario.description}`,
    )
    .join("\n");
}

export function resolveManualScenarioChoice(value) {
  const normalized = value.trim().toLowerCase();
  if (/^[1-9][0-9]*$/.test(normalized)) {
    const scenario = manualTestScenarios[Number(normalized) - 1];
    if (scenario) return scenario;
  }
  return getManualTestScenario(normalized);
}
