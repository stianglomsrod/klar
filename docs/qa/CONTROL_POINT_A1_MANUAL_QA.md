# Kontrollpunkt A1 – manuell QA på reelt utstyr

**Status:** Klar til gjennomføring – ingen fysisk port er godkjent ennå

**Gjelder:** [`CONTROL_POINT_A1.md`](./CONTROL_POINT_A1.md)

Denne protokollen lukker de seks manuelle portene som ikke kan erstattes av
Playwright, viewport-emulering, axe eller screenshots. En port krysses bare av
når testen er gjennomført på den navngitte nettleseren eller enheten og
resultatet er ført i bevisloggen nederst.

## 1. Sikker inngang

- Bruk bare syntetiske A1-brukere og syntetiske klasser.
- Desktoptesten skal bruke lokal Supabase og loopback-Klar når det er mulig.
- Ethvert testmål som ikke er loopback, må navngis og godkjennes eksplisitt
  før det brukes. Ikke bruk et linket Supabase-prosjekt som reserve.
- Ikke ta med passord, TOTP-hemmeligheter, cookies, elevkoder eller nøkler i
  skjermbilder eller notater.
- Noter nøyaktig commit, enhet, OS-versjon, nettleser og nettleserversjon.
- Ved ett avvik: stopp den berørte porten, la den stå åpen og registrer et
  konkret reproduksjonssteg. Ikke godkjenn resten av porten ved skjønn.

## 2. Felles beståttkriterier

Alle relevante scenarioer skal oppfylle følgende:

- ingen horisontal sidescroll ved normal bruk;
- ingen skjult eller avkuttet hovedhandling, feilmelding eller fokusmarkering;
- synlig fokus følger den logiske arbeidsrekkefølgen;
- ingen handling krever hover, drag eller presis musepeker;
- dialog/sheet har forståelig navn, holder fokus, lukkes med Escape der
  tastatur finnes og returnerer fokus til utløseren;
- status og tilgangstap forstås uten bare farge;
- zoom, tastatur, safe-area eller orienteringsbytte nullstiller ikke en
  påbegynt handling og sender ikke samme handling to ganger.

## 3. Port A – faktisk 200 prosent browserzoom

**Utstyr:** Windows-PC, Chromium-basert nettleser, fysisk tastatur.

1. Åpne den lokale AAL2-eierflaten `/v3/teacher/access`.
2. Nullstill nettleserzoom med `Ctrl+0`.
3. Bruk nettleserens egen zoomkontroll til browser-UI-et viser **200 %**.
   OS-skalering, devtools, CSS-transform og viewportendring teller ikke.
4. Kontroller oppdragslisten og åpne **Gi tilgang**.
5. Tab gjennom alle felt og handlinger. Kontroller at feltet med fokus alltid er
   synlig, og at dialogen kan lukkes med Escape med fokusretur.
6. Åpne en tildelt klasse og kontroller oppgavepublisering, Smart Import,
   elevlisten og hjelpekøen uten å sende eller publisere noe.

**Bestått når:** alle felles kriterier gjelder på både tilgangs- og
klasseflaten, og ingen hovedhandling krever horisontal scroll.

## 4. Port B – NVDA og VoiceOver

### NVDA på Windows

1. Start NVDA og bruk bare tastaturet.
2. Kontroller at skip-lenke, banner/sidebar, navigasjon, hovedinnhold,
   overskrift og oppdragsregion annonseres med riktig rolle og navn.
3. Åpne **Gi tilgang** og kontroller dialognavn, beskrivelse, feltetiketter,
   grupper, feil/status og fokusfelle.
4. Åpne tilbakekallingsdialogen uten å bekrefte. Konsekvensen skal leses før
   bekreftelsesknappen.
5. Kontroller en klasseflate og den trygge tilstanden
   **Tilgangen er avsluttet** med en dedikert syntetisk fixture.

### VoiceOver på iPad/iPhone

1. Bruk Safari og VoiceOver med sveip-/rotornavigasjon.
2. Gjenta landmark-, overskrift-, navigasjons-, dialog- og statuskontrollene.
3. Kontroller at visuell rekkefølge og opplesingsrekkefølge er den samme etter
   orienteringsbytte.

**Bestått når:** begge skjermlesere gir entydige navn, roller, tilstander og
feilmeldinger, uten fokusfelle uten utvei eller uvarslet kontekstbytte.

## 5. Port C – ekte touch og trykkmål

