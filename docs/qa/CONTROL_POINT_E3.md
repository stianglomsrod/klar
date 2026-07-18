# Kontrollpunkt E3 – delt ansattdeltakelse i hjelpekøen

**Status:** Lokalt automatisert verifisert 18. juli 2026; fysisk E03-enhetsport
er fortsatt åpen

**Epic:** [E03 – Kontekstuell hjelpekø](../epics/E03_CONTEXTUAL_HELP_QUEUE.md)

**Kontrakt:** [Domenekontrakten](../product/DOMAIN_CONTRACT.md), særlig § 8

## Mål for slicen

En lærer som går videre til en annen klasse skal kunne forlate en aktiv
hjelpekø uten å stenge køen for elevene eller de gjenværende ansatte. Personlig
uttreden og global stenging er derfor to forskjellige domenehandlinger:

- «Forlat køen» avslutter bare den innloggede ansattes deltakelse og løpende
  staff-abonnement;
- «Steng kø» stopper nye elevforespørsler for hele klassen og lar eksisterende
  arbeid tømmes i `closing`;
- en annen autorisert ansatt velger «Bli med» før hen kan prioritere, overta,
  løse, frigi eller motta overført arbeid.

Dette svarer direkte på den manuelle to-vindu-testen der én lærer ønsket å gå
til en annen klasse uten videre varsler fra den forrige.

## Produkt- og sikkerhetsbeslutninger

1. Deltakelse identifiseres per kø og ansattbruker, ikke per oppdragsrad. Et
   nytt overlappende oppdrag kan autorisere videre arbeid uten duplisert
   deltaker.
2. Den som åpner køen blir første deltaker. Andre autoriserte ansatte kan lese
   den klasseavgrensede køen, men må melde seg inn før de får
   mutasjonskontroller eller staff-only liveoppdateringer.
3. En ansatt med overtatt arbeid må først løse, frigi eller overføre det før
   personlig uttreden. Overføring kan bare gå til en annen aktiv deltaker med
   aktuell `help_queue.manage` i samme klasse.
4. Siste deltaker kan ikke bruke «Forlat køen» på en åpen kø. Hen kan bruke den
   eksplisitte globale stengingen. Dette hindrer en åpen, ubemannet kø. En
   ikke-siste deltaker uten eid arbeid kan også forlate mens køen tømmes i
   `closing`; kollegaen fortsetter og den som går mister staff-varsler.
5. Utløpt eller tilbakekalt tilgang fjernes ved reconcile. Overtatt arbeid går
   atomisk tilbake til venting. Dersom ingen deltakere står igjen, går en åpen
   kø til `closing`, men forespørslene bevares og kan reddes av en ny autorisert
   deltaker.
6. Realtime er bare invalidering. En ikke-deltaker kan oppdage at en kø åpnes,
   men kan ikke lese staff-only signaler for en kø hen ikke deltar i. Fokus,
   nettverkstilbakekomst og heartbeat gir fortsatt autoritativ gjenlesing.
7. Join, leave, close, claim, resolve, release, transfer og reorder beholder
   eksakte receipts. En identisk retry etter personlig uttreden returnerer det
   opprinnelige resultatet; ny mutasjon avvises.

## Levert modell og flate

- `help_queue_staff_participants` er service-only og binder kø, organisasjon,
  ansattbruker og oppdrag med kompositt fremmednøkkel og eksplisitt RLS/grants.
- Snapshot v2 returnerer aktive deltakere sammen med kø, privat rekkefølge og
  forespørsler i ett autoritativt snapshot.
- Serverlaget har eksplisitte join-/leave-operasjoner og avleder
  overføringsmål fra aktive deltakerbrukere, ikke fra alle ansatte som kan se
  klassen.
- Ansattflaten skiller «Bli med», «Forlat køen» og «Steng kø». Ikke-deltakere
  får en rolig, read-only visning uten prioriterings- eller claimkontroller.
- Eleven beholder samme hånd, oppgavekontekst og private status. Personlig
  uttreden endrer verken elevens aktive forespørsel eller køens status.

## Akseptansekriterier

- [x] To autoriserte AAL2-ansatte kan delta i samme øktbundne kø.
- [x] Etter åpning/«Bli med» kan bare aktive deltakere bruke operative
  køkommandoer eller lese staff-only signaler.
- [x] Én ansatt kan overføre arbeid og deretter forlate; kø, elevstatus og den
  andre ansattes kontroller forblir aktive.
- [x] Etter global stenging kan én ikke-siste deltaker forlate personlig, mens
  den gjenværende ansatte beholder arbeid og tømmer køen til `closed`.
