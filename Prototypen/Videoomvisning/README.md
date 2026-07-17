# Videoomvisning av Klar – kuratert referanse

**Kilde:** [Omvisning av Klar](https://youtu.be/yg6kgcdzIYM), 10:59,
publisert 15. mai 2026.

Bildene ble hentet ut 16. juli 2026. Fortellerstemmen er produkteierens egen
forklaring av hensikt og flyt. Tidskodene i filnavnene kobler hvert bilde til
det som blir sagt i videoen. Automatisk norsk transkripsjon er brukt som
arbeidsstøtte, men produktvalg er kontrollert mot bildet, masteroppgaven,
domenekontrakten og `origin/master`.

Videoen og bildene er historiske produktreferanser. De er ikke bevis på at en
funksjon finnes i 3.0, og de overstyrer ikke domenekontrakten eller relevante
epics.

En tidskodet parafrase av produkteierens muntlige intensjon, med kobling til
gjeldende kontrakt, epics, åpne valg og faktisk implementeringsstatus, finnes i
[`docs/product/NARRATED_PROTOTYPE_INTENT.md`](../../docs/product/NARRATED_PROTOTYPE_INTENT.md).

## Det talesporet avklarer

- Lærerens oversikt skal samle nylig brukte elever, aktiv hjelpekø,
  hurtighandlinger og nylig elevaktivitet.
- Hjelpekø åpnes for en klasse. Læreren kan prioritere internt uten at eleven
  trenger å kjenne den reelle rekkefølgen.
- Oppgaver kan tildeles en elev, klasse eller gruppe, knyttes til en konkret
  undervisningsøkt og gjentas som nye iterasjoner.
- Talesporet skiller mellom én fullføring som gjelder alle valgte økter og én
  ny fullføring per økt. Den historiske ukegjentakelsen er produktintensjon,
  men 3.0 modellerer den som eksplisitte økter, planrevisjoner og iterasjoner.
- Egendefinerte fag kan få symbol og farge som følger inn i elevflaten.
- Elevens startpunkt er dagens økter. Åpning viser instruksjonen direkte; det
  finnes ingen egen «I gang»-handling i den viste flyten.
- Ved fullføring kan eleven velge lyd, kamera eller bilde, men også fullføre
  uten vedlegg.
- Angre åpner oppgaven igjen og trekker tilbake poengene.
- Reaksjon og kommentar på elevens levering er en ønsket retning, men
  fortellerstemmen omtaler den viste kommentarflyten som feilende. Bildet er
  derfor ikke akseptansebevis for interaksjonen.
- Ved nivåoppgang kan en elev med blomst aktivert velge å fargelegge et
  kronblad. Den viste belønningsflaten inneholder også læreropprettede
  belønninger. Videoen avklarer ikke bevaring etter XP-reversering.
- Smart Import skal ende i en redigerbar forhåndsvisning før publisering.
- Synlige eller enkelt genererte elevpassord mot slutten av omvisningen er
  legacy-atferd og skal ikke porteres til 3.0.

## Kuraterte nøkkelbilder

| Tid | Fil | Klassifisering og bruk i 3.0 |
| --- | --- | --- |
| 00:10 | `00-00-10-teacher-home.png` | **Intensjon:** samlet ansattoversikt med kø, hurtighandlinger og aktivitetsfeed. Dekorativ statistikk er ikke nødvendig. |
| 00:33 | `00-00-33-help-queue-toggle.png` | **Intensjon:** kø åpnes for en klasse. I 3.0 må dette være en autorisert, tidsavgrenset køøkt. |
| 01:08 | `00-01-08-student-profile.png` | **Visuell referanse:** klasse-, gruppe- og elevinnganger med søk. Individuell støtte skal ikke eksponere passord eller unødvendige elevdata. |
| 02:05 | `00-02-05-create-task.png` | **Intensjon:** kort innholdssteg før tildeling, økt og iterasjon. 3.0 bruker autoritative serveroperasjoner. |
| 03:05 | `00-03-05-task-session-iteration.png` | **Innarbeidet intensjon:** tildeling kan knyttes til konkrete økter og ny utsending kan bli en ny iterasjon. **Åpent valg:** én fullføring for alle valgte økter eller én per økt. **Utsatt intensjon:** eksplisitt ukegjentakelse. Den tette dialogen og klientstyrt recurrence er antimønstre. |
| 04:08 | `00-04-08-schedule.png` | **Intensjon:** fast grunnplan med kontrollerte ukeavvik og personlig støtte. |
| 05:08 | `00-05-08-plan-import.png` | **Intensjon:** DOCX inn, forklaring og redigerbart kontrollpunkt før publisering. KI-påstanden er historisk; pilotens parser er regelbasert. |
| 06:10 | `00-06-10-student-home.png` | **Intensjon:** dagens økter som rolige, tidsstyrte kort med aktuell økt tydeligst. |
| 06:24 | `00-06-24-task-detail.png` | **Intensjon:** ett fag, én oppgave og én tydelig fullføringshandling. Ingen «Start» eller «I gang». |
| 06:26 | `00-06-26-completion-flow-a.png` | **Intensjon:** kort sjekkpunkt med frivillig lyd, kamera og bilde; null vedlegg er gyldig. |
| 06:43 | `00-06-43-level-up.png` | **Fortalt og vist historisk flyt:** ved nivåoppgang kan en elev med blomst aktivert velge å fargelegge et kronblad; fortelleren viser deretter pågående og ferdig blomst. Konfetti og tvungen modal er legacy-uttrykk, ikke 3.0-krav. |
| 07:06 | `00-07-06-student-queue.png` | **Antimønster:** elevens synlige «Nr 1» kopieres ikke. Bare hånd og «Står i kø» vises. |
| 07:14 | `00-07-14-teacher-queue.png` | **Intensjon + delvis antimønster:** ansatt kan se og prioritere køen. Dra-og-slipp kan aldri være eneste metode. |
| 08:10 | `00-08-10-all-tasks.png` | **Intensjon:** fagkort gir sekundær oversikt over alle oppgaver uten å konkurrere med dagens økt. |
| 08:16 | `00-08-16-task-undo.png` | **Intensjon:** en fullført oppgave kan åpnes igjen med «Angre»; talesporet bekrefter at de krediterte poengene samtidig reverseres. |
| 08:24–08:45 | `00-08-39-reward-coupon.png` | **Fortalt og vist historisk flyt:** en læreropprettet belønning vises som aktiv kupong med «Bruk kupong»; fortelleren sier at eleven kan velge å bruke den. Bevaring etter XP-reversering og eksakt innløsningslivsløp fremgår ikke av videoen. |
| 08:51 | `00-08-51-student-schedule.png` | **Intensjon:** ukeoversikt er sekundær; dagens kolonne og oppgavestatus skal være lett å finne. |
| 09:41 | `00-09-41-parsed-plan.png` | **Intensjon:** strukturert, redigerbar forhåndsvisning med menneskelig publiseringskontroll. |

## Porteringsregel

Bevar informasjonsarkitektur, flyt, gjenkjennelige symboler og rolig tone.
Ikke porter direkte Supabase-klientmutasjoner, offentlig elevmedia, gammel RLS,
kønummer for eleven, drag-only-interaksjon, klientberegnet XP eller legacyens
klientstyrte og delvis inkonsistente angre-/belønningsmodell.

Nåværende implementeringsbevis føres separat: den øktbundne køflyten fra
fortellerstemmen og bildene 00:33, 07:06 og 07:14 spores i
[`docs/qa/CONTROL_POINT_E1.md`](../../docs/qa/CONTROL_POINT_E1.md).
Oppgaveangre fra 08:16 spores i
[`docs/qa/CONTROL_POINT_B1.md`](../../docs/qa/CONTROL_POINT_B1.md), mens
økt- og iterasjonsmodellen fra 03:05 spores i
[`docs/qa/CONTROL_POINT_C1.md`](../../docs/qa/CONTROL_POINT_C1.md) og
[`docs/qa/CONTROL_POINT_D2.md`](../../docs/qa/CONTROL_POINT_D2.md). De åpne og
utsatte delene spores separat i
[`docs/product/NARRATED_PROTOTYPE_INTENT.md`](../../docs/product/NARRATED_PROTOTYPE_INTENT.md).
