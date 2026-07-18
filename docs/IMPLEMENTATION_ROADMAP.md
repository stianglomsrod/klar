# Klar 3.0 – implementeringsplan

**Status:** Pågår

**Sist avklart:** 18. juli 2026

**Autoritativ produktkilde:** [Domenekontrakten](./product/DOMAIN_CONTRACT.md)

Denne planen deler målbildet i kontrollerbare leveranser. Den beskriver ikke
funksjoner som allerede er ferdige. Hver epic må ende i et eget kontrollpunkt
med migrasjoner, autorisasjonstester, domenetester og verifisert UI der det er
relevant.

Planen skiller mellom to lag som begge er nødvendige:

1. **3.0-motoren:** organisasjonsgrenser, AAL2, serveroperasjoner, planer,
   assignments, immutable attempts, XP-ledger, kø og retry/samtidighet.
2. **Klar-opplevelsen:** den tidsstyrte elevdagen, ansattens cockpit,
   innholdsbiblioteker, interaktiv quiz, kontekstuell dock, kuponger og den
   levende blomsterhagen.

Commit `8677e0a31c0caaaecdaf08fed82afe498e59cf43`, masteroppgaven,
videoomvisningen og `Prototypen/` er semantiske kilder for lag 2. De skal ikke
erstatte sikkerhets- og datamodellen i lag 1.

## Epics

| ID | Epic | Primært resultat |
| --- | --- | --- |
| E01 | [Elevens dag og oppgaveflyt](./epics/E01_STUDENT_DAY_AND_TASK_FLOW.md) | Rolig timebasert dagsflate og et valgfritt mediesjekkpunkt etter «Fullfør» |
| E02 | [Progresjon og belønninger](./epics/E02_PROGRESS_AND_REWARDS.md) | Reverserbar, transaksjonssikker XP- og levelloop uten farming |
| E03 | [Kontekstuell hjelpekø](./epics/E03_CONTEXTUAL_HELP_QUEUE.md) | Ikonbasert hjelp for eleven og styrbar, reviderbar kø for ansatte |
| E04 | [Smart Import og ukeplaner](./epics/E04_SMART_IMPORT_AND_WEEKLY_PLANS.md) | Full DOCX-tolkning med utkast, diff, revisjoner og trygg reimport |
| E05 | [Ansattilgang og vikar](./epics/E05_STAFF_ACCESS_AND_SUBSTITUTES.md) | Lik pedagogisk funksjon innenfor eksplisitt og tidsavgrenset virkeområde |
| E06 | [Responsive og tilgjengelige skall](./epics/E06_RESPONSIVE_ACCESSIBLE_SHELLS.md) | Sammenhengende elev- og lærerflater på mobil, iPad og PC |
| E07 | [Ansattarbeidsflate og innholdsbiblioteker](./epics/E07_STAFF_WORKSPACE_AND_CONTENT_LIBRARIES.md) | Operativt cockpit og stabile arbeidsrom for klasse, elev, oppgave, plan og belønning |
| E08 | [Interaktive quizer og lærersjekk](./epics/E08_INTERACTIVE_QUIZZES_AND_CHECKS.md) | Ett-spørsmål-om-gangen, autosave og lærerreview uten skjult fasit eller resultat-XP |
| E09 | [Levende blomsterhage og betingede belønninger](./epics/E09_LIVING_GARDEN_AND_CONDITIONAL_REWARDS.md) | Flerfarget maling, kuponger, blomstring og en levende, fysisk verifisert hage |
| E10 | [Elevidentitet og kontekstuell dock](./epics/E10_STUDENT_IDENTITY_AND_AMBIENT_DOCK.md) | Sammenhengende tid, hjelp, fremdrift og bare faktisk tilgjengelige belønninger |

## Avhengigheter

```text
E05 Ansattilgang ─────┬────> E03 Hjelpekø
                     ├────> E04 Smart Import
                     └────> lærerhandlinger i E01/E02

E04 Ukeplan/sesjoner ──────> E01 Elevens dag
E02 XP/state machine ──────> E01 Fullfør-sjekkpunkt
E01 Oppgavekontekst ───────> E03 «Hjelp med denne»

E01/E03/E05 ────────────────> E07 W1–W2 ansattarbeidsflate
E04 ────────────────────────> E07 W3 plan-/innholdsintegrasjon
E01/E02/E04/E07 ───────────> E08 Interaktiv quiz
E01/E02/E03 ───────────────> E10 Elevdock og identitet
E02/E07 ───────────────────> E09 Domene, kuponger og hagemotor
E10 DCK1–DCK3 ─────────────> E09 R6a kupongintegrasjon
E10 DCK1–DCK3 ─────────────> E09 R6b samlet hageintegrasjon
E08 Q4 ────────────────────> E09 R6b quizretur

E06 gjelder i alle leveranser fra første komponent og første E2E-test.
```

