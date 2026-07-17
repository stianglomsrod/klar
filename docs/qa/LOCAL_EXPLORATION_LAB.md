# Lokalt utforskingsverksted

**Status:** Implementert og fullstendig lokalt reset-/reuse-verifisert

**Gjelder:** Kun lokal utvikling med syntetiske data på branch `3.0`

Verkstedet gir produkteier og utvikler lav terskel for å utforske UI, UX og
domenehandlinger som lærer, elev, eier og vikar. Det er med vilje skilt fra
formell QA: utforsking kan endre data fritt og gir ikke et pass/fail-resultat,
mens en manuell QA-port fortsatt starter fra en kontrollert kandidat og føres i
sin egen bevisprotokoll.

## Rask bruk

Start Docker Desktop og kontroller at port 3100 er ledig. Første gang, etter
fixture-/migrasjonsendringer eller når du ønsker grunnstilling:

```bash
npm run lab:reset
```

Senere starter du uten database-reset, seed eller ny MFA-runde:

```bash
npm run lab
```

`npm run dev:roles` er et alias for den raske starteren. Menyen åpner ett
scenario om gangen. Alle rolle-vinduene i scenarioet har egne cookies, men
bruker samme origin. Lukk alle vinduene for å stoppe scenarioets Next/Chromium
og gå tilbake til menyen; et nytt valg starter devserveren raskt på nytt uten
reset, seed eller Auth-oppsett. `Q` avslutter menyen. Lokal Supabase og de
syntetiske endringene blir stående.

Scenarioer kan også åpnes direkte:

```bash
npm run lab:list
npm run lab -- --scenario=help
npm run lab -- --scenario=rewards
```

Direkte modus avsluttes når scenarioets vinduer lukkes. Samtidig kjøring av
`test:e2e:*`, `qa:a1:desktop` eller en annen lab støttes ikke; disse bruker den
samme lokale Supabase-stacken og/eller port 3100.

## Scenariokart

| ID | Startflater | Hensikt |
| --- | --- | --- |
| `day` | Visuell faglærer + Visuell elev | Dagens økter og oppgaver i samme klasse |
| `subjects` | Visuell faglærer + Visuell elev | Fagoversikt og fagspesifikke oppgaver |
| `help` | Eier/lærer + Hjelpeelev | Åpne/lukke kø, elevhånd og oppgaveknytning |
| `help-team` | Eier + Hjelpelærer + Hjelpeelev | Privat prioritering, overføring og frigivelse |
| `return` | Eier/lærer + Returelev | Fullført oppgave, retur og tilbakeført poeng |
| `rewards` | Eier/lærer + Belønningselev | Milepæl, blomsterclaim, angre/retur og farmingvern |
| `iterations` | Visuell faglærer + D2-elev | Flytt samme oppgave eller send ny iterasjon |
| `access` | Eier + vikar | Gi, bruke, utløpe og trekke tilbake tilgang |
| `garden-preview` | Visuell hageelev | Ferdig read-only utgangspunkt for blomsterhagen |
| `progress-preview` | Visuell progresjonselev | Poeng, nivå og fremdriftsdock |

Registryen i `scripts/e2e/manual-test-scenarios.mjs` er den ene tekniske kilden
til meny, allowlist, storage state, rute og forventet hovedoverskrift. Laben
bruker eksakt rollebeskyttet rute som Auth-gate, men lar produktoverskriften
endres under UI-arbeid. Den formelle QA-starteren beholder streng kontroll av
både rute og forventet overskrift.

## Datalevetid og eksplisitt reset

Verkstedet er stateful med hensikt. Opprettede oppgaver, statusendringer,
hjelpekøhandlinger, poeng og tilgangsendringer beholdes når du bytter scenario
eller starter laben på nytt. Den eneste normale nullstillingen er den tydelige
kommandoen `npm run lab:reset`, som bruker `supabase db reset --local`.

Gjenbruk følger prinsippet **gjenbruk eller stopp**, aldri **gjenbruk eller
skjult reset**. Starteren ber om ny reset når:

- migrasjoner, seed, lokal Auth-konfig eller scenario-/auth-fixturekode er
  endret;
