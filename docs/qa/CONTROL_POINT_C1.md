# Kontrollpunkt C1 – første klasseuke og øktstyrt elevdag

**Status:** Verifisert lokalt 17. juli 2026

**Epics:** [E04 – Smart Import og ukeplaner](../epics/E04_SMART_IMPORT_AND_WEEKLY_PLANS.md) og [E01 – Elevens dag og oppgaveflyt](../epics/E01_STUDENT_DAY_AND_TASK_FLOW.md)

**Kontrakt:** [Domenekontrakten](../product/DOMAIN_CONTRACT.md), særlig §§ 4,
6 og 9

## Resultat

C1 etablerer den første autoritative klasseuken på 3.0-domenet. En ansatt med
AAL2, aktivt klasseoppdrag og `plan.publish` kan bygge tidsfestede økter med
eller uten oppgaver, kontrollere uke, dato, klokkeslett og oppgavetitler og
publisere revisjon 1 i én transaksjon. Publiserte uker vises i lærerflaten, og
byggeren orienterer mot første upubliserte uke.

Eleven får en Europe/Oslo-basert projeksjon av nærmeste forrige, aktuelle og
neste økt fra den aktive revisjonen. Aktuell økt er størst, forrige er tonet
ned og lukket, neste er kompakt og kan åpnes. Oppgaver fra gamle task-only-
flyter bevares uten oppdiktet provenance og ligger sekundært under «Andre
oppgaver».

## Kildegrunnlag og valgte produktgrep

- Produksjonsreglene følger domenekontrakten og E01/E04, ikke legacy-koden.
- Produkteierens egen fortellerstemme i videoen er primær intensjonskilde.
  [06:10 – elevens dag](../../Prototypen/Videoomvisning/00-06-10-student-home.png)
  underbygger fisheye-hierarkiet, og
  [09:41 – tolket plan](../../Prototypen/Videoomvisning/00-09-41-parsed-plan.png)
  underbygger menneskelig kontroll før publisering.
- `origin/master`, masteroppgaven og øvrige prototypebilder er brukt som
  historisk informasjonsarkitektur, ikke som datamodell eller pixel-golden.
- Ingen «I gang»-handling eller etter-skoletid-modus er innført.
- Neste økt og historiske løse oppgaver er gjort sammenleggbare for ikke å
  konkurrere med aktuell økt.
- Lik tekst i DOCX-parseren beholdes som separate forslag med varsel; importen
  sletter ikke lenger et mulig repetert arbeid lydløst.

## Invarianter og sikkerhetsgrenser

- Uken starter mandag og bruker alltid `Europe/Oslo`.
- Planen er unik per organisasjon, klasse og ukestart.
- Revisjon 1, revisjonsøkter, revisjonsoppgaver og tilknyttede
  oppgavedefinisjoner er uforanderlige etter publisering.
- Økt og planoppgave har stabile UUIDv4-nøkler; assignment peker på både stabil
  planoppgave og eksakt revisjonsoppgave.
- Historiske assignments beholder `null` i de nye provenance-kolonnene.
- En oppgave blir read-only-synlig for eleven ved lokal midnatt på øktdagen,
  ikke mandag for hele uken. Morgendagens innhold kan derfor ikke leses via
  RLS eller falle inn i «Andre oppgaver».
- Mottakerlisten tas én gang i publiseringstransaksjonen. En samtidig
  elevinnmelding får enten alle eller ingen av planens assignments, aldri en
  delmengde.
- Request-ID og fingerprint gir eksakt retry-idempotens. Semantisk identisk
  kandidat med ny request er no-op. Ulik kandidat for en allerede publisert
  uke avvises.
- Request- og klasse/uke-lås serialiserer samtidige publiseringer.
- Serveren autoriserer før og etter feil, og RPC-en låser og kontrollerer
  eksakt staff assignment og `plan.publish` på nytt.