**Utstyr:** minst én iPad og én mobiltelefon.

1. Bruk finger, ikke mus, styreflate eller emulator.
2. Åpne/lukk mobilnavigasjon, klassekort, tilgangsdialog/sheet og
   tilbakekallingsbekreftelse.
3. Kontroller select, dato-/tidsfelt, avbryt og hovedhandling.
4. Kontroller at tilstøtende handlinger kan treffes uten feiltrykk, og at ingen
   kontroll bare oppdages med hover.
5. Gjenta på elevens sentrale handlinger uten å fullføre en oppgave.

**Bestått når:** alle sentrale mål kan aktiveres stabilt med finger og ingen
flyt krever drag. Det eksisterende automatiserte geometribeviset for 44 × 44
CSS-piksler skal fortsatt være grønt; den fysiske testen måler ikke CSS-piksler.

## 6. Port D – notch og safe-area

**Utstyr:** iPhone/iPad med faktisk safe-area eller tilsvarende Android-enhet.

1. Åpne elev- og ansattflaten i standalone/PWA-modus hvis den modusen skal
   brukes i piloten; kontroller også vanlig Safari/Chrome.
2. Kontroller A1-flatenes toppfelt, mobilmeny og dialog/sheet i portrett og
   landskap.
3. Scroll helt til topp og bunn.

**Bestått når:** ingen tekst, fokusmarkering eller handling ligger under notch,
statusfelt, avrundede hjørner eller home indicator.

## 7. Port E – ekte virtuelt tastatur

**Utstyr:** iPad og mobiltelefon med systemets skjermtastatur.

1. Fokuser innlogging, oppdragsdialogens tekst-/dato-/tidsfelt,
   oppgavepublisering og Smart Import-redigering.
2. Bytt mellom tekst-, tall- og dato-/tidsinput.
3. Kontroller siste felt og hovedhandling mens tastaturet er åpent.
4. Lukk tastaturet og kontroller at scrollposisjon, dialog og innhold bevares.

**Bestått når:** fokusert felt og relevant feilmelding er synlig, hovedhandlingen
kan nås uten fastlåst scroll, og tastaturet skjuler ikke innhold permanent.

## 8. Port F – live orienteringsbytte

**Utstyr:** iPad og mobiltelefon med rotasjon aktivert.

1. Start i portrett, åpne mobilmeny og lukk den igjen.
2. Åpne en tilgangsdialog/sheet og velg syntetiske, ikke-sensitive verdier uten
   å bekrefte.
3. Roter til landskap og tilbake til portrett mens dialogen er åpen.
4. Gjenta på klasseflaten med et felt fokusert og med virtuelt tastatur åpent.

**Bestått når:** innhold og feltverdi bevares, fokus forblir logisk, layouten
reflower uten overflow, og ingen handling sendes eller dupliseres ved rotasjon.

## 9. Bevislogg

Fyll én rad per faktisk gjennomføring. `Bestått` kan bare brukes når hele
portens beståttkriterium er kontrollert.

| Port | Resultat | Commit | Dato/tester | Enhet, OS og nettleser | Bevis/notat |
| --- | --- | --- | --- | --- | --- |
| A – faktisk 200 % zoom | Ikke kjørt |  |  |  |  |
| B1 – NVDA | Ikke kjørt |  |  |  |  |
| B2 – VoiceOver | Ikke kjørt |  |  |  |  |
| C – ekte touch | Ikke kjørt |  |  |  |  |
| D – notch/safe-area | Ikke kjørt |  |  |  |  |
| E – virtuelt tastatur | Ikke kjørt |  |  |  |  |
| F – orienteringsbytte | Ikke kjørt |  |  |  |  |

## 10. Lukking av A1

Når alle rader er bestått, skal beviset og de automatiske portene gjelde samme
kandidatcommit. Etter en kodeendring må berørte manuelle porter kjøres på nytt.

Deretter:

1. oppdater bevisloggen med faktiske enheter og resultater;
2. kryss av de seks manuelle portene i `CONTROL_POINT_A1.md` og
   `PILOT_RUNBOOK.md`;
3. kjør `npm run verify:checkpoint`, `npm run test:db:staff`,
   `npm run test:e2e:full`, `npm run test:e2e:full:webkit` og
   `git diff --check`;
4. lag et eget grønt dokumentasjonscommit;
5. marker A1 fullført bare dersom ingen åpent avvik berører kriteriene over.
