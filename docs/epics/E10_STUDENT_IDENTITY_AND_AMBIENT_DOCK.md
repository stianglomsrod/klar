# E10 – Elevidentitet og kontekstuell dock

**Status:** Planlagt

**Sist avklart:** 18. juli 2026

**Kontrakt:** [§ 7 Oppgavestatus, XP, nivå og belønning](../product/DOMAIN_CONTRACT.md#7-oppgavestatus-xp-nivå-og-belønning),
[§ 8 Hjelpekø](../product/DOMAIN_CONTRACT.md#8-hjelpekø),
[§ 10 Motivasjonsstøtte](../product/DOMAIN_CONTRACT.md#10-motivasjonsstøtte-belønninger-og-levende-hage)
og [§ 11 Responsivitet og tilgjengelighet](../product/DOMAIN_CONTRACT.md#11-responsivitet-og-tilgjengelighet)

**Avhenger av:** DCK1–DCK3 avhenger av E01, E02, E03 og E06. DCK4a avhenger i
tillegg av E08 Q4 og E09 R1/R6a. DCK4b avhenger av E09 R2–R6b.

## Resultat

Elevflaten får tilbake den gjenkjennelige sammenhengen fra Klar-prototypen:
dagen og oppgaven står i sentrum, mens en stabil dock gir rolig tilgang til
tid, fremdrift, hjelp og faktisk tilgjengelige belønninger. En forsiktig
personlig identitet kan gjøre flaten varm og egen uten at avatar, XP eller spill
blir et krav for å bruke skoleverktøyet.

Epicen er et opplevelses- og navigasjonslag over E01–E03. Den oppretter ingen
parallell oppgavestatus, køstatus eller poengsaldo.

## Produktprinsipper

- Dagen skal være forståelig før eleven leser docken.
- Docken viser bare handlinger som finnes akkurat nå.
- Hånden finnes bare for en åpen, aktuell kø.
- Belønning finnes bare ved ventende entitlement eller eid kupong/hage.
- Skjult XP, hage eller kupong etterlater ingen tom plassholder eller «låst»
  system.
- Ingen badge skal skape frykt for å miste progresjon eller følge en streak.
- Docken bevarer kontekst, men dekker aldri innhold, fokus eller
  skjermtastatur.
- Personlig uttrykk er privat for eleven og brukes aldri til rangering.

## Dockens kontrakt

Mulige moduler:

| Modul | Når den vises | Primær handling |
| --- | --- | --- |
| Nå | En aktiv eller kommende økt finnes | Tilbake til aktuell økt |
| Tid | Eleven har valgt lokal tidsstøtte | Åpne en enkel, valgfri timer |
| Hjelp | Aktuell kø er åpen | Gå inn/ut av kø; oppgavekontekst følger med |
| Fremdrift | XP/nivå er synlig for eleven | Åpne rolig egen fremdrift |
| Belønning | En entitlement venter og minst én aktuell belønningstype finnes | Velg nå eller senere |
| Hage | Hage er aktiv og har innhold/utkast | Åpne verksted eller hage |
| Kuponger | Minst én kupong finnes | Se eller forespør bruk |

Desktop kan vise flere korte moduler. Mobil og iPad bruker et lite antall
prioriterte symboler og en «Mer»-flate når det er nødvendig. Hjelpehånden og
oppgavens primærhandling skal aldri gjemmes bak «Mer» i aktiv kontekst.

## Elevens tids- og arbeidsmodell

Prototypens fisheye-hierarki beholdes:

- aktuell økt er størst og tydeligst;
- forrige økt er roligere, men kan åpnes når oppgaver fortsatt er relevante;
- neste økt er synlig som orientering, ikke som krav om å starte tidlig;
- utenfor planlagt tid vises en nøytral dagsoversikt, ikke en egen
  «etter skoletid»-modus.

Når eleven går fra oppgave til quiz, hjelp, belønning eller hage, skal retur
åpne samme økt, oppgave og relevante scroll-/spørsmålskontekst. URL og
serverstatus er fasit; docken skal ikke gjette en parallell «nå»-tilstand.

Timeren i første målversjon er et frivillig, lokalt elevverktøy uten
serverprogresjon, læreraktivering, audit eller produktivitetstelemetri. Den kan
startes, pauses, nullstilles og skjules av eleven. Dersom tidsstøtte senere skal
styres av en ansatt eller følge eleven mellom enheter, krever det en ny
kontraktsbeslutning om omfang og elevvalg.

## Fremdrift og nivå

Fremdrift kan presenteres som en kort bane, ring eller rolig tall/symbol,
avhengig av elevens valgte visning. Den skal:

- bruke snapshotsatt, serverberegnet saldo og nivå;
- forklare nivåfall etter angre/retur uten straffespråk;
- skille nåværende nivå fra høyeste nådde milepæl;
- vise første level-up én gang og gjenvunnet nivå uten ny stor feiring; og
- tilby «Velg nå» eller «Senere» bare når en reell belønning finnes.

## Personlig identitet og avatar

En avatar eller figur er en visuell retning som skal prototypetestes, ikke en
forutsetning for domenet. Før bindende implementasjon skal minst tre uttrykk
sammenlignes med elever og lærere:

1. enkel personlig figur med få, inkluderende valg;
2. abstrakt natur-/fargeidentitet; og
3. ingen figur, men personlig navn, farge og samling.

Valget skal fungere fra omtrent fem til tretten år, unngå kjønnede eller
prestasjonskodede standarder og aldri kreve kropp, bilde eller sensitivt
utseende. Avataren kan reagere kort på første level-up, men skal ikke bli syk,
trist eller krevende ved fravær. Klær/utseende skal ikke være økonomi eller
lootloop i første versjon.

DCK4a skal dokumentere testoppgaver, deltakere og beslutning. Produkteier og
minst én relevant lærer-/brukerrepresentant vurderer forståelse i aldersspennet,
anti-stigma, gjenkjennelighet, ro, valgfrihet og skjermleserbeskrivelse. Dersom
ingen retning består uten vesentlige avvik, er eksplisitt fallback «ingen
figur»; dock, navn, farge og hage skal fortsatt fungere.

## Visuell retning

- Docken kan være mørkere eller mer materialpreget enn arbeidskortene, slik at
  den oppfattes som elevens verktøylinje.
- Aktiv hånd, timer og ventende pensel/kupong bruker kjente symboler og korte
  norske ord.
- Mikromagi er tillatt: myk dybde, en forsiktig glød ved ny tilgjengelig
  handling og en kort, taktil trykkrespons.
- Ingen kontinuerlig pulsering, alarmfarge eller tallbadge som ikke kan ryddes.
- Fagfarge følger oppgaven, mens fremdrift/belønning har et eget varmt språk.
- Safe-area, skjermtastatur og nettleserchrome er en del av komposisjonen på
  iPad og mobil.

## Tilgjengelighet

- Docken er et navngitt navigasjons-/verktøyområde etter hovedinnholdet i DOM,
  selv om den visuelt er fast.
- Hver modul er en native knapp/lenke med navn, tilstand og eventuell
  kontekst, for eksempel «Be om hjelp med Les side 12».
- Fokus kan nå og forlate docken logisk uten å gå gjennom skjulte moduler.
- Ved breakpoint/orientering flyttes fokus bare dersom den fokuserte kontrollen
  faktisk erstattes; hovedinnholdsfokus kapres ikke.
- 200 prosent zoom kan gjøre docken til en ikke-fast rad eller sheet uten
  funksjonstap.
- Reduced motion beholder status og sluttresultat uten pulsering eller spring.
- Timer skal ikke være tidskritisk og skal kunne skjules av eleven.

## Kontrollpunkter

### DCK1 – Informasjonsarkitektur og responsiv komposisjon

- modulprioritet for elevdag, oppgave og quiz;
- wireframes ved fem målviewports og 200 prosent;
- safe-area, skjermtastatur, orientation og fokusrekkefølge;
- ingen døde eller låste moduler.

### DCK2 – Nå, tid og hjelp

- caller-bound øktkontekst og retur;
- valgfri timer uten serverprogresjon;
- E03-hånd med og uten oppgavekontekst;
- offline/reconnect og flere faner.

### DCK3 – Fremdrift og ventende belønning

- E02-saldo/milepæl uten parallell cache;
- «Velg nå/Senere» og gjenopptakelse;
- betinget hage-/kuponginngang;
- angre, retur og gjenvunnet nivå.

### DCK4a – Personlig uttrykk, quiz/kupong og fysisk dockport

- prototypetest av tre identitetsretninger før valg;
- valgt retning dokumentert i UI/UX-referansen;
- fysisk iPad/VoiceOver, mobil, PC, tastatur, 200 prosent og reduced motion;
- sammenhengende retur fra quiz, hjelp og kupong.

### DCK4b – Hageintegrasjon og samlet retur

- inngang til ventende kronblad, malerverksted og plantet hage;
- sammenhengende retur etter «Senere», kronblad, blomstring og planting;
- motorfallback, orientation, background/resume og fysisk hageport;
- ingen dockmodul når hagen er utilgjengelig eller skjult.

## Akseptansekriterier

- [ ] Elevens aktuelle økt og primærhandling er forståelig uten å bruke docken.
- [ ] Hånden vises bare når riktig kø er åpen og oppdaterer samme
  hjelpeforespørsel fra footer og oppgave.
- [ ] Skjult funksjon gir verken tom plass, låst ikon eller mangelspråk.
- [ ] Ventende belønning finnes etter refresh/enhetsbytte uten alarmbadge.
- [ ] Angre/retur viser korrekt saldo og gjenbruker tidligere milepæl.
- [ ] Retur fra dockmodul gjenoppretter riktig økt/oppgave/spørsmålskontekst.
- [ ] Docken skjuler aldri fokusert innhold, siste oppgave eller
  skjermtastaturet ved målviewportene.
- [ ] Alle handlinger fungerer med touch, tastatur, VoiceOver, NVDA og Switch
  Control.
- [ ] Eventuell avatar er valgfri, privat, inkluderende og uten
  vedlikeholds-/streakpress.

## Utenfor omfang

- sosial profil, venneliste, offentlig avatar eller elevsammenligning;
- virtuell valuta, butikk, loot og kjøp;
- tvungen timer, produktivitetsmåling eller overvåking;
- trist/sulten avatar, besøksstreak eller tap ved fravær;
- push-/smartklokkevarsler;
- endelig avataruttrykk før prototypetest og eksplisitt produktvalg.

## Ferdigbevis

Epicen er ferdig når docken er en stabil, kontekstavgrenset inngang til
implementerte funksjoner på alle målenheter, når den ikke viser planlagte eller
deaktiverte systemer, og når elevens arbeidskontekst kan forlates og
gjenopptas uten statusdrift eller tilgjengelighetsavvik.