- den faste syntetiske databasegenerasjonen ikke matcher;
- en browsertilstand er manglende eller endret uten ryddig lagring;
- forrige økt ble avbrutt med `Ctrl+C`, krasj eller tvungen lukking;
- fixture-datoen ikke lenger er dagens dato i `Europe/Oslo`;
- den aktuelle undervisningsøkten for dags-, fag- eller hjelpekøscenariet er
  utløpt.

Dette kan bety at en lang utforskingsdag trenger en eksplisitt reset før ny
dags-, fag- eller hjelpekørunde. Det er valgt fremfor å skjule at scenarioets
tidsforutsetning er utløpt. I den interaktive menyen blir bare det utløpte
scenariet avvist, og du kommer tilbake til menyen slik at tidløse scenarioer
fortsatt kan utforskes. Direkte modus avsluttes med samme resetveiledning.

## Auth, cache og sikkerhetsgrense

- Første reset bruker ekte lokal Supabase Auth, elevinnlogging og TOTP/AAL2.
  Det finnes ingen runtime-bypass, testendepunkt eller klientstyrt rollevalg.
- Labens browsertilstander ligger separat under ignorerte
  `playwright/.auth/lab/`; ordinære E2E- og QA-states endres ikke av fri
  utforsking.
- Cachemappen og state-filene opprettes med private katalog-/filmodi der
  operativsystemet støtter det. Symlink eller junction i cachebanen avvises før
  tokens eller runtime-filer skrives.
- Browsertilstander inneholder lokale sessions-/refresh-tokens og skal behandles
  som hemmelige selv om alle brukere er syntetiske. De committes aldri.
- Manifestet inneholder bare fingerprints, fixture-dato, fast syntetisk
  eiergenerasjon og hashes av state-filene. Lokale Supabase-nøkler og rå tokens
  skrives ikke dit.
- Studentkode-pepperen må følge den stateful databasen og ligger derfor i en
  separat ignorert runtime-fil og bindes til det hemmelighetsfrie manifestet
  med en hash. Passord, elevkoder og TOTP-hemmeligheter persisteres ikke.
- Gyldige refresh-tokens kan roteres under bruk. Hver context lagres atomisk
  etter vellykket sidenavigasjon og ved ryddig lukking, og manifestet oppdateres
  sist.
- Før et rollevindu presenteres, og på nytt før en interaktiv økt erklæres
  ryddig avsluttet, bekreftes faktisk Supabase-bruker-ID mot scenarioets faste
  syntetiske aktør. Voksen-states med `aal2` i navnet må i tillegg ha faktisk
  AAL2. Feil identitet eller nivå lar cachen stå avbrutt og krever reset.
- Alle database- og API-mål utledes fra lokal `supabase status` og må være
  eksakt loopback på port 54321/54322. `.env.local`, linket prosjekt og
  pilotdatabase er aldri fallback.
- Next bindes til `127.0.0.1:3100`; en ukjent prosess på porten stoppes aldri
  automatisk.
- En eksklusiv lock tas før lokal Supabase kan startes eller resettes. En lock
  etter krasj slettes aldri automatisk: kontroller først at ingen runner kjører,
  og fjern deretter `playwright/.auth/local-runner.lock` manuelt.

## Utforsking kontra manuell QA

| Egenskap | `npm run lab` | `npm run qa:a1:desktop` |
| --- | --- | --- |
| Formål | Fri UI/UX- og flytutforsking | Navngitt kontrollpunkt med bevislogg |
| Data | Beholdes og kan være mutert | Fersk, deterministisk lokal fixture |
| Oppstart | Cachet Auth/MFA og valgt scenario | Reset, produksjonsbuild og fast trevindusoppsett |
| Resultat | Ingen beståttstatus | Manuelt resultat føres i A1-protokollen |
| Browser states | Egen `playwright/.auth/lab/` | Ordinær E2E/QA-cache |

Når produkteier ber om formell QA, finnes dermed inngangen og rolleisolasjonen
allerede. Det som legges til er den konkrete protokollen, kandidaten,
viewports/enhetene og bevisføringen – ikke en ny auth- eller testarkitektur.

## Overførbare arbeidsvalg

1. Skill et statefult utforskingsmiljø fra deterministiske test- og
   QA-fixtures.
2. La første oppsett være ekte nok til å dekke Auth/autorisasjon; optimaliser
   gjenbruk, ikke sikkerhetsmodellen.