- Browserroller har ingen direkte skrivegrant til plan-, oppgave- eller
  progresjonsdata. Intern projeksjon er service-role-only; elevwrapperen er
  bundet til innlogget elev og eksplisitt organisasjon.

## Verifiserte akseptansekriterier

- [x] Tom database kan bygges gjennom C1-migrasjonen.
- [x] Representativ oppgradering bevarer legacy-assignments med null
  provenance og oppretter ingen oppdiktet planhistorikk.
- [x] Første revisjon publiserer plan, økter, oppgaver, assignments,
  elevtilstand, receipt og audit atomisk.
- [x] Samme request, semantisk retry, ulike samtidige requests og ulike
  samtidige kandidater gir forventet idempotens/konflikt uten delgraf.
- [x] Samtidig elevinnmelding gir hele eller ingen plan.
- [x] Økt uten oppgave kan publiseres og projiseres.
- [x] Eksakte start-, slutt-, pause- og etter-siste-grenser bruker halvåpne
  intervaller fra samme databaseklokke.
- [x] Framtidig dagsoppgave er skjult av RLS før lokal øktdag.
- [x] Planprojeksjon krysser ikke organisasjonsgrense.
- [x] Lærerens UI-kontroll publiserer en virkelig plan og beviser hele
  databasegrafen, ikke bare en visuell mock.
- [x] Elev- og lærerflate har ingen ukjente axe A/AA-funn eller horisontal
  overflow ved 360×640, 640×360, 768×1024, 1024×768 og 1440×900.
- [x] Begge C1-flatene reflower uten horisontal overflow ved 720×450 som
  eksplisitt 200 prosent-proxy, også med WCAG-tekstavstand. Proxyen er ikke
  presentert som en fysisk zoomtest.
- [x] Sentrale kontroller har minst 44×44 CSS-piksler, review-fokus flyttes til
  overskriften, og feil får programmatisk fokus.
- [x] Reduced motion og tastaturflyten er bevart.

## Avgrensning og kjente restpunkter

C1 er ikke hele E04 eller E01:

- Bare første manuelle revisjon finnes. Senere revisjon, rollback og
  reaktivering er ikke implementert.
- DOCX-flyten gir redigerbare forslag til løse oppgaver. Den bevarer ikke
  tabellstruktur, økter, beskjeder, mål eller dokumentproveniens, og har ikke
  serverutkast, diff eller treveis reimport.
- Elevlisten snapshots ved publisering. En elev som meldes inn senere får ikke
  automatisk den allerede publiserte revisjonen. Pilotoperatøren må derfor
  ferdigstille elevlisten først til en autorisert backfill-/revisjonsflyt
  finnes.
- Valgfri tekst, lyd og bilde, oppgaveknyttet hånd, flytt, send ut på nytt,
  offlineflyt og opplesingskontroll gjenstår i E01/E03.
- Den eksisterende tekstlige hjelpekontrollen er fortsatt en mellomtilstand.
  Den avtalte hånden skal bare vises når en ansatt har åpnet kø for økten, og
  eleven skal ikke se køplass.
- Automatisert fem-viewport-QA erstatter ikke gjenværende fysisk mobil/iPad,
  VoiceOver/NVDA, safe-area og virtuelt tastatur i den samlede pilotporten.

## QA-artefakter

Alle bildene bruker syntetiske data og er lagret i repoet:

| Flate | 360×640 | 640×360 | 768×1024 | 1024×768 | 1440×900 |
| --- | --- | --- | --- | --- | --- |
| Elevdag | [mobil](./artifacts/control-point-c1/student-day-small-mobile.png) | [mobil landskap](./artifacts/control-point-c1/student-day-mobile-landscape.png) | [iPad portrett](./artifacts/control-point-c1/student-day-ipad-portrait.png) | [iPad landskap](./artifacts/control-point-c1/student-day-ipad-landscape.png) | [desktop](./artifacts/control-point-c1/student-day-desktop.png) |
| Lærerens kontroll | [mobil](./artifacts/control-point-c1/teacher-plan-review-small-mobile.png) | [mobil landskap](./artifacts/control-point-c1/teacher-plan-review-mobile-landscape.png) | [iPad portrett](./artifacts/control-point-c1/teacher-plan-review-ipad-portrait.png) | [iPad landskap](./artifacts/control-point-c1/teacher-plan-review-ipad-landscape.png) | [desktop](./artifacts/control-point-c1/teacher-plan-review-desktop.png) |

