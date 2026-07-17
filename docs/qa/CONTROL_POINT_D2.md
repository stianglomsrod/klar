# Kontrollpunkt D2 – flytt samme oppgave eller send ut på nytt

**Status:** Implementert og lokalt verifisert 17. juli 2026

**Epic:** [E01 – Elevens dag og oppgaveflyt](../epics/E01_STUDENT_DAY_AND_TASK_FLOW.md)

**Kontrakt:** [Domenekontrakten](../product/DOMAIN_CONTRACT.md), særlig § 5,
§ 9.5, § 12 og minimumsscenario 10

## Mål for slicen

På lærerens klasseflate skal en autorisert ansatt kunne velge en konkret,
tidligere utsendt oppgave og eksplisitt gjøre én av to forskjellige handlinger:

1. **Flytt samme oppgave.** Valgte, uferdige elevtildelinger flyttes til en
   senere publisert undervisningsøkt. Iterasjon, assignment, elevstatus,
   fullføringshistorikk og samme ene XP-mulighet beholdes.
2. **Send ut på nytt.** Den samme uforanderlige oppgavedefinisjonen sendes som
   en ny, lenket iterasjon til eksplisitt valgte elever og en senere publisert
   økt. Originalen beholdes urørt; den nye iterasjonen får egne assignments,
   elevstatuser og XP-muligheter.

Ingen oppgave flyttes eller kopieres automatisk ved økt- eller skoledagsslutt.

## Kildegrunnlag og valgte referanser

- Produkteierens egen fortellerstemme i
  [videoomvisningen](../../Prototypen/Videoomvisning/README.md) brukes som
  historisk produktintensjon, ikke som bakgrunnslyd. Den tidskodede
  [sporingen av fortalt produktintensjon](../product/NARRATED_PROTOTYPE_INTENT.md)
  skiller det produkteieren forklarer, fra det legacy-skjermen tilfeldigvis
  viser. Ved 03:05 forklares
  koblingen mellom oppgave, konkret økt, samlet eller øktvis fullføring og nye
  iterasjoner. D2 bevarer økt- og iterasjonsmodellen. Delt fullføring på tvers
  av flere økter er fortsatt et åpent valg, og eksplisitt ukegjentakelse er
  utsatt. Klientstyrt autoritet porteres ikke.
- [03:05 – oppgave, økt og iterasjon](../../Prototypen/Videoomvisning/00-03-05-task-session-iteration.png)
  brukes for koblingen mellom innhold, mottaker og tidspunkt. Den tette
  legacy-dialogen er et antimønster.
- [Oppgaveoppretting steg 2](<../../Prototypen/L%20oppgaveoppretting%202%20-%20oppgaven%20knyttes%20til%20en%20time%20og%20til%20en%20elev.jpg>)
  brukes for eksplisitt mottaker- og øktvalg. Ukentlig gjentakelse er ikke del
  av D2 og trenger et senere, avklart kontrollpunkt.
- Masteroppgaven, PDF-side 11, 46, 55 og 104 (trykte sider 3, 38, 47 og 96),
  er lest og visuelt kontrollert. Den peker på videreutvikling av
  lærergrensesnittet, konkret elev-/klassekontekst og tidsbesparelse som sterk
  adopsjonsdriver. Oppgavebibliotek og gjentakelse begrunnes som gjenbruk uten
  dobbeltarbeid; D2 gjør gjenbruket eksplisitt og reviderbart.
- `origin/master` brukes bare som historisk flyt- og språkspor. Direkte
  klientskriving, implisitt recurrence, gammel datatilgang og tett
  administrasjons-UI porteres ikke.

## Produktbeslutninger

1. D2 støtter bare oppgaver med stabil proveniens fra en publisert klasseuke.
   Løse kompatibilitetsoppgaver får ingen oppdiktet økt.
2. Mål velges blant senere økter i en aktiv, publisert plan i samme
   organisasjon og klasse. Økter grupperes etter dag i UI; fri dato uten økt er
   et senere produktvalg.
3. «Flytt» gjelder bare assignments med status `assigned` eller `reopened`.
   Fullførte mottakere vises som utilgjengelige og filtreres aldri bort lydløst.
4. «Send ut på nytt» kan ta utgangspunkt i en original uavhengig av dens
   elevstatus, fordi originalen ikke muteres.
5. En batch er alt-eller-ingenting. Mottakere velges eksplisitt, og alle må
   fremdeles være aktive elever i klassen ved commit.