E09s motor-/kunstspike startes tidlig, men produksjonshagen bygges først når
E02s entitlement og E10s inngang/retur er stabile. Slik kan grafikkvalget
bevises på fysisk iPad uten å lage en parallell progresjonsmotor.

## Anbefalt leveranserekkefølge

### Kontrollpunkt 0 – arbeids- og QA-fundament

**Status:** Fullført og lokalt verifisert i Chromium og WebKit.

Før produktleveransene etableres en repo-skill, varige agentregler,
lokal-only syntetiske Supabase-fixtures, separate elev-/lærersesjoner,
responsiv screenshotmatrise og en deterministisk kontrollpunktport. Se
[`docs/qa/CONTROL_POINT_0.md`](./qa/CONTROL_POINT_0.md) for bevis og kjente
manuelle enhetsporter.

**Utgangskrav:** Oppfylt. Arbeidsflyt, tom lokal database, Supabase Auth/MFA,
rolleisolasjon, offentlig smoke og visuell matrise er grønne. Ekte touch,
skjermleser og 200 % browserzoom følger den relevante produktslicen og kan ikke
erstattes av emulatorbeviset.

### Kontrollpunkt A – felles fundament

**Status:** Pågår – A1-kjernen er implementert og de konfigurerte automatiske
kommandoportene er grønne. Kravrevisjonen har åpne evidensgap, og fysiske og
manuelle enhetsporter gjenstår.

Første vertikale slice er scope-låst i
[`Kontrollpunkt A1 – aktive ansattoppdrag og autorisasjonskjerne`](./qa/CONTROL_POINT_A1.md).
A1 har levert den klasseavgrensede autorisasjonskjernen, owner-kontrollflaten
og første responsive ansattskall. De konfigurerte kontrollportene er grønne i
lokal database, Chromium og WebKit, men hele kravmatrisen er ennå ikke
uttømmende bevist. Kontrollpunkt A forblir åpent til evidensgapene er lukket og
skjermleser, touch, safe-area/skjermtastatur og orienteringsbytte er
dokumentert på reelt utstyr.

Start E05 og E06 som tverrgående fundament:

- modeller aktive ansattoppdrag og virkeområder;
- behold AAL2 for voksne handlinger;
- etabler felles skall, navigasjon, dialog-/sheet-primitiver, fokusregler,
  ikonregler og responsive teststørrelser;
- opprett autorisasjonsmatrise og automatiske negative tester.

**Utgangskrav:** Ingen ny voksenhandling kan utføres uten aktivt oppdrag, og
grunnkomponentene fungerer med tastatur, berøring, skjermleser, 200 % zoom og
redusert bevegelse.

### Kontrollpunkt B – oppgavestatus, XP og belønning

**Status:** Pågår – B1 har levert oppgaveovergang, XP-ledger, angre og
ansattretur. [B2](./qa/CONTROL_POINT_B2.md) har levert varig kronbladvalg,
blomsterhage, ansattramme og elevens separate synlighetspreferanse. B2s
database-, Chromium-, WebKit- og responsive porter er grønne; fysisk
VoiceOver/NVDA-retest er åpen. Kuponginnløsning og øvrige E02-flater gjenstår.

Implementer E02 før elevens nye fullførflyt kobles på:

- transaksjonell oppgaveovergang og XP-ledger;
- nøyaktig én level-entitlement per elev og nivå;
- elevangre og lærer-/vikarretur som kompenserende hendelser;
- bevaring av valgt belønning og beskyttelse mot dobbeltklikk, retry og to
  faner.

**Utgangskrav:** Alle tilstandsoverganger og edgecaser er bevist i
databasetester og tjenestetester uten direkte klientskriv til progresjonsdata.

### Kontrollpunkt C – ukeplan og Smart Import

**Status:** Pågår – C1 har levert den første manuelle, strukturerte og
uforanderlige klasseukerevisjonen samt stabil økt-/oppgaveproveniens. DOCX er
fortsatt task-only; utkast, full strukturbevaring, senere revisjoner, reimport,
treveis merge og rollback gjenstår. Se
[`docs/qa/CONTROL_POINT_C1.md`](./qa/CONTROL_POINT_C1.md).

