# Kontrollpunkt 0 – arbeids- og QA-fundament

**Status:** Fullført og lokalt verifisert

**Dato:** 15. juli 2026

Kontrollpunktet etablerer en repeterbar implementeringssløyfe uten å bygge en
ny produktslice. Det gjør historiske referanser, arbeidsregler, sikker testdata,
rolleisolasjon, responsive skjermbilder og kontrollpunktporter gjenbrukbare for
alle senere epics. Lokal Auth-konfigurasjon er korrigert slik at adminopprettede
kontoer kan bruke e-post/passord, mens offentlig registrering fortsatt er
globalt avslått og negativt testet.

## Leveranser

- `AGENTS.md` med autoritative kilder, sikkerhetsgrenser og definition of done;
- repo-skillen `$klar-loop` under `.agents/skills/klar-loop`;
- kuratert `Prototypen/Bildeoversikt.md` og stabile lokale referansefiler;
- låst Supabase CLI som utviklingsavhengighet;
- lokal-only runner som krever Docker, bruker `db reset --local` og avviser
  ikke-loopback Supabase;
- separat lokalt utforskingsverksted som gjenbruker samme sikkerhetsgrense,
  starter loopback-bundet Next-utviklerserver med hot reload og åpner valgte,
  isolerte lærer-, elev-, eier- og vikarvinduer uten auth-bypass;
- syntetisk fixture med eier/AAL2-oppsett, elev, klasse og oppgaver;
- separate Playwright storage states for lærer og elev;
- offentlig smoke, autentisert smoke og visuell matrise ved 360×640, 640×360,
  768×1024, 1024×768 og 1440×900;
- axe-, overflow-, runtime- og rolleisolasjonshjelpere;
- visuell QA-mal og deterministisk `npm run verify:checkpoint`.

## Sikkerhetsbevis

- Runneren godtar bare `http://127.0.0.1:54321` eller
  `http://localhost:54321`.
- Både produksjons-QA-serveren og utviklerserveren bindes eksplisitt til
  `127.0.0.1:3100`; Nexts bredere standardbinding brukes ikke.
- Eksternt/linket Supabase-prosjekt har ingen fallback eller override.
- Testpassord og TOTP-hemmelighet opprettes per reset og logges ikke. Labens
  pepper gjenbrukes fra en separat ignorert runtime-fil så lenge den stateful
  lokale databasen beholdes.
- Auth-oppsettet har trace, video og screenshot avslått slik at TOTP-hemmelighet
  ikke havner i artefakter.
- Browsertilstander ligger under ignorert `playwright/.auth/`.
- Fixtures bruker `.invalid`-adresser og generiske testnavn.
- Offentlig signup forsøkes etter hver reset og skal avvises før fixtures
  opprettes.
- Direkte Playwright-authmodus avviser ikke-loopback Supabase, også når noen
  forsøker å omgå runneren.
- Lokal gateway restartes etter database-reset for å fjerne foreldede interne
  Docker-adresser før Auth-health og seeding.

## Kommandoer

| Kommando | Formål |
| --- | --- |
| `npm run lab:reset` | Eksplisitt fersk lokal syntetisk fixture, Auth/MFA-cache og scenariomeny |
| `npm run lab` / `npm run dev:roles` | Gjenbruk syntetiske data og åpne valgte isolerte Chromium-roller med hot reload |
| `npm run lab:list` | List scenarioene uten Docker, database eller reset |
| `npm run test:e2e` | Rask offentlig Chromium-smoke uten lokal Supabase |
| `npm run test:e2e:auth` | Lokal autentisert elev-/lærer-smoke |
| `npm run test:e2e:visual` | Ti screenshot-/axe-kjøringer på fem målviewports |
| `npm run test:e2e:full` | Offentlig, autentisert og visuell Chromium-port |
| `npm run test:e2e:full:webkit` | Samme autentiserte port i WebKit |
| `npm run verify:checkpoint` | Diff, check, build, offentlig E2E og produksjonsaudit |

## Opprinnelig verifikasjonsstatus 15. juli 2026

- Skillstruktur: validert med `quick_validate.py` og forward-testet mot E05.
- `npm run verify:checkpoint`: grønn med lint, kjerne-lint, typecheck, 22
  enhetstester, produksjonsbuild, fire offentlige Playwright-tester og
  high-threshold produksjonsaudit.
