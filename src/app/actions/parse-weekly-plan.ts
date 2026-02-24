"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import mammoth from "mammoth";

// ── Types ────────────────────────────────────────────

export type LearningGoal = {
  subject: string;
  goals: string[];
};

export type HomeworkEntry = {
  subject: string;
  tasks: string[];
};

export type ScheduleEntry = {
  className: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  subjectName: string;
};

/** Ukebrev = parent-facing weekly newsletter */
export type WeeklyPlanData = {
  documentType: "ukebrev";
  weekNumber: number;
  generalMessages: string[];
  learningGoals: LearningGoal[];
  homework: HomeworkEntry[];
  schedule: ScheduleEntry[];
};

/** A single task extracted from a teacher lesson planner */
export type LessonPlanTask = {
  subjectName: string;
  sessionNumber: number;
  title: string;
  description: string;
  goals: string[];
  targetClasses: string[];
};

/** Ukeplanlegger = teacher-facing lesson planner */
export type LessonPlanData = {
  documentType: "ukeplanlegger";
  weekNumber: number;
  tasks: LessonPlanTask[];
};

/** Discriminated union — result of AI classification + extraction */
export type ParsedDocument = WeeklyPlanData | LessonPlanData;

export type ParseWeeklyPlanResult =
  | { success: true; data: ParsedDocument }
  | { success: false; error: string };

// ── Constants ────────────────────────────────────────

