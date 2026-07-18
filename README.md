# Klar 3.0

Klar er en forskningsprototype for elever som trenger støtte til struktur,
prioritering og hjelpesøking i skolehverdagen – uten at støtten blir et stigma.
Prosjektet er designproduktet fra en masteroppgave i digital læringsdesign ved
OsloMet (2026).

Denne `3.0`-branchen er en ny, avgrenset og sikrere pilotkjerne. Den er ikke en
full produksjonsplattform, og den gamle 2.x-datamodellen er ikke grunnlaget for
piloten.

## Hva prototypen gjør nå

Eieren med AAL2 kan:

- logge inn med e-post, passord og TOTP-basert tofaktorautentisering;
- opprette klasser og pseudonyme prototypeelever;
- gi og tilbakekalle klasse- og tidsavgrensede oppdrag for eksisterende,
  navngitte voksne organisasjonsmedlemmer.

En ansatt eller vikar med personlig konto, AAL2 og et aktivt klasseoppdrag kan:

- se bare klassene oppdraget omfatter;
- publisere løse oppgaver til alle nåværende elever i en klasse;
- bygge den første strukturerte klasseuken med tidsfestede økter og oppgaver,
  kontrollere innholdet og publisere én uforanderlig revisjon atomisk;
- velge en konkret utsending fra klasseuken og enten flytte valgte
  `assigned`/`reopened`-mottakere til en senere publisert økt eller sende samme
  oppgavedefinisjon ut som en ny, lenket utsending. Fullførte mottakere kan
  ikke flyttes, men kan velges ved ny utsending;
- importere en DOCX til redigerbare oppgaveforslag. DOCX-flyten bevarer ennå
  ikke økter eller ukeplanrevisjon og publiserer eventuelt løse oppgaver;
- følge oppgavefremdrift, åpne og stenge hjelpekø for den aktuelle økten og ta
  eller løse elevforespørsler innenfor sitt klasseoppdrag;
- prioritere køen privat og reviderbart, frigi en overtatt forespørsel eller
  overføre den til en annen aktiv kø-deltaker med aktuelt autorisert
  klasseoppdrag;
- angi hvor mye struktur den enkelte eleven skal få se;
- åpne eller lukke blomsterhagen for en elev i eget klasseomfang uten å kunne
  endre elevens personlige valg om å vise den.

Vanlige ansatte kan ikke opprette kontoer eller klasser eller forvalte
ansattoppdrag. Eierens kontrollplantilgang gir ikke i seg selv pedagogisk
tilgang til en klasse.

Eleven kan:

- logge inn med elevkode og separat passord;
- se forrige, aktuell og neste økt fra den aktive klasseuken, med eldre løse
  oppgaver i en sekundær seksjon;
- åpne «Fag og oppgaver» fra den lille elevmenyen og finne igjen alle nå
  synlige oppgaveiterasjoner gruppert etter fag, også ferdige og gjenåpnede;
- åpne oppgaven uten «I gang»-status, fullføre uten vedlegg, angre og se en
  ikke-straffende beskjed når en ansatt åpner oppgaven igjen;
- få en hånd bare når den aktuelle øktkøen er åpen, be om generell eller
  oppgaveknyttet hjelp og melde seg av uten å se køplass eller andre elever;
- velge kort, vanlig eller mer detaljert visning;
- velge om poeng/fremdrift og blomsterhage skal vises, uavhengig av hverandre;
- når læreren har åpnet hagen, få ett varig kronblad ved første passering av
  et nytt nivå, velge blant åtte navngitte farger og se kronbladene i en rolig
  samling. Angre eller ansattretur trekker tilbake XP, men ikke et valgt
  kronblad, og samme nivå kan ikke farmes på nytt.

Støtten er bygget som et stillas: læreren setter hvor mye støtte en oppgave
kan tilby, mens elevens individuelle valg kan redusere mengden informasjon etter
hvert som behovet blir mindre.

## Avgrensning for første skolepilot

- Ingen Feide-integrasjon er nødvendig for prototypetesten.
- DOCX-importen bruker lokal, regelbasert tolking og gir foreløpig bare
  redigerbare oppgaveforslag. Dokumentinnhold sendes ikke til en ekstern
  KI-tjeneste. Strukturbevarende Smart Import/reimport er ikke implementert.
- 2.x-grensesnitt, 2.x-administrasjon, pushvarsler og gamle service-role-ruter
  er deaktivert. De privilegerte 2.x-handlingene er erstattet med inaktive
  stubs i runtime.
- Innlevering av bilder, lyd eller fritekst om elever er ikke del av kjernen.
- Motivasjonsvisningen er frivillig og ikke-konkurrerende.
- Hjelpekøen bruker øktbundet stenging, privat og atomisk rekkefølge,
  claim/resolve og release/transfer. Gruppekø og en global køwidget er ikke
  implementert.
