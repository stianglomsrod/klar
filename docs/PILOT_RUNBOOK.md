# Klar 3.0 – teknisk pilotrunbook

Dette er oppskriften for en avgrenset skolepilot av forskningsprototypen. Den
beskriver tekniske utviklings- og driftsgrep, ikke en produksjonsutrulling.

## Fast pilotscope

- Bruk bare 3.0-flatene under `/v3`. 2.x er avslått.
- Smart Import er lokal, regelbasert DOCX-tolking. Ekstern KI er avslått.
- Pushvarsler, innleveringer, fritekst om eleven og konkurrerende spillelementer
  er ikke del av første pilot.
- Elevkontoer bruker korte visningsnavn, tilfeldig intern e-post, elevkode og
  et separat passord. Klar lagrer bare HMAC-avtrykket av elevkoden.
- Voksne bruker personlige kontoer med e-post, passord og TOTP-basert
  tofaktorautentisering. Pedagogisk tilgang krever i tillegg AAL2 og et aktivt,
  klasseavgrenset oppdrag.
- A1 kan bare gi oppdrag til eksisterende voksne organisasjonsmedlemmer.
  Invitasjon og opprettelse av nye ansattkontoer er ikke implementert.

## Miljøer

Bruk separate Supabase- og appmiljøer for lokal utvikling og skolepilot. Velg
en norsk eller EØS-lokasjon hos begge leverandører, og dokumenter den valgte
regionen sammen med pilotens konfigurasjon. Ikke kopier elevdata tilbake til
utviklingsmiljøet.

Pilotmiljøet starter med [`PILOT_ENABLED=false`](../.env.pilot.example). Denne
verdien sender innlogging og alle 3.0-ruter til en nøytral stengt-side. Endre
til `true` først etter teknisk kontroll. `/api/health` svarer 200 når appen er
konfigurert og piloten er åpen, ellers 503.

Alle hemmeligheter skal ligge i leverandørens secret store. De skal aldri
legges i repoet, deles i skjermbilder eller skrives i logger.

## Første oppsett

1. Opprett et tomt Supabase-prosjekt i valgt EØS-region.
2. Kontroller at offentlig registrering er avslått, passordkravet er minst ti
   tegn og TOTP er aktivert. Disse valgene er også uttrykt i
   [`supabase/config.toml`](../supabase/config.toml).
3. Koble Supabase CLI til pilotprosjektet og kjør alle migrasjoner i
   [`supabase/migrations`](../supabase/migrations) i stigende rekkefølge.
4. Fyll miljøvariablene med utgangspunkt i [`.env.pilot.example`](../.env.pilot.example).
5. Last variablene inn i en lokal terminal og kjør `npm run pilot:check-env`.
6. Sett bootstrap-variablene lokalt og kjør
   `npm run pilot:bootstrap-owner`. Passordet gis til eieren via en annen kanal
   og skrives ikke ut av skriptet.
7. Kjør `npm ci`, `npm run test:e2e:install` og følgende porter fra en ren
   utsjekk før pilotversjonen slippes:

   ```text
   npm run verify:checkpoint
   npm run test:db:staff
   npm run test:e2e:full
   npm run test:e2e:full:webkit
   ```

8. Database- og E2E-runnerne bruker bare syntetiske data og nullstiller bare
   lokale Docker/Supabase-ressurser. E2E-runneren avviser andre verter enn
   loopback. Direkte testkontroll godtar bare Postgres på loopback-port 54322,
   database `postgres`, uten query eller fragment. Runnerne skal aldri peke mot
   piloten.
9. Logg inn som eier, fullfør TOTP-oppsettet, opprett en testklasse og verifiser
   hele løypa med testdata: elev → oppgave → status → hjelpekø.
10. Åpne piloten med `PILOT_ENABLED=true` og kontroller `/api/health` igjen.

## Minimumskontroll før hver testøkt

