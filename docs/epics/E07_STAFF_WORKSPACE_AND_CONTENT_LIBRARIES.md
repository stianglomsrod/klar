# E07 – Ansattarbeidsflate og innholdsbiblioteker

**Status:** Planlagt

**Sist avklart:** 18. juli 2026

**Kontrakt:** [§ 4 Aktører, roller og ressursomfang](../product/DOMAIN_CONTRACT.md#4-aktører-roller-og-ressursomfang),
[§ 6 Elevens dagsflate](../product/DOMAIN_CONTRACT.md#6-elevens-dagsflate) og
[§ 9 Smart Import og ukeplanrevisjoner](../product/DOMAIN_CONTRACT.md#9-smart-import-og-ukeplanrevisjoner)

**Avhenger av:** W1–W2 bruker stabile read-modeller fra gjeldende E01/E03/E05
og E06. W3s plan-/innholdsintegrasjon avhenger av E04.

## Resultat

Ansatte får igjen den operative sammenhengen som var tydelig i den opprinnelige
Klar-prototypen: en arbeidsflate som svarer på «hva krever oppmerksomhet nå?» og
fører videre til separate, gjenkjennelige arbeidsrom for klasser, grupper,
elever, standardoppgaver og planer, samt vertsflater for senere quiz- og
belønningsmoduler fra E08/E09. Flaten skal bruke 3.0s autoriserte
serveroperasjoner og read-modeller; den skal ikke gjeninnføre 2.x-klientlogikk.

Dashboardet er et cockpit, ikke en statistikkside. Det prioriterer:

- aktive undervisningsøkter og hjelpekøer;
- nylig brukte klasser, grupper og elever;
- leveringer eller returnerte oppgaver som krever oppfølging;
- planutkast, importkonflikter og publisering som venter;
- hurtighandlinger med tydelig valgt omfang; og
- en knapp aktivitetsfeed med handling, aktør og relevant ressurs.

## Informasjonsarkitektur

### Oversikt

Oversikten viser få, handlingsrettede kort. Hvert kort skal enten føre til en
konkret arbeidsflate eller forklare hvorfor ingen handling finnes. Dekorative
tall, konkurranser mellom klasser og diagrammer uten pedagogisk handling er
utenfor omfang.

### Klasser og grupper

En klasse eller gruppe har ett stabilt arbeidsrom med:

- undervisningsøkter og planstatus;
- elever og medlemskap;
- aktiv eller nylig hjelpekø;
- oppgaver, mottakere og samlet leveringsstatus; og
- innganger til publisering, retur og ny iterasjon.

Gruppe- og klasseomfang skal være eksplisitt i overskrift, sidepanel og
bekreftelse. En ansatt skal aldri tro at en handling gjelder én elev når den
egentlig gjelder hele klassen.

### Elev

Elevens arbeidsrom samler bare informasjon den ansatte har et aktivt oppdrag
til å se: dagens oppgaver, fullførings-/returhistorikk, aktuell støttevisning,
køstatus og tilgjengelige motivasjonsrammer. Det er ikke en fritekstjournal og
skal ikke samle unødvendig atferdsanalyse.

### Oppgavebibliotek

Oppgavedefinisjoner er gjenbrukbart innhold, adskilt fra konkrete utsendinger.
E07 eier bibliotekskallet, søk/filter, standardoppgaverevisjoner og eksplisitt
«send ut som ny iterasjon». E08 eier quizschema, quizbygger og quizmodulen som
senere monteres i biblioteket. Tidligere leveringer skal alltid peke på den
revisjonen eleven faktisk mottok.

### Belønningsbibliotek

E07 eier vertsflaten og navigasjonen. E09 eier belønningsdefinisjon,
scope, arkivering, claim og innløsning og leverer modulen som monteres her.
Biblioteket skal vise hvilke definisjoner som fortsatt kan velges, og hvilke
utstedte kuponger som består etter arkivering. Inngangen er fraværende for
roller uten relevant virkeområde.

## UX-regler

- Desktop kan bruke fast navigasjon, tabell og sidepanel; mobil bruker
  sekvensielle kort og fullskjerms sheet med samme begreper.
- «Opprett», «publiser», «returner», «flytt», «send ut på nytt» og «arkiver»
  skal være forskjellige handlinger med konsekvensforhåndsvisning.
- Nylig brukt er et lokalt eller serveravgrenset hjelpemiddel, ikke profilering
  av eleven.
- Sidepaneler skal bevare listekontekst, URL og fokus. Dyp lenking skal åpne
  samme ressurs etter refresh når oppdraget fortsatt er gyldig.
- Ingen oppgave, plan, kupong eller kø muteres direkte fra browserklienten.
- Tomtilstander skal foreslå en reell neste handling og aldri vise planlagt
  funksjonalitet som om den allerede finnes.

## Data, read-modeller og autorisasjon

Epicen introduserer primært sammensatte, omfangssikre read-modeller over
eksisterende domener. Nye serveroperasjoner er bare tillatt når en underliggende
epic allerede definerer invariantene. Alle spørringer skal avgrenses med
organisasjon, aktivt oppdrag og konkret ressurs.

Read-modeller skal:

- unngå N+1-kall og klientbasert sammenslåing av autorisasjon;
- ha deterministisk sortering og paginering;
- ikke lekke antall, navn eller status på tvers av virkeområder;
- tåle at et oppdrag utløper mens et panel er åpent; og
- vise et konsistent snapshot før realtime-oppdateringer anvendes.

## Kontrollpunkter

### W1 – Informasjonsarkitektur og cockpit

- prototypebasert wireflow for PC, iPad og mobil;
- read-modell for aktive arbeidskontekster;
- nylig brukte ressurser og hurtighandlinger uten dekorativ statistikk;
- URL-, fokus- og tilgangstapstest.

### W2 – Klasse-, gruppe- og elevarbeidsrom

- stabile ressursruter og omfangsheader;
- samlet oppgave-, plan- og køkontekst;
- responsive sidepaneler/sheets;
- negative rolle-, organisasjons- og utløpstester.

### W3 – Bibliotekskall og standardoppgaver

- versjonert standardoppgave, søk, filter og revisjonsnavigasjon;
- tydelig skille mellom definisjon og iterasjon;
- kontraktsfestede modulgrenser for E08-quiz og E09-belønninger uten dupliserte
  migrasjoner eller kommandoer;
- full tastatur-, skjermleser- og touchport.

## Akseptansekriterier

- [ ] Dashboardets hvert synlige tall eller kort har en forståelig handling.
- [ ] Klasse, gruppe og elev har stabile URL-er og eksplisitt omfang.
- [ ] Samme ansatte får lik pedagogisk funksjon innenfor kontaktlærer-,
  faglærer-, ITO- og vikaroppdrag og avvises utenfor oppdraget.
- [ ] Oppgavebiblioteket kan opprette ny definisjonsrevisjon uten å omskrive
  en tidligere iterasjon eller levering.
- [ ] «Flytt» og «send ut på nytt» viser forskjellig identitet, mottaker,
  tidspunkt og XP-konsekvens før bekreftelse.
- [ ] Når E08/E09 er levert, kan modulene monteres i biblioteket uten å flytte
  schema-, kommando- eller ferdigbevisansvar inn i E07.
- [ ] Tilgangstap midt i en arbeidsflyt gir en trygg, forklart avvisning uten
  delvis mutasjon eller skjult datalekkasje.
- [ ] Mobil er en egen komposisjon, og ingen hovedhandling krever tabell,
  hover eller presis drag.

## Utenfor omfang

- karakterbok, fraværssystem eller LMS-erstatning;
- generisk analyseplattform eller elevrangering;
- meldinger, reaksjoner og kommentarfelt før personvern- og
  modereringsreglene er avklart;
- direkte gjenbruk av 2.x-datalag, RLS eller klientmutasjoner.

## Ferdigbevis

Epicen er ferdig når alle arbeidsrom bruker autoriserte read-modeller og
serveroperasjoner, målviewportene er visuelt kontrollert, rolle-/omfangsmatrisen
er negativt testet og golden journeys fra dashboard til klasse, elev, kø, plan
og standardoppgave er bevist uten å kopiere kjente 2.x-avvik.
