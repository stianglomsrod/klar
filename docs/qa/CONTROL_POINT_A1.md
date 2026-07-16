# Kontrollpunkt A1 – aktive ansattoppdrag og autorisasjonskjerne

**Status:** Implementert – de konfigurerte automatiske kommandoportene samt
manuell Port A og NVDA-port B1 er grønne. Kravrevisjonen har åpne automatiske
evidensgap, og VoiceOver-port B2 og de øvrige fysiske enhetsportene er ikke
fullført på hele enhetsmatrisen

**Forberedt:** 15. juli 2026

**Sist automatisk verifisert:** 16. juli 2026

**Baseline:** `838aa96` på branch `3.0`

**Overordnet kontrollpunkt:**
[Kontrollpunkt A – felles fundament](../IMPLEMENTATION_ROADMAP.md#kontrollpunkt-a--felles-fundament)

Dette dokumentet er implementeringskontrakten og bevisoversikten for første
vertikale slice av E05 og E06. A1-kjernen er implementert, men kontrollpunktet
er ikke fullført før de åpne automatiske evidensgapene og de resterende fem
fysiske og manuelle portkategoriene er dokumentert.

## 1. Autoritative kilder og inngangskrav

A1 følger, i prioritert rekkefølge:

1. [domenekontraktens rolle- og omfangsmodell](../product/DOMAIN_CONTRACT.md#4-aktører-roller-og-ressursomfang),
   sikkerhetsinvarianter og tilgjengelighetskrav;
2. [E05 – ansattilgang og vikar](../epics/E05_STAFF_ACCESS_AND_SUBSTITUTES.md);
3. [E06 – responsive og tilgjengelige skall](../epics/E06_RESPONSIVE_ACCESSIBLE_SHELLS.md);
4. [implementeringsplanens kontrollpunkt A](../IMPLEMENTATION_ROADMAP.md#kontrollpunkt-a--felles-fundament);
5. [UI/UX-referansen](../product/UI_UX_REFERENCE.md) og de valgte
   prototypebildene i dette dokumentet;
6. README, pilotrunbook, migrasjoner og tester som sannhet om nåtilstanden.

Kontrollpunkt 0 er grønt i Chromium og WebKit. All A1-database-, Auth- og
E2E-verifikasjon er kjørt med syntetiske data mot lokal Docker/Supabase på
loopback. Det linkede pilotprosjektet er ikke brukt eller mutert.

## 2. Utgangspunkt og lukket sikkerhetsgap

Før A1 brukte 3.0 organisasjonsrollen `owner`/`teacher` og
`class_memberships.role = 'teacher'` som pedagogisk autoritet flere steder:

- serverautorisasjon i `src/server/auth/authorize.ts`;
- klasseoversikt og arbeidsflate;
- oppgavepublisering og planimport;
- hjelpekø og elevens støtteinnstillinger;
- databasefunksjoner, triggerkontroller og RLS-policyer.

Dette var tilstrekkelig for den daværende avgrensede pilotkjernen, men oppfylte
ikke E05. Et assignment-register alene ville ikke vært sikkert: en
tilbakekalt ansatt kunne fortsatt få tilgang gjennom en gammel rolle-,
klassemedlemskaps-, RLS- eller RPC-sjekk. A1 gjennomfører derfor én samlet
autorisasjons-cutover uten legacy-fallback for pedagogisk voksentilgang.

Organisasjonsmedlemskap beholdes som identitet og grov ruting. Elevens
klassemedlemskap beholdes som elevtilhørighet. Ingen av delene skal alene gi en
voksen rett til pedagogiske klasseopplysninger eller handlinger.

## 3. Goal-resultat

En eier med AAL2 kan gi en eksisterende, navngitt ansattkonto et eksplisitt,
klasseavgrenset og tidsavgrenset oppdrag med obligatorisk slutt, og kan trekke
oppdraget tilbake. Bare systemopprettet legacy-/`operational_owner`-tilgang har
det dokumenterte unntaket for åpen slutt. Den ansatte bruker personlig konto
og AAL2, ser bare tildelte klasser
og kan utføre dagens pedagogiske kjernehandlinger gjennom en fast,
serverdefinert kapabilitetsprofil. Før start, ved utløp, etter utløp,
tilbakekalt, ved AAL1 eller utenfor klasse/organisasjon skal både lesing og
mutasjon avvises.

Opprettelse, tilbakekalling og pedagogiske mutasjoner skal kunne forklares med
aktør, assignment-ID, kapabilitet, ressurs og tidspunkt. UI-et skal fungere på
alle fem målviewports og etablere de første gjenbrukbare primitive delene av
ansattskallet.

### Goal-tekst som kan brukes ordrett

> Implementer og verifiser Kontrollpunkt A1 i
> `docs/qa/CONTROL_POINT_A1.md` med repoets `$klar-loop`. Gjennomfør en hard
> cutover fra generell owner/teacher- og class-membership-autorisasjon til
> aktive, klasseavgrensede staff assignments med den faste
> `class_pedagogy_v1`-profilen. Lever eierens AAL2-beskyttede opprettelse og
> tilbakekalling, personlig AAL2-flyt for ansatt/vikar, trygt legacy-backfill,
> RLS/RPC/serverkontroll, audit, responsivt ansattskall og hele A1-bevismatrisen.
> Bruk bare lokal Supabase og syntetiske data. Stopp ved et grønt, dokumentert
> kontrollpunkt-commit; ikke push.

Goalen startes uten et kunstig tokenbudsjett. Scope, porter og stoppvilkår i
dette dokumentet er den operative begrensningen.

## 4. Vertikal brukerflyt

1. Eier logger inn med personlig konto og AAL2.
2. Eier åpner **Tilganger** i ansattskallet.
3. **Gi tilgang** åpner en dialog på større skjermer og et sheet på mindre
   skjermer.
4. Eier velger en eksisterende ansattkonto i egen organisasjon, jobbetikett,
   én klasse, start og obligatorisk slutt.
5. UI-et oppsummerer person, klasse, gyldighet og handlingene i
   `class_pedagogy_v1` før bekreftelse.
6. Serveroperasjonen validerer eier, AAL2, organisasjon, målbruker, klasse,
   periode og idempotens, oppretter oppdraget atomisk og skriver audit.
7. Den ansatte logger inn personlig og fullfører AAL2. Bare aktive, tildelte
   klasser vises.
8. En representativ pedagogisk mutasjon – oppgavepublisering – går gjennom
   samme sentrale kapabilitetskontroll og skriver assignment-ID i audit.
9. Eier trekker oppdraget tilbake. Den ansattes neste serverlesing eller
   serverhandling revaliderer oppdraget og avvises uten ny innlogging.
10. Reload eller direkte navigasjon viser ikke lenger klasse- eller elevdata.

En allerede rendret side kan ikke fjernslette data som er lastet ned uten en
egen realtime-kontrakt. A1 krever revalidering ved neste lesing, handling,
navigasjon, reload eller når den åpne flaten eksplisitt ber om ny status.
Subsekund-realtime for utløp og tilbakekalling er ikke del av A1.

## 5. Låste domenebeslutninger

### 5.1 Identitet, kontrollplan og pedagogisk plan

- `memberships.role` beskriver organisasjonstilknytning og grov aktørtype.
- Hver pedagogisk autorisasjon revaliderer at assignment-eieren fortsatt har
  et `owner`- eller `teacher`-medlemskap i samme organisasjon. Et gammelt
  assignment kan aldri holde liv i tilgang etter demotering eller fjerning.
- Jobbetikett ligger på oppdraget og gir aldri rettigheter alene.
- `owner` er eneste kontrollplanrolle i A1 og kan, med AAL2, forvalte klasser,
  prototypekontoer og assignments i egen organisasjon.
- En eier får ikke pedagogisk elevtilgang bare fordi rollen er `owner`.
- Pedagogisk tilgang krever et aktivt assignment, riktig klasse, eksplisitt
  kapabilitet og AAL2 – også for eieren.
- En egen `admin`-rolle er ikke nødvendig for A1. Modellen skal ikke hindre at
  den innføres senere.

### 5.2 Jobbetiketter

Datamodellen skal kunne uttrykke minst:

- kontaktlærer;
- faglærer;
- ITO-/spesialpedagog;
- vikar;
- de interne etikettene `legacy_teacher` og `operational_owner` for henholdsvis
  ærlig lærerbackfill og ownerens eksisterende eller nyopprettede
  lærerklasseforhold.

De fire pedagogiske etikettene har samme `class_pedagogy_v1`-profil i A1.
Interne etiketter kan ikke velges ved vanlig opprettelse. I tilgangslisten
vises de med menneskelige navnene **Overført lærertilgang** og **Operativ
eiertilgang**, sammen med kilden. De kan trekkes tilbake gjennom samme
eksplisitte owner-flyt; eieren beholder kontrollplantilgang og kan opprette et
nytt, vanlig klasseoppdrag ved behov. UI-et skal aldri vise rå internkoder.

Et eksisterende lærerklassemedlemskap skal backfilles med en nøytral intern
etikett og eksplisitt migrasjonskilde; migrasjonen skal ikke gjette om personen
var kontaktlærer, faglærer eller ITO.

### 5.3 Ressursomfang

- A1 oppretter bare klasseomfang.
- UI-et oppretter ett oppdrag for én klasse om gangen.
- Alle FK-er og serverkontroller skal bevise at assignment, bruker og klasse
  tilhører samme organisasjon.
- Assignment har organisasjonskonsistent FK til medlemskapet. Aktivt
  voksenoppdrag må tilbakekalles før medlemskapet kan demoteres; sletting av et
  medlemskap med historiske assignments er `restrict` i A1. Runtime-resolveren
  joiner likevel medlemskapet og nekter ved enhver inkonsistent tilstand.
- Gruppe-, fag-, elev- og øktomfang er senere E05-arbeid. A1-strukturen skal
  kunne utvides med egne, integritetskontrollerte scopetabeller uten å bruke
  frie ressurs-ID-er.

### 5.4 Gyldighet og tilbakekalling

- Gyldighetsintervallet er halvåpent: `[starts_at, ends_at)`.
- Starttidspunktet er inklusivt; nøyaktig sluttidspunkt er utløpt.
- Alle assignments opprettet gjennom A1-UI-et må ha sluttidspunkt. Bare
  systemopprettet legacy-/`operational_owner`-tilgang kan ha åpen slutt når en
  forsvarlig historisk eller operativ slutt ikke finnes.
- `revoked_at` vinner over tidsintervallet.
- Produksjonsautorisasjon bruker database-/servertid, aldri browserklokke eller
  et klientstyrt `p_now`.
- Opprettelse og tilbakekalling skal være retry-sikre. Dobbel innsending skal
  ikke lage duplikatoppdrag eller flere semantiske revokeringer.
- Flere gyldige oppdrag kan eksistere, men autorisasjon skal velge én
  deterministisk grant slik at audit peker på et bestemt assignment.
- En idempotent `reconcile_expired_staff_assignments`-operasjon registrerer
  `staff_assignment.expired` nøyaktig én gang med både faktisk registreringstid
  og `effective_at = ends_at`. Den kalles før ownerens tilgangsliste leses og
  når serverautorisasjonen møter en utløpt kandidat, og kan senere kjøres av en
  scheduler. Autorisasjon bruker alltid tidsfeltene direkte og venter aldri på
  reconciler eller audit. Reconcile-kallet committes separat før den avviste
  forespørselen, slik at en senere autorisasjonsfeil ikke ruller audit tilbake.

### 5.5 Kapabilitetsprofil

A1 tilbyr ingen fri kapabilitetsvelger. Serveren utvider den versjonerte
profilen `class_pedagogy_v1` til et eksplisitt sett som dekker dagens
pedagogiske flyter:

| Kapabilitet | Nåværende flyt |
| --- | --- |
| `class.workspace.read` | Klasse, elever, oppgaver og relevant status i tildelt klasse |
| `task.publish` | Publisere oppgave til tildelt klasse |
| `plan.preview` | Tolke plan med tildelt klasse som eksplisitt kontekst |
| `plan.publish` | Publisere kontrollert plan til tildelt klasse |
| `help_queue.manage` | Se, overta og løse klassens eksisterende hjelpekø |
| `student_support.update` | Endre eksisterende støtte-/progresjonsvisning for elev i klassen |

Ukjente og nye kapabiliteter er deny-by-default. Notater, medier, belønninger,
retur og funksjoner fra senere epics skal ikke snikes inn i profilen før de har
egen implementasjon og test.

Disse er kontrollplanhandlinger og ligger uttrykkelig utenfor profilen:

- opprette klasse;
- opprette eller slette konto/elev;
- opprette eller tilbakekalle assignment;
- endre organisasjons- eller sikkerhetsinnstillinger.

## 6. Data- og migrasjonskontrakt

Migrasjonen `20260715000000_staff_assignments.sql` implementerer følgende
ressurser og invarianter:

- `staff_assignments` med organisasjon, målbruker, jobbetikett,
  gyldighetsperiode, tilbakekalling, oppretter, versjon, idempotensmetadata og
  en entydig markør for registrert utløpsaudit;
- en integritetskontrollert klasse-scopetabell, ikke en fri polymorf UUID;
- eksplisitte assignment-kapabiliteter eller en materialisert, versjonert
  profil som kan revalideres i RPC;
- indekser for aktivt oppdrag per bruker/organisasjon/klasse og for
  utløpskontroll;
- sentral SQL-helper for aktivt scope + kapabilitet;
- sentral helper skal også kreve nåværende voksenmedlemskap i samme
  organisasjon ved hver autorisasjon;
- RLS på alle nye tabeller, eksplisitte grants og ingen klientmutasjon;
- service-role-RPC-er for opprettelse og tilbakekalling som også gjennomfører
  domenesjekk og audit;
- strukturerte, organisasjonskonsistente auditfelt for autoriserende
  assignment-ID og kapabilitet ved hver pedagogisk mutasjon; de skal ikke bare
  ligge som uvalidert fritekstmetadata.

Assignmentets identitet, mål, scope, profil og gyldighetsperiode er uforanderlig
etter opprettelse. A1 endrer bare revokerings- og expiry-auditfeltene; annen
endring skjer som tilbakekalling + nytt assignment. Oppdrag, scopes og
kapabiliteter hard-slettes ikke etter at de kan ha autorisert en handling.

### 6.1 Sikker oppgradering fra dagens pilotkjerne

A1-migrasjonen skal være additiv og bevare eksisterende pedagogiske data:

1. Opprett nye typer/tabeller/helpere uten å fjerne gamle rader.
2. Kjør en fail-closed preflight som avviser en inkonsistent
   lærerklassemedlemskapsrad dersom det nåværende organisasjonsmedlemskapet ikke
   er `owner` eller `teacher`; slike rader skal aldri silently konverteres.
3. Backfill nøyaktig ett eksplisitt, ikke-utløpende klasseoppdrag med
   `class_pedagogy_v1` for hvert eksisterende
   `class_memberships.role = 'teacher'`. Bruk `operational_owner` når denne
   raden tilhører en owner, ellers `legacy_teacher`.
4. Ikke materialiser `owner × alle klasser`. Den gamle globale owner-grenen i
   RLS strammes inn med vilje: owner uten lærerklassemedlemskap/assignment får
   kontrollplantilgang, men ingen pedagogiske klasseopplysninger. Dette er en
   tilgangsinnstramming, ikke datatap, og skal bevises særskilt i upgrade-testen.
5. Merk backfillkilden teknisk og skriv audit uten å dikte en pedagogisk
   jobbetikett eller menneskelig aktør.
6. Bytt serverautorisasjon, RLS, RPC-er og triggerkontroller til assignment og
   kapabilitet i samme migrasjons-/kodeleveranse.
7. Behold voksne `class_memberships` midlertidig som kompatibilitetsdata, men
   test at en slik rad uten assignment ikke gir tilgang noe sted.
8. Gjør klasseopprettelse owner-only. Opprettelsen skal atomisk lage et
   eksplisitt `operational_owner`-assignment for den nye klassen, med synlig
   konsekvens i UI og audit.
9. Gjør opprettelse av prototypeelev owner-only. Pedagogiske ansatte og vikarer
   kan arbeide med eksisterende elever, men ikke forvalte kontoer.

Planforhåndsvisning skal samtidig få eksplisitt klassekontekst. En generell
«har en lærerrolle et sted»-sjekk før dokumenttolking er ikke tilstrekkelig.

Det skal ikke finnes en overgangsperiode der både gammel rollelogikk og ny
assignmentlogikk godtas. Hvis hard cutover ikke kan gjøres i samme grønne
checkpoint, skal arbeidet forbli WIP og ikke fremstilles som A1-ferdig.

### 6.2 Lagdelt AAL2- og TOCTOU-kontroll

- Serverlaget verifiserer ekte session, målressurs og AAL2.
- RLS for direkte autentisert lesing kontrollerer JWT-ens `sub` og `aal` samt
  aktivt assignment.
- Kontrollplan-RLS krever owner + AAL2 for andre brukeres konto-, assignment-
  og scopemetadata. Owner AAL1 kan bare lese egen identitet/sessiondata som er
  nødvendig for innlogging og MFA, ikke kontrollplan- eller pedagogiske data.
- Service-role-RPC får verifisert aktør og assignment-ID og revaliderer tid,
  scope og kapabilitet før mutasjon, slik at tilbakekalling mellom
  serverkontroll og RPC ikke kan utnyttes.
- Et løst `p_aal` sendt til service-role-RPC er ikke et gyldig MFA-bevis.
- `anon` og `authenticated` får ikke execute på muterende RPC-er.

## 7. UI- og skallkontrakt

### 7.1 Informasjonsarkitektur

- Eksisterende `/v3/teacher` beholdes som kompatibel URL til ansattskallet.
- Kontrollplanet for assignments får den eksplisitte ruten
  `/v3/teacher/access`. Direkte navigasjon fra owner AAL1, vanlig ansatt,
  vikar, elev eller aktør i annen organisasjon skal ikke returnere assignment-,
  konto- eller scopemetadata.
- Synlig språk bruker **ansatt**, **oppdrag** og **Tilganger** der «lærer» blir
  for smalt.
- Eier ser navigasjon til **Tilganger**; vanlig ansatt og vikar gjør ikke det.
- Ansatte uten aktive oppdrag får en rolig tomtilstand uten klasse- eller
  elevdata, ikke en innloggingsfeil.
- Klasseflaten viser bare handlinger som den aktive, valgte grant-en tillater.
- Ingen nylig besøkte elever, aktivitetsfeed eller organisasjonsomfattende
  elevsøk vises før de kan avgrenses sikkert.
- Ressursvelgeren på tilgangssiden kan lese voksenidentitet og klassemetadata i
  eierens organisasjon, men aldri elevrader, oppgavestatus, kø eller
  støtteopplysninger som del av kontrollplanlesingen.

Capability og synlig kontroll skal kobles eksplisitt:

| Autorisasjon | Synlig UI |
| --- | --- |
| `class.workspace.read` | Klassenavn, elevliste, oppgaver og relevante statusflater |
| `task.publish` | `PublishTaskForm` |
| `plan.preview` | Opplasting og forhåndsvisning i `SmartImportPanel` |
| `plan.publish` | Publiseringshandlingen i `SmartImportPanel` |
| `help_queue.manage` | Ansattkø, overta og løse |
| `student_support.update` | `TeacherStudentExperienceEditor` |
| owner + AAL2 control plane | `CreateClassForm`, `CreateStudentForm` og **Tilganger** |

En manglende kapabilitet skal både skjule kontrollen og avvises på server/RPC;
skjult UI er aldri selve sikkerhetsbeviset.

### 7.2 Opprettelses- og tilbakekallingsflyt

«Gi tilgang» skal bruke samme semantiske dialogkomponent med ulik responsiv
presentasjon:

- navngitt dialog med konsekvensbeskrivelse;
- inert bakgrunn, fokusfelle, Escape/lukk og fokusretur;
- native select/radio og `fieldset`/`legend` i A1;
- eksisterende voksenmedlem i egen organisasjon som mål;
- målmedlemmet må ha voksenrollen `owner` eller `teacher`; student, annen
  organisasjon og intern jobbetikett avvises også ved direkte server-/RPC-kall;
- jobbetikett, én klasse, start og obligatorisk slutt;
- lesbar oppsummering i norsk tidssone før bekreftelse;
- statusene planlagt, aktiv, utløpt og tilbakekalt uttrykkes med tekst og
  symbol, ikke bare farge;
- «Trekk tilbake» bruker egen bekreftelse og destruktiv knapp får ikke
  startfokus;
- feiloppsummering fokuseres, og lagring/resultat annonseres med live-region.

På mobil er dette samme skjema, feltsett og DOM-rekkefølge som på desktop,
stablet responsivt – ikke en egen wizard.

### 7.3 Ansattskall og tilgangstap

Ansattskallet skal minst ha hopp-lenke, `lang="nb"`, navngitte landemerker,
korrekt overskriftshierarki og `aria-current` for aktiv navigasjon.
Mobilmenyknappen har tilgjengelig navn, `aria-expanded` og `aria-controls`.
Draweren gjør bakgrunnen inert, holder fokus, støtter Escape/lukk og returnerer
fokus til menyknappen. Det skal aldri finnes to samtidig fokuserbare kopier av
navigasjonen.

Når revalidering oppdager at oppdraget er avsluttet, erstattes den beskyttede
flaten med en rolig **Tilgangen er avsluttet**-tilstand. Endringen annonseres,
fokus flyttes kontrollert til melding eller hovedoverskrift, og gamle klasse-,
elev-, oppgave-, kø- og støtteopplysninger finnes ikke lenger i DOM-en.

### 7.4 Responsiv komposisjon

| Viewport | Navigasjon og liste | Opprett-flyt |
| --- | --- | --- |
| 360 × 640 | Kompakt toppfelt/drawer og énkolonne assignment-kort | Fullskjerm-sheet med én tydelig seksjon om gangen |
| 640 × 360 | Lav mobilheader og vertikal scrolling uten fast footer over innhold | Fullskjerm-sheet der bare innholdsområdet ruller |
| 768 × 1024 | Toppfelt/drawer og romslige kort | Fullhøyde side-sheet |
| 1024 × 768 | Fast, smal sidemeny og brede semantiske rader | Sentrert dialog |
| 1440 × 900 | Fast sidemeny og tabell/list-detail innen maks innholdsbredde | Sentrert dialog uten unødvendig wizard |

Ved 200 prosent zoom skal desktop gå over til kort-/sheet-komposisjon uten
horisontal scrolling. Sticky elementer skal ikke skjule innhold eller fokus.
Sentrale touchhandlinger skal være minst 44 × 44 CSS-piksler. QA skal også
dekke safe-area, åpent virtuelt tastatur, overstyrt systemfont og økt
linje-/bokstavavstand. Et fokusert felt i 640 × 360-sheetet skal forbli synlig
når skjermtastaturet reduserer den brukbare høyden.

### 7.5 Valgte prototypebilder

| Referanse | Intensjon som beholdes | Det som ikke kopieres |
| --- | --- | --- |
| `Prototypen/L Landingsside med oversikt og hurtighandlinger - statistikk er en plassholder.jpg` | Fast desktopmeny, tydelig overskrift, hvite handlingskort og prioritert innhold | Dekorativ statistikk, uautorisert aktivitetsfeed, små chevrons og hover-only |
| `Prototypen/L Mine elever 1.jpg` | Klassehierarki, ressursgruppering, søk og eksplisitte antall | Krympet desktopliste på mobil, direkte køtoggles, tre-prikk som eneste handling og implisitt global elevtilgang |
| `Prototypen/L Mine elever 2 - oppretting av egen gruppe.jpg` | Historisk referanse for tydelig dialogtittel, valgt antall, avgrenset valg og separate avbryt/bekreft-handlinger | Liten checkbox, nested scrolling, manglende fokuskontrakt og farge som eneste valgtstatus |
| `Prototypen/Forsideillustrasjon Lærer Dashboard Mobil NY.jpg` | Kompakt toppfelt, kjent menyknapp og sekvensielle kort | Telefonramme, pixelmål eller antakelser om drawer, safe-area og innhold under folden |

Bildene er semantiske referanser, ikke screenshot-baselines.

## 8. Akseptansekriterier

### Domene og sikkerhet

- [x] A1 bruker bare personlig voksenidentitet og AAL2 for pedagogisk tilgang.
- [x] Eier AAL1 kan ikke opprette eller tilbakekalle assignment.
- [x] Vanlig ansatt kan ikke gi seg selv eller andre tilgang.
- [x] Normal opprettelse avviser student, målbruker/klasse i annen
  organisasjon, ugyldig intervall, manglende slutt og forsøk på å velge en
  intern jobbetikett – både i serveroperasjon og RPC.
- [x] Alle fire pedagogiske jobbetiketter får samme `class_pedagogy_v1` innen
  identisk aktivt klasseomfang.
- [x] Før start, ved nøyaktig slutt, etter slutt og etter tilbakekalling
  avvises lesing og mutasjon.
- [x] Feil klasse, feil organisasjon, ukjent kapabilitet og manglende
  assignment avvises deny-by-default.
- [x] Gammelt lærerklassemedlemskap uten assignment gir ingen pedagogisk
  tilgang via server, RLS, RPC eller trigger.
- [x] Aktiv demotering av målbrukerens voksenmedlemskap avvises til oppdraget
  er tilbakekalt; etter tilbakekalling/demotering gir det historiske
  assignmentet ingen tilgang, og inkonsistent tilstand avvises fail-closed.
- [x] Kontrollplanhandlingene klasse-, konto- og assignmentforvaltning er
  owner-only og inngår ikke i `class_pedagogy_v1`.
- [x] Opprettelse/retry lager ikke semantiske duplikater, og gjentatt
  tilbakekalling er idempotent.
- [x] Neste serverlesing eller serverhandling fra en åpen, tilbakekalt sesjon
  avvises uten ny innlogging.
- [x] Audit for assignment-opprettelse, tilbakekalling og pedagogiske
  mutasjoner viser aktør, assignment, kapabilitet, ressurs og tidspunkt.
- [x] Reconciler-operasjonen registrerer utløp idempotent som
  `staff_assignment.expired`, også ved parallelle retry, mens
  tilgangsavgjørelsen alltid bruker tidsfeltet direkte.
- [x] Browserklienten har read-only grants mot tabellene og kan ikke mutere
  assignments eller pedagogiske data direkte.

### Migrasjon og kompatibilitet

- [x] Hele migrasjonskjeden bygger fra tom database.
- [x] Representativ `00000–00006`-database kan oppgraderes til A1.
- [x] Eksisterende elev-, oppgave-, status- og kødata er uendret etter
  oppgradering.
- [x] Eksisterende mutasjonstilgang fra lærerklassemedlemskap er bevart gjennom
  eksplisitte klasseoppdrag, ikke legacy-fallback, uten å gi owner nye
  skriverettigheter i andre klasser.
- [x] Owner AAL2 uten klasseassignment kan bruke kontrollplanet, men får ingen
  pedagogiske klasse-, elev-, oppgave-, kø- eller støtterader.
- [x] Backfill gjetter ikke pedagogisk jobbetikett og lager ikke assignment for
  elever.
- [x] Nye tabeller har RLS, dokumenterte grants og ingen anonym tilgang.

### UI, UX og E06

- [x] Eier kan opprette og tilbakekalle ett oppdrag gjennom hele UI-flyten.
- [x] Ansatt ser bare tildelte klasser og tillatte handlinger.
- [x] Vanlig ansatt ser ikke **Tilganger** eller owner-only-handlinger.
- [x] Direkte navigasjon til `/v3/teacher/access` fra owner AAL1, ansatt/vikar
  AAL2, elev og other-org-aktør returnerer ingen kontrollplanmetadata.
- [x] Owner AAL1 kan heller ikke lese andre brukeres konto-, assignment- eller
  scopemetadata direkte gjennom authenticated RLS/RPC; egen MFA-identitet er
  eneste dokumenterte unntak.
- [x] Hver kapabilitet styrer den dokumenterte synlige kontrollen, mens direkte
  action/RPC fortsatt avviser når kontrollen er skjult.
- [x] Interne assignments vises med menneskelig navn og kilde, aldri rå kode,
  og tilbakekalling forklarer konsekvensen før bekreftelse.
- [x] De fire assignment-statusene er forståelige uten farge.
- [x] Dialog/sheet har navn, beskrivelse, fokusfelle, Escape/lukk og fokusretur.
- [x] Alle handlinger kan utføres med tastatur uten hover eller drag.
- [ ] Handlingene og de sentrale trykkmålene er verifisert med ekte berøring.
- [x] Ingen kjernehandling eller synlig fokus skjules ved noen automatisert
  målviewport eller reflowproxy.
- [x] Faktisk 200 prosent browserzoom/reflow er verifisert manuelt.
- [x] Reduced motion fjerner bevegelse uten å endre innhold eller bekreftelse.
- [x] Mobilmenyen og tilgangsdialogen har korrekt inert/fokus/Escape/fokusretur,
  og tilgangstap annonseres før fokus lander i en trygg tomtilstand.
- [x] Overstyrt systemfont/linjeavstand gir ikke skjulte felt, handlinger eller
  fokus i den automatiserte reflowproxyen.
- [ ] Safe-area/notch og ekte virtuelt tastatur gir ikke skjulte felt,
  handlinger eller fokus.
- [x] Axe A/AA, runtime- og overflow-kontroller har ingen ukjente avvik.
- [ ] NVDA/VoiceOver kontrolleres manuelt før Kontrollpunkt A kan omtales som
  ferdig. NVDA er verifisert 2026-07-16. VoiceOver er delvis gjennomført på
  iPad; meny/drawer og fokusoverføring ved live orienteringsbytte er fysisk
  retestet. Tilgangsdialog og Smart Import over lokal HTTP er også kontrollert
  uten nytt avvik. Eksakt Safari-versjon, mobiltelefon og resten av protokollen
  gjenstår. Inntil begge skjermlesere er bestått på avtalt matrise, kalles A1
  ikke fullført.

### Verifikasjonsstatus

Følgende automatiske porter er grønne mot syntetiske data og lokal
Docker/Supabase:

- `npm run verify:checkpoint`;
- `npm run test:db:staff`;
- `npm run test:e2e:full` – 27/27 i Chromium;
- `npm run test:e2e:full:webkit` – 27/27 i WebKit.

Databasetesten dekker tom database, representativ oppgradering, atomisk
fail-closed preflight, RLS/RPC/grants, backfill, audit, idempotens og
samtidighet. De autentiserte browserløypene dekker owner → vikar →
tilbakekalling, stale handlinger, den avtalte negative matrisen for
ugyldige assignment-input,
forfalskede kontrollhandlinger for fire aktørtyper, redusert
kapabilitetsprofil, positiv regelbasert DOCX-forhåndsvisning/publisering og
utløpsreconcile som committes før etterfølgende autorisasjonsnekt. De dekker
også fem målviewports, tastaturflyt, fokus, reduced motion, axe A/AA,
runtime-feil og horisontal overflow.

Den reduserte kapabilitetsprofilen opprettes bare som lokal test-fixture og er
ikke en implementert kapabilitetseditor. DOCX-beviset verifiserer den
eksisterende regelbaserte Smart Import-flyten og fullfører ikke E04.

Kommandoportene ble kjørt på nytt på den rene kodekandidaten `c562bb0` 16.
juli 2026. Checkpoint, database, Chromium 27/27 og WebKit 27/27 var grønne;
første WebKit-forsøk hadde én ikke-reprodusert Server Action-fangsttimeout.
Gjennomføringer, retest og den semantiske bildegranskingen er bevart i
[`CONTROL_POINT_A1_AUTOMATED_QA.md`](./CONTROL_POINT_A1_AUTOMATED_QA.md).

En etterfølgende kravrevisjon fant likevel åpne evidensgap for positiv
owner+AAL2-klasse-/prototypeelevopprettelse, enkelte capability-negativer,
direkte RLS-matrise og dynamisk immutabilitets-/slettevern. Grønne
kommandoporter betyr derfor ikke at hele A1-bevismatrisen er komplett.

Automatiserte emuleringer og layoutproxyer erstatter ikke en fysisk
enhetskontroll. Gjennomfør og loggfør portene med
[`CONTROL_POINT_A1_MANUAL_QA.md`](./CONTROL_POINT_A1_MANUAL_QA.md):

| Port | Status | Automatisert bevis som finnes |
| --- | --- | --- |
| Faktisk 200 % browserzoom | Verifisert 2026-07-16 | 720 × 450 reflowproxy med tekstoverstyring og faktisk Port A-bevis i den manuelle QA-loggen |
| NVDA/VoiceOver | NVDA verifisert 2026-07-16; VoiceOver-stegene på iPad har ingen kjente åpne funksjonsavvik, men eksakt Safari-versjon og hele enhetsmatrisen gjenstår | Axe og semantiske tastaturtester; faktisk NVDA-bevis og kronologisk iPad-/avvikslogg i den manuelle QA-loggen |
| Ekte touch | Delvis kontrollert på iPad uten avvik – mobilmeny, tilgangsfelt, Avbryt og fjerning av et Smart Import-forslag; klassekort, tilbakekallingsdialog, hovedhandling, elevflyt og mobiltelefon gjenstår | Touch-emulering og 44 × 44-geometri |
| Safe-area/notch | Uverifisert | Responsiv CSS og statiske viewports |
| Ekte virtuelt tastatur | Delvis kontrollert uten avvik – Smart Import på iPad; eksakt nettlesermetadata og resten av enhetsmatrisen gjenstår | Redusert viewporthøyde |
| Orienteringsbytte på enhet | Pågår – navigasjon, tilgangsdialog og Smart Import er kontrollert fysisk på iPad uten avvik; eksakt nettlesermetadata og mobiltelefon gjenstår | Separate portrett-/landskapsprosjekter samt grønn automatisert `768×1024 → 1024×768 → 768×1024` fokus-round-trip i Chromium og WebKit |

A1 omtales derfor ikke som fullført.

## 9. Test- og bevismatrise

### 9.1 Aktører og browsertilstander

Alle contexts bruker samme `http://127.0.0.1`-origin:

- `student.json`;
- `owner-aal1.json`;
- `owner-aal2.json`;
- `substitute-aal1.json`;
- `substitute-aal2.json`;
- `visual-staff-aal2.json`;
- `other-org-staff-aal2.json`.

Dagens `teacher.json` er i realiteten owner og skal gis et presist navn.
TOTP-hemmeligheter skal aldri logges eller lagres i trace, video, screenshot
eller committed storage state. Other-org-ansatt har et gyldig assignment i
egen organisasjon, og visual-staff har et eget uforanderlig assignment som
livsløpstesten aldri tilbakekaller.

### 9.2 Enhets- og boundarytester

En ren policy-evaluator med eksplisitt testtid skal bevise:

- inklusiv start og eksklusiv slutt;
- før, like før, nøyaktig ved og etter slutt;
- tilbakekalling foran øvrige felt;
- AAL1 mot AAL2;
- feil organisasjon, klasse og kapabilitet;
- deny-by-default for ukjent kapabilitet;
- deterministisk valg blant flere gyldige grants.

En statisk boundarytest skal avvise pedagogiske voksenflyter som fortsatt
bruker `requireClassRole(..., ['teacher'])`, generell owner/teacher-sjekk eller
direkte `class_memberships.role = 'teacher'`. MFA-innrullering og grov
ansattruting kan være eksplisitt dokumenterte identitetsunntak. Denne testen er
bare en arkitekturvakt og erstatter ikke integrasjonstester per kapabilitet.

Alle fire pedagogiske jobbetiketter testes tabellstyrt med samme scope og
profil. Normal opprettelse testes negativt med student, other-org-voksen,
other-org-klasse, ugyldig intervall, manglende slutt og intern jobbetikett.
Runtime-testen avviser demotering under aktivt oppdrag, tilbakekaller, demoterer
og beviser at det historiske assignmentet ikke autoriserer. Upgrade-preflight
avviser et legacy teacher-class-medlemskap som peker på et nåværende
studentmedlemskap.

### 9.3 SQL, RLS og RPC

Supabase-stubben skal tilby en kompatibel `auth.jwt()`/claimmodell; dagens
`auth.uid()`-stub alene er ikke nok. En separat staff-smoke setter både JWT
`sub` og `aal` og beviser:

- aktiv vikar AAL2 ser klasse A og relevante klasse-A-rader;
- samme vikar ved AAL1, før start, ved slutt, etter slutt eller tilbakekalt ser
  ingen privilegerte rader;
- annen organisasjon og gammel class-membership uten assignment gir null;
- owner AAL2 uten assignment får ingen pedagogiske rader;
- owner AAL1 får ikke kontrollplanmetadata eller pedagogiske rader gjennom
  direkte RLS/RPC; egen profil/session for MFA er eksplisitt unntak;
- `anon` har ingen tabell- eller helpertilgang;
- `authenticated`, også aktiv AAL2-ansatt, kan ikke kjøre direkte
  `INSERT`/`UPDATE`/`DELETE` på assignments eller pedagogiske tabeller og kan
  ikke execute service-role-RPC-er;
- vikar kan ikke lese organisasjonens samlede auditlogg;
- owner kan administrere assignment bare i egen organisasjon;
- RPC revaliderer assignment etter serverkontrollen og skriver riktig audit.

Hver profilkapabilitet får positivt og negativt bevis ved hvert faktisk
produksjonsinnsteg: server action/service, direkte RLS-lesing der den finnes,
muterende RPC og tilhørende trigger. En kategori kan bare hoppes over når den
er eksplisitt merket `N/A` fordi kapabiliteten ikke har et slikt innsteg.

| Kapabilitet | Server action/service | RLS-lesing | RPC/trigger |
| --- | --- | --- | --- |
| `class.workspace.read` | Riktig/feil klasse, tid, AAL og organisasjon | Samme matrise direkte som `authenticated` | `N/A` – ingen mutasjon |
| `task.publish` | Action/service med valgt assignment og negative scope/capability-caser | `N/A` utover separat `class.workspace.read` | Publiserings-RPC og task-assignment-trigger, inkludert revoke-race |
| `plan.preview` | Eksplisitt klassekontekst; annen klasse/manglende capability avvises | `N/A` – dokumentet behandles på server | `N/A` – preview muterer ikke |
| `plan.publish` | Action/service krever separat publish-kapabilitet | `N/A` utover separat klasselesing | Plan-/oppgave-RPC og alle triggere den aktiverer |
| `help_queue.manage` | Kølesing, claim og resolve før/etter revoke | Direkte kølesing i riktig/feil scope | Claim-/resolve-RPC og help-request-trigger |
| `student_support.update` | Riktig elev/klasse og feil elev/klasse/capability | Direkte lesing av støtteinnstilling | Update-RPC og eventuell trigger; eksplisitt `N/A` hvis ingen trigger finnes |

Kontrollplanet får egne integrasjonstester: owner AAL2 kan opprette klasse,
prototypeelev og assignment i egen organisasjon; owner AAL1, vanlig ansatt,
student og other-org-owner avvises på hvert direkte endepunkt. Klasseoppretting
skal bevise én atomisk transaksjon for klasse, `operational_owner`-assignment og
audit; en tvungen feil i assignment/audit skal rulle hele klasseopprettelsen
tilbake.

Tidsmatrisen bruker `transaction_timestamp()`/`current_timestamp` og ingen
`sleep`.

### 9.4 Samtidighet og idempotens

Tester med to uavhengige databasesesjoner skal bevise:

- parallelle create-kall med samme idempotensnøkkel og samme payload gir ett
  assignment og én create-audit;
- samme nøkkel med ulik payload avvises som konflikt;
- parallelle revoke-kall gir én semantisk overgang og én revoke-audit;
- parallelle expiry-reconcile-kall gir én expiry-audit;
- revoke samtidig med pedagogisk mutasjon gir enten en fullført mutasjon som
  ble autorisert før revokeringen, med korrekt audit, eller en full avvisning
  uten sidedata – aldri en mutasjon autorisert etter revokeringen.

### 9.5 Kritiske risikobevis

Følgende regnes som releaseblokkere:

- ett gjenværende rolle-/class-membership-bypass i server, RLS, RPC eller
  trigger;
- en service-role-lesing uten forutgående sentral kapabilitetskontroll;
- TOCTOU mellom serverkontroll og muterende RPC;
- pedagogisk mutasjon og audit i forskjellige transaksjoner;
- owner-kontrollplan som fortsatt gir global pedagogisk lesing;
- backfill som gjetter jobbetikett, lager org-scope eller endrer elevdata;
- Smart Import-preview uten konkret klassekontekst;
- duplikate assignments eller revoke-/expiry-hendelser ved retry.

### 9.6 Tom database og representativ oppgradering

CI og lokal port skal kjøre to isolerte scenarier i separate, ferske
PostgreSQL 17-instanser/containere. De skal ikke dele database, schema eller
cluster-wide stubroller. Pre-A1-scenariet bruker et frosset manifest som
eksplisitt lister migrasjon `00000–00006`; vanlig `supabase db reset` er ikke et
gyldig upgrade-bevis.

1. **Empty:** Supabase-stub → alle migrasjoner → generell RLS-smoke →
   staff-smoke.
2. **Upgrade:** stub → migrasjon `00000–00006` → representativ legacy-fixture
   → A1-migrasjon → upgrade-smoke.

Upgrade-fixturen inneholder minst to organisasjoner og flere klasser, inkludert
både:

- en legacy-owner med `class_memberships.role = 'teacher'` i én klasse, som
  skal få nøyaktig ett `operational_owner`-assignment;
- en owner uten lærerklassemedlemskap i en annen klasse, som ikke skal få et
  globalt eller implisitt assignment;
- en vanlig legacy-lærer med medlemskap bare i én klasse;
- elever, oppgave, elevstatus og kødata.

Testen sammenligner det eksakte assignment-settet og uendrede oppgave-, status-
og kø-rader, og beviser at ingen org-/klassevid backfill eller legacy-bypass
oppstår.

### 9.7 Autentisert E2E

Én seriell livsløpstest bruker samtidige owner-, vikar- og
other-org-contexts:

1. Owner AAL1 avvises.
2. Owner AAL2 oppretter vikaroppdrag.
3. Vikar AAL1 får ikke pedagogiske data.
4. Vikar AAL2 ser bare klasse A og publiserer én syntetisk oppgave.
5. Other-org-ansatt avvises på direkte URL til klasse A.
6. Owner AAL1, vikar AAL2, elev og other-org-aktør avvises på direkte URL til
   `/v3/teacher/access` uten kontrollplanmetadata.
7. Vikarens klasseflate står åpen mens owner tilbakekaller.
8. Ny vikarhandling avvises og oppretter ingen rad.
9. Reload/direkte navigasjon viser ikke klasse- eller elevdata.
10. Direkte databasekontroll bekrefter at det avviste kallet ikke opprettet en
    rad eller audit som påstår suksess.

Separate, autentiserte matriser beviser i tillegg:

- 17 ugyldige assignment-input og direkte forfalskning av opprett/tilbakekall,
  klasseoppretting og prototypeelev som owner AAL1, vanlig ansatt, elev og
  other-org-owner;
- en lokalt injisert minimumsprofil der `class.workspace.read` og
  `plan.preview` virker, øvrige kontroller er skjult og stale actions samt
  direkte RPC-er avvises uten sidedata;
- deterministisk syntetisk DOCX gjennom eksisterende regelbasert preview,
  redigering og publisering, med riktig oppgave-, assignment-, status- og
  auditdata, samt avvisning ved feil klasse og etter tilbakekalling;
- faktisk tidsutløp etter at en side er åpnet, der neste serverhandling avvises
  uten oppgave- eller suksessaudit, mens nøyaktig én
  `staff_assignment.expired` committes med korrekt `effective_at` og
  `recorded_at`.

Direkte databasekontroll i disse browsertestene godtar bare en lokal Postgres-
URL på loopback-port 54322, database `postgres`, uten query eller fragment.

Visuell E2E dekker ownerens tilgangsflate og den tildelte ansattflaten ved alle
fem viewports i Chromium og WebKit med axe, overflow, runtime-feil og reduced
motion. Visuell QA bruker en egen, uforanderlig assignment/ansatt som aldri
tilbakekalles av livsløpstesten, eller kjører etter separat reset. Den skal ikke
dele muterbar fixture med parallelle prosjekter.

## 10. Forventet filomfang

Listen er en scope-vakt, ikke et krav om å endre alle filer:

- én ny A1-migrasjon etter `20260714000006`;
- SQL-smoke og representativ upgrade-fixture/-smoke;
- `src/server/auth/policy.ts` og `src/server/auth/authorize.ts`;
- ny sentral assignment-/staff-access-tjeneste;
- dagens klasse-, oppgave-, import-, hjelpe- og elevstøttetjenester;
- databasefunksjoner og triggere som fortsatt bruker lærerklassemedlemskap;
- genererte/håndholdte Supabase-typer;
- owner-only server actions og UI for opprettelse/tilbakekalling;
- gjenbrukbart ansattskall og dialog/sheet-primitiv;
- lærer-/klasseflatene for capability-basert rendering;
- lokal E2E-seed, credentials, auth setup, Playwright-prosjekter og scripts;
- enhetstester, boundarytest og CI-databaseporter;
- E05/E06, README og pilotrunbook bare når implementert atferd faktisk
  endrer nåstatusen.

Hvis slicen krever nye produktfunksjoner, medielagring, notemodell eller en
annen ressursakse enn klasse, skal scopet stoppes og replanneres.

## 11. Agentoppsett for goalen

Hovedagenten er eneste skriver og eier migrasjon, kode, tester, dokumentasjon,
diff og commits. Tre read-only-agenter brukes ved tydelige kontrollpunkter:

1. **Domene og sikkerhet:** kontrakt, backfill, RLS/RPC, TOCTOU, audit og
   legacy-bypass.
2. **Tester og feilmodi:** tidsgrenser, retry, samtidighet, cross-org,
   representativ oppgradering og harness.
3. **UI, tilgjengelighet og visuell QA:** alle fem viewports, tastatur,
   dialog/sheet, 200 prosent, reduced motion, axe og prototypesammenligning.

Agentene får rå diff, relevante testresultater og screenshots. De redigerer
ikke kildefiler. Hovedagenten vurderer alle funn og gjør rettingene.

## 12. Arbeidsloop og porter

### Rask indre port

```text
node --test tests/staff-assignment-policy.test.mjs tests/staff-authorization-boundary.test.mjs
npm run lint:core
npm run typecheck
npm run test:db:staff
npm run test:e2e:staff
```

### Full A1-port

```text
git diff --check HEAD
npm run verify:checkpoint
npm run test:db:staff:empty
npm run test:db:staff:upgrade
npm run test:e2e:full
npm run test:e2e:full:webkit
```

I tillegg gjennomføres dokumentert semantisk screenshotgjennomgang, 200 prosent
reflow, keyboard-only, NVDA/VoiceOver, ekte touch og orienteringsbytte for
berørte flater. Ingen screenshot-baseline oppdateres automatisk.

## 13. Ikke-mål

A1 implementerer ikke:

- invitasjon eller opprettelse av nye ansattkontoer;
- en egen adminrolle;
- gruppe-, fag-, elev- eller øktomfang;
- fri kapabilitetseditor eller bulkassignments;
- redigering eller forlengelse av et eksisterende assignment; A1 bruker
  tilbakekalling og et nytt assignment med ny periode;
- pedagogiske notater eller tilgang til fremtidige sensitive notefelt;
- ny oppgave-/XP-/belønningsmodell fra E01/E02;
- ny Smart Import-modell fra E04;
- ny aktiv kømodell fra E03;
- realtime-fjerning av allerede rendret DOM;
- full ferdigstilling av E05 eller E06;
- ekstern eller linket Supabase-mutasjon;
- deploy, push eller pull request.

Etter A1 kan senere slicer utvide ressursomfang og kapabiliteter uten å
gjeninnføre rollebaserte snarveier. E05 og E06 kan høyst settes til **Pågår**;
de er ikke ferdige før deres fulle akseptansekriterier er bevist.

## 14. Stoppvilkår og ferdigbevis

Stopp og replannér ved:

- destruktiv migrasjon eller datatap;
- behov for å godta både legacy- og assignmentautorisasjon i en merget
  mellomtilstand;
- ny produktavgjørelse om rolle, omfang eller kapabilitet;
- identisk feil to ganger eller tre reparasjonsrunder;
- overlappende brukerendringer;
- manglende obligatorisk lokal DB-, RLS-, AAL2- eller E2E-port.

A1 kan bare markeres **Fullført** når alle automatiske porter og nødvendige
manuelle porter er dokumentert, ingen legacy-bypass finnes, diffen er kontrollert
for scope og hemmeligheter, E05/E06 beskriver faktisk status og ett eller noen
få naturlige grønne commits er opprettet. Branchen skal ikke pushes uten en ny,
uttrykkelig beskjed fra brukeren.
