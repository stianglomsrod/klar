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
- separat `npm run dev:roles` som gjenbruker samme sikkerhetsgrense, starter
  loopback-bundet Next-utviklerserver med hot reload og åpner isolerte lærer-
  og elevvinduer uten auth-bypass;
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
- Testpassord, pepper og TOTP-hemmelighet opprettes per kjøring og logges ikke.
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
| `npm run dev:roles` | Fersk lokal, syntetisk lærer-/elevøkt i to isolerte Chromium-vinduer med hot reload |
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

## Lokal rolleutvikling

`npm run dev:roles` er en utviklerinngang, ikke et nytt produktendepunkt. Den
bruker den samme lokale resetten, syntetiske seeden, negative signup-kontrollen,
ekte elevinnloggingen og ekte MFA/AAL2-oppsettet som den autentiserte E2E-
suiten. I utviklermodus hoppes bare produksjonsbygget over, og Playwright
starter i stedet `next dev` med Webpack og eksakt loopback-binding. Den
formelle `npm run qa:a1:desktop` beholder sitt tidligere produksjonsnære
trevindusoppsett og sin egen manuelle bevisprotokoll.

Utviklerøkten åpner bare den syntetiske læreren og eleven i samme klasse. De
har separate ignorerte storage states under `playwright/.auth`, men bruker
samme origin; logging ut eller navigering i ett vindu endrer ikke den andres
cookie-sesjon. Tilfeldige credentials opprettes på nytt for hver reset og
vises aldri. Å lukke vinduene stopper appserveren, mens lokal Supabase må
stoppes eksplisitt når den ikke lenger skal brukes.

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

## Publiseringsport for prototypebilder

Produkteier bekreftet 15. juli 2026 at navn, e-post og eksempeltekst i
referansebildene tilhører mockbrukere. Binærbildene, kollasjene og det sanerte
tekstmanifestet kan derfor inngå i kontrollpunktet som syntetiske historiske
referanser. De skal fortsatt ikke brukes som fixtures eller dokumentasjon av
virkelige elever.