- Ingen oppgave flyttes eller gjentas automatisk. Ukentlig gjentakelse og én
  felles fullføring på tvers av flere undervisningsøkter er ikke implementert.

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
  og avgrenses med RLS eller smale, caller-bound lese-RPC-er. Alle mutasjoner
  går gjennom autoriserte serverhandlinger og eksplisitte service-role-RPC-er.
- Pedagogiske voksenhandlinger krever nåværende voksenmedlemskap i
  organisasjonen, AAL2, et aktivt tids- og klasseavgrenset oppdrag og den
  eksplisitte kapabiliteten handlingen trenger. Eierens kontrollplan er separat
  og gir ikke automatisk pedagogisk tilgang. Elevens handlinger bindes til den
  verifiserte brukeren.
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

### Lokalt utforskingsverksted

Dette er standardinngangen når du vil prøve lærer-, elev- og eierflyter uten å
gjennomføre en formell QA-protokoll. Første gang, etter fixtureendringer eller
når du vil tilbake til grunnstillingen, oppretter du eksplisitt en ny lokal,
syntetisk testverden:

```bash
npm run lab:reset
```

Resetkommandoen nullstiller **bare lokal Supabase**, seeder syntetiske
scenarioer, gjennomfører ekte lokale Auth-/MFA-oppsett og åpner en norsk
scenariomeny. Senere starter du raskt med de samme dataene og de oppdaterte,
isolerte browserøktene:

```bash
npm run lab
# Eldre kommandonavn:
npm run dev:roles
```

Velg blant dags-/fagflyt, hjelpekø, retur, blomsterhage og poeng,
oppgaveiterasjoner, tilgang/vikar og visuelle elevforhåndsvisninger. Lærer og
elev åpnes på samme `http://127.0.0.1:3100`-origin i separate Chromium-contexts,
tilsvarende vanlig vindu og inkognito. Lukk alle vinduene i et scenario for å
gå tilbake til menyen; scenarioets devserver stoppes, men syntetiske data og
Auth-økter beholdes. Et nytt valg starter devserveren raskt igjen. `Q` avslutter
labprosessen, mens lokal Supabase kan gjenbrukes senere.

```bash
npm run lab:list
npm run lab -- --scenario=rewards
```

Gjenbruk gjør aldri en skjult reset. Et registrert scenario kan etter krasj
gjenopptas bare når runneren beviser at låsens PID er død, den tilfeldige
runnerbindingen matcher, og faste identiteter og AAL2 fortsatt valideres. En
aktiv lås krever at kjøringen avsluttes; ukjent låseierskap krever manuell
kontroll. Ubundet eller inkonsistent dirty-cache stopper med beskjed om
`npm run lab:reset`. En datoendring alene stopper ikke laben; bare valgte
tidsstyrte scenarioer avvises dersom tidsforutsetningen i aktiv planrevisjon
ikke er oppfylt. Tilkoblingen har ingen fallback til `.env.local`, et linket
prosjekt eller pilotdatabasen. Verkstedet er uformell utforsking og registrerer
ikke QA som bestått. Når et formelt manuelt kontrollpunkt ønskes, brukes fortsatt
den separate `npm run qa:a1:desktop` og tilhørende bevisprotokoll. Se
[`docs/qa/LOCAL_EXPLORATION_LAB.md`](./docs/qa/LOCAL_EXPLORATION_LAB.md).

## Verifikasjon

```bash
npm run check
npm run build
npm run test:e2e:install
npm run test:e2e
npm run verify:checkpoint
npm run test:db:staff
```

Den offentlige Playwright-suiten er rask og bruker ingen testkontoer. For
autentiserte elev-/lærerflater finnes en separat, lokal-only suite:

```bash
# Krever Docker Desktop. Kommandoene nullstiller den lokale Supabase-databasen.
npm run test:e2e:auth
npm run test:e2e:staff
npm run test:e2e:visual
npm run test:e2e:full
npm run test:e2e:full:webkit
```

Runneren krever og bruker Supabase API via `http://127.0.0.1:54321`, avviser alt
annet enn loopback og godtar direkte testkontroll mot Postgres bare på
loopback-port 54322, database `postgres`, uten query eller fragment. Den
oppretter bare syntetiske fixtures, gjennomfører lærerens TOTP-oppsett gjennom
UI og bruker samme origin med separate browser contexts og separate, ignorerte
storage-state-filer for elev og ansatte. Den bruker aldri det linkede
pilotprosjektet som reserve.

Loopback-valideringen er en applikasjonsvakt, ikke en vertsbrannmur. Supabase CLI
og Docker Desktop kan fortsatt publisere portene `54321–54324` på
vertsgrensesnitt. Kontroller lokal brannmur og stopp testmiljøet med
`npx supabase stop --no-backup` etter kontrollpunktet.

Midlertidige Playwright-spor og feilartefakter lagres i
`test-results/<browser>-<modus>`. Utvalgte Chromium-tester skriver i tillegg
kuraterte, versjonerte bilder til `docs/qa/evidence/`; slike endringer skal
vurderes eksplisitt og aldri godtas automatisk som nye baselines.
Prototypebildene er semantiske referanser, ikke pixel-baselines.

