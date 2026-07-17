import { createHmac, randomInt } from "node:crypto";

const FIRST_WORDS = [
  "BJORK",
  "EIK",
  "FURU",
  "GRAN",
  "HEGG",
  "LIND",
  "LOENN",
  "OR",
  "OSP",
  "PIL",
  "ROGN",
  "SELJE",
  "ALM",
  "ASK",
  "EINER",
  "VIER",
] as const;

const SECOND_WORDS = [
  "ELG",
  "FALK",
  "HARE",
  "HJORTE",
  "HVAL",
  "KATT",
  "LUNDE",
  "LYNX",
  "MAAKE",
  "OTER",
  "REV",
  "SEL",
  "SVALE",
  "UGLE",
  "ULV",
  "OERN",
] as const;

const PASSWORD_WORDS = [
  "Blaa",
  "Fjell",
  "Globus",
  "Komet",
  "Lime",
  "Mango",
  "Nord",
  "Panda",
  "Robot",
  "Sol",
  "Tromme",
  "Vaffel",
] as const;

function pick<const Values extends readonly string[]>(values: Values): Values[number] {
  return values[randomInt(values.length)];
}

export function normalizeStudentCode(value: string): string {
  return value.trim().toUpperCase().replace(/[\s_]+/g, "-");
}

export function generateStudentCode(): string {
  const digits = randomInt(1000, 10000);
  return `${pick(FIRST_WORDS)}-${pick(SECOND_WORDS)}-${digits}`;
}

export function generateStudentPassword(): string {
  const digits = randomInt(1000, 10000);
  return `${pick(PASSWORD_WORDS)}-${pick(PASSWORD_WORDS)}-${digits}`;
}

export function digestStudentCode(code: string, pepper: string): string {
  return createHmac("sha256", pepper)
    .update(normalizeStudentCode(code), "utf8")
    .digest("hex");
}