6. En aktiv, oppgaveknyttet hjelpeforespørsel bevares på samme assignment.
   D2 flytter, løser eller sletter den aldri automatisk. Låsing gjør
   request-versus-flytt deterministisk.
7. Samme planoppgave kan ikke ligge mer enn én gang for samme elev i samme
   måløkt. Dette hindrer utilsiktet dobbeltutsending og XP-farming.
8. Brukerspråket er «samme oppgave» og «ny oppgave». Tekniske ord som
   «iterasjon», revisjons-ID og CAS vises ikke til eleven og unngås i lærerens
   hovedflyt.

## Autoritativ modell

Dagens `task_definition` og elevspesifikke `task_assignment` er ikke nok til å
skille en utsendingsbatch fra senere gjenbruk. D2 innfører derfor et eget
planleggingslag:

- `task_iterations` er identiteten til én konkret utsending av en uforanderlig
  oppgavedefinisjon. Første publisering tilbakefylles deterministisk; en ny
  utsending oppretter en ny identitet lenket til kilden.
- `task_assignments.iteration_id` binder hver mottaker til utsendingen.
- `scheduled_teaching_session_id` er gjeldende, stabil øktidentitet på tvers av
  senere planrevisjoner.
- `scheduled_from_revision_session_id` er det eksakte, publiserte
  tidssnapshotet den ansatte valgte.
- eksisterende `visible_from` og `due_at` forblir autoritative tidssnapshots;
  `schedule_version` økes ved en reell flytting.
- `source_plan_revision_task_id` og `plan_task_id` forblir uforanderlig
  innholds- og opphavsproveniens. De brukes aldri som gjeldende plassering.
- immutable planleggingshendelser og request-receipts dokumenterer før/etter,
  handling, tekniske ID-er og mottakeromfang uten navn eller oppgavetekst.

Elevprojeksjonen matcher assignmentens stabile `scheduled_teaching_session_id`
mot den aktive planrevisjonen. Dermed forsvinner ikke oppgaven når en senere
planrevisjon overtar samme logiske økt.

## Domene- og samtidighetsinvarianter

- Flytt bevarer iterasjons-ID, assignment-ID, definisjons-ID, status,
  fullføringssekvens, returmelding, ledger og entitlement-historikk.
- Flytt oppretter ingen assignment, elevstatus, fullføringsforsøk, XP-post,
  milepæl eller belønning.
- Ny utsending bevarer eksakt definisjons-ID og snapshotsatt XP-verdi, men får
  ny iterasjons-ID, nye assignment-ID-er og tom `assigned`-status.
- Originalens plassering, assignments, status, forsøk, XP og køhistorikk er
  bit-for-bit urørt ved ny utsending.
- Måløkten må starte etter både transaksjonstidspunktet og den aktuelle
  kildeplasseringen. `Europe/Oslo` er autoritativ klokke; `visible_from` er
  lokal midnatt og `due_at` er øktslutt.
- Kommandoen låser iteration, assignments, elevstatuser, medlemskap og
  målplan/-økt i fast rekkefølge. Revocation eller stale versjon gir ingen
  delgraf.
- Fingerprint omfatter handling, kilde, sortert mottakersett, måløkt,
  forventede status-/planleggingsversjoner og forventet planlås.
- Samme request-ID og payload returnerer identisk resultat; samme ID med annen
  payload avvises.
- To konkurrerende flyttinger eller nyutsendinger får én vinner. Taperen må
  hente ny forhåndsvisning før et nytt, bevisst forsøk.
- Elevfullføring krever både forventet `state_version` og `schedule_version`.
  Fullføring først gjør assignmenten ikke-flyttbar; flytt først gjør en gammel
  elevfane stale uten XP-sideeffekt, også ved flytting senere samme dag.
- Hjelpeforespørsel først beholder gammel, historisk korrekt oppgavekontekst.
  Flytt først gjør en ny forespørsel mot gammel økt stale og avvist.
- Feil ved siste hendelse, audit eller receipt ruller tilbake hele operasjonen;
  samme request kan retryes etter rollback.

## Autorisasjonsmatrise

