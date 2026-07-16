# Kontrollpunkt A1 – manuell QA på reelt utstyr

**Status:** Port A og B1 bestått 16. juli 2026 – iPad-retesten har ingen kjente
åpne avvik; B2 og C–F pågår fordi elevflyt, mobiltelefon og safe-area gjenstår

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
- Loggfør hver fysisk gjennomføring, hvert avvik, rettingen, automatisk
  regresjonsbevis og fysisk retest som separate hendelser. En retting lukker
  ikke avviket før den er kontrollert på samme enhetstype og eksakte
  kandidatcommit.

### Repeterbar desktopstarter

`npm run qa:a1:desktop` nullstiller **bare lokal** Supabase, bygger samme
kandidat og oppretter ferske, isolerte sesjoner før tre synlige
Chromium-vinduer åpnes i denne rekkefølgen: eierens tilgangskontroll, ansattens
klasseflate og elevens dagsflate. Voksenrollene er AAL2. De tre rollene tilhører
samme syntetiske organisasjon, men bruker separate browser-contexts. Innlogging
og MFA-oppsett skjer headless; passord, elevkoder og TOTP-hemmeligheter skrives
ikke til terminalen.

- Start Docker og stopp først enhver Klar-server som bruker port 3100.
- Kjør kommandoen i en interaktiv terminal, ikke i CI eller via en agent.
- Bruk eier-vinduet for Port A og NVDA, og de andre vinduene for rolle- og
  flytsammenligning.
- Lukk alle tre vinduene for en ryddig avslutning som `skipped`. `Ctrl+C` er
  bare nødavslutning og rapporteres som avbrutt.
- Kommandoen er bare en sikker testinngang. Den godkjenner ingen manuell port;
  Playwright markerer startertesten som `skipped`, og resultatet må fortsatt
  føres i bevisloggen.

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
4. Lukk mobilmenyen med fokus returnert til menyknappen. Roter til landskap og
   bekreft at fokus flyttes til tilsvarende aktiv, synlig sidepanellenke. Roter
   tilbake og bekreft fokus på menyknappen uten at draweren åpnes.
5. Flytt fokus til hovedinnholdet eller skip-lenken og gjenta begge retninger.
   Fokus skal ikke kapres av navigasjonen.

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
2. Med fokus på menyknappen: roter til landskap og bekreft fokus på aktiv,
   synlig sidepanellenke. Roter tilbake og bekreft fokus på menyknappen. Gjenta
   med fokus i hovedinnholdet og kontroller at det ikke kapres.
3. Åpne en tilgangsdialog/sheet og velg syntetiske, ikke-sensitive verdier uten
   å bekrefte.
4. Roter til landskap og tilbake til portrett mens dialogen er åpen.
5. Gjenta på klasseflaten med et felt fokusert og med virtuelt tastatur åpent.

**Bestått når:** innhold og feltverdi bevares, fokus forblir logisk, layouten
reflower uten overflow, og ingen handling sendes eller dupliseres ved rotasjon.

## 9. Gjennomførings-, avviks- og retestlogg

Denne kronologien er råbeviset bak den aggregerte porttabellen. Den skal også
bevare mislykkede forsøk og delvise gjennomføringer; de må ikke overskrives av
en senere bestått retest.

### 9.1 Fysiske gjennomføringer