- CI er grønn for nøyaktig commit som er deployet.
- `PILOT_ENABLED`, 2.x-, push- og KI-flagg har forventet verdi.
- En elev kan bare se egne oppgaver, egen hjelpekøstatus og egne visningsvalg.
- En ansatt kan bare se en klasse når et aktivt oppdrag gir
  `class.workspace.read` for akkurat den klassen.
- Pedagogiske voksenoperasjoner stopper uten AAL2/TOTP, ved feil scope og når
  oppdraget er utløpt eller tilbakekalt. En allerede åpen side gir ingen
  snarvei; neste serverlesing eller handling skal avvises.
- En eier uten klasseoppdrag kan bruke kontrollplanet, men kan ikke lese eller
  mutere pedagogiske data i klassen.
- Smart Import viser en redigerbar forhåndsvisning og krever eksplisitt
  bekreftelse før publisering.
- Innlogging, elevens dagsflate og lærerens klasseflate kan brukes med tastatur
  ved 200 % zoom og med redusert bevegelse aktivert.
- Elevkode og engangspassord er overlevert uten at de ligger igjen i e-post,
  logger eller delte dokumenter.

## Avgrenset logging og data

Ikke logg request bodies, passord, elevkoder, DOCX-innhold eller service role-
nøkkelen. Applikasjonens auditthendelser inneholder aktør, hendelsestype,
ressurs-ID og teknisk metadata; de skal ikke brukes til fritekst om elever.

Fastsett en konkret slettedato per testgruppe i pilotens driftsnotat. Når en
elev skal fjernes, sett `PILOT_STUDENT_ID` og
`CONFIRM_DELETE_STUDENT_ID` til samme UUID og kjør
`npm run pilot:remove-student`. Skriptet nekter å slette lærer- og eierkontoer.
Kontroller og slett eventuelle leverandørbackuper etter den valgte
oppbevaringsperioden.

## Stans og gjenoppretting

Ved mistenkt feil eller uønsket tilgang:

1. Sett `PILOT_ENABLED=false` og kontroller at `/api/health` svarer 503.
2. Roter berørte nøkler og sesjoner. Service role-nøkkelen regnes som berørt
   hvis den kan ha vært eksponert.
3. Ta vare på relevante tekniske auditthendelser uten å eksportere mer
   elevdata enn hendelsen krever.
4. Rett feilen, kjør kode- og databasetestene på nytt og åpne piloten
   eksplisitt. Ikke gjenbruk en ukjent eller delvis migrert database.

## Verifiserte sikkerhetsgrenser

CI bygger databasen både fra null og fra en representativ `00000–00006`-
tilstand. Ansattpakken kontrollerer eksakt backfill, atomisk fail-closed
preflight, owner-only kontrollplan, RLS/RPC/grants, ingen anonym skrivetilgang,
idempotens og samtidighet. Lokal autentisert E2E i Chromium og WebKit
kontrollerer owner → vikar → tilbakekalling, AAL1/AAL2, avgrenset klasseflate,
ugyldige oppdragsinput, forfalskede kontrollhandlinger, redusert
kapabilitetsprofil, positiv regelbasert DOCX-preview/publisering,
utløpsreconcile, stale handlinger og responsive/tilgjengelige QA-proxyer.
Testene bruker bare syntetiske data og lokal Supabase.

## Manuelle enhetsporter før Kontrollpunkt A kan lukkes

De automatiske proxyene er nyttige, men erstatter ikke følgende kontroller på
reelt utstyr. Bruk den detaljerte
[`manuelle A1-protokollen`](./qa/CONTROL_POINT_A1_MANUAL_QA.md) og før inn
faktisk enhet, nettleser og resultat:

- [x] faktisk 200 prosent browserzoom/reflow;
- [ ] NVDA bestått 2026-07-16; VoiceOver gjenstår;
- [ ] ekte touch og trykkmål;
- [ ] notch/safe-area;
- [ ] ekte virtuelt tastatur;
- [ ] live bytte mellom portrett og landskap.

Kontrollpunkt A1 skal ikke omtales som fullført før disse er dokumentert.
