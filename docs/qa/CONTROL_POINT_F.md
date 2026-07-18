# Kontrollpunkt F – integrert Klar 3.0-motor

**Status:** Automatisert, lokal A–E-motorbaseline verifisert 18. juli 2026 i
Chromium og WebKit. Kontrollpunktets navngitte fysiske enhetsporter er fortsatt
åpne.

**Omfang:** Den implementerte sikkerhets-, plan-, oppgave-, progresjons-,
belønnings- og hjelpekømotoren i kontrollpunktene
[A1](./CONTROL_POINT_A1.md), [B1](./CONTROL_POINT_B1.md),
[B2](./CONTROL_POINT_B2.md), [C1](./CONTROL_POINT_C1.md),
[D2](./CONTROL_POINT_D2.md), [D3](./CONTROL_POINT_D3.md),
[E1](./CONTROL_POINT_E1.md), [E2](./CONTROL_POINT_E2.md) og
[E3](./CONTROL_POINT_E3.md).

**Autoritative produktkilder:**
[domenekontrakten](../product/DOMAIN_CONTRACT.md),
[implementeringsplanen](../IMPLEMENTATION_ROADMAP.md) og de relevante epicene i
[`docs/epics`](../epics/).

## Mål og avgrensning

F beviser at den eksisterende A–E-motoren kan bygges og kjøres samlet med
representative, syntetiske elev- og ansattroller. Baseline er sammenligningspunkt
for de neste opplevelsesslicene; den er ikke en erklæring om at alle delporter i
A–E er ferdige.

F innebærer heller ikke at planlagt funksjonalitet er levert. Medievedlegg og
offlinehåndtering i E01, øvrige belønningsflater i E02, gruppe-/globalt
hjelpekøpanel i E03, full planrevisjon/reimport i E04, øvrige ressursomfang i E05
og E06s samlede produktmatrise står fortsatt åpne. E07–E10 er ikke implementert
av dette kontrollpunktet.

## Akseptansekriterier

- [x] Nåværende elev- og ansattløype kjører sammen mot én lokal, syntetisk
  testverden.
- [x] Tom database, representativ framoveroppgradering, RLS/grants,
  negative organisasjons- og klassegrenser, idempotens, retry, samtidighet og
  fail-closed autorisasjon består.
- [x] Elev og ansatt bruker samme origin, `http://127.0.0.1:3100`, men separate
  browser contexts og storage states.
- [x] Chromium og WebKit består den samme autentiserte funksjonsmatrisen.
- [x] 360×640, 640×360, 768×1024, 1024×768 og 1440×900, samt en 720×450
  reflowproxy, består relevante axe A/AA-, fokus-, overflow-, reduced-motion- og
  geometriporter.
- [x] Reelle avvik, reparasjoner og identiske retester er bevart nedenfor.
- [ ] De navngitte fysiske enhetsportene er gjennomført på den endelige
  kandidatcommiten.

## Verifisert kandidatmatrise

Alle kommandoene ble kjørt fra den autoritative arbeidskopien på branch `3.0`
mot bare lokal Docker/Supabase og syntetiske fixtures.

| Port | Resultat 18. juli 2026 |
| --- | --- |
| `npm run verify:checkpoint` | **Bestått.** ESLint, kjernelint, TypeScript, 98/98 enhets- og boundarytester, produksjonsbuild og offentlig Chromium 4/4. |
| `npm run test:db:staff` | **Bestått.** Tom database med hele migrasjonskjeden og representativ oppgradering fra `00000–00006` bestod RLS/RPC/grants, samtidighet og atomisk fail-closed preflight. |
| Målrettede tester for autoritativ hjelpekøovergang | **Bestått, 8/8.** Predikatene binder feil til kommandoens intensjon; bare et autoritativt resultat som oppfyller akkurat «stå i kø», «knytt til oppgave» eller «gå ut» kan fjerne feilen. |
| Målrettet autentisert hjelpekøretest | **Bestått, 4/4 i både Chromium og WebKit.** Samtidige elevfaner konvergerer til én varig forespørsel uten stale feilmelding. |
| Målrettet capability- og livsløpsretest | **Bestått, 2/2 per fil i både Chromium og WebKit.** Proaktiv tilgangsfjerning og serveravvist stale handling gir begge null mutasjon. |
| `npm run test:e2e:full` | **Bestått, 58/58 i Chromium.** |
| `npm run test:e2e:full:webkit` | **Bestått, 58/58 i WebKit.** |
| `git diff --check` | **Bestått.** |
| Sikker teardown | **Bestått.** Lokal Supabase ble stoppet uten backup; portene 3100 og 54321–54324 var lukket, og ingen runner-lock eller operation gate stod igjen. |