| ID | Port/deltest | Kandidat | Enhet og programvare | Resultat | Kontrollert omfang |
| --- | --- | --- | --- | --- | --- |
| `A1-IPAD-20260716-01` | B2 – VoiceOver, første iPad-runde | `2d70ab4a94094df9dffdd036f3d6cd01e02c58c9` | iPad 9. generasjon; iPadOS 26.5.2; Safari; VoiceOver | Delvis gjennomført – avvik funnet | Syntetisk innlogging, MFA-oppsett, inngang til eierflaten, rotor for overskrifter og mobilnavigasjon fungerte. Menyknappen lå på motsatt side av den venstreforankrede draweren; `A1-IPAD-001` ble åpnet og porten stoppet. |
| `A1-IPAD-20260716-01T` | Sikker teardown etter første iPad-runde | `2d70ab4a94094df9dffdd036f3d6cd01e02c58c9` | Windows 11; lokal Klar/Supabase; midlertidig enhetsavgrenset brannmur | Bestått | Klar-starter og lokal Supabase ble stoppet, testportene ble kontrollert lukket, midlertidige regler ble fjernet og opprinnelig brannmurtilstand gjenopprettet. |
| `A1-IPAD-20260716-02` | B2/F – fysisk retest av mobilnavigasjon og orientering | `d9ec64740a1e798e994ff3796fad6010bc114f5c` | iPad 9. generasjon; iPadOS 26.5.2; Safari; VoiceOver | Delvis gjennomført – nytt avvik funnet | Menyknapp og drawer var begge venstreforankret, og lukking returnerte fokus til menyknappen; `A1-IPAD-001` bestod fysisk retest. Ved portrett → landskap forsvant den fokuserte mobilknappen ved breakpointet, og VoiceOver flyttet til Safaris «Show sidebar»/«Home button to the right»; `A1-IPAD-002` ble åpnet og porten stoppet. |
| `A1-IPAD-20260716-02T` | Sikker teardown etter andre iPad-runde | `d9ec64740a1e798e994ff3796fad6010bc114f5c` | Windows 11; lokal Klar/Supabase; midlertidig enhetsavgrenset brannmur | Bestått | Klar-starter og lokal Supabase ble stoppet, testportene ble kontrollert lukket, midlertidige regler ble fjernet og opprinnelig brannmurtilstand gjenopprettet. |
| `A1-IPAD-20260716-03` | B2/F – fysisk fokusretest og dialoginngang | `255795df1dbe1453f1a0bcb8d6f3e4ee05727838` | iPad 9. generasjon; iPadOS 26.5.2; Safari; VoiceOver | Delvis gjennomført – fokus bestått, nytt avvik funnet | Lukket og åpen drawer bestod portrett → landskap → portrett med fokus på «Oversikt» og tilbake på «Åpne meny». Fokus på «Opprett» ble ikke kapret; iPadens orienteringsmelding ble lest mens den visuelle fokusmarkeringen ble bevart. Deretter annonserte VoiceOver «Gi tilgang, knapp», men dobbelttrykk åpnet ingen dialog; `A1-IPAD-003` ble åpnet og dialogdelen stoppet. |
| `A1-IPAD-20260716-03T` | Sikker teardown etter tredje iPad-runde | `255795df1dbe1453f1a0bcb8d6f3e4ee05727838` | Windows 11; lokal Klar/Supabase; midlertidig enhetsavgrenset brannmur | Bestått | Klar-starter og lokal Supabase ble stoppet, testportene ble kontrollert lukket, midlertidige regler ble fjernet og opprinnelig brannmurtilstand gjenopprettet. |
| `A1-IPAD-20260716-04` | B2/C/E/F – lokal HTTP-, touch-, tastatur- og orienteringsretest | `c562bb007da061708af9671d2bb7f67cc36a9be2` | iPad 9. generasjon; iPadOS 26.5.2; Safari; VoiceOver og direkte touch | Delvis gjennomført – kontrollert omfang uten nytt avvik | «Gi tilgang» åpnet over lokal HTTP. VoiceOver leste skjemagruppe, etikett, valgt verdi og påkrevd tilstand; dialogen holdt fokus, og rollevalg, fokus og verdi ble bevart gjennom landskap → portrett. Avbryt lukket dialogen og returnerte fokus. En lokalt generert syntetisk DOCX ga to Smart Import-forslag; tekstfelt, åpent skjermtastatur, fokus og redigert verdi ble bevart gjennom begge orienteringer uten horisontal overflow. Med VoiceOver av fjernet direkte touch riktig forslag, og mobilmeny, tilgangsdialog, rollevalg, dato-/tidsfelt og Avbryt traff riktig kontroll uten innsending. Elevens direkte touchflyt ble utsatt da porten ble pauset. Ingen oppdrag eller oppgaver ble publisert. |
| `A1-IPAD-20260716-04T` | Sikker teardown etter fjerde iPad-runde | `c562bb007da061708af9671d2bb7f67cc36a9be2` | Windows 11; lokal Klar/Supabase; midlertidig enhetsavgrenset brannmur | Bestått | Den syntetiske nedlastingsfilen og den lokale kopien ble fjernet. Klar-starter og lokal Supabase ble stoppet, alle testporter ble kontrollert lukket, midlertidige regler ble fjernet og opprinnelig brannmurtilstand gjenopprettet. |