## Avvik, tiltak og retest

| Avvik | Tiltak | Retest |
| --- | --- | --- |
| Første SQL-versjon fikk PL/pgSQL-navnekollisjon og arvet for bred `service_role`-grant. | Valgte eksplisitt variable conflict-regel og revokerte alle tabellgrants før minste nødvendige `SELECT`. | Tom database, privilege-smoke og build bestod. |
| Test-Postgres kunne svare fra en kortvarig oppstartsprosess før endelig server var stabil. | Krevde seks sammenhengende vellykkede readiness-prober. | Samme tom-/upgrade-runner kjørte deterministisk. |
| Planoppgaver for senere dager ble synlige fra mandag og kunne havne i «Andre oppgaver». | Satte `visible_from` til lokal midnatt på øktdagen og lot compatibility-queryen hente bare `plan_task_id is null`. | Direkte authenticated RLS-test og elev-E2E bestod. |
| Elevlisten ble lest for hver oppgave og kunne gi en samtidig innmeldt elev bare siste del av planen. | Snapshottet og låste mottaker-ID-er én gang før oppgaveloopen. | Samtidig publisering/innmelding gav 0 eller alle 3 assignments. |
| UI og domene tillot i praksis ikke en økt uten oppgave. | Tillot 0–20 oppgaver i klient, tjeneste og SQL og viste eksplisitt tomtilstand. | SQL-publisering og elevprojeksjon av oppgaveløs økt bestod. |
| Bytte av uke lot øktdatoen bli stående i gammel uke. | Bevarte ukedagsforskyvningen når ukestart endres og validerte mandag, ukegrenser, sluttid og overlapp før review. | UI-publisering og fem viewport-runder bestod. |
| Første E2E-retest forventet eldre løse oppgaver åpne, og én label matchet både «Start» og «Uken starter». | Testene åpner nå den bevisst sekundære seksjonen etter reload og bruker eksakt tidslabel. | Elevfullføring/angre og ansattretur bestod. |
| Publiseringsbeviset søkte audit på plan-ID i stedet for kontraktens revisjons-ID. | Rettet bare bevis-spørringen til aktiv revisjon. | Chromium auth-E2E bestod 8/8 med hele revisjonsgrafen og auditthendelsen. |
| WebKit returnerte ikke fokus til oppgavekortet etter Escape fra fullføringsdialogen. Safari fokuserer ikke nødvendigvis en knapp ved museklikk, så `document.activeElement` var ikke et sikkert returpunkt. | Lagret den faktiske utløserknappen fra klikkhendelsen og sendte den eksplisitt til dialogens fokusretur. | Målrettet WebKit-smoke bestod 8/8, deretter bestod full WebKit-matrise 34/34 med den opprinnelige fokusassertionen uendret. |
| Kontrollsteget avmonterte den fokuserte knappen ved retur eller publisering, og skjemaet for eldre enkeltoppgaver kunne forveksles med klasseuken. | Returnerte fokus til ukefeltet ved redigering og til status ved publisering. Merket den separate flyten konsekvent som «løs oppgave» og forklarte at den står utenfor klasseuken. | Fem-viewport lærer-E2E kontrollerer redigeringsfokus; auth-E2E kontrollerer publiseringsfokus, og ansattporten kontrollerer den separate løse oppgaven. |
| Første sikkerhetsbevis dekket bare gyldig klasseukepublisering, og framtidsoppgaven kunne ikke skille korrekt øktmidnatt fra feil ukemandag. | La til stjålet aktør, virkelig klasse utenfor scope, tilbakekalt oppdrag, manglende `plan.publish`, stale serverhandling og eksakt `visible_from`. En tvungen feil ved siste auditinnsetting sammenligner hele grafen før/etter og retryer samme request etterpå. | Tom-/oppgraderingsporten avviste alle negative kall uten delgraf; auditfeilen rullet alt tilbake og samme request publiserte deretter nøyaktig én graf. Ansatt-E2E bestod 6/6. |
| Den tidsstyrte E2E-fixturen kunne miste aktuell økt dersom en lang matrise passerte lokal midnatt, og en søndag krevde ny uke. | Publiserer en morgendagsguard gruppert per lokal mandagsuke, med lokale kalenderoperasjoner fremfor 24-timers aritmetikk. Kandidater og requests er separate når søndag går over i mandag. | Fire enhetstester dekker vanlig uke, søndag–mandag og begge DST-døgn; full Chromium/WebKit bruker samme fixture. |
| C1 hadde fem viewports, men bare tilgangsflaten hadde en eksplisitt 200 prosent-reflow-proxy. | La elevdagen og lærerens kontrollsteg kjøre ved 720×450 med WCAG-tekstavstand, trykkmål, axe og overflow-kontroll. | Visuell Chromium-matrise bestod 24/24; begge nye C1-prosjekter var grønne. |
| Første utvidede WebKit-runde rapporterte `Load failed` da testen erstattet dokumentet mens en Next.js RSC-oppdatering etter «Angre fullføring» fortsatt var i luften. Funksjons- og databasebevisene var allerede bestått. | Beholdt streng runtime-feilkontroll og ventet eksplisitt på nettverksro før full reload, slik at testen ikke selv avbryter en legitim oppdatering. | Målrettet WebKit-smoke bestod 8/8 uten filtrering av feilen; endelig full WebKit-runde bestod 36/36. |

