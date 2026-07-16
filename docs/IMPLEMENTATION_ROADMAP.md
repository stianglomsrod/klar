# Klar 3.0 – implementeringsplan

**Status:** Pågår

**Sist avklart:** 16. juli 2026

**Autoritativ produktkilde:** [Domenekontrakten](./product/DOMAIN_CONTRACT.md)

Denne planen deler målbildet i kontrollerbare leveranser. Den beskriver ikke
funksjoner som allerede er ferdige. Hver epic må ende i et eget kontrollpunkt
med migrasjoner, autorisasjonstester, domenetester og verifisert UI der det er
relevant.

## Epics

| ID | Epic | Primært resultat |
| --- | --- | --- |
| E01 | [Elevens dag og oppgaveflyt](./epics/E01_STUDENT_DAY_AND_TASK_FLOW.md) | Rolig timebasert dagsflate og et valgfritt mediesjekkpunkt etter «Fullfør» |
| E02 | [Progresjon og belønninger](./epics/E02_PROGRESS_AND_REWARDS.md) | Reverserbar, transaksjonssikker XP- og levelloop uten farming |
| E03 | [Kontekstuell hjelpekø](./epics/E03_CONTEXTUAL_HELP_QUEUE.md) | Ikonbasert hjelp for eleven og styrbar, reviderbar kø for ansatte |
| E04 | [Smart Import og ukeplaner](./epics/E04_SMART_IMPORT_AND_WEEKLY_PLANS.md) | Full DOCX-tolkning med utkast, diff, revisjoner og trygg reimport |
| E05 | [Ansattilgang og vikar](./epics/E05_STAFF_ACCESS_AND_SUBSTITUTES.md) | Lik pedagogisk funksjon innenfor eksplisitt og tidsavgrenset virkeområde |
| E06 | [Responsive og tilgjengelige skall](./epics/E06_RESPONSIVE_ACCESSIBLE_SHELLS.md) | Sammenhengende elev- og lærerflater på mobil, iPad og PC |

## Avhengigheter

```text
E05 Ansattilgang ─────┬────> E03 Hjelpekø
                     ├────> E04 Smart Import
                     └────> lærerhandlinger i E01/E02

E04 Ukeplan/sesjoner ──────> E01 Elevens dag
E02 XP/state machine ──────> E01 Fullfør-sjekkpunkt
E01 Oppgavekontekst ───────> E03 «Hjelp med denne»

E06 gjelder i alle leveranser fra første komponent og første E2E-test.
```

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

**Status:** Pågår – A1 er implementert og alle automatiske A1-porter er
verifisert; fysiske og manuelle enhetsporter gjenstår.

Første vertikale slice er scope-låst i
[`Kontrollpunkt A1 – aktive ansattoppdrag og autorisasjonskjerne`](./qa/CONTROL_POINT_A1.md).
A1 har levert den klasseavgrensede autorisasjonskjernen, owner-kontrollflaten
og første responsive ansattskall. De automatiske kontrollportene er grønne i
lokal database, Chromium og WebKit. Kontrollpunkt A forblir åpent til faktisk
200 prosent zoom, skjermleser, touch, safe-area/skjermtastatur og
orienteringsbytte er dokumentert på reelt utstyr.

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

Implementer E02 før elevens nye fullførflyt kobles på:

- transaksjonell oppgaveovergang og XP-ledger;
- nøyaktig én level-entitlement per elev og nivå;
- elevangre og lærer-/vikarretur som kompenserende hendelser;
- bevaring av valgt belønning og beskyttelse mot dobbeltklikk, retry og to
  faner.

**Utgangskrav:** Alle tilstandsoverganger og edgecaser er bevist i
databasetester og tjenestetester uten direkte klientskriv til progresjonsdata.

### Kontrollpunkt C – ukeplan og Smart Import

Implementer E04 som datagrunnlag for en tidsbasert elevdag:

- stabile ukeplaner, sesjoner, beskjeder, mål og oppgaver;
- strukturbevarende DOCX-tolkning;
- lagret utkast, menneskelig kontrollpunkt og atomisk publisering;
- idempotent reimport og treveis sammenslåing med stabile identiteter.

**Utgangskrav:** Samme dokument kan lastes opp flere ganger uten duplikater,
og en endret plan kan publiseres uten å slette elevprogresjon eller manuelle
lærerendringer.

### Kontrollpunkt D – elevens dag og oppgave

Bygg E01 på de stabile sesjons- og progresjonsmodellene:

- forrige, nåværende og neste økt uten egen «etter skoletid»-modus;
- åpning av oppgave viser instruksjon uten en «I gang»-knapp;
- «Fullfør» åpner et sjekkpunkt der tekst, lyd og bilde er valgfritt;
- bekreftelse uten vedlegg er en fullverdig standardflyt;
- valgt oppgave kan sende kontekst videre til hjelpekøen.

**Utgangskrav:** En førsteklassing kan forstå og fullføre hovedflyten med
symboler, korte handlingsord og opplesing, på mobil, iPad og PC.

### Kontrollpunkt E – aktiv hjelpekø

Koble E03 til aktive timer/sesjoner:

- lærer oppretter og avslutter køen for valgt klasse og time;
- elevens hånd vises bare mens køen er aktiv;
- generell hjelp og oppgaveknyttet hjelp bruker samme kø;
- ansattrekkefølge kan endres atomisk og reviderbart;
- elevens kompakte tilstander lover aldri en bestemt køplass.

**Utgangskrav:** Realtime, avbrudd, overtakelse, omprioritering og avslutning
er verifisert på alle målenheter og ved midlertidig nettverksbrudd.

### Kontrollpunkt F – samlet pilotkandidat

- kjør hele elev- og lærerløypa med representative DOCX-filer;
- gjennomfør E2E på 360×640, mobil landskap, 768×1024, 1024×768 og desktop;
- test tastatur, skjermleser, 200 % zoom, redusert bevegelse og avbrutt nett;
- kjør sikkerhets-, RLS-, sletting-, migrasjons- og rollback-øvelse;
- oppdater README og pilotrunbook først når funksjonene faktisk er verifisert.

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