De fulle suitene dekker den representative rolleflyten, men WebKit er ikke et
fysisk Safari-/VoiceOver-bevis, og axe er ikke en skjermlesertest.
Overgangstestene verifiserer tilstands- og intensjonspredikatene, mens den
autentiserte tofane-E2E-en verifiserer den observerte React-integrasjonen.
Testene tvinger ikke React-scheduleren deterministisk gjennom begge mulige
rekkefølger mellom sen kommandofeil og tidlig refresh; begge rekkefølger er
gjennomgått som kodeinvariant, ikke omtalt som separat runtimebevis.

## Database-, sikkerhets- og rollbackgrense

F verifiserer at eksisterende operasjoner er atomiske og fail-closed: tom
database kan bygges, representativ database kan oppgraderes framover, preflight
hindrer delvis migrasjon, og implementerte kommandoer har testet
transaksjonstilbakeføring, idempotens og samtidighetsvern.

Dette er ikke bevis for migrasjonsnedgradering, katastrofegjenoppretting eller
den planlagte E04-flyten for aktiv planrevisjon, treveis reimport og rollback av
en upublisert planrevisjon. Disse funksjonene er ikke implementert og omtales
ikke som verifisert.

## Avvik, reparasjon og retest

| ID | Avvik | Tiltak | Retest |
| --- | --- | --- | --- |
| `F-01` | To samtidige elevfaner opprettet korrekt bare én varig hjelpeforespørsel, men fanen som tapte løpet beholdt en rød, stale feilmelding etter at begge faner viste samme autoritative køtilstand. Første reparasjon var for bred og kunne skjule en annen kommandos feil. | Bandt feilen til kommandoens konkrete intensjon. Bare en autoritativ tilstand som oppfyller akkurat «stå i kø», «knytt til oppgave» eller «gå ut» rydder feilen. Urelatert kontekstualisering skjuler ikke en avmeldingsfeil; den motsatte asynkrone rekkefølgen er sikret av samme invariant og kodegjennomgått. | 8/8 målrettede predikattester, kø-E2E 4/4 i begge motorer og fulle 58/58-matriser i Chromium og WebKit bestod etter siste herding. Ingen separat test tvinger begge React-scheduler-rekkefølgene. |
| `F-02` | En capability-test ventet på en incidental RSC-respons som lovlig kunne utebli selv om UI-et var ferdig. | Erstattet transportbarrieren med observerbar UI-tilstand, eksplisitt capability-resolution, bevart filvalg, fail-closed redirect og uendret beskyttet datatilstand. | Capability-suiten bestod 2/2 i Chromium og 2/2 i WebKit. |
| `F-03` | Første forsøk på å gjenbruke en avbrutt multipart-forespørsel var motoravhengig: WebKit-fangsten hadde filheader, men null filbytes. | Stoppet etter tredje reparasjonsrunde i tråd med arbeidsregelen, forkastet capture/replay-strategien og brukte en isolert, ekte UI-flyt med syntetisk DOCX. | Identisk capability-flyt bestod i begge motorer og i fullmatrisene. |
| `F-04` | Livsløpstesten forventet alltid å kunne klikke en stale ansatthandling etter tilbakekalling. En autoritativ bakgrunnsoppdatering kunne allerede ha fjernet kontrollen og vist «Tilgangen er avsluttet». | Testen godtar nå begge korrekte fail-closed-forløp: proaktiv fjerning eller eksplisitt avvisning ved handling. Begge krever fjernede kontroller, uendret database og uendrede auditinvarianter. | Livsløpssuiten bestod 2/2 i begge motorer; full Chromium og WebKit bestod 58/58. |
| `F-05` | En målrettet køkommando fikk først en for kort verktøytidsgrense, mens barneprosessen fortsatte med en gyldig runner-lock. Neste forsøk brukte feilaktig `smoke`-modus, som ikke inneholder køprosjektet, og rapporterte «No tests found». | Den aktive låsen ble ikke slettet; eierprosessen fikk avslutte før ny kjøring. Køspec-en ble deretter kjørt alene med korrekt `staff`-modus i begge motorer. | 4/4 bestod i Chromium og 4/4 i WebKit. Avsluttende teardown viste ingen runner-lock eller operation gate. |

