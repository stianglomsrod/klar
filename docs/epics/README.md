# Klar 3.0 – epic-oversikt

Epicene gjør [domenekontrakten](../product/DOMAIN_CONTRACT.md) gjennomførbar
uten at produktbeslutninger blir liggende bare i chat, skjermbilder eller
historisk kode.

## Statusverdier

- **Planlagt:** kontrakten er avklart, men leveransen er ikke påbegynt.
- **Pågår:** det finnes en aktiv implementasjon med et definert kontrollpunkt.
- **Blokkert:** en navngitt avhengighet eller produktbeslutning mangler.
- **Ferdig:** alle akseptansekriterier og bevis i epicen er oppfylt.

En epic endrer ikke status automatisk når enkeltfiler opprettes. Status skal
oppdateres eksplisitt i samme commit som kontrollpunktet.

## Oversikt

| ID | Epic | Status | Viktigste avhengigheter |
| --- | --- | --- | --- |
| E01 | [Elevens dag og oppgaveflyt](./E01_STUDENT_DAY_AND_TASK_FLOW.md) | Pågår | E02, E04, E06 |
| E02 | [Progresjon og belønninger](./E02_PROGRESS_AND_REWARDS.md) | Pågår | E05, E06 |
| E03 | [Kontekstuell hjelpekø](./E03_CONTEXTUAL_HELP_QUEUE.md) | Pågår | E01, E05, E06 |
| E04 | [Smart Import og ukeplaner](./E04_SMART_IMPORT_AND_WEEKLY_PLANS.md) | Pågår | E05, E06 |
| E05 | [Ansattilgang og vikar](./E05_STAFF_ACCESS_AND_SUBSTITUTES.md) | Pågår | E06 |
| E06 | [Responsive og tilgjengelige skall](./E06_RESPONSIVE_ACCESSIBLE_SHELLS.md) | Pågår | Tverrgående |
| E07 | [Ansattarbeidsflate og innholdsbiblioteker](./E07_STAFF_WORKSPACE_AND_CONTENT_LIBRARIES.md) | Planlagt | W1–W2: E01, E03, E05, E06; W3: E04 |
| E08 | [Interaktive quizer og lærersjekk](./E08_INTERACTIVE_QUIZZES_AND_CHECKS.md) | Planlagt | E01, E02, E04, E05, E06, E07 |
| E09 | [Levende blomsterhage og betingede belønninger](./E09_LIVING_GARDEN_AND_CONDITIONAL_REWARDS.md) | Planlagt | E02, E05, E06, E07; R6a: E10 DCK1–DCK3; R6b: E08 Q4, R1–R5, E10 DCK1–DCK3 |
| E10 | [Elevidentitet og kontekstuell dock](./E10_STUDENT_IDENTITY_AND_AMBIENT_DOCK.md) | Planlagt | DCK1–DCK3: E01, E02, E03, E06; DCK4a: E08 Q4, E09 R1/R6a; DCK4b: E09 R2–R6b |

Se [implementeringsplanen](../IMPLEMENTATION_ROADMAP.md) for rekkefølge og
kontrollpunkter.

## Vedlikehold

Hver epic skal holde disse delene oppdatert:

1. status og sist endret;
2. mål og eksplisitt avgrensning;
3. domeneregler og UX-krav;
4. forventet data-, API- og autorisasjonsarbeid;
5. akseptansekriterier og testmatrise;
6. avhengigheter, risiko og migrasjonsbehov;
7. konkrete bevis før status settes til ferdig.

Nye produktbeslutninger hører først hjemme i domenekontrakten. Epicene skal
referere til kontrakten og beskrive leveransen, ikke etablere konkurrerende
regler.
