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
- syntetisk fixture med eier/AAL2-oppsett, elev, klasse og oppgaver;
- separate Playwright storage states for lærer og elev;
- offentlig smoke, autentisert smoke og visuell matrise ved 360×640, 640×360,
  768×1024, 1024×768 og 1440×900;
- axe-, overflow-, runtime- og rolleisolasjonshjelpere;
- visuell QA-mal og deterministisk `npm run verify:checkpoint`.

## Sikkerhetsbevis

- Runneren godtar bare `http://127.0.0.1:54321` eller
  `http://localhost:54321`.
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
| `npm run test:e2e` | Rask offentlig Chromium-smoke uten lokal Supabase |
| `npm run test:e2e:auth` | Lokal autentisert elev-/lærer-smoke |
| `npm run test:e2e:visual` | Ti screenshot-/axe-kjøringer på fem målviewports |
| `npm run test:e2e:full` | Offentlig, autentisert og visuell Chromium-port |
| `npm run test:e2e:full:webkit` | Samme autentiserte port i WebKit |
| `npm run verify:checkpoint` | Diff, check, build, offentlig E2E og produksjonsaudit |

## Verifikasjonsstatus

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

## Publiseringsport for prototypebilder

Produkteier bekreftet 15. juli 2026 at navn, e-post og eksempeltekst i
referansebildene tilhører mockbrukere. Binærbildene, kollasjene og det sanerte
tekstmanifestet kan derfor inngå i kontrollpunktet som syntetiske historiske
referanser. De skal fortsatt ikke brukes som fixtures eller dokumentasjon av
virkelige elever.