| Operasjon | Krav |
| --- | --- |
| Lese konkrete iterasjoner og måløkter | AAL2, aktivt eksakt klasseoppdrag, `class.workspace.read` og `student_progress.read` |
| Flytt samme oppgave | Samme + `task.publish` og `plan.publish` |
| Send ut på nytt | Samme + `task.publish` og `plan.publish` |
| Elevfullføring | Bare egen synlige assignment og eksakte status-/planleggingsversjoner |
| Eier/admin | Ingen implisitt pedagogisk tilgang; aktivt operativt klasseoppdrag kreves |
| Kontaktlærer, faglærer, spesialpedagog og vikar | Lik funksjon når oppdrag, tidsrom og begge kapabiliteter er aktive |
| Browserroller | Ingen direkte skrivetilgang; kommando-RPC-ene er `service_role`-only |

Serverlaget autoriserer før lesing/preview, rett før RPC og etter en databasefeil.
Databasen låser og validerer det eksakte staff assignment-et på nytt.

## Akseptansekriterier

- [x] Lærerflaten viser en konkret utsending med oppgave, nåværende økt,
  mottakere og statuser; flere utsendinger av samme definisjon blandes ikke.
- [x] «Flytt eller send ut på nytt» åpner en responsiv dialog knyttet til den
  konkrete utsendingen.
- [x] Dialogen forklarer valgene kort før bekreftelse:
  - «Beholder status og poenghistorikk. Ingen ny poengmulighet.»
  - «Lager en ny oppgave. Eleven kan få poeng på nytt.»
- [x] Måløkt og mottakere velges eksplisitt, og kontrolloppsummeringen viser
  handling, innhold, mottakeromfang og tidspunkt.
- [x] Primærknappen heter «Flytt oppgaven» eller «Send ut på nytt» i samsvar
  med valgt handling.
- [x] Flytt godtar `assigned` og `reopened`, viser `completed` som utilgjengelig
  og bevarer alle identiteter og historikk.
- [x] Ny utsending får ny iterasjons-/assignmentidentitet og egen XP-mulighet;
  originalen er urørt.
- [x] Framtidige assignments er skjult før lokal måldag via både RLS,
  elevprojeksjon og fullføringskommando.
- [x] Flyttet oppgave vises nøyaktig én gang i måløkten og ikke i gammel økt.
- [x] Gammel elevfane kan ikke fullføre etter en flytting.
- [x] Aktiv hjelpeforespørsel bevares; ny forespørsel valideres mot gjeldende
  øktplassering.
- [x] Retry, dobbeltklikk, to faner og konkurrerende ansatte kan ikke duplisere
  eller delvis mutere data.
- [x] Manglende AAL2, hver manglende kapabilitet, feil klasse/organisasjon,
  stjålet ID og utløpt/tilbakekalt oppdrag avvises uten sideeffekt.
- [x] Positive porter dekker kontaktlærer, faglærer, spesialpedagog og vikar.
- [x] Audit inneholder tekniske ID-er og før/etter uten navn, oppgavetekst
  eller fritekst.
- [x] Ingen klokkejobb, refresh eller skoledagsslutt kan utløse handlingen.
- [x] Tom database og representativ C1/B1-oppgradering bevarer ID-er, tider,
  status, forsøk og ledger og tilbakefyller planleggingslaget deterministisk.
- [x] Chromium og WebKit består 360×640, 640×360, 768×1024, 1024×768,
  1440×900 og 720×450 reflow-proxy uten horisontal overflow.
- [x] Dialogen består tastatur, fokusfelle/-retur, Escape, pending/retry,
  synlig fokus, axe A/AA, reduced motion og WCAG-tekstavstand.

## Responsiv UX-retning

- Triggeren ligger ved den konkrete utsendingen i «Publiserte oppgaver», ikke
  i ukeplanbyggeren eller som en global hurtighandling.
- Dialogen bruker samme DOM gjennom reflow: fullskjerm ved 360/640 og iPad
  portrett, høyresheet ved iPad landskap og en rolig sentrert dialog/sideflate
  på desktop.
- Først velges «Hva vil du gjøre?», deretter måløkt og mottakere, og til slutt
  vises én kompakt kontrolloppsummering. Ingen stor informasjonstett modal,
  drag-only, hover-only eller skjult/automatisk recurrence.
- Alle sentrale trykkmål er minst 44 × 44 CSS-piksler.

## Ikke-mål

- Ingen fri dato uten publisert økt, automatisk «etter skoletid»-flyt eller
  ukentlig gjentakelsesregel i D2. En eksplisitt lærerstartet ukeregel er
  utsatt, ikke avvist som framtidig produktintensjon.
