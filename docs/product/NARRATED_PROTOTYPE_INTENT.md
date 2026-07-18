# Klar 3.0 – sporing av fortalt produktintensjon

> **Status:** Kuratert sporingsregister for historisk produktintensjon. Dette
> dokumentet er ikke en ordrett transkripsjon og er ikke i seg selv en
> implementasjonsspesifikasjon. Normative valg må være innarbeidet i
> [domenekontrakten](./DOMAIN_CONTRACT.md) og relevante epics.

## Hvorfor talesporet er en egen kilde

I [videoomvisningen av Klar](https://youtu.be/yg6kgcdzIYM) er det produkteieren
selv som forklarer hensikten med skjermene og brukerflytene. Stemmen skal derfor
ikke behandles som bakgrunnslyd. Den kan avklare hva en kontroll skulle løse,
og kan også si at en synlig legacy-flyt ikke fungerte som ønsket.

Tidskodene under peker til de kuraterte bildene i
[`Prototypen/Videoomvisning`](../../Prototypen/Videoomvisning/README.md). Teksten
er en kort parafrase av den muntlige forklaringen, kontrollert mot bildet,
masteroppgaven og historisk kode. Ved konflikt gjelder kilderekkefølgen i
domenekontrakten. Sikkerhets-, personvern- og autorisasjonsgrensene i 3.0 kan
aldri svekkes av historisk atferd.

Videoen dokumenterer belønningstypene og den synlige valgsituasjonen. Den
spesifiserer ikke bevaring etter XP-reversering eller vern mot ny belønning ved
samme nivå. Disse reglene er senere eksplisitte produktbeslutninger og spores
normativt i domenekontrakten § 7.3.

## Klassifisering

- **Innarbeidet:** intensjonen finnes i domenekontrakten og har en eier i en
  epic. Dette sier ikke nødvendigvis at hele funksjonen er implementert.
- **Tilpasset:** intensjonen beholdes, men synlig legacy-atferd er endret av en
  nyere produkt- eller sikkerhetsbeslutning.
- **Utsatt:** ønsket retning, men ikke del av gjeldende kontrollpunkt eller
  pilotgrense.
- **Åpent valg:** talesporet viser et reelt alternativ som ennå ikke er avgjort
  normativt. Det skal ikke implementeres ved gjetning.
- **Antimønster:** vist eller omtalt legacy-atferd som ikke skal porteres.

## Tidskodet sporingsmatrise

| Tid | Parafrasert muntlig intensjon | Klassifisering i 3.0 | Eier og faktisk status |
| --- | --- | --- | --- |
| 00:10 | Læreren trenger én oversikt med nylige elever, aktiv hjelpekø, hurtighandlinger og elevaktivitet. | Innarbeidet som planlagt helhet. | [E07](../epics/E07_STAFF_WORKSPACE_AND_CONTENT_LIBRARIES.md) og [`UI_UX_REFERENCE.md`](./UI_UX_REFERENCE.md). Dagens lærerflate er ikke det ferdige dashboardet. |
| 00:33 | Læreren åpner hjelpekø for en valgt klasse og kan styre prioriteringen internt. | Tilpasset og innarbeidet. Eleven skal ikke se reell køplass. | [E03](../epics/E03_CONTEXTUAL_HELP_QUEUE.md), [E1](../qa/CONTROL_POINT_E1.md) og [E2](../qa/CONTROL_POINT_E2.md). |
| 01:08 | Klasse-, gruppe- og elevflater skal gi raske innganger til oppfølging og individuell støtte. | Innarbeidet som planlagt helhet. | [E05](../epics/E05_STAFF_ACCESS_AND_SUBSTITUTES.md) eier tilgangsgrensen; [E07](../epics/E07_STAFF_WORKSPACE_AND_CONTENT_LIBRARIES.md) eier arbeidsrommene. |
| 02:05 | Oppgaveinnhold opprettes kort og gjenbrukbart før mottaker og tidspunkt velges. | Innarbeidet, delvis implementert. | [E01](../epics/E01_STUDENT_DAY_AND_TASK_FLOW.md) og [E04](../epics/E04_SMART_IMPORT_AND_WEEKLY_PLANS.md). |
| 03:05 | En oppgave kan knyttes til elev, klasse eller gruppe og til konkrete undervisningsøkter; gjenbruk skal kunne bli nye iterasjoner. | Innarbeidet; D2 implementerer eksplisitt flytt eller ny utsending. | Domenekontrakten § 5 og § 9.5. [D2](../qa/CONTROL_POINT_D2.md) dokumenterer den faktiske verifikasjonsstatusen. |
| 03:05 | Valgte økter kan enten dele én fullføring eller kreve en ny fullføring per økt. | **Åpent valg.** 3.0 har ennå ikke kontrakt for én fullføring som dekker flere økter. | Må avklares før en flersesjonsmodell bygges. D2 endrer ikke denne regelen. |
| 03:05 | Læreren kan velge ukentlig gjentakelse for å spare dobbeltarbeid. | **Utsatt**, ikke forkastet. Eventuell gjentakelse må bli eksplisitte, forhåndsviste iterasjoner; den er ikke automatisk flytting etter skoletid. | E01/E04 trenger et senere kontrollpunkt og konkrete stopp-/redigeringsregler. D2 har ingen recurrence-regel. |
| 04:08 | En fast grunnplan kan ha kontrollerte ukeavvik og personlig støtte. | Utsatt. | E04 dekker publiserte ukeplaner; permanent grunnplan og avvik er ikke ferdig spesifisert. |
| 05:08 | Dokumentimport skal ende i en strukturert, redigerbar forhåndsvisning før publisering. | Innarbeidet, delvis implementert. | [E04](../epics/E04_SMART_IMPORT_AND_WEEKLY_PLANS.md) og [C1](../qa/CONTROL_POINT_C1.md). Pilotparseren er regelbasert. |
| 06:10 | Elevens startpunkt er dagens undervisningsøkter, med aktuell økt tydeligst. | Innarbeidet, delvis implementert. | Domenekontrakten § 6 og [C1](../qa/CONTROL_POINT_C1.md). |
| 06:24 | Åpning av oppgaven viser instruksjonen direkte; eleven trenger ingen egen «Start» eller «I gang». | Innarbeidet og implementert i gjeldende kjerneflyt. | [E01](../epics/E01_STUDENT_DAY_AND_TASK_FLOW.md) og [B1](../qa/CONTROL_POINT_B1.md). |
| 06:26 | Etter «Fullfør» kan eleven velge tekst, lyd, kamera eller bilde, men også bekrefte uten vedlegg. | Innarbeidet; medier er utsatt. | Domenekontrakten § 6.3. Null vedlegg er implementert i B1; medielagring krever eget personvernkontrollpunkt. |
| 06:43 | Ved nivåoppgang kan en elev med blomst aktivert velge å fargelegge et kronblad; fortelleren viser både pågående og ferdig blomst. Den viste flaten tilbyr også læreropprettede belønninger. | Tilpasset og innarbeidet som planlagt målprodukt. Flerfargede strøk, «Velg nå/Senere», levende hage og unik claim er senere 3.0-regler. | [E02](../epics/E02_PROGRESS_AND_REWARDS.md), [E09](../epics/E09_LIVING_GARDEN_AND_CONDITIONAL_REWARDS.md) og [B2](../qa/CONTROL_POINT_B2.md). |
| 07:06 | Eleven kan rekke opp hånden og trekke forespørselen tilbake. | Tilpasset og implementert. Synlig kønummer er et antimønster. | [E03](../epics/E03_CONTEXTUAL_HELP_QUEUE.md) og [E1](../qa/CONTROL_POINT_E1.md). |
| 07:14 | Læreren kan se og prioritere køen. | Innarbeidet og implementert i kjerne. Drag kan ikke være eneste metode. | [E2](../qa/CONTROL_POINT_E2.md). |
| 08:10 | Fag og alle oppgaver gir en sekundær oversikt ved siden av dagens økter. | Innarbeidet og implementert i D3. | [E01](../epics/E01_STUDENT_DAY_AND_TASK_FLOW.md), [D3](../qa/CONTROL_POINT_D3.md) og UI/UX-referansen. «Dagen i dag» er fortsatt landing. |
| 08:16 | Eleven kan angre fullføring, åpne oppgaven igjen og få de krediterte poengene reversert. | Innarbeidet og implementert. | Domenekontrakten § 7.4 og [B1](../qa/CONTROL_POINT_B1.md). |
| 08:24–08:45 | Fortelleren går opp i nivå for å vise andre belønningstyper. En læreropprettet belønning vises som kupong eleven kan velge å bruke. | Tilpasset og innarbeidet som planlagt målprodukt. Videoens åpne bevarings- og innløsningsregler er nå kontraktsfestet. | [E02](../epics/E02_PROGRESS_AND_REWARDS.md), domenekontrakten § 10.2 og [E09](../epics/E09_LIVING_GARDEN_AND_CONDITIONAL_REWARDS.md). |
| 08:51 | Ukeoversikten er sekundær, men dagens kolonne og oppgavestatus skal være lett å finne. | Innarbeidet visuell retning; full flate er utsatt. | E01 og UI/UX-referansen. |
| 09:41 | Smart Import skal gi en menneskekontrollert og redigerbar kandidat før publisering. | Innarbeidet, delvis implementert. | E04 og C1. |
| Tidskode ikke bevart i nøkkelbildesettet | Egendefinerte fag kan få et symbol og en farge som følger inn i elevflaten. | Utsatt intensjon. Farge kan aldri være eneste informasjonsbærer. | UI/UX-referansen; fagadministrasjon mangler et eget kontrollpunkt. |
| Tidskode ikke bevart i nøkkelbildesettet | Læreren kan gi en kompakt reaksjon eller kommentar på frivillig elevmedia, men den viste kommentarflyten omtales som feilende. | Åpent produktvalg; vist interaksjon er ikke akseptansebevis. | Personvern, moderering, oppbevaring og elevens innsyn må avgjøres før implementering. |
| Mot slutten | Synlige eller enkelt genererte elevpassord vises i legacy-flyten. | Antimønster. | 3.0 bruker serverstyrt, pepperet prototypekode og skal ikke eksponere hemmeligheter. |

## Åpne valg som ikke skal avgjøres ved implementasjonsgjetning

1. Om én elevfullføring kan gjelde flere valgte undervisningsøkter, og hvordan
   status, angre, retur, vedlegg og XP i så fall skal avgrenses.
2. Hvordan eksplisitt ukegjentakelse opprettes, forhåndsvises, endres og
   stoppes, og om hver forekomst alltid er en selvstendig iterasjon.
3. Hvilket personvern- og modereringsregime som må gjelde før reaksjoner og
   kommentarer på elevens frivillige levering kan aktiveres.
4. Om en senere, separat «Har du husket?»-sjekkliste skal være en ikke-XP-
   givende planstruktur eller en avgrenset oppgavetype.

Disse punktene er produktgjeld, ikke skjulte krav til D2 eller bevis på at den
historiske løsningen skal kopieres.
