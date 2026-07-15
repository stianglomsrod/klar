# Klar 3.0

Klar er en forskningsprototype for elever som trenger støtte til struktur,
prioritering og hjelpesøking i skolehverdagen – uten at støtten blir et stigma.
Prosjektet er designproduktet fra en masteroppgave i digital læringsdesign ved
OsloMet (2026).

Denne `3.0`-branchen er en ny, avgrenset og sikrere pilotkjerne. Den er ikke en
full produksjonsplattform, og den gamle 2.x-datamodellen er ikke grunnlaget for
piloten.

## Hva prototypen gjør nå

Læreren kan:

- logge inn med e-post, passord og TOTP-basert tofaktorautentisering;
- opprette klasser og pseudonyme prototypeelever;
- publisere oppgaver til alle elever i en klasse;
- importere en DOCX-ukeplan til en redigerbar forhåndsvisning og bekrefte en
  samlet, transaksjonell publisering;
- følge oppgavefremdrift og en sikker, sanntidsoppdatert hjelpekø;
- angi hvor mye struktur den enkelte eleven skal få se.

Eleven kan:

- logge inn med elevkode og separat passord;
- se neste oppgave og endre egen oppgavestatus;
- be om hjelp, følge køstatus og trekke forespørselen;
- velge kort, vanlig eller mer detaljert visning;
- velge en rolig fremdriftsvisning uten poeng, rangering eller sammenligning.

Støtten er bygget som et stillas: læreren setter hvor mye støtte en oppgave
kan tilby, mens elevens individuelle valg kan redusere mengden informasjon etter
hvert som behovet blir mindre.

## Avgrensning for første skolepilot

- Ingen Feide-integrasjon er nødvendig for prototypetesten.
- Smart Import bruker lokal, regelbasert DOCX-tolking. Dokumentinnhold sendes
  ikke til en ekstern KI-tjeneste.
- 2.x-grensesnitt, 2.x-administrasjon, pushvarsler og gamle service-role-ruter
  er deaktivert. De privilegerte 2.x-handlingene er erstattet med inaktive
  stubs i runtime.
- Innlevering av bilder, lyd eller fritekst om elever er ikke del av kjernen.
- Motivasjonsvisningen er frivillig og ikke-konkurrerende.

## Avklart målbilde

Den videre produktretningen er samlet i
[`docs/product/DOMAIN_CONTRACT.md`](./docs/product/DOMAIN_CONTRACT.md), med
sporbare leveranser i [`docs/epics`](./docs/epics) og anbefalt rekkefølge i
[`docs/IMPLEMENTATION_ROADMAP.md`](./docs/IMPLEMENTATION_ROADMAP.md).

Disse dokumentene beskriver målbildet og skal ikke leses som en liste over
ferdige pilotfunksjoner. Avsnittene «Hva prototypen gjør nå» og «Avgrensning
for første skolepilot», sammen med
[`docs/PILOT_RUNBOOK.md`](./docs/PILOT_RUNBOOK.md), er fasit for nåværende
implementasjon og driftsklarhet.

## Arkitektur og sikkerhetsmodell

- Next.js 16, React 19 og TypeScript med strengt lintnivå for 3.0-koden.
- En ny migrasjonsstyrt PostgreSQL/Supabase-kjerne i
  [`supabase/migrations`](./supabase/migrations).
- Den tidligere databasen er bevart for historikk i [`supabase-2x`](./supabase-2x),
  og den tidligere UI-koden i [`archive/2x-ui`](./archive/2x-ui), men ingen av
  dem bygges eller migreres inn i 3.0.
- Anonyme klienter har ingen tabelltilgang. Autentiserte klienter er read-only
  og avgrenses med RLS. Alle mutasjoner går gjennom autoriserte serverhandlinger
  og eksplisitte service-role-RPC-er.
- Lærerhandlinger krever medlemskap, riktig klasse/organisasjon og AAL2. Elevens
  handlinger bindes til den verifiserte brukeren.
- Elevkoder lagres som HMAC-SHA256-avtrykk med en separat server-pepper; Klar
  lagrer ikke elevpassord i klartekst.
- Sikkerhetsheadere, kill switch, miljøvalidering, auditthendelser og eksplisitt
  sletting av pilotelever er del av pilotverktøyet.

## Lokal utvikling

Forutsetninger: Node.js 24, npm og et Supabase-prosjekt eller lokal Supabase CLI.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Fyll alle påkrevde verdier i `.env.local`. Kjør SQL-filene i
[`supabase/migrations`](./supabase/migrations) i stigende rekkefølge på en tom
database. [`supabase/config.toml`](./supabase/config.toml) inneholder lokale
Auth-standarder for prototypen.

## Verifikasjon

```bash
npm run check
npm run build
npm run test:e2e:install
npm run test:e2e
```

CI gjør i tillegg følgende:

- bygger en tom PostgreSQL 17-database fra alle 3.0-migrasjonene;
- kjører RLS- og RPC-smoketesten i
  [`supabase/verification/rls_smoke.sql`](./supabase/verification/rls_smoke.sql);
- tester tastaturtilgang, smal elevskjerm og automatiske WCAG A/AA-funn i
  Chromium;
- avviser high/critical funn i produksjonsavhengigheter.

## Pilotmiljø

Teknisk oppsett, kontroll før testøkter, dataminimering, kill switch og
sletteflyt er beskrevet i [`docs/PILOT_RUNBOOK.md`](./docs/PILOT_RUNBOOK.md).
Miljøet skal opprettes fra [`.env.pilot.example`](./.env.pilot.example) og
kontrolleres med `npm run pilot:check-env` før det åpnes.

## Bakgrunn

Klar ble utviklet gjennom deltakende design med lærere som meddesignere. De
fem førende prinsippene er universell tilgjengelighet og anti-stigma, lav
terskel for læreren, frivillig motivasjonsstøtte, plattformuavhengighet og
autonomistøttende stillas som kan trekkes tilbake.

[Videogjennomgang av 2.x-prototypen](https://www.youtube.com/watch?v=yg6kgcdzIYM)
· [Portefølje og prosjektbakgrunn](https://stianglomsrod.no)

Stian Glomsrød · Master i digital læringsdesign, OsloMet 2026