Safari-versjonen ble ikke registrert i disse rundene og skal fanges ved neste
fysiske retest. Ingen passord, elevkoder, TOTP-hemmeligheter, nøkler eller
engangs-IP-adresser er lagret i loggen.

### 9.2 Avvik og retester

| ID | Port | Funnet på | Reproduksjon og observasjon | Tiltak | Automatisk regresjon | Fysisk retest |
| --- | --- | --- | --- | --- | --- | --- |
| `A1-NVDA-001` | B1 | `81d19569a275ec15fe34c8b6e5b905bd49efd479`; Windows/NVDA | Tab til en «Trekk tilbake»-knapp i oppdragslisten. Flere kontroller hadde samme tilgjengelige navn, slik at region-/listekontekst ble lest før knappen og målet ble tvetydig. | Unikt tilgjengelig navn med ansatt og klasse per tilbakekallingskontroll. | Målrettet tilgangs-/navnetest og full kontrollpunktport grønne. | Bestått med NVDA på `5cc860c681bea2e781a17f93f56778039dff419b`; de tidlige kontrollene ble kjørt på nytt på samme commit. |
| `A1-IPAD-001` | B2/C | `2d70ab4a94094df9dffdd036f3d6cd01e02c58c9`; iPad portrett/Safari/VoiceOver | Åpne mobilmenyen. Triggeren lå til høyre, mens draweren åpnet fra venstre, slik at kontroll og resultat manglet romlig sammenheng. | Behold venstreforankret drawer og flytt triggeren til venstre foran Klar-merket. Testen krever trigger før merke, samme kant, 44 × 44-mål, `aria-expanded`, Escape og fokusretur. | `npm run test:e2e:visual -- --browser=chromium` 17/17, WebKit 17/17 og `npm run verify:checkpoint` grønne før `d9ec647`. | Bestått på samme iPad og `d9ec64740a1e798e994ff3796fad6010bc114f5c`: trigger og drawer åpnet fra samme side; lukking returnerte fokus. |
| `A1-IPAD-002` | B2/F | `d9ec64740a1e798e994ff3796fad6010bc114f5c`; iPad/Safari/VoiceOver | Lukk draweren slik at fokus står på menyknappen, og roter fra 768-portrett til 1024-landskap. Mobilheaderen skjules, fast sidepanel vises, men fokus forlater Klar og lander i Safari-grensesnittet. | Spor siste navigasjonsregion. Ved breakpointbytte flyttes fokus etter layout til aktiv synlig sidepanellenke, og symmetrisk tilbake til menyknappen ved landskap → portrett. Hovedinnholdsfokus skal ikke kapres. | Dynamisk, automatisert viewport-round-trip `768×1024 → 1024×768 → 768×1024` består i Chromium 17/17 og WebKit 17/17 på `255795d`; negativ skip-lenke-test inngår. | **Bestått fysisk** på `255795df1dbe1453f1a0bcb8d6f3e4ee05727838`: begge retninger, lukket og åpen drawer samt ikke-kapret hovedinnholdsfokus ble kontrollert med VoiceOver. |
| `A1-IPAD-003` | B2/C/F | `255795df1dbe1453f1a0bcb8d6f3e4ee05727838`; iPad/Safari/VoiceOver over lokal HTTP | Dobbelttrykk på den fokuserte, aktiverte «Gi tilgang»-knappen. Knappen annonseres, men dialogen åpnes ikke visuelt eller programmatisk. | `openCreate` kalte `crypto.randomUUID()` før `showModal()`. WebKit-probe bekreftet at API-et mangler i ikke-sikker HTTP-kontekst, mens `crypto.getRandomValues()` finnes. En delt klient-UUID-hjelper bruker native UUID når tilgjengelig og ellers RFC 4122 v4 fra `getRandomValues`; samme latente feil rettes i Smart Import. | WebKit-probe: `isSecureContext=false`, `randomUUID=undefined`, `getRandomValues=function`. Deterministisk fallbacktest består 2/2. Den integrerte iPad-portretttesten fjerner native `randomUUID` før innlasting og krever at «Gi tilgang»-dialogen likevel åpnes. Full kontrollpunktport og visuell Chromium-/WebKit-port er grønne. | **Fysisk funksjonsretest uten nytt avvik** på `c562bb007da061708af9671d2bb7f67cc36a9be2`: både «Gi tilgang» og Smart Import fungerte over lokal HTTP; dialog-, fokus-, verdi-, tastatur- og orienteringsstegene i `A1-IPAD-20260716-04` fungerte. Eksakt Safari-versjon må registreres før formell lukking. |

