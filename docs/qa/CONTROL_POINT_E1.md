# Kontrollpunkt E1 – øktbundet hjelpekø

**Status:** Verifisert lokalt 17. juli 2026

**Epic:** [E03 – Kontekstuell hjelpekø](../epics/E03_CONTEXTUAL_HELP_QUEUE.md)

**Kontrakt:** [Domenekontrakten](../product/DOMAIN_CONTRACT.md), særlig § 8

## Mål for slicen

E1 erstatter den nåværende, alltid synlige tekstboksen med en autoritativ kø
for én konkret undervisningsøkt. En ansatt åpner køen. Først da får eleven en
gjenkjennelig hånd i den felles footeren og inne i en åpen oppgave. Eleven ser
bare «Står i kø», mens ansatte kan ta og ferdigbehandle forespørsler.

Køen bruker overgangene `open → closing → closed`. `closing` stanser nye
forespørsler uten å skjule eller forkaste aktive forespørsler. Køen lukkes
først når alle aktive forespørsler er avsluttet eller eleven har meldt seg av.

## Verifisert resultat

- Køen er knyttet til eksakt organisasjon, klasse og publisert
  undervisningsøkt. Serveren eier åpning, stenging, forespørsel, avmelding,
  kontekst, overtakelse og løsning.
- Eleven får én rolig hånd i footer og oppgavedialog bare når den aktuelle
  køen er åpen, og ser aldri køplass, andre elever eller intern status.
- Ansattflaten viser FIFO, ventetid og valgfri oppgavekontekst. Samtidig claim
  har én vinner, mens rolle-, medlemskaps- og oppdragsendringer terminaliserer
  berørt tilstand atomisk.
- Realtime-tabellen inneholder bare private invalideringssignaler. Publiserte
  rader slettes ikke i normal livsløp; de anonymiseres som tombstones slik at
  en PostgreSQL `DELETE` aldri kan omgå RLS-beskyttelsen i Realtime.
- Reconnect og kanalendring utløser autoritativ serverlesing. Klienten muterer
  ingen køtabell direkte og forsøker ikke Next.js-refresh mens nettverket er
  eksplisitt frakoblet.

## Kildegrunnlag og beslutninger

- Produkteierens egen fortellerstemme i
  [videoomvisningen](../../Prototypen/Videoomvisning/README.md) er brukt som
  primær historisk intensjonskilde. Den beskriver at læreren åpner kø for en
  klasse og kan prioritere internt uten å vise eleven den faktiske
  rekkefølgen.
- [00:33 – lærer åpner kø](../../Prototypen/Videoomvisning/00-00-33-help-queue-toggle.png)
  er flytreferansen for den voksne kontrollen.
- [07:06 – elevens hånd](../../Prototypen/Videoomvisning/00-07-06-student-queue.png)
  bevarer håndsymbolet, men det synlige kønummeret er et eksplisitt antimønster.
- [07:14 – lærerens kø](../../Prototypen/Videoomvisning/00-07-14-teacher-queue.png)
  bevarer intern oversikt og overtakelse. Drag-only og elevsynlig prioritet
  kopieres ikke.
- Masteroppgaven, PDF-side 40, 45, 58 og 130 (trykte sider 32, 37, 50 og 122),
  beskriver hjelpekøen som en måte å normalisere hjelp og redusere stigma på,
  samtidig som lange eller synlige køer kan skape uro. Derfor får eleven ingen
  plass, ventetidsprognose, andre elevnavn eller intern status.
- `origin/master` er historisk flytreferanse. Gammel klientmutasjon, RLS,
  to-timers utløp og direkte portering av kønummer brukes ikke.
- Supabase Realtime anvender ikke RLS på `DELETE`-hendelser. Derfor har den
  publiserte signaltabellen teknisk rad-ID, nullable elev-/øktreferanser,
  `ON DELETE SET NULL` og ingen runtime-`DELETE`-grant. Rolle- og
  medlemskapsendringer anonymiserer signalet i samme låste operasjon.

## Akseptansekriterier

- [x] En kø er bundet til organisasjon, klasse og eksakt
  `plan_revision_session`, med status, versjon og aktør-/tidsspor.
- [x] Bare AAL2-ansatt med aktivt klasseoppdrag og `help_queue.manage` kan åpne,
  begynne å stenge, ta og løse forespørsler.