Den autentiserte grunnsuiten og den samlede automatiserte produktmatrisen er
verifisert lokalt i Chromium og WebKit. Kontrollpunkt Fs motorbaseline og åpne
fysiske porter er dokumentert i
[`docs/qa/CONTROL_POINT_F.md`](./docs/qa/CONTROL_POINT_F.md). Suiten er fortsatt
en eksplisitt lokal kontrollpunktport. CI beholder offentlig Playwright-smoke og
kjører den separate databasepakken i både tomt og representativt
oppgraderingsscenario.

Første strukturerte klasseuke og den øktstyrte elevdagen er dokumentert med
akseptansekriterier, avvik, retester og syntetiske fem-viewport-bilder i
[`docs/qa/CONTROL_POINT_C1.md`](./docs/qa/CONTROL_POINT_C1.md).

Den øktbundne hjelpekøen, elevhånden, oppgavekontekst, privacy, samtidighet og
reconnect er dokumentert i
[`docs/qa/CONTROL_POINT_E1.md`](./docs/qa/CONTROL_POINT_E1.md). Chromium,
WebKit, databaseportene og syntetisk visuell QA er automatisert; fysisk
E1-touch og skjermleser er fortsatt en manuell produktport.

Privat, reviderbar ansattprioritering, release/transfer og atomisk staff-
snapshot er dokumentert i
[`docs/qa/CONTROL_POINT_E2.md`](./docs/qa/CONTROL_POINT_E2.md). Den samlede
fysiske touch-/skjermleserporten for E03 står fortsatt åpen.

Delt ansattdeltakelse, personlig uttreden, global stenging, automatisk sikker
uttreden ved endret tilgang og eksplisitt overtakelse av ubemannet kø er
dokumentert i
[`docs/qa/CONTROL_POINT_E3.md`](./docs/qa/CONTROL_POINT_E3.md). To ansatte kan
delta; én ikke-siste deltaker uten eid arbeid kan forlate både åpen og stengende
kø uten å stanse kollegaens arbeid. Siste deltaker i åpen kø må velge «Steng
kø». Den samlede fysiske E03-porten står fortsatt åpen.

Eksplisitt flytt av samme uferdige oppgave og ny, lenket utsending er
dokumentert i
[`docs/qa/CONTROL_POINT_D2.md`](./docs/qa/CONTROL_POINT_D2.md). Tom database,
representativ oppgradering, målrettet D2-E2E, de fulle autentiserte suitene og
den responsive Chromium-/WebKit-matrisen er grønne. Fysisk
D2-iPad-/VoiceOver-port er ikke gjennomført og omtales ikke som automatisk
bevis.

Den sekundære elevoversikten «Fag og oppgaver» er dokumentert i
[`docs/qa/CONTROL_POINT_D3.md`](./docs/qa/CONTROL_POINT_D3.md). Caller-bound
kataloglesing, tom database, representativ oppgradering, fullføring/angre/XP
fra fagdetalj og den responsive Chromium-/WebKit-matrisen er grønne. Et
kuratert, syntetisk bildeutvalg er lagret i
[`docs/qa/evidence/D3`](./docs/qa/evidence/D3/README.md). Fysisk D3-retest med
VoiceOver/NVDA gjenstår.

Den varige blomsterbelønningen er dokumentert i
[`docs/qa/CONTROL_POINT_B2.md`](./docs/qa/CONTROL_POINT_B2.md). Tom database,
representativ oppgradering, RLS/grants, retry/samtidighet, komplett
Chromium-/WebKit-flyt og seks kuraterte responsive bilder er verifisert. Den
fysiske VoiceOver/NVDA-flyten står fortsatt åpen.

Den samlede automatiserte motorbaselinen for kontrollpunkt F er dokumentert i
[`docs/qa/CONTROL_POINT_F.md`](./docs/qa/CONTROL_POINT_F.md). Den samler
`verify:checkpoint`, tom database og representativ oppgradering, full
autentisert Chromium-/WebKit-flyt, samme origin med separate rollekontekster og
den responsive fem-viewport-matrisen. Dette er et automatisert
integrasjonsbevis, ikke fysisk enhetsbevis.

Faktisk 200 prosent browserzoom og NVDA er bestått. Navngitte fysiske porter for
A1, B1, B2, D2, D3 og E03 står fortsatt åpne eller delvis gjennomførte som
beskrevet i kontrollpunktdokumentene og pilotrunbooken. Den historiske,
kandidatbundne A1-revisjonen ligger i
[`docs/qa/CONTROL_POINT_A1_AUTOMATED_QA.md`](./docs/qa/CONTROL_POINT_A1_AUTOMATED_QA.md).

CI gjør i tillegg følgende:

- bygger både en tom PostgreSQL 17-database og en representativ
  `00000–00006`-database som oppgraderes til A1;
- verifiserer migrasjon, backfill, fail-closed preflight, RLS, RPC, grants,
  audit, idempotens og samtidighet for ansattoppdrag;
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
