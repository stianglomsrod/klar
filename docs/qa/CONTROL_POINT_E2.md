# Kontrollpunkt E2 – intern prioritering og overlevering i hjelpekøen

**Status:** Verifisert lokalt 17. juli 2026

**Epic:** [E03 – Kontekstuell hjelpekø](../epics/E03_CONTEXTUAL_HELP_QUEUE.md)

**Kontrakt:** [Domenekontrakten](../product/DOMAIN_CONTRACT.md), særlig § 8

## Mål for slicen

E2 bygger videre på E1s øktbundne kjernekø. En autorisert ansatt skal kunne
endre den interne rekkefølgen atomisk og reviderbart. Den ansatte som hjelper
en elev, skal kunne frigi forespørselen tilbake til køen eller overføre den
direkte til en annen navngitt ansatt med aktiv tilgang til samme klasse.

Elevflaten endres ikke. Eleven ser fortsatt bare hånden og «Står i kø», aldri
plass, ventetidsløfte, ansvarlig ansatt, grunnkode eller intern omprioritering.

## Kildegrunnlag og valgte referanser

- Produkteierens talespor i videoomvisningen er historisk intensjonskilde:
  - 00:32–00:37 forklarer at læreren åpner køen i klassekontekst;
  - 07:05–07:11 viser det historiske, nå forkastede elevnummeret;
  - 07:14–07:24 forklarer at læreren kan flytte en elev frem uten at elevene
    nødvendigvis ser det.
- [00:33 – køkontroll](../../Prototypen/Videoomvisning/00-00-33-help-queue-toggle.png)
  bevarer en enkel voksenhandling, men 3.0 binder den til eksakt økt.
- [07:06 – elevens kø](../../Prototypen/Videoomvisning/00-07-06-student-queue.png)
  bevarer footerhånden; «Nr 1» er et eksplisitt antimønster.
- [07:14 – lærerens kø](../../Prototypen/Videoomvisning/00-07-14-teacher-queue.png),
  [lærerlisten](../../Prototypen/L%20hjelpekøliste.png) og
  [den historiske 3→1-flyttingen](<../../Prototypen/L%20flytter%20elev%20opp%20på%20hjelpekølista%20uten%20at%20elevene%20trenger%20å%20vite%20det%20jf%20WS3%20-%20Dette%20var%20en%20bug%20som%20ble%20en%20feature.jpg>)
  bevarer den kompakte voksenlisten, ventetid og stille prioritering.
  Drag-and-drop er ikke en nødvendig eller autoritativ kontroll.
- Masteroppgaven, særlig PDF-side 36–45, 50–60 og 126–130, beskriver køen som
  en lavterskel kanal for hjelp og stille omprioritering som en validert
  transformasjon. Synlig rang og lange køer kan samtidig skape uro.
- `origin/master` brukes bare som historisk flytreferanse. Klientmutasjoner,
  `Promise.all`-reorder, elevsynlig nummer og rang på elevressursen porteres
  ikke.

## Produktbeslutninger for E2

1. Bare den ansatte som eier en aktiv claim, kan frigi eller overføre den.
   E2 har ikke force-takeover eller målaksept.
2. Overføring kan bare gå til en annen navngitt voksen med aktivt
   klasseoppdrag og `help_queue.manage` ved commit. Rolleetiketten er
   irrelevant; vikar er en fullverdig målaktør.
3. Ventende og overtatte forespørsler beholder én samlet intern rang. Claim,
   release og transfer endrer ikke forespørselstid eller rang.
4. Manuell flytting bruker én av tre private, strukturerte grunnkoder:
   `support_needed_now` («Trenger støtte nå»), `short_clarification`
   («Rask avklaring») eller `staff_coordination` («Avtalt mellom ansatte»).
   Det lagres ingen fritekst om eleven.
5. «Flytt først», «Flytt opp» og «Flytt ned» er de autoritative kontrollene
   for tastatur og berøring. Drag er ikke del av denne slicen.

## Akseptansekriterier

- [x] Hver aktiv øktforespørsel har én entydig intern plass i en separat,
  staff-only ressurs. Oppgradering bruker deterministisk FIFO etter
  `requested_at, id`, og nye forespørsler legges sist.
