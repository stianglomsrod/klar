# Kontrollpunkt A1 – kandidatbundet automatisk og visuell QA

## Omfang

- **Dato:** 16. juli 2026
- **Kodekandidat:** `c562bb007da061708af9671d2bb7f67cc36a9be2`
- **Dokumentasjonslinje:** `6dfa8d47ae172be83e0509681a44e6d3dfe2466c`
- **Arbeidsmåte:** separat, ren detached worktree; B1-arbeidstreet ble ikke
  brukt som kandidat eller endret
- **Data og tjenester:** bare syntetiske fixtures, lokal Docker/PostgreSQL og
  lokal Supabase; ingen linket eller ekstern Supabase ble lest eller mutert

Dette er råloggen og den semantiske skjermbildevurderingen for en fersk
retest av A1s konfigurerte automatiske porter. Den erstatter ikke de manuelle
enhetsportene i
[`CONTROL_POINT_A1_MANUAL_QA.md`](./CONTROL_POINT_A1_MANUAL_QA.md), og den
lukker heller ikke testmatrisehullene som er listet nederst.

Screenshots var midlertidige, ignorerte `test-results`-artefakter med bare
syntetiske data. De ble inspisert manuelt, men committes ikke som
pixel-baselines.

## Gjennomførings- og retestlogg

| ID | Kommando eller steg | Resultat | Observasjon og retest |
| --- | --- | --- | --- |
| `A1-AUTO-20260716-01` | `npm run verify:checkpoint` i temp-worktree med junction til hovedrepoets `node_modules` | Infrastrukturfeil før produktbuild | Turbopack avviste en junction som pekte utenfor prosjektroten. Alle 33 enhets-/boundarytester var grønne før build. Junctionen ble fjernet, temp-worktree fikk egen `npm ci`, og samme port ble kjørt på nytt. |
| `A1-AUTO-20260716-01R` | `npm run verify:checkpoint` etter egen `npm ci` | **Bestått** | Lint, core-lint, typecheck, 33/33 tester, produksjonsbuild og offentlig Playwright 4/4 var grønne. `npm audit` rapporterte to moderate PostCSS-funn i Next-avhengighet; foreslått `--force`-retting ville nedgradere Next og ble ikke brukt. |
| `A1-AUTO-20260716-02` | `npm run test:db:staff` | Transient lokal init-race | Første PostgreSQL 17-container svarte på `pg_isready` under init og restartet før første `psql`-kall. Ingen A1-migrasjon ble kjørt delvis; containeren ble ryddet av runneren. |
| `A1-AUTO-20260716-02R` | identisk `npm run test:db:staff` | **Bestått** | Tom kjede + RLS/RPC + concurrency og representativ upgrade + atomisk fail-closed preflight bestod. |
| `A1-AUTO-20260716-03` | `npm run test:e2e:full` | **Bestått, 27/27** | Chromium: offentlig smoke, auth-setup, student/ansatt, owner→vikar→tilbakekalling, kontrollhandlinger, capabilities, expiry og visuell matrise. |
| `A1-AUTO-20260716-04` | `npm run test:e2e:full:webkit` | Delvis, 26/27 | Senere kontrollplanscenario ventet mer enn 20 sekunder på fangst av «Opprett klasse»-Server Action mens førstegangs Docker-images ble lastet. Ingen produkt- eller autorisasjonsassert feilet. |
| `A1-AUTO-20260716-04R` | identisk `npm run test:e2e:full:webkit` med lokale images | **Bestått, 27/27** | Fangstscenariet brukte 7 sekunder og hele WebKit-matrisen bestod. Feilen ble ikke reprodusert. |
| `A1-AUTO-20260716-05` | `git diff --check` i ren kandidat | **Bestått** | Ingen whitespacefeil. |
| `A1-AUTO-20260716-06` | sikker teardown | **Bestått** | Lokal Supabase ble stoppet. Portene 3100 og 54321–54324 ble kontrollert lukket, og A1-brannmurtilstanden var gjenopprettet/lukket. |

Ingen passord, elevkoder, TOTP-hemmeligheter, cookies eller lokale
Supabase-nøkler ble lagret i denne loggen.

## Automatisk visuell matrise

Alle radene bestod testenes axe WCAG A/AA-, runtime-, reduced-motion-,
horisontal-overflow- og geometriasserts i både Chromium og WebKit.

| Flate | Viewport | Resultat | Semantisk vurdering |
| --- | --- | --- | --- |
| Eierens Tilganger | 360×640 | Bestått | Énkolonne assignment-kort og fullskjerm-sheet. Tittel, lukk og fast handlingsrad er synlige uten sideveis scroll. |
| Eierens Tilganger | 640×360 | Bestått | Lav sheet-header og separat rullbart innhold; fast Avbryt/bekreft-rad skjuler ikke feltet med fokus. |
| Eierens Tilganger | 768×1024 | Bestått | Mobilheader og romslig side-sheet; tilbakekallingsdialogen beholder tydelig konsekvens og trygg handling først. |
| Eierens Tilganger | 1024×768 | Bestått | Fast sidemeny og brede semantiske assignment-rader uten tabellstøy. |
| Eierens Tilganger | 1440×900 | Bestått | Rolig kontrollplanhierarki, én tydelig «Gi tilgang»-handling og lesbar maksvidde. |
| Eierens Tilganger | 720×450 reflowproxy | Bestått | 200 prosent-proxyen går over til sheet/kort, viser tydelig feltfokus og beholder hovedhandlingen uten horisontal scroll. |
| Ansattklasse og elevdag | alle fem målviewports | Bestått som A1-regresjonsflater | Innholdsrekkefølge og responsive skall var konsistente; ingen synlig klipping eller overflow. Senere B1-produktatferd vurderes i eget kontrollpunkt. |