- [x] Feil organisasjon, klasse, økt, tilbakekalt oppdrag, manglende capability
  og stale versjon avvises i databasen uten delvis endring eller audit.
- [x] Eleven ser ingen hånd når riktig øktkø ikke er åpen. En aktiv forespørsel
  forblir synlig mens køen stenger.
- [x] Elevkontrollen er minst 44 × 44 CSS-piksler, ligger i samme safe-area-
  footer som progresjonen og viser bare hånd eller hånd + «Står i kø».
- [x] Footerforespørsel har ingen oppgavekontekst. Forespørsel fra åpen oppgave
  bruker elevens eksakte assignment i køens økt.
- [x] En generell aktiv forespørsel kan få oppgavekontekst uten ny rad, nytt
  tidspunkt eller endret FIFO-rekkefølge.
- [x] Retry, dobbelttrykk og to faner gir én aktiv forespørsel per elev og kø.
- [x] Trykk på «Står i kø» åpner en kompakt, tilgjengelig avmelding med
  fokusretur; avmelding gjør hånden tilgjengelig igjen dersom køen fortsatt er
  åpen.
- [x] Ansatt ser elev, ventetid, valgfri oppgave/fag, status og ansvarlig. Bare
  én ansatt vinner en samtidig overtakelse.
- [x] `closing` stopper nye forespørsler og går deterministisk til `closed` når
  siste aktive forespørsel blir terminal.
- [x] Realtime brukes bare som invalidering; reconnect og kanalstatus utløser
  autoritativ refetch.
- [x] Browserroller har ingen direkte skrivegrant. Kommandoer er serverstyrte,
  idempotente og auditerte uten elevfritekst eller intern prioritet i en
  elevlesbar rad.
- [x] Tom database og representativ oppgradering består RLS, grants,
  samtidighet, retry og rollback.
- [x] Elev- og lærerkomposisjon, håndens synlighet og trykkmål, overflow,
  reduced motion og axe A/AA består Chromium og WebKit ved 360×640, 640×360,
  768×1024, 1024×768 og 1440×900, i tillegg til 200 % reflow-proxy. Hele den
  interaktive kølivssyklusen, tastaturflyten og fokusreturen er kjørt i
  representative elev- og lærerviewports i begge motorer.

## Avgrensning

E1 implementerer ikke manuell omprioritering, release/transfer, gruppekø,
global lærerwidget, chat, begrunnelse, ventetidsløfte, varsler eller en egen
«arbeid mens du venter»-sandbox. FIFO beregnes fra det uforanderlige
`requested_at`; en senere intern rangmodell må ligge i en egen staff-only
ressurs fordi RLS skjuler rader, ikke kolonner.

Bare aktuell undervisningsøkt kan åpnes i E1. Køen går automatisk til
`closing` ved øktslutt. Framtidig forhåndsåpning og alle øvrige E03-handlinger
kommer i senere slicer.

## Baseline før kodeendring

| Port | Resultat 17. juli 2026 |
| --- | --- |
| `npm test` | Bestått 44/44. |
| `npm run test:db:staff` | Bestått fra tom database og representativ oppgradering. |
| Git | `3.0` var fem commits foran `origin/3.0`; bare midlertidige PDF-renderinger lå uversjonert. |

## Avvik, tiltak og retest