## Responsiv og visuell baseline

F gjenbruker den kuraterte, semantiske evidensen fra
[B2](./evidence/B2/README.md), [D2](./evidence/D2/),
[D3](./evidence/D3/README.md), [E1](./evidence/E1/README.md),
[E2](./evidence/E2/) og [E3](./evidence/E3/README.md). Bildene viser
syntetiske data og vurderes etter hierarki, hovedhandling, kognitiv belastning,
symbolbruk, responsiv komposisjon og tone. De er ikke pixel-golden-mastere.

F oppretter ingen nye screenshot-baselines. Fulle visuelle kjøringer kan skrive
de kuraterte filene på nytt; slike endringer skal vurderes eksplisitt og ble
restaurert da denne runden ikke avdekket et godkjent visuelt designskifte.

## Fysiske og manuelle porter som står åpne

| Område | Gjenstående kandidatbundet kontroll |
| --- | --- |
| A1 | Resten av VoiceOver-/mobilmatrisen, ekte touch, safe-area/notch, virtuelt tastatur, orientering og eksakt Safari-versjon. Faktisk 200 prosent browserzoom og NVDA er bestått; tidligere iPad-kontroller var vellykkede delbevis på en eldre kandidat. |
| B1 | Den fysiske oppgave-/XP-flyten, faktisk norsk Web Speech-stemme og fallback i en nettleser uten støtte. |
| B2 | Hele flower-claim-flyten med fysisk VoiceOver og NVDA. |
| D2 | Flytt og ny, lenket utsending på fysisk iPad med VoiceOver. |
| D3 | Elevmeny, fagoversikt, oppgavedialog, fullføring og fokusretur med fysisk VoiceOver og NVDA. |
| E03 | Elevhånd, oppgavekontekst, avmelding, reconnect og samspill mellom elev og to ansatte på touch-enhet med skjermleser og safe-area. |

Detaljer og tidligere manuelle delresultater står i de lenkede
kontrollpunktdokumentene og
[A1s manuelle protokoll](./CONTROL_POINT_A1_MANUAL_QA.md).

## Lokal sikkerhetsgrense og teardown

Runneren avviser andre applikasjons-, API- og databasemål enn loopback, og ingen
linket eller ekstern Supabase ble brukt. Dette er en applikasjonsvakt, ikke en
vertsbrannmur: Supabase CLI og Docker Desktop kan publisere portene
`54321–54324` på vertsgrensesnitt. Lokal brannmur må derfor kontrolleres, og
miljøet stoppes med `npx supabase stop --no-backup` etter kontrollpunktet.

Alle fixtures, skjermbilder og logger i runden brukte syntetiske data. Passord,
elevkoder, TOTP-hemmeligheter, cookies, brukerlevert eller ikke-syntetisk
dokumentinnhold og Supabase-nøkler ble ikke lagret i Git eller dette beviset.

## Avhengighetsrevisjon

`npm audit` rapporterte to kjente moderate, transitive PostCSS-funn gjennom
Next.js. Ingen high- eller critical-funn ble rapportert. Den foreslåtte
automatiske `--force`-rettingen ville installert en inkompatibel eldre
Next-versjon og ble derfor ikke brukt.

## Beslutning

**Kontrollpunkt Fs automatiserte utgangskrav er oppfylt: Klar 3.0 har én grønn,
reproduserbar lokal motorbaseline i Chromium og WebKit. Den fysiske
samlingsporten er fortsatt åpen, delkontrollpunktene beholder sine navngitte
manuelle porter, og ingen planlagt E07–E10-funksjon omtales som levert.**
