# Klar 3.0 – arbeidsregler for agenter

## Arbeidskopi og omfang

- Arbeid i denne utsjekken på `C:\Users\x_ray\kode 2026\klar-3.0`. Ikke bruk
  OneDrive-kopier av prosjektet.
- Kontroller `git status --short --branch` før og etter en leveranse. Bevar
  brukerens eksisterende endringer og hold uvedkommende filer utenfor commit.
- Velg én avgrenset vertikal slice om gangen. Unngå megacommits og parallelle
  skrivere i de samme kildefilene.
- `archive/2x-ui` og `supabase-2x` er kun historiske referanser. Ikke importer
  gammel datatilgang, RLS, klientmutasjoner eller privilegerte handlinger.

## Autoritative kilder

For målproduktet gjelder denne rekkefølgen:

1. `docs/product/DOMAIN_CONTRACT.md`;
2. relevant epic i `docs/epics/` og `docs/IMPLEMENTATION_ROADMAP.md`;
3. `docs/product/UI_UX_REFERENCE.md`;
4. kurateringen i `Prototypen/Bildeoversikt.md` og relevante skjermbilder;
5. historisk 2.x-kode.

README, pilotrunbook, kode og tester beskriver hva som faktisk er tilgjengelig
nå. Ikke presenter planlagt funksjon som implementert. Ved en reell konflikt i
produktflyt eller sikkerhetsmodell: stopp slicen og be om en produktavgjørelse.

## Sikkerhets- og datagrenser

- Bruk bare syntetiske data i lokal utvikling, fixtures, screenshots og logger.
- Legg aldri passord, elevkoder, TOTP-hemmeligheter, dokumentinnhold eller
  Supabase-nøkler i Git, logger eller delte artefakter.
- Ikke muter et linket eller eksternt Supabase-prosjekt uten en uttrykkelig
  instruksjon som navngir miljøet. E2E-runneren skal bare godta loopback-URL.
- Behold voksenhandlinger bak AAL2 og eksplisitt autorisasjon. All tilgang skal
  være organisasjons- og klasseavgrenset.
- Hold browserklienter read-only mot pilottabellene. Status, XP, belønning, kø,
  plan og tilgang skal muteres gjennom autoriserte serveroperasjoner.
- Nye databaseressurser skal leveres som migrasjoner, få eksplisitt RLS/grants
  og kunne bygges fra tom database.

## Implementeringsmåte

- Bruk `$klar-loop` for en hel slice.
- Skriv akseptansekriterier og velg konkrete prototypebilder før kodeendring.
- Implementer domeneinvarianter, autorisasjon og atomiske operasjoner før UI
  når slicen endrer data.
- La hovedagenten eie kodeendringene. Bruk parallelle agenter primært til
  read-only gjennomgang av domene/sikkerhet, tester og visuell QA.
- Oppdater relevant epic eller kontrakt i samme commit når verifisert atferd
  endrer dokumentert status.
- Lag små, grønne commits ved naturlige kontrollpunkter. Push bare når brukeren
  ber om det.

## UI, UX og tilgjengelighet

- Prototypebildene er semantiske referanser, ikke pixel-golden-mastere.
  Sammenlign hierarki, hovedhandling, kognitiv belastning, symbolbruk og tone.
- Ikke kopier kjente antimønstre: elevens kønummer, informasjonstett
  «halvveis»-modal, angstskapende arkivbadge, hover-only eller drag-only.
- Kontroller relevante flyter ved 360×640, 640×360, 768×1024, 1024×768 og
  1440×900. Mobil er en egen komposisjon, ikke en krympet desktop.
- Kontroller tastatur, synlig fokus, reflow ved 200 %, reduced motion,
  horisontal overflow og axe A/AA. Elevens sentrale trykkmål skal være minst
  44×44 px.
- Bruk samme origin og separate Playwright browser contexts/storage states for
  elev og ansatt. Ikke isoler roller med `localhost` kontra `127.0.0.1`.
- Oppdater aldri screenshot-baselines automatisk for å få en test grønn.

## Verifikasjonsporter

Bruk en rask indre port under arbeid og full port ved kontrollpunkt:

- målrettede tester for endret domene/UI;
- `npm run verify:checkpoint` før commit;
- relevante migrasjons- og RLS-tester ved databaseendring;
- `npm run test:e2e:auth` når Docker/lokal Supabase er tilgjengelig og slicen
  berører autentiserte flater;
- dokumentert visuell QA på relevante roller og målviewports.

Hvis lokal infrastruktur mangler, kjør alle porter som er mulige og merk den
reelle testen som uverifisert. Ikke bruk pilotdatabasen som snarvei.

## Definition of done

En slice er ferdig når:

- scoped akseptansekriterier har test- eller QA-bevis;
- negative tilgangstester og relevante retry-/samtidighetscaser består;
- ingen ukjente axe A/AA-feil, skjulte hovedhandlinger eller responsive avvik
  gjenstår;
- `git diff --check`, sjekk, build og relevante E2E-/databasetester er grønne;
- dokumentasjonen beskriver faktisk status;
- diffen er gjennomgått for hemmeligheter, uventede filer og scope-drift.

Stopp og replannér etter tre reparasjonsrunder, ved gjentatt identisk feil,
ved destruktiv dataendring eller når en ny produktbeslutning er nødvendig.
