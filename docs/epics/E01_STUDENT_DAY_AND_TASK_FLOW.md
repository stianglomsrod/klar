# E01 – Elevens dag og oppgaveflyt

**Status:** Pågår – B1/C1/D2/E1-flyten er delvis verifisert

**Kontrakt:** [§ 6 Elevens dagsflate](../product/DOMAIN_CONTRACT.md#6-elevens-dagsflate)

**Avhenger av:** E02, E04 og E06

## Resultat

Eleven møter en rolig, tidsstyrt dagsflate med forrige, aktuell og neste
undervisningsøkt. Eleven åpner en oppgave for å se instruksjonen og trykker
«Fullfør» når arbeidet utenfor Klar er gjort. Et kort sjekkpunkt lar eleven
bekrefte med `✓ Ferdig`, med eller uten frivillig tekst, lyd eller bilde.

Nåværende 3.0 har en autoritativ Europe/Oslo-projeksjon av forrige, aktuell og
neste økt fra aktiv planrevisjon. Aktuell økt er fremhevet, forrige er tonet
ned og lukket, neste er kompakt, og historiske løse oppgaver ligger sekundært.
Oppgaven åpnes uten «I gang», og det eksisterende sjekkpunktet kan fullføres
uten vedlegg med atomisk XP, elevangre og ansattretur fra B1.

Tekst, lyd og bilde, offlineflyt og hele den fysiske enhetsmatrisen gjenstår.
D2 har levert eksplisitt flytt eller ny lenket utsending. E1 har erstattet den
tekstlige mellomtilstanden med
den avtalte ikonbaserte footer-hånden og samme oppgaveknyttede køflyt.

## Omfang

Epicen omfatter:

- tidsbasert forrige/aktuell/neste-visning;
- oppgavevisning med instruksjon, opplesing og tilpasset støtte;
- åpning uten «I gang»-knapp eller obligatorisk status;
- fullføringssjekkpunkt med null eller flere frivillige vedlegg;
- elevangre og visning av ansattretur;
- inngang til oppgaveknyttet hjelp når køen er åpen;
- lærerhandlingene «flytt samme oppgave» og «send ut på nytt»;
- responsive tom-, laste-, feil- og offline-tilstander.

Epicen omfatter ikke vurdering, karaktersetting, obligatorisk dokumentasjon,
automatisk etter-skoletid-prioritering eller automatisk flytting til neste dag.

Produkteierens talespor beskriver i tillegg flersesjons-fullføring og en
eksplisitt ukegjentakelse. Om én fullføring kan dekke flere økter er et åpent
produktvalg. Ukegjentakelse er en utsatt retning, ikke en implementert regel.
D2 flytter eller sender ut én konkret iterasjon til én senere publisert økt og
avgjør ingen av delene. Elevens komplette «alle oppgaver»- og
ukeoversiktsflater er også senere E01-slicer.

## Elevflyt

1. Dagsflaten fremhever aktuell økt. Forrige tones ned og neste vises som
   orientering; ytterkantene av dagen skal ikke starte en egen modus.
2. Eleven åpner en oppgave. Dette viser instruksjon og støtte, men muterer ikke
   pedagogisk status.
3. Dersom øktens kø er åpen, kan eleven bruke håndsymbolet inne i oppgaven.
   Forespørselen får oppgaveiterasjonen som kontekst uten ekstra skjema.
4. «Fullfør» åpner sjekkpunktet. Det første trykket gir ikke XP.
5. Eleven kan skrive tekst, velge/spille inn lyd og ta/velge bilde i valgfri
   kombinasjon, eller hoppe over alt.
6. `✓ Ferdig` utfører den autoritative fullføringen. Avbryt går tilbake uten
   status-, medie- eller XP-endring.
7. Etter fullføring får eleven en kort, rolig bekreftelse. E02 avgjør eventuell
   level-/belønningsfeiring.

Synlige handlingsord skal være korte. Kamera, mikrofon, bilde, høyttaler, hake
og kryss skal bruke etablerte symboler, men alltid ha tilgjengelig navn.

## Flytt eller send ut på nytt

Lærerdashboardet skal tilby to eksplisitte handlinger:

- **Flytt:** endrer tidspunkt på samme uferdige iterasjon. Identitet, historikk
  og den ene XP-muligheten beholdes.
- **Send ut på nytt:** oppretter en ny, lenket iterasjon for valgt dato,
  undervisningsøkt og mottakere. Den får egen status og legitim XP-mulighet.

Begge krever forhåndsvisning og bekreftelse. Ingen handling utløses av at
skoledagen slutter eller at en oppgave er uferdig.

## Data og tjenester

- Undervisningsøkter og oppgaveiterasjoner må ha stabile identiteter fra E04.
- Oppgaveiterasjonen må snapshotte innhold/versjon, mottaker, økt og XP-verdi.
- Fullføringssjekkpunktet skal bruke én idempotent serveroperasjon fra E02.
- Vedlegg skal knyttes til fullføringsforsøket, ikke til elevprofilen generelt.
- Opplasting før databaseskriving må ha opprydding for foreldreløse objekter;
  feil må gi retry eller eksplisitt fjerning, aldri skjult tap.
- Tilgang til vedlegg skal følge organisasjon, elev og aktivt ansattomfang.
- «Flytt» og «send ut på nytt» er separate serverkommandoer og auditthendelser.

Før medier aktiveres i pilot må format, størrelse, skanning, EØS-region,
oppbevaring og sletting være dokumentert.

## Tilgjengelighet og responsivitet

- Mobil: én kolonne, aktuell økt og primærhandling innen tommelrekkevidde;
  sjekkpunkt som fullskjerm/bottom sheet med safe-area.
- iPad: portrett kan bruke fullskjerm-sheet; landskap kan bruke delt visning.
- PC: sentrert elevflate med samme rekkefølge og begreper.
- Ingen handling er hover- eller drag-avhengig.
- Primærhandlinger bør være minst 44 × 44 CSS-piksler.
- Opplesing, skjermlesernavn, fokusretur, Escape, 200 % zoom og redusert
  bevegelse skal verifiseres.
- Kamera- og mikrofontillatelse skal forklares kort før systemprompten åpnes.

## Akseptansekriterier

- [x] Forrige, aktuell og neste økt bestemmes fra samme autoritative klokke og
  planrevisjon uten egen etter-skoletid-flyt.
- [x] Å åpne en oppgave endrer ikke status eller XP og krever ingen «I gang».
- [x] Oppgaven kan fullføres med null vedlegg.
- [ ] Tekst, lyd og bilde kan velges og fjernes uavhengig før bekreftelse.
- [x] XP gis først etter `✓ Ferdig` og nøyaktig én gang per gyldig overgang.
- [x] Avbryt fra sjekkpunktet etterlater ingen fullføring eller XP.
- [ ] Vedleggsfeil kan prøves på nytt eller fjernes uten skjult deltilstand.
- [x] Oppgaveknyttet hånd oppretter samme køtype som footer-hånden.
- [x] Elevangre og ansattretur viser riktig, ikke-straffende status.
- [x] Flytt bevarer iterasjons-ID/XP; send ut på nytt oppretter ny ID/XP.
- [x] Ingen uferdig oppgave flyttes eller kopieres automatisk.
- [ ] Hele flyten består målmatrisen for mobil, iPad, PC og tilgjengelighet.

## Tester og ferdigbevis

Minimum: domenetester for tidskantene, integrasjonstester for vedlegg og
fullføring, autorisasjonstester for medier og lærerhandlinger, samt E2E for
fullføring uten vedlegg, hvert mediealternativ, avbryt, upload-feil, angre,
retur, flytt og ny iterasjon.

Epicen kan markeres ferdig først når migrasjoner kan bygges fra tom database,
testene er grønne, representative skjermbilder fra alle tre enhetsklassene er
lagret i kontrollpunktet, og README/runbook beskriver den faktisk aktiverte
pilotgrensen.

Delbeviset for flytt og ny utsending finnes i
[Kontrollpunkt D2](../qa/CONTROL_POINT_D2.md). Det lukker ikke medier,
offlineflyt eller hele den fysiske enhetsmatrisen.

Delbevis for øktprojeksjon og den første klasseuken finnes i
[Kontrollpunkt C1](../qa/CONTROL_POINT_C1.md). Fullførings-/XP-beviset finnes i
[Kontrollpunkt B1](../qa/CONTROL_POINT_B1.md), og den oppgaveknyttede hånden i
[Kontrollpunkt E1](../qa/CONTROL_POINT_E1.md).
