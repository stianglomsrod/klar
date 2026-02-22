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

export type WeeklyPlanData = {
  weekNumber: number;
  generalMessages: string[];
  learningGoals: LearningGoal[];
  homework: HomeworkEntry[];
  schedule: ScheduleEntry[];
};

export type ParseWeeklyPlanResult =
  | { success: true; data: WeeklyPlanData }
  | { success: false; error: string };

// ── Constants ────────────────────────────────────────

const GEMINI_MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT = `Du er en ekspert norsk lærerassistent. Din oppgave er å analysere en norsk ukeplan (weekly plan) og trekke ut strukturert informasjon.

Du vil motta råtekst fra et Word-dokument som inneholder en ukeplan for en norsk barneskole eller ungdomsskole.

Analyser teksten nøye og returner et JSON-objekt med følgende struktur:

{
  "weekNumber": <number — ukenummeret, f.eks. 5>,
  "generalMessages": [<streng-array med beskjeder/informasjon til foresatte>],
  "learningGoals": [
    { "subject": "<fagnavn>", "goals": [<streng-array med læringsmål/fokusområder>] }
  ],
  "homework": [
    { "subject": "<fagnavn>", "tasks": [<streng-array med lekseinstruksjoner>] }
  ],
  "schedule": [
    {
      "className": "<klassenavn, f.eks. '7A', '7B', eller 'Alle' hvis ikke spesifisert>",
      "dayOfWeek": <nummer 1-5 der 1=mandag, 2=tirsdag, 3=onsdag, 4=torsdag, 5=fredag>,
      "startTime": "<HH:MM format>",
      "endTime": "<HH:MM format>",
      "subjectName": "<fagnavn, f.eks. 'Norsk', 'Matte', 'Matte/K&H'>"
    }
  ]
}

VIKTIGE REGLER:
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

KORREKTURLESING (SVÆRT VIKTIG):
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
      `Her er teksten fra ukeplanen:\n\n---\n${rawText}\n---\n\nAnalyser teksten og returner strukturert JSON.`,
    );

    const response = result.response;
    const jsonText = response.text();

    // ── 5. Parse and validate the JSON response ──
    let parsed: WeeklyPlanData;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      return {
        success: false,
        error: "AI-en returnerte ugyldig JSON. Prøv igjen.",
      };
    }

    // Basic shape validation
    if (
      typeof parsed.weekNumber !== "number" ||
      parsed.weekNumber < 1 ||
      parsed.weekNumber > 53
    ) {
      // Try to coerce if it's a string number
      const coerced = Number(parsed.weekNumber);
      if (!isNaN(coerced) && coerced >= 1 && coerced <= 53) {
        parsed.weekNumber = coerced;
      } else {
        return {
          success: false,
          error:
            "AI-en kunne ikke identifisere et gyldig ukenummer fra dokumentet.",
        };
      }
    }

    // Ensure arrays exist
    parsed.generalMessages = Array.isArray(parsed.generalMessages)
      ? parsed.generalMessages
      : [];
    parsed.learningGoals = Array.isArray(parsed.learningGoals)
      ? parsed.learningGoals
      : [];
    parsed.homework = Array.isArray(parsed.homework) ? parsed.homework : [];
    parsed.schedule = Array.isArray(parsed.schedule) ? parsed.schedule : [];

    // Validate schedule entries
    parsed.schedule = parsed.schedule.filter((entry) => {
      return (
        typeof entry.className === "string" &&
        typeof entry.dayOfWeek === "number" &&
        entry.dayOfWeek >= 1 &&
        entry.dayOfWeek <= 7 &&
        typeof entry.startTime === "string" &&
        typeof entry.endTime === "string" &&
        typeof entry.subjectName === "string"
      );
    });

    return { success: true, data: parsed };
  } catch (error) {
    console.error("[parseWeeklyPlan] Error:", error);
    const message =
      error instanceof Error
        ? error.message
        : "Ukjent feil ved parsing av ukeplan.";
    return { success: false, error: message };
  }
}