- [x] Browserroller kan ikke lese eller skrive rangressurs, kommando-receipts
  eller køtabeller. E2-kommandoene kan bare kjøres av service role etter AAL2,
  aktivt oppdrag, eksakt organisasjon/klasse/økt og `help_queue.manage`.
- [x] «Først», «opp» og «ned» beregnes fra autoritativ serverrekkefølge og
  utføres i én transaksjon med forventet `activity_version`. En stale eller
  samtidig taper endrer ingen rang, audit, signal eller receipt.
- [x] Første rad kan ikke flyttes først/opp og siste rad kan ikke flyttes ned.
  Et gyldig no-op er idempotent uten audit- eller signalstøy.
- [x] En reell flytting logger aktør, tidspunkt, kø, forespørsel,
  før-/etterposisjon og strukturert grunnkode. Ansatte ser hvem som sist
  prioriterte, når og hvorfor; elever kan ikke observere metadataene.
- [x] Release krever gjeldende eier, gjør `claimed → waiting`, nullstiller
  eierskapet og bevarer rang, oppgavekontekst og `requested_at`.
- [x] Transfer krever gjeldende eier og et annet, aktivt og autorisert
  måloppdrag. Forespørselen forblir `claimed`, får ny eier og beholder rang,
  oppgavekontekst og `requested_at`.
- [x] Release/transfer virker i `open` og `closing`, aldri etter `closed`.
  Hvis målaktørens tilgang senere forsvinner, fører eksisterende reconcile
  forespørselen tilbake til `waiting` med bevart rang.
- [x] Reorder, release og transfer er receipt-idempotente. Samme kommando-ID
  med samme fingerprint gir samme resultat; annen payload avvises uten
  sideeffekt.
- [x] Kompositt-FK binder alle levende signaler til samme organisasjon og
  klasse som køøkten. Skjulte staff-handlinger bruker bare et staff-lesbart
  invalideringssignal uten rang, grunn, eier eller navn.
- [x] To separate AAL2-ansattkontekster ser autoritativ reorder,
  release/transfer og måltilgang. Elev-DOM og tilgjengelig tre lekker aldri
  intern plass, ansatt eller grunnkode.
- [x] Flytteknapper og overleveringsdialog har norske navn, synlig fokus,
  fokusretur, statusmelding, Escape/lukk og minst 44 × 44 mål på berørte
  touchflater.
- [x] Lærerflyten består tastatur, axe A/AA, reduced motion, horisontal
  overflow, 200 %-reflow-proxy og 360×640, 640×360, 768×1024, 1024×768 og
  1440×900 i Chromium og WebKit.
- [x] Tom database og representativ E1→E2-oppgradering består grants, RLS,
  backfill, rollback, vikar, feil scope, utløpt/tilbakekalt tilgang,
  idempotens og relevante reorder-/eierskapsrace.

## Ikke-mål

- Ingen endring av elevens kømodell eller elevnummer.
- Ingen gruppekø, forhåndsåpning, global livewidget eller automatisk
  prioritering.
- Ingen chat, notat, fri begrunnelse, sensitive kategorier eller ventetidsløfte.
- Ingen force-takeover, målaksept, offline-mutasjon eller optimistisk
  autoritet.
- Ingen påstand om at E03, E06 eller den fysiske enhetsporten er ferdig.

## Baseline før kodeendring

| Port | Resultat 17. juli 2026 |
| --- | --- |
| Køenhetstester | Bestått 4/4. |
| Målrettet E1, Chromium | Bestått 3/3 etter lokal database-reset. |
| Git | Ren `3.0`, sju commits foran `origin/3.0`. |

## Levert atferd og sikkerhetsmodell

- `help_queue_order` holder den private, sammenhengende ansattrekkefølgen
  separat fra elevens forespørsel. Backfill er deterministisk, og alle nye
  forespørsler legges bakerst.
- Reorder, release og transfer er service-only RPC-er med eksplisitt
  organisasjons-, klasse-, kø-, versjons-, eierskaps- og receipt-kontroll.
  Serverhandlingen validerer AAL2 og `help_queue.manage` både før og etter
  operasjonen.