| Avvik | Tiltak | Retest |
| --- | --- | --- |
| Seed forventet to signaler etter at køåpning fanet ut til tre elever. | Fixture og forventning ble gjort eksplisitt klasseavgrenset. | Tom database, oppgradering og RLS-smoke består. |
| Første Realtime-utkast eksponerte for bred tilstand og ugyldig filter. | Egen autentisert, privat signaltabell og eksakt publication-allowlist. | Elev ser bare eget signal; AAL1-ansatt og elev utenfor klassen ser null rader. |
| Supabase Realtime beskytter ikke `DELETE` med RLS. | Ingen runtime-sletting, cascade eller mutasjonsgrant på publiserte signaler; terminalisering lager anonym tombstone. | Skjemainvariant, rolleendring, medlemskapsløp og RLS-smoke består. |
| Samtidig elevforespørsel og organisasjonsrolleendring kunne bruke en gammel elevrolle. | Organisasjons- og klasserolle valideres både etter klasselås og i DB-triggeren. | Deterministisk request-vs-role-race etterlater null aktive forespørsler og null levende elevsignal. |
| Nexts route-announcer ble tolket som appens statusmelding. | Assertion ble avgrenset til hjelpedokkens live-region. | Chromium og WebKit består uten skjult global antakelse. |
| Kontekstassertion kunne løpe foran autoritativ refetch. | Testen venter på observerbar servertilstand, ikke fast timeout. | Oppgavekontekst beholder samme rad, tid og FIFO i begge browsere. |
| Fokusretur ble kontrollert mens avmeldingsknappen fortsatt var deaktivert. | Fokusbevis skjer etter avsluttet pending-tilstand med ekte Tab/Enter-sekvens. | Tastaturflyt, dialog og fokusretur består. |
| WebKit rapporterte avbrutt RSC under bevisst offline-test og harde reloads. En senere fullmatrise viste at `networkidle` kunne returnere før Next planla serverhandlingens RSC, slik at testens varighetsreload avbrøt den 19 ms senere. Transporten var heller ikke stabilt én GET; enkelte revalideringer kom i handlingens POST-respons. | Realtime-hooken refresher ikke offline; reconnect bruker `online`-signal og autoritativ refetch. Varighetsbeviset lar den interaktive siden fullføre uforstyrret og leser i stedet oppgavestatusen fra et ferskt dokument i en ny fane med samme elevsesjon. | Isolert WebKit-elevflyt bestod 2/2, målrettet E1 bestod 3/3 og full WebKit bestod 38/38 uten runtime-feil. |
| En bakgrunnsrefresh kunne flytte fokus tilbake til sjekkpunktoverskriften mens eleven forsøkte en handling på nytt. | Oppgavedialogen fokuserer overskriften bare ved faktisk overgang inn i sjekkpunktet, ikke når en autoritativ oppdatering erstatter oppgaveobjektet. | Målrettet elevflyt og full Chromium/WebKit-matrise beholder handlingsfokus. |
| Supabase meldte kanalen `SUBSCRIBED` før Postgres-replikasjonen faktisk var klar. Ved to samtidige WebKit-faner kunne køen åpnes mellom de to readiness-hendelsene, slik at bare én fane fikk signalet. | Kanalen ber eksplisitt om `replication_ready`. Bare `status: ok` fullfører startbarrieren; `status: error` gjenleser uten å avvæpne femsekundersfallbacken. Både klientens dokumenterte `extension: system` og lokalservers observerte `extension: postgres_changes` støttes. Et faktisk endringssignal fullfører samme barriere, mens fokus, synlighet og reconnect beholder autoritativ gjenlesing. | To enhetstester låser protokollvariantene og feilstatusen. WebSocket-sporet viste readiness-rekkefølgen; deretter bestod målrettet og full autentisert retest i begge motorer. |
| Server og klient beregnet standardtidspunkt uavhengig i tilgangsdialogen og kunne krysse et minuttskifte under hydrering. Første utbedring sendte samme ISO-tidspunkt, men formaterte det fortsatt med miljøets tidssone. | Serveren sender ett ISO-tidspunkt, og både første render, ny åpning, forhåndsvisning og innsending konverterer eksplisitt mot `Europe/Oslo`. Dermed blir server-UTC og norsk nettleser identiske, også over sommer-/vintertid. | Enhetstesten låser vinter- og sommertid uavhengig av prosessens tidssone; tilgangsflaten bestod begge fulle browsermatriser uten hydreringsfeil. |
| Lærerens ventetidslabel brukte klientens egen klokke i første render og hadde samme minuttskiftefare. | Klassesiden sender ett `initialNow` som brukes ved hydrering; klienten overtar bare de senere 30-sekundersoppdateringene. | Typekontroll, målrettet E1 og begge fulle browsermatriser består uten hydreringsavvik. |
| En lukket kø fra forrige økt kunne gjøre at timeren valgte det gamle sluttidspunktet foran starten på neste undervisningsøkt. | En eksplisitt overgangshjelper prioriterer `nextTransitionAt` og faller bare tilbake til aktuell økts slutt. | To enhetstester dekker lukket kø → neste økt, aktuell øktslutt og tom tilstand; full Chromium/WebKit viser riktig øktgrense. |
| Naturlig-øktslutt-testen la midlertidig eleven i en ekstra klasse og tilbakedaterte økten uten å gjenopprette fixture-en. En retry kunne derfor starte mot korrupt tilstand. | Testen lagrer original `ends_at`, gjenoppretter den i en sekvensiell `finally`-transaksjon og fjerner bare medlemskapet den selv opprettet. Baseline-oppryddingen fjerner også et eventuelt avbrutt restmedlemskap. | Naturlig øktslutt består i Chromium og i tre etterfølgende WebKit-kjøringer; hele E1-specen kan kjøres på nytt etter reset. |
| Session-sletting satte signalenes fremmednøkkel til `null`, slik at varige, elevlesbare tombstones kunne hope seg opp mellom E2E-retries. | Den lokale E1-fixturen sletter klassens signaler eksplisitt før receipts, forespørsler og økter. | Målrettet E1 bestod på nytt i begge motorer mot gjentatte lokale database-reset uten fixture-vekst. |
| En WebKit-ukeplantest begynte å fylle skjemaet samtidig med køens dokumenterte første RSC-synkronisering, slik at ukefeltet ble remontert før tidsvalideringen. Første testfiks ventet på `response.finished()`, men en gyldig Next RSC-stream kunne forbli åpen til testtimeout selv om UI-et var ferdig. | Testen avgrenser fortsatt den eksakte første RSC-responsen, men bruker observerbar UI-tilstand som port: alle uke-, dato- og tidsverdier bekreftes etter utfylling og før innsending. Dermed fanges en sen remount uten å anta at streamen lukkes. | Ukeplanflyten bestod isolert 3/3, full Chromium 38/38 og full WebKit 38/38. Versjonssjekket startsynkronisering eller eksplisitt draftbevaring følges opp før staff-flaten får flere samtidige livepaneler. |
| Fire parallelle, muterende fullmodusarbeidere overbelastet den delte lokale Supabase-fixture-en etter at E1 ble lagt til; to urelaterte autorisasjonslesinger feilet transient, mens begge specene bestod isolert. | Fullmodus bruker tre arbeidere. Målrettede moduser beholder fire, og de deterministiske SQL-racetestene kjøres uendret som autoritativ samtidighetsport. | De to feilspecene bestod 3/3 isolert; full Chromium og WebKit bestod deretter 38/38 med tre arbeidere. |
| Naturlig lukket QA-bilde var tatt etter scroll. | Siden rulles eksplisitt til toppen før bildet tas. | Bildet ble regenerert og visuelt gjennomgått. |