Implementer E04 som datagrunnlag for en tidsbasert elevdag:

- stabile ukeplaner, sesjoner, beskjeder, mål og oppgaver;
- strukturbevarende DOCX-tolkning;
- lagret utkast, menneskelig kontrollpunkt og atomisk publisering;
- idempotent reimport og treveis sammenslåing med stabile identiteter.

**Utgangskrav:** Samme dokument kan lastes opp flere ganger uten duplikater,
og en endret plan kan publiseres uten å slette elevprogresjon eller manuelle
lærerendringer.

### Kontrollpunkt D – elevens dag og oppgave

**Status:** Pågår delvis – C1 projiserer forrige/aktuell/neste økt, B1 gir
fullføring uten vedlegg, angre og ansattretur, E1 leverer kontekstuell hånd i
footer og oppgave, og [D2](./qa/CONTROL_POINT_D2.md) leverer eksplisitt flytt
eller ny lenket utsending fra en konkret planoppgave.
[D3](./qa/CONTROL_POINT_D3.md) leverer «Fag og oppgaver» som en sekundær,
caller-bound oversikt over alle nå synlige assignments og gjenbruker samme
oppgaveflyt. D2/D3s databaseporter, målrettede nettleserflyter, fulle
autentiserte suiter og responsive Chromium-/WebKit-matriser er grønne.
Medier, offlineflyt og den samlede fysiske målenhetsmatrisen gjenstår.

Bygg E01 på de stabile sesjons- og progresjonsmodellene:

- forrige, nåværende og neste økt uten egen «etter skoletid»-modus;
- åpning av oppgave viser instruksjon uten en «I gang»-knapp;
- «Fullfør» åpner et sjekkpunkt der tekst, lyd og bilde er valgfritt;
- bekreftelse uten vedlegg er en fullverdig standardflyt;
- alle nå synlige assignments kan finnes igjen i en sekundær fagoversikt uten
  parallell status eller automatisk prioritering;
- lærer kan eksplisitt flytte samme uferdige tildeling eller sende samme
  definisjon ut som en ny, lenket iterasjon;
- valgt oppgave kan sende kontekst videre til hjelpekøen.

**Utgangskrav:** En førsteklassing kan forstå og fullføre hovedflyten med
symboler, korte handlingsord og opplesing, på mobil, iPad og PC.

### Kontrollpunkt E – aktiv hjelpekø

**Status:** Pågår – E1 leverer det øktbundne livsløpet, elevhånden, FIFO,
claim/resolve, privacy og reconnect. E2 leverer atomisk og reviderbar manuell
reorder, release/transfer og privat staff-snapshot. E3s delte
ansattdeltakelse med personlig uttreden, global stenging og trygg overtakelse
er lokalt verifisert. Grupper, globalt livepanel og fysisk enhetsport gjenstår.

Koble E03 til aktive timer/sesjoner:

- lærer oppretter og avslutter køen for valgt klasse og time;
- elevens hånd vises bare mens køen er aktiv;
- generell hjelp og oppgaveknyttet hjelp bruker samme kø;
- ansattrekkefølge kan endres atomisk og reviderbart;
- flere ansatte kan delta samtidig; én kan forlate egne oppdateringer uten å
  stenge køen for de andre, også mens de gjenværende tømmer en stengende kø;
- en ubemannet kø med aktive elever går til `closing` og kan overtas av en ny
  autorisert ansatt;
- elevens kompakte tilstander lover aldri en bestemt køplass.

**Utgangskrav:** Realtime, avbrudd, overtakelse, omprioritering og avslutning
er verifisert på alle målenheter og ved midlertidig nettverksbrudd.

### Kontrollpunkt F – integrert 3.0-motor

**Status:** Planlagt som samlende port for eksisterende A–E-arbeid.

F lukker ikke målproduktet. Det beviser at sikkerhets-, plan-, oppgave-, XP- og
køkjerne kan kjøres sammen før den historiske Klar-opplevelsen bygges ut:

- kjør hele nåværende elev- og lærerløype med representative syntetiske planer;
- lukk navngitte manuelle porter fra A–E eller dokumenter reelle blokkere;
- kjør security/RLS, tom database, upgrade, rollback og autentisert E2E;
- verifiser at samme origin og separate browser contexts isolerer elev/ansatt;
- dokumenter baseline for fem viewports, 200 prosent, reduced motion og fysisk
  iPad uten å kalle planlagte E07–E10-flater ferdige.