- Ingen avgjørelse om én fullføring kan dekke flere valgte økter; D2 arbeider
  med én konkret iterasjon og én valgt måløkt om gangen.
- Ingen redigering av oppgaveinnhold, XP-verdi, immutable planrevisjoner eller
  opprinnelig planproveniens.
- Ingen full C2-planrevisjon, reimport, rollback eller permanent
  timeplanendring.
- Ingen automatisk endring av aktiv hjelpekø eller intern køplass.
- Ingen valgfri tekst-/lyd-/bildelevering; medielagring krever et separat,
  avklart lagrings- og personvernkontrollpunkt.
- Ingen påstand om fysisk iPad-/VoiceOver-port før en egen manuell retest.

## Baseline før kodeendring

| Port | Resultat 17. juli 2026 |
| --- | --- |
| `npm test` | Bestått: 51 tester i 19 suiter. |
| `npm run test:db:staff` | Bestått fra tom database og representativ oppgradering. |
| Git | Ren `3.0`, ti commits foran `origin/3.0`; ingen push. |

## Verifikasjon etter implementering

### Levert kandidat

- `task_iterations` gir én stabil identitet per konkret utsending, med
  deterministisk tilbakefylling av eksisterende planoppgaver.
- To separate, autoriserte og atomiske operasjoner flytter valgte uferdige
  assignments eller oppretter en ny lenket utsending uten å mutere originalen.
- `schedule_version` inngår i fullførings- og angre-CAS. En gammel elevfane kan
  derfor ikke kreditere XP etter at lærerens flytting har vunnet løpet.
- Framtidige tildelinger skjules både av RLS, elevprojeksjonen og
  fullføringskommandoen fram til lokal måldag.
- RPC-ene er `service_role`-only. AAL2, eksakt aktivt klasseoppdrag,
  `task.publish`, `plan.publish`, organisasjon, medlemskap og målplan valideres
  på nytt i databasen.
- Immutable hendelser og request-receipts gir retry, audit og samtidighetsvern
  uten navn, oppgavetekst eller annen fritekst.
- Lærerflaten velger konkret utsending, handling, senere publisert økt og
  eksplisitte mottakere. Kontrolloppsummeringen står ved hovedhandlingen også
  på lav skjermhøyde.

### Automatiserte porter

| Port | Resultat 17. juli 2026 |
| --- | --- |
| `npm run test:db:staff` | Bestått fra tom database og representativ C1/B1-oppgradering. |
| Målrettet D2-E2E, Chromium | Bestått: auth-oppsett og fire D2-scenarioer, 5/5. |
| Målrettet D2-E2E, WebKit | Bestått: samme fem tester, 5/5. |
| Målrettet visuell QA, Chromium | Bestått: auth-oppsett og seks viewportprosjekter, 7/7. |
| Målrettet visuell QA, WebKit | Bestått: samme sju tester, 7/7. |
| `npm run typecheck` og målrettet ESLint | Bestått etter siste race-retting. |
| `npm run verify:checkpoint` | Bestått: lint, streng kjernelint, TypeScript, 53 tester i 20 suiter, produksjonsbuild, offentlig Playwright 4/4 og high/critical dependency-port. To moderate PostCSS-funn inne i Next.js er fortsatt synlige og ble ikke tvangsoppgradert. |
| Full autentisert Chromium-suite | Bestått: 43/43, inkludert D2, progresjon, tilgang, ukeplan, hjelpekø og full visuell matrise. |
| Full autentisert WebKit-suite | Bestått: 43/43 med samme prosjektmatrise. |

Alle database- og nettleserkjøringer brukte bare syntetiske fixtures og lokal
Supabase på loopback. Det linkede pilotprosjektet ble ikke lest eller mutert.

### Avvik, tiltak og retester