## 10. Bevislogg

Fyll én aggregert rad per port. De underliggende gjennomføringene og avvikene
skal finnes i kronologien over. `Bestått` kan bare brukes når hele portens
beståttkriterium er kontrollert.

| Port | Resultat | Commit | Dato/tester | Enhet, OS og nettleser | Bevis/notat |
| --- | --- | --- | --- | --- | --- |
| A – faktisk 200 % zoom | Bestått | `019ac23333bcbe20f5b45d3ded0440bbd7c05605` | 2026-07-16 / Stian | Windows 11 Home 10.0.26200; Codex In-app Browser, app 26.707.9981.0 / Chromium-prosess 150.0.7871.115 | Hele Port A-protokollen bekreftet bestått av tester. OS- og browsermetadata er lest lokalt etter testen. |
| B1 – NVDA | Bestått | `5cc860c681bea2e781a17f93f56778039dff419b` | 2026-07-16 / Stian | Windows 11 Home 10.0.26200; NVDA 2026.1.1; Playwright Chromium 149.0.7827.55 | Hele NVDA-protokollen bekreftet med bare tastatur og syntetiske lokale data: skip-lenke, landmarks, overskrifter og oppdragsregion; felt, grupper, fokusfelle, Escape og fokusretur i opprettings- og tilbakekallingsdialog; klasseoverskrifter, trygg tilgangsavslutning samt opprettings-, tilbakekallings- og feilstatus. Et tvetydig navn på tilbakekallingsknappene ble funnet, rettet i denne commiten og kontrollert på nytt. Den avsluttende retesten av de tidlige kontrollene ble kjørt på samme commit. |
| B2 – VoiceOver | Pågår – ingen kjent åpen iPad-funksjonsfeil | `c562bb007da061708af9671d2bb7f67cc36a9be2` | 2026-07-16 / Stian | iPad 9. generasjon; iPadOS 26.5.2; Safari-versjon ikke registrert; VoiceOver | Innlogging, MFA, overskriftsrotor, mobilmeny, tilgangsdialog, Smart Import og fokus/verdi ved orienteringsbytte er fysisk kontrollert uten nytt avvik. Eksakt Safari-versjon, mobiltelefon og resten av den avtalte matrisen gjenstår. |
| C – ekte touch | Pågår – utvalgte iPad-kontroller uten avvik | `c562bb007da061708af9671d2bb7f67cc36a9be2` | 2026-07-16 / Stian | iPad 9. generasjon; iPadOS 26.5.2; Safari-versjon ikke registrert; direkte touch | Mobilmeny, tilgangsdialog, rollevalg, dato-/tidsfelt, Avbryt og fjerning av riktig Smart Import-forslag traff stabilt uten feiltrykk eller innsending. Klassekort, tilbakekallingsdialog, hovedhandling, elevflyt og mobiltelefon gjenstår. |
| D – notch/safe-area | Ikke kjørt |  |  |  |  |
| E – virtuelt tastatur | Pågår – Smart Import på iPad uten avvik | `c562bb007da061708af9671d2bb7f67cc36a9be2` | 2026-07-16 / Stian | iPad 9. generasjon; iPadOS 26.5.2; Safari-versjon ikke registrert; skjermtastatur | Redigert oppgavetittel, feltfokus og skjermtastatur forble brukbare gjennom orienteringsbytte; verdien ble bevart og publiseringshandlingen var nåbar uten å bli aktivert. Eksakt Safari-versjon og resten av felt- og enhetsmatrisen gjenstår. |
| F – orienteringsbytte | Pågår – iPad-steg uten avvik | `c562bb007da061708af9671d2bb7f67cc36a9be2` | 2026-07-16 / Stian | iPad 9. generasjon; iPadOS 26.5.2; Safari-versjon ikke registrert; VoiceOver og skjermtastatur | Navigasjon, tilgangsdialog med valgt rolle og Smart Import med fokusert felt og åpent skjermtastatur fungerte fysisk i begge retninger uten tapt verdi, skjult hovedhandling eller innsending. Eksakt Safari-versjon og mobiltelefon gjenstår. |

## 11. Lukking av A1

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