**Utgangskrav:** Én grønn og reproduserbar motorbaseline som nye
opplevelsesslicer kan bygges og sammenlignes mot.

### Kontrollpunkt G – produktidentitet, kunstretning og motorvalg

**Status:** Pågår på dokumentnivå; teknisk/kunstnerisk spike gjenstår.

- forvalt de avklarte domenebeslutningene som låst målkontrakt og spor senere
  endringer eksplisitt;
- lag wireflows som kobler elevdag, dock, quiz, level-up, verksted og hage;
- lag wireflows for ansattcockpit, arbeidsrom og biblioteker;
- produser stilbibel og representative final-quality assets for hagen;
- gjennomfør E09 R0: Canvas 2D mot PixiJS/WebGL på fysisk iPad 9. generasjon;
- dokumenter renderer, fallback, kunstpipeline og forkastede alternativer i ADR.

**Utgangskrav:** Navngitt referansesett, godkjente storyboards/stilbibel,
render-ADR, kunstreview-rubrikk og beståtte fysiske målverdier finnes før
produksjonsslicen starter.

### Kontrollpunkt H – ansattcockpit og ressursarbeidsrom

Lever E07 W1–W2:

- handlingsrettet oversikt med aktive økter/køer, nylig brukte ressurser og
  oppfølging;
- stabile klasse-, gruppe- og elevarbeidsrom;
- omfangssikre read-modeller, URL-er og sidepaneler/sheets;
- samme pedagogiske kjernefunksjon for kontaktlærer, faglærer, ITO og vikar;
- mobil-/iPad-komposisjon som ikke er en krympet desktoptabell.

**Utgangskrav:** Læreren kan orientere seg og gå til riktig arbeid uten døde
lenker, dekorativ statistikk eller datalekkasje ved utløpt oppdrag.

### Kontrollpunkt I – plan- og innholdsbiblioteker

Fullfør E04 og E07 W3 før nye rike oppgavetyper:

- full strukturbevarende DOCX-import, utkast, diff og treveis reimport;
- planbibliotek og eksplisitt publisering/ny iterasjon;
- oppgavebibliotek med definisjon, revisjon, arkivering og utsending;
- bibliotekskall med eksplisitte modulgrenser for senere quiz og belønninger;
- regresjonsbevis for elevhistorikk og XP ved innholdsendring.

**Utgangskrav:** Innhold kan gjenbrukes og endres uten at definisjon,
iterasjon, assignment eller elevforsøk blandes sammen.

### Kontrollpunkt J – elevens gjenkjennelige dag, dock og mediesjekkpunkt

Fullfør E01 og lever E10 DCK1–DCK3:

- prototypeforankret forrige/aktuell/neste-komposisjon;
- oppgaveåpning uten «I gang», med opplesing og trinnvis støtte;
- valgfritt tekst-, lyd- og bildesjekkpunkt etter «Fullfør»;
- kontekstuell dock for nå, tid, hjelp, fremdrift og ventende belønning;
- nøyaktig retur til økt/oppgave etter hjelp eller belønningsvalg;
- betinget synlighet uten tomme hage-/kupong-/timeplanmål.
- semantisk sammenligningsmatrise mot valgte prototypebilder for
  forrige/aktuell/neste, primærhandling, dock og kognitiv belastning ved alle
  målviewports.

**Utgangskrav:** Sammenligningsmatrisen består uten ukjente avvik, og
hovedflyten består 3.0s media-, autorisasjons-, touch- og
tilgjengelighetsporter.

### Kontrollpunkt K – interaktiv quiz/test

Lever E08 Q1–Q4:

- versjonert lærerbygger for tekst, enkeltvalg, flervalg og valgfritt lydsvar;
- ett spørsmål om gangen, opplesing, autosave og fortsett senere;
- atomisk levering, uforanderlig besvarelse, XP-reversering og nytt utkast
  etter retur; ny forsøkssekvens oppstår først ved ny levering;
- lærerreview uten falsk «riktig»-markering, prosent eller resultatbasert XP;
- samme-origin rolle-E2E, WebKit, fysisk iPad og skjermleserbevis.

**Utgangskrav:** Hele lærer→elev→review→retur→nytt forsøk fungerer uten
parallell oppgave-/XP-modell.

### Kontrollpunkt L – level-up, personlig uttrykk og kuponger

Lever E09 R1/R6a og E10 DCK4a:

- kort førstegangs level-up med «Velg nå» og «Senere»;
- ventende entitlement i dock uten pressende badge;
- prototypetest og eksplisitt valg av avatar/naturidentitet/ingen figur;
- lærerdefinisjon, omfang, arkivering og betinget synlige kuponger;
- elevforespørsel, ansattinnløsning, samtidighetsvern og kompenserende retting;
- ingen belønningsflate når verken hage eller relevant lærerbelønning finnes.

**Utgangskrav:** En milepæl gir høyst ett varig valg, kupongen kan ikke
forsvinne eller brukes dobbelt, og skolearbeidet fungerer identisk uten
spillifisering.

### Kontrollpunkt M – levende blomsterhage

Lever E09 R2–R5/R6b og E10 DCK4b på motoren som bestod G:

- kronbladdomene, reservasjon ved første strøk, CAS og avbruddsikker autosave;
- flerfarget, taktil maling med undo/redo og tilgivende dekning;
- likeverdig semantisk komponist for tastatur, switch og skjermleser;
- femte kronblad, én blomstring, pending placement og fri/alternativ planting;
- produksjonskunst, seedet vind, sommerfugler, dybde og kvalitetsprofiler;
- 200 blomster, context-loss, 30-minutters soak og alle harde iPad-budsjetter.
- samlet retur fra «Velg nå/Senere», «Mal kronblad», blomstring, planting og fallback
  til eksakt økt/oppgave gjennom E10s dock.

**Utgangskrav:** Hagen består E09s kunstreview-rubrikk, latency/FPS/minne/
bundle-/soak-budsjetter og alle domeneporter; ingen kreativ handling kan farme
XP eller miste arbeid.

### Kontrollpunkt N – feedback og kommunikasjon, beslutningsport

Før reaksjoner, kommentarer, meldinger eller «skrytevegg» implementeres:

- avgjør mottakere, moderering, varsling, oppbevaring, sletting og audit;
- skill pedagogisk feedback fra sosial feed og offentlig sammenligning;
- prototypetest minste nyttige flyt med barn og lærer;
- oppdater domenekontrakt og opprett egen epic dersom retningen godkjennes.

**Utgangskrav:** Enten en kontraktsfestet, avgrenset epic eller en eksplisitt
beslutning om å utsette. Ingen chat-/kommentarfelt bygges ved antakelse.

### Kontrollpunkt Z – samlet målproduktkandidat

- kjør elev- og ansattløypa fra plan/import til oppgave, quiz, hjelp, retur,
  level-up, kupong og hage;
- gjennomfør E2E på 360×640, 640×360, 768×1024, 1024×768 og 1440×900;
- test tastatur, NVDA, fysisk VoiceOver/Switch Control, 200 prosent, reduced
  motion, avbrutt nett, orientation og background/resume;
- kjør sikkerhets-, RLS-, media-, sletting-, migrasjons- og rollbackøvelse;
- gjør fysisk iPad-soak av hagen og realistisk lærer/elev-samtidighet;
- oppdater README og pilotrunbook bare med faktisk verifiserte funksjoner.

**Utgangskrav:** Alle epics har lenket bevis, ingen planlagt funksjon omtales
som tilgjengelig, og målproduktet kan piloteres uten kjente kritiske avvik.

## Arbeidsregler

1. En epic kan ikke markeres ferdig bare fordi UI-en finnes.
2. Nye tabeller og RPC-er skal komme som migrasjoner og kunne bygges fra tom
   database.
3. Alle mutasjoner av oppgavestatus, XP, belønning, kø, planer og tilganger er
   serverstyrte, autoriserte og reviderbare.
4. Historiske 2.x-komponenter kan brukes som referanse, men ikke importeres
   sammen med gammel datatilgang eller klientstyrt forretningslogikk.
5. Relevante dokumenter oppdateres i samme commit som atferden de beskriver.
6. Uferdige eller skjulte funksjoner skal ikke omtales som tilgjengelige i
   README eller pilotrunbook.

## Felles «definition of done»

En epic er ferdig når:

- alle akseptansekriterier er knyttet til automatiske eller dokumenterte
  tester;
- tilgang utenfor virkeområdet er testet negativt;
- retry, samtidighet og delvis feil er håndtert der data muteres;
- mobil, iPad og PC er visuelt og funksjonelt kontrollert;
- tastatur, skjermleser, 200 % zoom og redusert bevegelse er kontrollert;
- auditthendelser inneholder teknisk metadata, ikke unødvendig elevfritekst;
- migrasjon fra tom database og relevant rollback/gjenoppretting er prøvd;
- kontrakt, epic, README og pilotrunbook gjenspeiler faktisk status.