- `read_help_queue_staff_snapshot_v1` leser kø, orden og aktive forespørsler i
  ett MVCC-snapshot. RPC-en er `SECURITY INVOKER`, har tomt `search_path` og
  kan bare kjøres av `service_role`; browserroller har ingen direkte tilgang.
- Ansattflaten viser rang, ventetid, oppgavekontekst, eier og siste private
  prioriteringsgrunn. Elevflaten er uendret og viser aldri disse dataene.
- Reorder har egne kontroller for «først», «opp» og «ned». Eieren kan frigi
  eller overføre til en annen aktiv, autorisert ansatt i samme klasse.

## Avvik og retester

| Avvik | Årsak og retting | Retest |
| --- | --- | --- |
| Fokus gikk til seksjonsoverskriften etter prioritering. | Runtime-sporet viste at fokussøket brukte `data-help-request-priority`, mens raden eksponerte `data-help-priority`. Attributtet ble gjort entydig. | Fokus ble bevart gjennom etterfølgende RSC/DOM-oppdateringer i Chromium og WebKit. |
| WebKit kunne vise en Next-feil når to elever ba om hjelp 27,1 ms fra hverandre. | Tre raske klientretries kunne fortsatt kombinere kø, orden og forespørsler fra ulike commits. Den delte lesingen ble erstattet av én atomisk snapshot-RPC, med streng validering av scope, ID-sett, versjon og sammenhengende posisjoner. | Hele hjelpekøflyten bestod 4/4 i både Chromium og WebKit. En kildegrensetest hindrer gjeninnføring av delt lesing. |
| En eldre capability-test kalte den tilbakekalte `claim_student_help_v2`. | Testen ble oppdatert til v3 og sender forventet eierskapsversjon. Databaseporten verifiserer samtidig at v2 forblir tilbakekalt. | Full ansatt-E2E bestod 9/9. |
| Første 200 %-reflow-endring traff feil viewport-løkke i testen. | Viewporten ble flyttet til den avgrensede reflow-testen, uten å endre screenshot-baselines automatisk. | Reflow-proxy og hele viewportmatrisen bestod i begge motorer. |

## Verifikasjon etter implementering

| Port | Resultat 17. juli 2026 |
| --- | --- |
| `npm run test:db:staff` | Bestått fra tom database og representativ E1→E2-oppgradering, inkludert RLS/grants, feil scope, rollback, idempotens og concurrency. |
| Målrettet hjelpekø-E2E | Bestått 4/4 i Chromium og 4/4 i WebKit. |
| `npm run test:e2e:staff` | Bestått 9/9 i Chromium. |
| `npm run test:e2e:auth` | Bestått 8/8. |
| `npm run verify:checkpoint` | Bestått: lint, kjernelint, typecheck, 51 tester i 19 suiter, produksjonsbuild og offentlig Playwright 4/4. |
| Tilgjengelighet og visuell QA | Axe A/AA, tastatur, fokusretur, reduced motion, overflow og 200 %-reflow-proxy bestått ved alle målviewports. |
| `npm audit` | To moderate funn i PostCSS via Next.js. Foreslått tvangsfiks ville nedgradert til inkompatibel Next 9.3.3 og ble derfor ikke kjørt; funnet følges som avhengighetsarbeid. |

## Visuell evidens

- [360×640 – fullskjerm prioriteringsdialog](evidence/E2/staff-priority-dialog-360x640.png)
- [640×360 – mobil landskap](evidence/E2/staff-priority-dialog-640x360.png)
- [720×450 – 200 %-reflow-proxy](evidence/E2/staff-priority-dialog-720x450.png)
- [768×1024 – iPad portrett](evidence/E2/staff-priority-dialog-768x1024.png)
- [1024×768 – iPad landskap](evidence/E2/staff-priority-dialog-1024x768.png)
- [1440×900 – desktop](evidence/E2/staff-priority-dialog-1440x900.png)

E2 har automatisert WebKit- og viewportbevis, men påstår ikke en ny fysisk
iPad-/VoiceOver-runde. Den fysiske enhetsporten for hele E03 står derfor åpen.
