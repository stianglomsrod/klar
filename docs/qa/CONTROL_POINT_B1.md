# Kontrollpunkt B1 – autoritativ oppgaveovergang og XP-kjerne

**Status:** Verifisert 16. juli 2026

**Epic:** [E02 – Progresjon og belønninger](../epics/E02_PROGRESS_AND_REWARDS.md)

**Kontrakt:** [Domenekontrakten § 7](../product/DOMAIN_CONTRACT.md#7-oppgavestatus-xp-nivå-og-belønning)

## Resultat

B1 erstatter den generelle statussetteren med separate, idempotente og
transaksjonelle kommandoer for elevfullføring, elevangre og ansattretur. Hver
gyldig fullføring oppretter ett uforanderlig fullføringsforsøk og én
XP-kreditering. Angre eller retur oppretter én eksakt, kompenserende
reversering. Samme oppgaveiterasjon kan derfor aldri ha mer enn én aktiv
kreditering.

Nivå og høyeste nivå beregnes i databasen. Førstegangs nivåmilepæler og én
unik belønningstildeling per nivå opprettes i samme transaksjon. En uvalgt
tildeling kan settes på vent ved nivåfall og gjøres tilgjengelig igjen, men
dupliseres aldri.

## Avgrensning

B1 omfatter:

- endelig oppgavestatus `assigned`, `completed` og `reopened`;
- snapshotsatt XP-verdi per elevspesifikk oppgaveiterasjon;
- append-only fullføringsforsøk, overgangshistorikk og XP-ledger;
- cachet progresjon som kan avstemmes mot ledgeren;
- varige nivåmilepæler og unike belønningstildelinger;
- separate, service-role-only RPC-er for fullføring, angre og ansattretur;
- request-ID, payload-fingerprint og lagret svar for retry-idempotens;
- eksplisitte ansattkapabiliteter for progresjonslesing og retur;
- historiske assignments frikoblet fra aktivt klassemedlemskap, med
  medlemskapskrav ved ny tildeling, lesing og alle progresjonskommandoer;
- migrering av eksisterende fullførte prototypeoppgaver til konsistent ledger;
- nødvendig minimal elev- og ansattflyt for å bruke de nye operasjonene.

B1 omfatter ikke:

- valg og innløsning av en konkret belønning;
- konfigurasjon av motivasjonsramme eller elevens rolige spillmodus;
- opplasting, lagring og visning av medievedlegg fra kamera, mikrofon, bilde
  eller tekst;
- undervisningsøkter, tidsbasert elevdag eller «send ut på nytt» i lærer-UI;
- stor level-up-feiring, blomsterhage eller kupongflate.

Datamodellen skal likevel gi neste slice stabile nøkler for belønningsvalg og
E01 et stabilt fullføringsforsøk for eventuelle vedlegg.

## Valgte pilotkonstanter

- Standardverdi for en ny oppgave er **10 XP**.
- Nivåkurven er versjonert som `linear_1000_v1`.
- Nivå 1 starter ved 0 XP; deretter nås ett nytt nivå per 1000 netto XP.

Kontrakten fastsetter ikke tallene. Versjonsnavnet gjør en senere justering
eksplisitt uten å omskrive historiske ledgerposter.

## Autorisasjonsmatrise

| Handling | Elev | Ansatt |
| --- | --- | --- |
| Se progresjon | Bare egen; oppgaver krever nåværende klassemedlemskap | AAL2 + aktivt klasseoppdrag + `student_progress.read` |
| Fullføre | Bare egen synlig iterasjon + nåværende klassemedlemskap | Ikke tillatt |
| Angre | Bare egen aktive fullføring + nåværende klassemedlemskap | Ikke tillatt |
| Åpne igjen | Ikke tillatt | AAL2 + eksakt klasseomfang + `task.return` |

Eierrollen alene gir ingen pedagogisk tilgang. Organisasjon, klasse, elev,
poengverdi og nivå utledes fra den låste oppgaveiterasjonen og sendes aldri
som klientautoritet. Alle nye RPC-er kan bare kjøres av `service_role`, og
serverlaget må validere sesjon/AAL før kall.

## Akseptansekriterier

- [x] Fullføring, forsøk, status, ledger, progresjon, milepæl, entitlement og
  audit lykkes eller rulles tilbake samlet.
- [x] `in_progress` og «Start oppgaven» er fjernet fra aktiv 3.0-flyt.
- [x] Samme request-ID med samme payload returnerer samme svar uten nye rader.
- [x] Samme request-ID med annen payload avvises.
- [x] Dobbeltklikk, to faner og to forskjellige request-ID-er gir høyst én
  aktiv kredit for iterasjonen.
- [x] Angre og ansattretur reverserer nøyaktig aktiv kredit og kan ikke gi
  negativ saldo eller dobbel reversering.
- [x] Ny fullføring etter angre eller retur krediterer snapshotverdien på nytt.
- [x] Endring i oppgavedefinisjonens XP påvirker ikke en eksisterende
  iterasjon eller historisk reversering.
- [x] Ny assignment av samme definisjon til samme elev er en ny iterasjon og
  kan gi legitim ny XP.
- [x] En overgang som krysser flere nivåer oppretter én milepæl og én
  entitlement for hvert nytt nivå.
- [x] Nivåfall senker nåværende nivå, men aldri høyeste nivå eller milepæler.
- [x] Uvalgt entitlement settes på vent og reaktiveres uten duplikat.
- [x] Kontaktlærer, faglærer, spesialpedagog og vikar kan returnere i eget
  aktive omfang; feil klasse, organisasjon, AAL eller utløpt tilgang avvises.
- [x] Student og ansatt kan bare lese progresjonsrader de har eksplisitt
  tilgang til, og ingen autentisert browserrolle kan skrive direkte.
- [x] Fjerning fra klassen bevarer assignment, forsøk og ledger, men gir tom
  oppgave-RLS, nektet elevkommando, nektet ansattretur og nektet ny tildeling.
- [x] Audit inneholder tekniske ID-er, overgang, XP-delta og strukturert
  årsakskode, men ikke elevnavn, oppgavetekst eller returforklaring.
- [x] Oppgradering fra representativ pre-B1-tilstand bevarer fullført-tid og
  gir konsistent ledger/progresjon uten å stole på 2.x-tellere.

## Obligatoriske bevis

- tom PostgreSQL 17-database gjennom alle migrasjoner;
- representativ oppgradering fra `00000–00007`;
- direkte RLS-, grant- og RPC-negative tester;
- samtidige fullføringer, reverseringer og retur/angre-race;
- tvungen feil midt i operasjonen med full rollback og vellykket retry;
- lagret XP-saldo avstemt mot `sum(points_delta)` etter hvert scenario;
- målrettede tjenestetester og lokal autentisert E2E med syntetiske data;
- elev- og ansattflate kontrollert for tastatur, axe, overflow, reduced motion
  og relevante målviewports.

## Verifikasjonsresultat 16. juli 2026

| Port | Resultat |
| --- | --- |
| `npm run test:db:staff` | Bestått: tom PostgreSQL 17, RLS/RPC, samtidighet, tvungen rollback/retry, ny XP-iterasjon, medlemskapsavslutning med bevart historikk og representativ oppgradering. |
| `npm run test:e2e:auth` | Bestått 7/7: tastaturfokus, syntetisk treg/feilende lagring med blokkert X/Escape, vellykket retry, XP, to angre-/fullføringsrunder og AAL2-ansattretur. |
| `npm run test:e2e:visual` | Bestått 22/22: stille og progresjonsaktiv dagsflate, oppgave og checkpoint ved 360×640, 640×360, 768×1024, 1024×768 og 1440×900. |
| `npm run verify:checkpoint` | Bestått: diff check, lint, kjernelint, TypeScript, 37 tester, produksjonsbuild, offentlig E2E og high-severity auditgate. |
| Manuell artefaktgjennomgang | Bestått mot `e2.jpg`, `e4.jpg`, `e6.jpg` og videoens 06:10, 06:24 og 06:26. Mobil er bottom sheet; iPad/desktop er sentrert dialog; progresjonsregionen reflower uten horisontal overflow. |

`npm audit` rapporterte to moderate PostCSS-funn gjennom Next.js. Det finnes
ingen kompatibel automatisk retting; `npm audit fix --force` foreslo en
destruktiv nedgradering til Next 9.3.3 og ble derfor ikke kjørt. High-severity
porten er grønn.

### Avvik, tiltak og retest

| Avvik | Tiltak | Retest |
| --- | --- | --- |
| Første databaseforsøk traff en kald Docker/Postgres-socket. | Lot lokal PostgreSQL bli klar og kjørte samme uendrede test på nytt. | Bestått, og den avsluttende fulltesten bestod begge databasescenariene. |
| Første visuelle elevrunde fant 3,76:1 kontrast på grønn `Ferdig`. | Endret primærgrønn fra emerald 600 til emerald 700. | Alle fem elevviewports bestod axe A/AA. |
| Neste visuelle runde forventet feilaktig progresjonsfooter i en fixture med stille motivasjonsmodus. | Endret testen til å bevise at region, poeng og aggregert `x av y ferdige` ikke lekker. | Stille modus bestod i alle fem viewports. |
| En kort verktøytidsgrense lot et lokalt E2E-barn kollidere med neste seed. | Stanset bare prosjektets lokale Supabase, startet rent og kjørte én runner. | Ren runde bestod; ingen ekstern database ble brukt. |
| Første autentiserte runde viste at progresjonsdokken manglet eksplisitt navn; første tiltak valgte feilaktig `contentinfo` inne i `<main>`. | Uavhengig review korrigerte den til `role="region"` med navnet «Din fremdrift». | 7/7 bestått; nivå, saldo og retur finnes i riktig skjermleserregion. |
| Uavhengig UI-review fant mistet fokus ved sjekkpunktbytte og mulig skjult, låst dialog hvis X/Escape lukket under feilende lagring. | Flyttet fokus eksplisitt til sjekkpunktoverskrift og tilbake til `Fullfør`, lot React-state eie lukking og blokkerte X/Escape under pending. | Tastaturflyt består i fem viewports; autentisert syntetisk nettverksfeil blir synlig, kan lukkes og retryes. |
| Uavhengig sikkerhetsreview fant at historikkens `RESTRICT` kolliderte med assignmentens gamle medlemskaps-`CASCADE`, at gammel browser-RLS ikke krevde nåværende klassemedlemskap, og at første hjelpefunksjon/ansattretur ga henholdsvis et medlemskapsorakel og en retur-bypass. | Frikoblet historisk assignment fra medlemskaps-FK, la inn medlemskapstrigger, gjorde hjelpefunksjonen RLS-respekterende og krevde aktiv elevtilknytning for alle progresjonskommandoer. | Klassemedlemskap kan fjernes; assignment/ledger består, mens orakel, lesing, ny tildeling, elevkommando og ansattretur avvises. |
| Første utvidede visuelle runde var 21/22 på grunn av ett lokalt Windows `ERR_NO_BUFFER_SPACE` etter at axe, overflow og skjermbilde allerede var kontrollert. | Ingen kode eller forventning ble endret; samme komplette runde ble kjørt på nytt. | 22/22 bestått på eksakt kandidat. |

Den fysiske iPad/VoiceOver-runden som tidligere bestod gjaldt A1. B1 er
verifisert i de fem nettleserformatene; en ny fysisk runde tas sammen med den
kommende øktstyrte dagsflaten, slik at samme hardwaretest ikke gjentas på en
bevisst midlertidig faggruppering.

## Prototypeintensjon

`E levelupmodal med valgmuligheter NY.jpg`, blomst-/kupongbildene og `e5.jpg`
viser varig belønning og lett tilgjengelig angre. Den tidskodede
[videoomvisningen](../../Prototypen/Videoomvisning/README.md) viser samme
sekvens i bruk: oppgaveåpning uten «Start», et frivillig mediesjekkpunkt,
poengkreditering, nivåvalg og senere
[angre med poengreversering](../../Prototypen/Videoomvisning/00-08-16-task-undo.png).

B1 implementerer de autoritative garantiene og en første, fungerende UI-bro
for åpning, opplesing, fullføringssjekkpunkt uten vedlegg og angre. Faktisk
opplasting og lagring av elevmedia hører fortsatt til E01 og krever egen
lagrings-, tilgangs- og slettekontrakt. Den historiske konfettien, den tette
halvveis-modalen og røde progresjonsbadges er eksplisitte antimønstre og inngår
ikke.

Opplesingsknappen er implementert som en norsk Web Speech-bro. Faktisk norsk
stemme og fallback når nettleseren mangler støtte er ikke fysisk verifisert i
B1 og inngår i neste relevante enhetsrunde.