- `npm run test:e2e:auth`: 7 av 7 bestått fra tom lokal database.
- `npm run test:e2e:full`: 17 av 17 bestått i Chromium.
- `npm run test:e2e:full:webkit`: 17 av 17 bestått i WebKit.
- Begge fullkjøringer omfatter offentlig smoke, adminopprettet elev,
  elevkode/passord, lærerens TOTP/AAL2, gjensidig rolleisolasjon, axe A/AA,
  horisontal overflow, runtime-feil, reduced motion og fem viewports per rolle.
- Alle ti Chromium- og ti WebKit-bilder er visuelt inspisert. Resultatet og
  kjente produktgap er dokumentert i
  [`CONTROL_POINT_0_VISUAL_QA.md`](./CONTROL_POINT_0_VISUAL_QA.md).
- Ekte touch på mobil/iPad, VoiceOver/NVDA og faktisk 200 % browserzoom er
  eksplisitte manuelle porter i den første relevante produktslicen.

Produksjonsauditen rapporterer to moderate, transitive PostCSS-funn via Next.
Tilgjengelig automatisk retting krever en brytende nedgradering og brukes ikke;
high/critical-porten er grønn.

Den autentiserte Docker-suiten er foreløpig lokal kontrollpunktport. En egen
cachet CI-jobb vurderes separat fordi full Supabase-stack er vesentlig tyngre
enn dagens offentlige E2E- og PostgreSQL/RLS-jobber.

## Lokal rolleutvikling og utforsking

`npm run lab` og aliaset `npm run dev:roles` er utviklerinnganger, ikke nye
produktendepunkter eller QA-bevis. En eksplisitt `npm run lab:reset` bruker den
samme lokale resetten, syntetiske seeden, negative signup-kontrollen, ekte
elevinnloggingen og ekte MFA/AAL2-oppsettet som den autentiserte E2E-suiten.
Deretter kan laben gjenbruke data og oppdaterte Auth-sesjoner uten ny reset,
seed eller MFA. I utviklermodus hoppes produksjonsbygget over, og Playwright
starter `next dev` med Webpack og eksakt loopback-binding.

Scenariomenyen dekker dags-/fagflyt, hjelpekø, retur, belønning/progresjon,
oppgaveiterasjoner og tilgang/vikar. Rollene har separate ignorerte storage
states under `playwright/.auth/lab`, men bruker samme origin. Manuelle
dataendringer beholdes til eksplisitt reset. Browsertilstandene lagres etter
vellykket navigasjon og ryddig lukking fordi lokal Auth roterer refresh-token.
En avbrutt økt eller mismatch i fixture, databasegenerasjon eller state stopper
gjenbruk. En utløpt tidsfixture avviser bare det valgte scenariet i menyen,
mens direkte modus stopper med resetveiledning. Starteren nullstiller aldri i
skjul. Før en labøkt presenteres eller lagres som ryddig avsluttet, må den
faktiske lokale Supabase-brukeren matche scenarioets syntetiske aktør, og alle
voksen-states merket `aal2` må fortsatt ha AAL2.

En datoendring alene invaliderer ikke lenger hele den stateful laben.
Manifestdatoen er metadata; dags-, fag-, hjelpekø- og
oppgaveiterasjonsscenarioer kontrollerer i stedet sin faktiske tidsforutsetning
mot DB-tid. Dermed kan tidløse scenarioer og manuelle data gjenbrukes over
midnatt, mens et utløpt valgt scenario fortsatt stopper med resetveiledning.

### Dato-rollover 18. juli 2026

En cache fra 17. juli ble gjenbrukt 18. juli uten reset. `access`, en faktisk
aktuell `day`-økt som krysset midnatt og `iterations` med en strengt fremtidig
måløkt bestod mot aktiv planrevisjon. Manifestdatoen forble 17. juli, alle 11
states var rene, og ingen lock eller appserver stod igjen. Den målrettede
pakken bestod 21 av 21 tester; full `npm run verify:checkpoint` bestod med 84 av
84 enhetstester, produksjonsbuild og 4 av 4 offentlig Playwright.