## Prototypesammenligning

Artefaktene ble sammenlignet semantisk med A1-referansene i
`CONTROL_POINT_A1.md`, ikke som pixel-golden-mastere:

- tydelig overskrift og én prioritert hovedhandling er bevart;
- hvite handlingsflater og klasse-/ressurshierarki er bevart;
- mobil er en egen kort-/sheet-komposisjon, ikke krympet desktop;
- assignment-status bruker tekst og symbol, ikke bare farge;
- tilbakekallingsdialogen forklarer konsekvensen og gir ikke den destruktive
  knappen startfokus;
- ingen organisasjonsomfattende elevfeed, hover-only-handling eller rå intern
  jobbetikett ble synlig.

Ingen blokkerende visuelle A1-avvik ble funnet i de ferske artefaktene.

## Kjente, ikke-blokkerende språkobservasjoner

- WebKit viser enkelte native `datetime-local`-verdier som ISO-streng, mens
  Chromium viser norsk feltformat. Den påkrevde norske oppsummeringen av
  periode og konsekvens er fortsatt lesbar.
- Native filinput viser nettleserens engelske «Choose File» / «No file
  chosen/selected» i begge motorer. Dette er senere norsk UI-polish og skal
  ikke skjules som en bestått språkvurdering.

## Åpne automatiske evidensgap

En krav-for-krav-revisjon etter kjøringen fant at grønne kommandoporter ikke
alene dekker hele matrisen i `CONTROL_POINT_A1.md`:

1. positiv owner+AAL2-integrasjon gjennom faktisk Server Action/UI mangler for
   klasseopprettelse og prototypeelevopprettelse;
2. capability-negativene mangler eksplisitt bortfall av
   `class.workspace.read` og `plan.preview`;
3. direkte authenticated RLS-negativ ved manglende `help_queue.manage` og
   `student_support.update` er ikke uttømmende dokumentert;
4. kontrakten må presisere om lesing av `student_experience_settings` styres
   av `class.workspace.read` eller `student_support.update`, og testen må følge
   beslutningen;
5. immutabilitet og hard-slettevern er implementert, men mangler en samlet
   dynamisk negativ testmatrise.

Disse er evidensgap, ikke påviste runtime-bypasser. A1 kan likevel ikke kalles
fullført før de er lukket eller kontrakten er presisert, og før de manuelle
portene er bestått på endelig kandidatcommit.

## Beslutning

**Den ferske automatiske og visuelle kandidatretesten er godkjent med bevart
flakehistorikk og eksplisitte evidensgap. A1 som kontrollpunkt er fortsatt
åpent.**

## Oppfølging i kontrollpunkt F – 18. juli 2026

Listen over automatiske evidensgap ovenfor bevares som historikk for kandidat
`c562bb0`. Den samlede, nyere F-kandidaten lukker disse automatiske hullene slik:

| Historisk gap | Nytt kandidatbevis |
| --- | --- |
| Positiv owner+AAL2-integrasjon for klasse og prototypeelev | Autentisert kontrollplansuite gjennomfører de faktiske UI-/Server Action-flytene og verifiserer resultatet mot lokal database. |
| Negative bortfall av `class.workspace.read` og `plan.preview` | Capability-suiten fjerner kapabilitetene isolert, kontrollerer resolver og synlig UI, og beviser fail-closed redirect uten beskyttet datamutering. |
| Direkte RLS-negativer for `help_queue.manage` og `student_support.update` | Databasepakken bygger tom og representativ database og verifiserer RLS/RPC/grants for manglende rolle, kapabilitet, klasse og organisasjon. |
| Uklart leseomfang for `student_experience_settings` | A1s kapabilitetskontrakt og testmatrisen bruker `student_support.update` for den ansattstyrte støtterammen; caller-bound elevlesing er separat. |
| Dynamisk immutabilitet og hard-slettevern | Databasepakken verifiserer append-only-/immutabilitetsgrenser, eksplisitte grants og hard-sletteavvisning i den samlede matrisen. |

Hele oppfølgingen, eksakte kommandoresultater og reparasjonsloggen står i
[`CONTROL_POINT_F.md`](./CONTROL_POINT_F.md). Dette lukker de automatiske
A1-evidensgapene, men ikke A1s fysiske enhetsporter. A1 er derfor fortsatt åpent
til de navngitte VoiceOver-, touch-, safe-area-, tastatur-, orienterings- og
mobilkontrollene er gjennomført på den endelige kandidatcommiten.