## QA-artefakter

De seks representative Chromium-bildene ligger i
[`docs/qa/evidence/E1`](./evidence/E1/README.md). De dekker elevhånd,
oppgavekontekst, aktiv lærerkø i mobil/iPad/desktop og naturlig lukket kø.
WebKit brukes som funksjonelt bevis og overskriver ikke dokumentasjonsbildene.

## Verifikasjonsresultat

| Port | Resultat |
| --- | --- |
| `npm run test:db:staff:empty` | Bestått: tom database, RLS/RPC, tombstones, rollback og samtidighet. |
| `npm run test:db:staff:upgrade` | Bestått: representativ oppgradering og atomisk preflight. |
| Målrettet E1, Chromium | Bestått 3/3 inkludert auth-oppsett. |
| Målrettet E1, WebKit | Bestått 3/3 inkludert auth-oppsett. |
| `npm run test:e2e:visual` | Bestått 24/24 i Chromium; representative bilder er gjennomgått semantisk. |
| `npm run verify:checkpoint` | Bestått: lint, kjernelint, typekontroll, 50/50 enhetstester, build, offentlig E2E 4/4 og high-auditgrense. |
| `npm run test:e2e:full` | Bestått 38/38 i Chromium. |
| `npm run test:e2e:full:webkit` | Bestått 38/38 i WebKit. |

Alle fixtures, logger og bilder bruker syntetiske data. Ingen ekstern eller
linket Supabase ble lest eller mutert. Automatisert WebKit er ikke et fysisk
Safari-/VoiceOver-bevis; fysisk E1-touch og skjermleser står derfor igjen som
en manuell produktport i E03/E06.