Ingen ekstern eller linket Supabase ble mutert. Alle fixtures, skjermbilder og
logger er syntetiske, og ingen passord, elevkode, TOTP-hemmelighet eller nøkkel
er lagret i repoet.

## Verifikasjonsresultat

| Port | Resultat 17. juli 2026 |
| --- | --- |
| `npm run verify:checkpoint` | Bestått: begge lintnivåer, TypeScript, 44/44 enhetstester, produksjonsbuild og 4/4 offentlig Chromium-E2E. Ingen high/critical avhengighetsfunn; to moderate PostCSS-funn via Next.js er registrert. |
| `npm run test:db:staff` | Bestått fra tom database og representativ oppgradering, inkludert RLS/RPC/grants, idempotens, konfliktløp, samtidighet og legacy-provenance. |
| `npm run test:e2e:auth` | Bestått 8/8 i Chromium, inkludert atomisk UI-publisering og autoritativ elevprogresjon. |
| `npm run test:e2e:staff` | Bestått 6/6 i Chromium for owner, vikar, utløp, tilbakekalling, redusert kapabilitetsprofil og kontrollhandlinger. |
| `npm run test:e2e:visual` | Bestått 24/24 i Chromium. Elevdag og lærerreview er kontrollert for axe A/AA, overflow og trykkmål i fem viewports og ved C1-spesifikk reflow-proxy. |
| `npm run test:e2e:full` | Bestått 36/36 i Chromium på den endelige kodekandidaten. |
| `npm run test:e2e:full:webkit` | Bestått 36/36 etter RSC-/fokusretest; inkluderer offentlig, elev, lærer, ansatt, fem viewports og tre eksplisitte 200 prosent-reflow-proxyer. |

Portene bruker lokal Supabase på loopback og syntetiske fixtures. Automatisert
WebKit og viewport-QA endrer ikke de fysiske restpunktene som er listet over.