| Runde | Observert avvik | Tiltak og retest |
| --- | --- | --- |
| Database 1 | D2-fixturen la til et tredje syntetisk hjelpesignal, mens en eldre kontroll forventet to. | Forventningen ble oppdatert til den faktiske, bevisste fixturen. |
| Database 2 | D2-smoke ble kjørt etter en køtest som allerede hadde lukket køen. | Rekkefølgen ble gjort deterministisk; tom database og oppgradering bestod samlet. |
| E2E 1 | Selektorer antok unik «Ferdig»-tekst, stabil pending-tekst og separate statusetiketter. | Testene bruker dialogscope, stabil kontrollidentitet og sammensatt status. Chromium og WebKit bestod. |
| Nettverkskvalitet | Chromium rapporterte én forventet avbrutt ressurs under simulert retry; WebKit gjorde ikke det. | Kvalitetshjelperen tillater bare den eksakte forventede Chromium-feilen og krever at den faktisk oppstår. Andre runtimefeil feiler testen. |
| Fokus 1 | `autoFocus` ga ikke pålitelig førstefokus eller `:focus-visible` i alle motorer. | Dialogen setter eksplisitt førstefokus etter `showModal`; tastaturåpning verifiserer synlig fokus. |
| Fokus 2 | En forsinket RSC-/hjelpeoppdatering kunne endre objektidentiteten og kjøre `showModal()` etter Escape, slik at en tom dialog åpnet igjen og blokkerte fokusretur. | Åpningseffekten avhenger av og voktes med stabil iterasjons-ID. Stabil dialoglocator, Escape, fokusretur og fokusfelle bestod 7/7 i begge motorer. |
| Visuell QA | Første småskjermbilder viste bare den autoscrollede mottakerdelen, og kontrolloppsummeringen kunne ligge utenfor viewporten mens CTA var synlig. | Det lagres nå både valgstate og reviewstate. Oppsummeringen er flyttet til footer ved hovedhandlingen, og tittelen sier «send ut på nytt». Seks viewports og reflow-proxy bestod i begge motorer. |
| Mottakerskala | Kontrolloppsummeringen skrev opprinnelig alle valgte navn i den faste footeren, selv om domenet tillater opptil 200 mottakere. | Footeren viser nå høyst tre navn og «og N til», mens totalantall og hele, scrollbar mottakerliste beholdes. En egen test med 200 syntetiske navn består, og den responsive matrisen ble regenerert og retestet 7/7 i begge motorer. |
| WebKit stale-fane | Live RSC-refresh kunne fjerne den flyttede oppgaven mens testen klikket «Fullfør». Dette er ønsket sikker oppførsel, men den opprinnelige testen krevde eksplisitt serverfeil. | Testen godtar automatisk bortfall eller eksplisitt stale-avvisning, men krever i begge tilfeller uendret status/XP og null attempts, transitions, ledger og receipts. 5/5 bestod i begge motorer. |
| QA-artefakter | Fulle E1/E2-flyter skriver fortsatt enkelte historiske evidensbilder direkte til repoet og regenererte dem som en test-sideeffekt. Dette var ikke D2-arbeid og kunne ha skapt ubevisst baseline-drift. | Status før kjøring ble brukt som fasit; samtlige 11 E1/E2-bilder ble kontrollert og gjenopprettet byte-for-byte fra `HEAD`. Bare de 12 bevisst kuraterte D2-bildene inngår i kontrollpunktet. Senere QA-harnessarbeid bør skille midlertidig testoutput fra eksplisitt kuratering. |

### Lagret visuell evidens

Bildene viser to semantiske tilstander per viewport: først valg av handling,
økt og mottaker; deretter kontrolloppsummering og hovedhandling. De er
syntetiske layoutbevis, ikke pixel-golden-mastere.

| Viewport | Valg | Kontrolloppsummering |
| --- | --- | --- |
| 360×640 | [valg](./evidence/D2/task-iteration-choice-360x640.png) | [review](./evidence/D2/task-iteration-dialog-360x640.png) |
| 640×360 | [valg](./evidence/D2/task-iteration-choice-640x360.png) | [review](./evidence/D2/task-iteration-dialog-640x360.png) |
| 768×1024 | [valg](./evidence/D2/task-iteration-choice-768x1024.png) | [review](./evidence/D2/task-iteration-dialog-768x1024.png) |
| 1024×768 | [valg](./evidence/D2/task-iteration-choice-1024x768.png) | [review](./evidence/D2/task-iteration-dialog-1024x768.png) |
| 1440×900 | [valg](./evidence/D2/task-iteration-choice-1440x900.png) | [review](./evidence/D2/task-iteration-dialog-1440x900.png) |
| 720×450, reflow/tekstavstand | [valg](./evidence/D2/task-iteration-choice-720x450.png) | [review](./evidence/D2/task-iteration-dialog-720x450.png) |

Fysisk iPad-/VoiceOver-test er fortsatt et uttrykkelig ikke-mål for D2 og er
ikke erstattet av de automatiske viewport- og WebKit-proxyene.