Den formelle `npm run qa:a1:desktop` er fortsatt en separat opt-in med fersk
fixture, produksjonsbuild, fast trevindusoppsett og egen bevisprotokoll. Se
[`LOCAL_EXPLORATION_LAB.md`](./LOCAL_EXPLORATION_LAB.md) for scenarioer,
cachegrenser og den overførbare arbeidsmodellen.

### Verifikasjon av rolleutviklingsstarteren 17. juli 2026

- Modus- og kommandoenhetstest: 4 av 4 bestått. `--dev` avvises uten manuell
  Chromium-modus, målrettede specs holdes under `tests/e2e`, og både dev- og
  produksjonsserverkommandoen bruker eksakt `127.0.0.1:3100`. En gammel
  `KLAR_ROLE_DEV`-verdi i terminalmiljøet overskrives eksplisitt og kan ikke
  endre den formelle QA-starterens modus.
- Eksisterende lokal-sikkerhetspakke: 4 av 4 bestått for API-/database-URL,
  port, database, query/fragment og CLI-statusparsing.
- Ikke-interaktiv kjøring av `dev:roles` ble avvist før Docker eller database
  ble berørt, som forventet.
- Første autentiserte reset traff et lokalt Supabase/Realtime-race i en
  tidligere kjørende Docker-stack: `realtime-dev` fantes allerede under
  databasegjenopprettelsen. Ingen apptest startet. Stacken ble stoppet med
  `supabase stop --no-backup`, som bare fjernet lokale syntetiske ressurser.
- Retest fra stoppet lokal stack: `npm run test:e2e:auth` bestod 14 av 14,
  inkludert syntetisk seed, ekte MFA/AAL2, lærer/elev, rolleisolasjon,
  oppgaveflyt og klasseomfang.
- Egen headless devkontroll startet samme Webpack-kommando som `dev:roles`,
  verifiserte health på `127.0.0.1:3100`, åpnet lærerens klasse og elevens
  dagsflate fra hver sin storage state og bekreftet at Auth-cookiene var
  forskjellige. Prosessen og port 3100 ble stoppet etter kontrollen.
- `npm run verify:checkpoint` bestod med 67 enhetstester, lint, kjerne-lint,
  typecheck, produksjonsbuild, fire offentlige Playwright-tester og den
  eksisterende high/critical-auditgrensen. De to kjente moderate, transitive
  PostCSS-funnene gjennom Next er uendret; `npm audit fix --force` ville kreve
  en brytende Next-nedgradering og brukes ikke.

Den synlige to-vindusøkten forblir en brukerinitiert, interaktiv handling. Den
automatiske kontrollen beviser starterbanen og isolasjonen, men registrerer
ikke produktets manuelle UI/UX som bestått.

### Stateful scenarioverksted 17. juli 2026

Den opprinnelige to-vindusinngangen er videreført som et statefult,
cachevalidert scenarioverksted. Fresh- og reuse-prosjektgraf, ekte lokal
reset/seed/Auth/MFA, rask gjenbruk, 1–3 samtidige roller og alle ti
startscenarioer,
refresh-state-lagring, eksklusiv runnerlås, bevart databasesentinel og
fail-closed avvisning av en avbrutt cache er integrasjonstestet. Den raske
reuse-banen brukte 11–25 sekunder per kontrollert scenario og kjørte verken
database-reset, seed eller auth-setup. Detaljert bevis og arbeidsvalg ligger i
[`LOCAL_EXPLORATION_LAB.md`](./LOCAL_EXPLORATION_LAB.md).

Den endelige herdede porten bestod med 77 av 77 enhetstester, produksjonsbuild,
4 av 4 offentlige Playwright-tester og 14 av 14 autentiserte regresjonstester.
Format-2-labcachen ble deretter bygget på nytt fra tom lokal database og
retestet i reuse-modus, slik at `npm run lab` er klar uten ny reset ved
overlevering.

## Publiseringsport for prototypebilder

Produkteier bekreftet 15. juli 2026 at navn, e-post og eksempeltekst i
referansebildene tilhører mockbrukere. Binærbildene, kollasjene og det sanerte
tekstmanifestet kan derfor inngå i kontrollpunktet som syntetiske historiske
referanser. De skal fortsatt ikke brukes som fixtures eller dokumentasjon av
virkelige elever.