const GEMINI_MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT = `Du er en ekspert norsk lærerassistent. Din oppgave er å analysere dokumenter fra norske skoler og trekke ut strukturert informasjon.

Du vil motta råtekst fra et Word-dokument. Dokumentet er enten:
A) Et **UKEBREV** (ukeplan til foresatte) — inneholder beskjeder til foreldre, lekser, læringsmål, og en timeplan med klokkeslett.
B) En **UKEPLANLEGGER** (lærers undervisningsplan) — inneholder fagøkter med øktnummer (f.eks. "Matte 1", "Norsk 2"), læringsmål per økt, aktiviteter, og progresjonsplaner.

═══════════════════════════════════════════
FASE 1: KLASSIFISER DOKUMENTET
═══════════════════════════════════════════

Analyser teksten og avgjør dokumenttype basert på disse signalene:

UKEBREV-signaler:
- Inneholder "Kjære foresatte", "Til foreldre", "Til hjemmet", "Informasjon til hjemmet"
- Har en timeplan med klokkeslett (f.eks. "08:30-09:15 Norsk")
- Inneholder seksjoner som "Lekser", "Hjemmearbeid", "Beskjeder"
- Generelle påminnelser om arrangementer, turdager, praktisk info
- Fokusert på hva foreldre trenger å vite

UKEPLANLEGGER-signaler:
- Inneholder nummererte fagøkter som "Matte 1", "Matte 2", "Norsk 1"
- Har "Mål for timen", "Læringsmål", "Kompetansemål" per økt
- Inneholder "Aktivitet", "Oppgaver", "Materiell", "Vurdering" per økt
- Strukturert per fag med flere økter
- Fokusert på hva læreren skal gjøre i timen

═══════════════════════════════════════════
FASE 2: TREKK UT DATA BASERT PÅ TYPE
═══════════════════════════════════════════

▸ Hvis UKEBREV, returner dette JSON-formatet:

{
  "documentType": "ukebrev",
  "weekNumber": <number — ukenummeret, f.eks. 5>,
  "generalMessages": [<streng-array med beskjeder/informasjon til foresatte>],
  "learningGoals": [
    { "subject": "<fagnavn>", "goals": [<streng-array med læringsmål>] }
  ],
  "homework": [
    { "subject": "<fagnavn>", "tasks": [<streng-array med lekseinstruksjoner>] }
  ],
  "schedule": [
    {
      "className": "<klassenavn, f.eks. '7A', '7B', eller 'Alle' hvis ikke spesifisert>",
      "dayOfWeek": <nummer 1-5 der 1=mandag, 5=fredag>,
      "startTime": "<HH:MM format>",
      "endTime": "<HH:MM format>",
      "subjectName": "<fagnavn>"
    }
  ]
}

UKEBREV-REGLER:
1. Ukenummeret finnes vanligvis i tittelen eller overskriften (f.eks. "Uke 5", "Ukeplan uke 12").
2. Generelle beskjeder inkluderer info om arrangementer, påminnelser, praktisk informasjon til foreldre/foresatte, osv.
3. Læringsmål er hva elevene skal lære eller fokusere på den uken, gruppert etter fag.
4. Lekser/hjemmearbeid er oppgaver elevene skal gjøre hjemme, gruppert etter fag.
5. Timeplanen skal inneholde alle fag/timer som er nevnt med klokkeslett og ukedag.
6. VIKTIG: Se etter FLERE timeplaner for forskjellige klasser (f.eks. 7A, 7B, 7C). Hver klasse kan ha sin egen timeplan. Map riktig className i schedule-arrayen.
7. Hvis timeplanen ikke spesifiserer klasse, bruk "Alle" som className.
8. Bruk norske fagnavn som de står i dokumentet (f.eks. "Norsk", "Matte", "Engelsk", "Naturfag", "Samfunnsfag", "KRLE", "K&H", "Gym", "M&H").
9. Hvis et felt ikke finnes i dokumentet, returner en tom array for det feltet.
10. Tider skal alltid være i HH:MM-format (f.eks. "08:30", "14:00").
11. Vær nøyaktig med dagsnummerering: mandag=1, tirsdag=2, onsdag=3, torsdag=4, fredag=5.

▸ Hvis UKEPLANLEGGER, returner dette JSON-formatet:

{
  "documentType": "ukeplanlegger",
  "weekNumber": <number — ukenummeret>,
  "tasks": [
    {
      "subjectName": "<fagnavn, f.eks. 'Matematikk', 'Norsk'>",
      "sessionNumber": <number — øktnummer, f.eks. 1 for 'Matte 1', 2 for 'Matte 2'>,
      "title": "<kort tittel for økten, f.eks. 'Brøkregning med liknevner'>",
      "description": "<beskrivelse av aktiviteter og innhold i økten>",
      "goals": [<streng-array med læringsmål for denne økten>],
      "targetClasses": [<streng-array med klassenavn, f.eks. ['7A', '7B'], eller ['Alle'] hvis ikke spesifisert>]
    }
  ]
}

UKEPLANLEGGER-REGLER:
1. Ukenummeret finnes vanligvis i tittelen (f.eks. "Undervisningsplan uke 8", "Ukeplan for lærer uke 12").
2. Øktnummeret (sessionNumber) utledes fra teksten: "Matte 1" → 1, "Matte 2" → 2, "Norsk 3" → 3. Hvis det ikke er nummerert eksplisitt, nummerer kronologisk per fag (første matteøkt = 1, andre = 2, osv.).
3. Tittelen skal være en kort, beskrivende oppsummering av øktens hovedtema.
4. Beskrivelsen skal inkludere aktiviteter, oppgaver, materiell, og arbeidsmetoder nevnt for økten.
5. Læringsmål (goals) er konkrete mål for akkurat den økten — ikke generelle ukersmål.
6. Målklasser (targetClasses) finnes ofte i overskriften av dokumentet (f.eks. "Plan for 6. trinn", "7A og 7B"). Bruk klassenavnet slik det står ("6A", "7. trinn", "Alle").
7. Hvis et fag opptrer med forskjellige planer for forskjellige klasser, opprett separate task-objekter med riktige targetClasses.
8. Bruk norske fagnavn som de står i dokumentet.

═══════════════════════════════════════════
KORREKTURLESING (GJELDER BEGGE TYPER)
═══════════════════════════════════════════

Du fungerer også som korrekturleser. Teksten du trekker ut vil ofte mangle mellomrom etter punktum og komma (f.eks. "dagen.Onsdag: 7B" skal bli "dagen. Onsdag: 7B"), eller ha ord som er mest sammen på grunn av linjeskift i Word-filen. Du MÅ rydde opp i dette:
- Legg til manglende mellomrom etter punktum, komma, kolon og semikolon.
- Fiks åpenbare skrivefeil og sammenskrevne ord som skyldes formatering.
- Sørg for at teksten er logisk formatert og lett å lese.
- Behold fagtermer og egennavn uendret — kun fiks formateringsfeil.`;

// ── Server Action ────────────────────────────────────