- [x] En deltaker med eid arbeid og siste deltaker i åpen kø kan ikke forlate.
- [x] Enhver aktiv deltaker kan velge global `closing`, som stopper nye elever
  uten å miste aktive forespørsler.
- [x] Utløpt eller tilbakekalt deltaker blir fjernet uten strandet claim;
  null-deltaker-kø kan reddes og tømmes av ny autorisert ansatt.
- [x] Identiske retries, overlapping assignment, tom database og representativ
  oppgradering bevarer identitet, audit og atomisitet.
- [x] Elev-DOM og tilgjengelig tre lekker ikke køplass, deltaker eller privat
  prioritering.
- [x] Deltakerflaten består tastatur, synlig fokus, axe A/AA, reduced motion,
  horisontal overflow, minst 44 × 44 px og målviewportene 360×640, 640×360,
  768×1024, 1024×768 og 1440×900 samt 720×450 reflow-proxy.
- [ ] Den komplette køflyten er fortsatt ikke fysisk retestet med touch og
  skjermleser på iPad/mobil; dette står åpent som samlet E03-enhetsport.

## Avvik, tiltak og retest

| Avvik | Tiltak | Retest |
| --- | --- | --- |
| Den tidligere køen hadde bare en global «Steng kø». En lærer som gikk til en annen klasse måtte enten fortsette å motta oppdateringer eller stenge for alle. | Innførte eksplisitt deltakerressurs og separate «Bli med», «Forlat køen» og «Steng kø», med serverautoritet og idempotente receipts. | To separate AAL2-contexts deltok og overførte arbeid. Hjelpelæreren forlot åpen kø, meldte seg inn igjen, eieren startet global `closing`, og hjelpelæreren forlot deretter personlig mens eieren tømte begge forespørslene til `closed`. |
| En første signalpolicy lot enhver ansatt med klassekapabilitet lese staff-only invalidering. | La til en selvavgrenset `SECURITY DEFINER`-hjelper med tomt `search_path`; staff-only signal krever nå både aktuell kapabilitet og aktiv deltakelse. | RLS-smoke viste at elev og autorisert ikke-deltaker ikke kan lese staff-only signal, mens aktiv deltaker kan. Livsløpssignal for å oppdage åpning er fortsatt tilgjengelig uten privat metadata. |
| Et historisk åpne-event kunne ikke alene bevise at åpnerens tilgang fortsatt var gyldig ved oppgradering. | Backfill kobler bare til et fortsatt aktivt, klasseavgrenset oppdrag; reconcile håndterer senere utløp/tilbakekalling. | Oppgraderingssmoke bevarte gyldig aktiv claimant og utelot tilbakekalt historisk åpner. |
| Deltakertabellen kunne ellers fått ulik bruker i raden og oppdragsreferansen. | La den eksisterende unike assignment-/organisasjons-/brukeridentiteten være målet for en kompositt-FK. | Negativ databasesmoke avviste mismatch før sideeffekt. |
| En manuell elevtest rapporterte React-hydratiseringsavvik fordi nettleseren kunne gjenopprette `open` på et serverrendret `<details>`. | Erstattet den native gruppe-disclosureen med kontrollert knapp/panel som alltid starter lukket og bruker `aria-expanded`, `aria-controls` og `hidden`. | Auth-E2E forsøker å mutere den gamle native selektoren før hydration, observerer ingen runtime-feil og bekrefter at en fersk autentisert elevside starter lukket. Se også C1-loggen. |
| Axe fant 4,33:1-kontrast på den tonede etiketten «Forrige økt» under ansattporten. | Endret bare den sekundære tekstfargen fra `slate-600` til `slate-700`; hierarkiet og elevflyten er uendret. | Målrettet hjelpekø-E2E og full ansattmatrise bestod uten axe A/AA-avvik. |
| Etter tvungen avslutning lå `playwright/.auth/local-runner.lock` igjen, og `npm run lab` krevde manuell sletting. | Laben kan nå adoptere bare en beviselig død PID gjennom atomisk gate og matchende tilfeldig runner-ID; refresh-token, faste identiteter og AAL2 valideres før scenariet fortsetter. Aktiv, ukjent eller eldre ubundet lås feiler fortsatt lukket. | 19/19 cache-/låstester, inkludert to samtidige recoverere i separate prosesser med nøyaktig én vinner og kontrollert metadataoverføring, normal reuse 1/1 og dead-PID recovery 1/1 bestod uten reset. Detaljer står i [lokal lab](LOCAL_EXPLORATION_LAB.md#retest-18-juli-2026--krasjgjenoppretting). |
| Første fulle WebKit-runde bestod 57/58; en hard test-`reload()` avbrøt en legitim Next.js RSC-oppdatering med `Load failed`. | Beholdt streng runtime-feilkontroll, men åpnet en fersk autentisert elevside for persistensbeviset i stedet for å erstatte dokumentet midt i RSC-trafikken. | Målrettet WebKit-retest bestod 5/5 med varig oppgaveiterasjon og deterministisk lukket disclosure. |
| Sikkerhetsrevisjonen fant at den eldre rå `reconcile_help_queue_sessions` fortsatt var service-role-RPC og kunne lukke en kø uten å pensjonere aktive deltakere. | Omdøpte råfunksjonen til en intern, ugrantet hjelper. Det opprinnelige offentlige navnet er nå en komposittoperasjon som reconciler sesjon, pensjonerer deltakere og reconciler på nytt i samme transaksjon. | Tom database og representativ oppgradering bestod. Privilege-smoke avviser direkte kall til råhjelperen; naturlig tom sesjonsslutt krever nå `queue_closed`-uttreden/audit, mens en stengende kø med aktiv elev beholder deltakeren. |
| Første artefaktrunde bestod den nye to-ansatt-flyten, men Windows returnerte en kortvarig `UNKNOWN open` da en eldre sporet E1-PNG skulle overskrives. | Evidenslagring prøver nå samme skjermbilde opptil tre ganger med kort, avgrenset venting; funksjonsassertions eller screenshot-baselines endres ikke. | Hele målrettede spec bestod 4/4 og skrev E1-, E2- og E3-artefaktene i neste runde. |

Ingen ekstern eller linket Supabase ble mutert. Alle fixtures, skjermbilder og
logger er syntetiske; ingen passord, elevkode, TOTP-hemmelighet eller nøkkel er
lagret i repoet.

## Verifikasjon

| Port | Resultat 18. juli 2026 |
| --- | --- |
| Målrettede cache-/låstester | Bestått 19/19, inkludert aktiv eier, ukjent/endrede metadata, to samtidige stale-lock-recoverere i separate prosesser, runnerbinding og kontrollert dead-PID recovery. |
| `npm run test:db:staff` | Bestått fra tom database og representativ oppgradering, inkludert deltakelse, RLS/grants, reconcile, rescue, overlapping assignment, retries, rollback og identitets-FK. |
| `npm run test:e2e:auth` | Bestått 15/15 i Chromium, inkludert hydratiseringsregresjonen og deterministisk lukket gruppe på en fersk autentisert side. |
| `npm run test:e2e:staff` | Bestått 9/9 i Chromium etter kontrastretesten; endelig målrettet køspec bestod 4/4 med to ansatte, seks viewports og stabil artefaktlagring. |
| `npm run test:e2e:visual` | Bestått 36/36 i Chromium for fem målviewports og relevante reflow-proxyer. |
| `npm run verify:checkpoint` | Bestått på sluttkandidaten: lint, kjernelint, TypeScript, 90/90 enhetstester, produksjonsbuild og 4/4 offentlig Chromium-E2E. To moderate transitive PostCSS-funn under Next.js er registrert; ingen high/critical-funn. |
| Målrettede WebKit-retester | Bestått 5/5 etter at testens harde reload ble erstattet med en fersk autentisert side. Etter siste databaseherding bestod køspec-en 4/4 på nytt. |
| `npm run test:e2e:full:webkit` | Bestått 58/58 før den isolerte rå-reconcile-herdingen, inkludert to ansatte i åpen/`closing` kø, hydration, B2, axe, reflow og alle responsive WebKit-prosjekter. Den berørte køspec-en ble deretter retestet 4/4 på sluttkandidaten. |

## Visuell evidens

- [360×640 – mobil](evidence/E3/shared-queue-participant-360x640.png)
- [640×360 – mobil landskap](evidence/E3/shared-queue-participant-640x360.png)
- [720×450 – 200 %-reflow-proxy](evidence/E3/shared-queue-participant-720x450.png)
- [768×1024 – iPad portrett](evidence/E3/shared-queue-participant-768x1024.png)
- [1024×768 – iPad landskap](evidence/E3/shared-queue-participant-1024x768.png)
- [1440×900 – desktop](evidence/E3/shared-queue-participant-1440x900.png)

Artefaktene viser syntetisk to-ansatt-deltakelse før personlig uttreden. De er
semantiske QA-bevis, ikke automatisk godkjente screenshot-baselines.
