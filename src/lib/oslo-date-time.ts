export const OSLO_TIMEZONE = "Europe/Oslo" as const;

type DateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

export class OsloDateTimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OsloDateTimeError";
  }
}

function parseDate(value: string): Omit<DateTimeParts, "hour" | "minute"> {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new OsloDateTimeError("Økten har ugyldig dato.");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    throw new OsloDateTimeError("Økten har ugyldig dato.");
  }
  return { year, month, day };
}

function parseTime(value: string): Pick<DateTimeParts, "hour" | "minute"> {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new OsloDateTimeError("Økten har ugyldig klokkeslett.");
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    throw new OsloDateTimeError("Økten har ugyldig klokkeslett.");
  }
  return { hour, minute };
}

const osloFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: OSLO_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function partsAt(instantMs: number): DateTimeParts {
  const parts = Object.fromEntries(
    osloFormatter
      .formatToParts(new Date(instantMs))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
  };
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function osloInstantToLocalDateTime(instant: Date): string {
  if (Number.isNaN(instant.getTime())) {
    throw new OsloDateTimeError("Tidspunktet er ugyldig.");
  }
  const parts = partsAt(instant.getTime());
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}T${pad2(parts.hour)}:${pad2(parts.minute)}`;
}

function sameParts(first: DateTimeParts, second: DateTimeParts): boolean {
  return (
    first.year === second.year &&
    first.month === second.month &&
    first.day === second.day &&
    first.hour === second.hour &&
    first.minute === second.minute
  );
}

export function osloLocalDateTimeToIso(date: string, time: string): string {
  const desired: DateTimeParts = { ...parseDate(date), ...parseTime(time) };
  const desiredAsUtc = Date.UTC(
    desired.year,
    desired.month - 1,
    desired.day,
    desired.hour,
    desired.minute,
  );

  let instant = desiredAsUtc;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const observed = partsAt(instant);
    const observedAsUtc = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
    );
    instant -= observedAsUtc - desiredAsUtc;
  }

  if (!sameParts(partsAt(instant), desired)) {
    throw new OsloDateTimeError(
      "Klokkeslettet finnes ikke i norsk tid på denne datoen.",
    );
  }

  if (
    [instant - 3_600_000, instant + 3_600_000].some((candidate) =>
      sameParts(partsAt(candidate), desired),
    )
  ) {
    throw new OsloDateTimeError(
      "Klokkeslettet er tvetydig ved overgang til vintertid. Velg et annet tidspunkt.",
    );
  }

  return new Date(instant).toISOString();
}

export function osloMondayForInstant(instant: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: OSLO_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(instant)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );
  const localDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  const day = localDate.getUTCDay() || 7;
  localDate.setUTCDate(localDate.getUTCDate() - day + 1);
  return localDate.toISOString().slice(0, 10);
}