export async function parseWeeklyPlan(
  formData: FormData,
): Promise<ParseWeeklyPlanResult> {
  try {
    // ── 1. Validate environment ──
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        error: "GEMINI_API_KEY er ikke konfigurert i miljøvariabler.",
      };
    }

    // ── 2. Extract file from FormData ──
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return {
        success: false,
        error: "Ingen fil funnet. Last opp en .docx-fil.",
      };
    }

    if (
      !file.name.endsWith(".docx") &&
      file.type !==
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      return {
        success: false,
        error: "Ugyldig filformat. Kun .docx-filer støttes.",
      };
    }

    // ── 3. Convert .docx to raw text via Mammoth ──
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const { value: rawText } = await mammoth.extractRawText({ buffer });

    if (!rawText || rawText.trim().length === 0) {
      return {
        success: false,
        error: "Kunne ikke trekke ut tekst fra dokumentet. Filen kan være tom.",
      };
    }

    // ── 4. Send to Gemini for structured parsing ──
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1, // Low temperature for factual extraction
      },
      systemInstruction: SYSTEM_PROMPT,
    });

    const result = await model.generateContent(
      `Her er teksten fra dokumentet:\n\n---\n${rawText}\n---\n\nKlassifiser dokumentet (ukebrev eller ukeplanlegger) og returner strukturert JSON.`,
    );

    const response = result.response;
    const jsonText = response.text();

    // ── 5. Parse and validate the JSON response ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let raw: any;
    try {
      raw = JSON.parse(jsonText);
    } catch {
      return {
        success: false,
        error: "AI-en returnerte ugyldig JSON. Prøv igjen.",
      };
    }

    // ── 5a. Validate weekNumber (common to both types) ──
    if (
      typeof raw.weekNumber !== "number" ||
      raw.weekNumber < 1 ||
      raw.weekNumber > 53
    ) {
      const coerced = Number(raw.weekNumber);
      if (!isNaN(coerced) && coerced >= 1 && coerced <= 53) {
        raw.weekNumber = coerced;
      } else {
        return {
          success: false,
          error:
            "AI-en kunne ikke identifisere et gyldig ukenummer fra dokumentet.",
        };
      }
    }

    // ── 5b. Branch on documentType ──
    const docType = raw.documentType;

    if (docType === "ukeplanlegger") {
      // Validate & sanitize LessonPlanData
      const tasks: LessonPlanTask[] = Array.isArray(raw.tasks)
        ? raw.tasks
            .filter(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (t: any) =>
                typeof t.subjectName === "string" &&
                typeof t.sessionNumber === "number" &&
                t.sessionNumber >= 1 &&
                typeof t.title === "string",
            )
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((t: any) => ({
              subjectName: t.subjectName,
              sessionNumber: t.sessionNumber,
              title: t.title,
              description:
                typeof t.description === "string" ? t.description : "",
              goals: Array.isArray(t.goals)
                ? t.goals.filter((g: unknown) => typeof g === "string")
                : [],
              targetClasses: Array.isArray(t.targetClasses)
                ? t.targetClasses.filter((c: unknown) => typeof c === "string")
                : ["Alle"],
            }))
        : [];

      const parsed: LessonPlanData = {
        documentType: "ukeplanlegger",
        weekNumber: raw.weekNumber,
        tasks,
      };

      return { success: true, data: parsed };
    }

    // ── 5c. Default: Ukebrev ──
    // Ensure arrays exist
    const generalMessages = Array.isArray(raw.generalMessages)
      ? raw.generalMessages
      : [];
    const learningGoals = Array.isArray(raw.learningGoals)
      ? raw.learningGoals
      : [];
    const homework = Array.isArray(raw.homework) ? raw.homework : [];
    const schedule: ScheduleEntry[] = Array.isArray(raw.schedule)
      ? raw.schedule.filter(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (entry: any) =>
            typeof entry.className === "string" &&
            typeof entry.dayOfWeek === "number" &&
            entry.dayOfWeek >= 1 &&
            entry.dayOfWeek <= 7 &&
            typeof entry.startTime === "string" &&
            typeof entry.endTime === "string" &&
            typeof entry.subjectName === "string",
        )
      : [];

    const parsed: WeeklyPlanData = {
      documentType: "ukebrev",
      weekNumber: raw.weekNumber,
      generalMessages,
      learningGoals,
      homework,
      schedule,
    };

    return { success: true, data: parsed };
  } catch (error) {
    console.error("[parseWeeklyPlan] Error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Ukjent feil ved parsing av dokument.";
    return { success: false, error: message };
  }
}