3. Gjør destruktiv reset eksplisitt og la brukerens manuelle endringer bestå.
4. Ha en data-drevet scenarioregistry med rute, rolle, forventet sideidentitet
   og stabil CLI-id.
5. Cache bare det som må gjenbrukes, skill hemmeligheter fra manifest og
   invalidér på relevante fixturekilder – ikke på enhver UI-commit.
6. Lagre roterende browserøkter ved ryddige kontrollpunkter og behandle avbrudd
   som ukjent tilstand.
7. Behold formell QA som en opt-in-prosess med egen protokoll og bevislogg.

## Verifikasjonslogg 17. juli 2026

- 14 av 14 målrettede option-, scenario-, cache-, fingerprint- og låsetester
  bestod. Typecheck og målrettet lint var grønne.
- Playwright-prosjektgrafen viste to tester for fresh lab og formell QA
  (`auth-setup` + manual), men bare én manualtest for reuse. Dermed kan
  auth-setup ikke kjøres ved et uhell i den raske banen.
- Første integrasjonsforsøk fullførte lokal reset og seed, men stoppet før
  cachepublisering fordi første Next-dev-serverhandling overskred den gamle
  15-sekunders loginfristen. Dev-only-fristen ble økt til 45 sekunder; den
  strengere ordinære E2E/QA-fristen ble ikke endret.
- Retest med `lab:reset -- --lab-check --scenario=day` bestod fra lokal reset:
  ekte Auth/MFA-oppsett 1 av 1 på ca. 1,3 minutter og isolert lærer/elev 1 av 1
  på 13 sekunder. Manifestet ble publisert først etter grønt Auth-oppsett.
- Ny `lab -- --lab-check --scenario=subjects` bestod 1 av 1 på 23 sekunder.
  Loggen inneholdt ingen reset, seed eller auth-setup.
- Reuse-matrisen bestod for `help-team`, `return`, `rewards`, `iterations`,
  `access`, `garden-preview` og `progress-preview`. Den omfattet én, to og tre
  samtidige isolerte roller samt både aktuelle og fremtidige
  øktforutsetninger.
- En midlertidig syntetisk klasse ble satt inn før reuse-matrisen. Den fantes
  fortsatt etter alle syv starter (`count = 1`) og ble deretter slettet. Dette
  beviser at den raske banen bevarer manuelle databaseendringer.
- Cachen ble eksplisitt markert som avbrutt. Neste reuse ble avvist med
  resetveiledning, og den faste eierens `created_at` var identisk før og etter;
  ingen skjult database-reset skjedde. Cachen ble deretter satt tilbake til
  clean state via den testede atomiske manifestbanen.
- Sikkerhetsrevisjonen førte til private filmodi, parent-symlink-/junctionvern,
  hashbinding av runtime-pepper, fail-closed manuell stale-lock-opprydding og
  senere dirty-markering. De nye negative testene inngår i de 14 over.
- `npm run test:e2e:auth` bestod 14 av 14 fra tom lokal database, inklusive
  Auth/MFA, rolleisolasjon, elevfag, XP/angre, retur, ukeplan, belønning og
  D2-iterasjoner.
- Endelig `npm run verify:checkpoint` bestod med 77 av 77 enhetstester, lint,
  kjerne-lint, typecheck, produksjonsbuild, 4 av 4 offentlig Playwright og
  eksisterende high/critical-auditgrense. To kjente moderate, transitive
  PostCSS-funn via Next er uendret.
- Etter den ordinære Auth-resetten ble format-2-cachen bygget på nytt gjennom
  den herdede filbanen. `day` bestod fresh og `help` bestod via reuse på 24,5
  sekunder. Samlet er alle ti registry-scenarioer åpnet og innholdskontrollert.
- Den siste auth-revisjonen førte til eksplisitt bruker-ID- og AAL2-kontroll
  før vinduene presenteres og før clean close, samt avvisning av arvet alternativ
  auth-mappe utenfor lab. Ny fresh `help` bestod med eier/elev, og `access`
  bestod deretter via reuse med eier/vikar på 13,5 sekunder. Sluttstatus er 11
  states, `dirtySince = null`, ingen lock og ingen tempfiler.
