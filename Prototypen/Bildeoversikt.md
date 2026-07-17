# Bildeoversikt — Prototypen (Klar)

Bildene er samlet som historisk dokumentasjon. De opprinnelige beskrivelsene
og plasseringsforslagene under refererer til kapittelnummer i oppgaven; den
kuraterte 3.0-klassifiseringen har forrang i produktarbeidet.

## Bruk i Klar 3.0

Denne mappen er en historisk designreferanse, ikke en pixelspesifikasjon eller
en fasit for domenet. Ved motstrid gjelder kildene i denne rekkefølgen:

1. `docs/product/DOMAIN_CONTRACT.md`;
2. relevant epic i `docs/epics/`;
3. `docs/product/UI_UX_REFERENCE.md`;
4. denne bildeoversikten, [videoomvisningen](./Videoomvisning/README.md) og de
   kuraterte skjermbildene;
5. historisk kode under `archive/2x-ui/` og på `origin/master`.

Skjermbildene skal brukes til å forstå informasjonsarkitektur, visuelt
hierarki, flyt og tone. De skal ikke brukes som automatiske
screenshot-baselines. Første godkjente Klar 3.0-flate blir baseline for senere
pixelregresjon.

Videoomvisningen tilfører tidsrekkefølge og produkteierens muntlige forklaring
av hensikten bak flytene. Tidskodede nøkkelbilder og beslutninger er lagret i
[`Videoomvisning/`](./Videoomvisning/README.md). Talesporet er et historisk
designbevis, ikke dokumentasjon på implementert 3.0-funksjon.

### Produktklassifisering

| Status | Betydning |
| --- | --- |
| **Intensjon** | Produktideen skal ivaretas, men utformingen skal reimplementeres på 3.0-domenet. |
| **Visuell referanse** | Hierarki, komposisjon eller tone kan inspirere; detaljer er ikke bindende. |
| **Historisk** | Dokumenterer prototypen/masterarbeidet og kan inneholde utgått funksjon eller språk. |
| **Antimønster** | Viser noe som uttrykkelig ikke skal kopieres. |

Filer som ikke er nevnt i den kuraterte tabellen under, behandles som
**historiske** inntil relevant epic gjør en eksplisitt ny vurdering.

| Filer | Status | Det som skal ivaretas | Det som ikke skal kopieres ukritisk |
| --- | --- | --- | --- |
| `e2.jpg`, `e4.jpg`, `E tidsverktøyet aktivert av eleven - tidsindikator på timen - antall oppgaver i timen - gjemmer de fleste timene og fremhever timen som er akkurat nå jf arbeidsminne NY.jpg` | **Intensjon** | Rolig dagsoversikt, tydelig aktuell økt, enkel oppgave og én åpenbar hovedhandling. | Eksakte størrelser, «Level»-språk og gamle oppgavestatuser. |
| `e6.jpg` | **Intensjon** | «Fullfør» åpner et rolig sjekkpunkt der tekst, lyd og bilde er frivillig. | Vedlegg som krav eller en egen «I gang»-tilstand. |
| `E oppgaver og quizer.jpg`, `E aktivert hjelpekø.jpg` | **Historisk + delvis antimønster** | Hånden er tilgjengelig i elevens aktive kontekst. | Eleven skal ikke se kønummer, andre elever eller lærerens skjulte prioritering. |
| `L hjelpekøliste.png`, `L flytter elev opp på hjelpekølista uten at elevene trenger å vite det jf WS3 - Dette var en bug som ble en feature.jpg` | **Intensjon** | Ansatte kan se, løse og omprioritere køen uten å eksponere prioriteringen for eleven. | Drag-and-drop som eneste metode; kønummeret i ansattflaten er ikke elevsannhet. |
| `E levelupmodal med valgmuligheter NY.jpg`, `E *kupong*.jpg`, `E *blomst*.jpg`, `E fargelegging av nytt kronblad NY.jpg` | **Intensjon + visuell referanse** | Et nivå kan gi ett belønningsvalg; blomsterhage og kuponger gir historisk visuell retning. Varighet, én-per-milepæl og anti-farming følger domenekontrakten § 7.3, ikke bildene alene. | Farming, gjentatt stor feiring, obligatorisk spillmodus eller kontinuerlig animasjon. |
| `E halvveis til målet modal - Basert på ide fra WS2 men må forenkles veldig eller fjernes i neste iterasjon da det kommer veldig mye informasjon.jpg` | **Antimønster** | Bare forskningsinnsikten om at progresjon kan motivere. | Informasjonstettheten, «raskeste vei» og pressende anbefalinger. |
| `Knappen som forårsaket angst i ws3.jpg` | **Antimønster** | Innsikten om at kjente symboler og trygg ordlyd er nødvendig. | Arkiv-/sletteambiguitet og alarmerende rød badge for vanlig progresjon. |
| `L Landingsside med oversikt og hurtighandlinger - statistikk er en plassholder.jpg`, `L Mine elever 1.jpg`, `L Mine elever 3.jpg` | **Visuell referanse** | Effektivt ansatthierarki, nylig brukte elever, kø, hurtighandlinger og klasse/elev-oversikt. | Dekorativ statistikk, hover-only-handlinger og desktop-tabeller på små skjermer. |
| `L administrer elev NY.jpg`, `L administrer elev scrollet ned NY.jpg` | **Visuell referanse + delvis antimønster** | Samlet elevkontekst, støttepreferanser og belønningsvalg. | Visning/kopiering av eksisterende passord og klientstyrte privilegier. |
| `Parset ukebrev øverste del.jpg`, `Parset ukebrev nederste del - Alle felter kan trykkes på og redigeres før man publiserer.jpg`, `L ai parser under Planer.jpg` | **Intensjon + historisk** | Kilden beholdes synlig, resultatet er redigerbart, og publisering krever et menneskelig kontrollpunkt. | Påstand om ekstern KI; første pilot bruker lokal, regelbasert DOCX-tolking. |
| `L visning av quizsvar med mulighet til å spille av elevens innspilte lyd, og mulighet for reaksjon og kommentar.png` | **Visuell referanse + åpent valg** | Lærer kan se avklart, frivillig elevmedia og sende arbeid i retur. Reaksjon/kommentar krever en senere personvern- og modereringsbeslutning; fortellerstemmen omtaler den viste kommentarflyten som feilende. | Den viste reaksjons-/kommentarinteraksjonen som akseptansebevis, quiz som obligatorisk oppgavetype eller fritekst som unødvendig elevjournal. |
| `Forsideillustrasjon.jpg`, `Forsideillustrasjon Elev Landingsside Laptop NY.jpg`, `Forsideillustrasjon Lærer Dashboard Mobil NY.jpg` | **Visuell referanse** | Helhetsinntrykk og presentasjon av elev-/ansattretningen. | Å bruke presentasjonsmockups som responsive eller funksjonelle baselines. |
| `Kollasj.pptx`, `Kollasj/*.PNG` | **Historisk** | Raske oversikter over prototypeflatene. | Å behandle kollasjene som egne eller mer autoritative designkilder. |

Produkteier bekreftet 15. juli 2026 at navn, e-postadresser og eksempeltekst i
bildene tilhører mockbrukere. Filene behandles derfor som syntetiske historiske
referanser og kan inngå i repoet. Innholdet skal likevel aldri kopieres til
fixtures eller brukes som dokumentasjon av virkelige elever.

---

## Elevgrensesnitt (E)

| Filnavn                                  | Beskrivelse                                                                                                                                                                                         | Foreslått plassering                                                               |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `E1.jpg`                                 | **Velkomstskjerm (elev)** — fullskjerm blå bakgrunn med navngitt velkomst og oppfordring om å starte dagen. Første skjerm eleven møter ved daglig innlogging.                                         | K4 4.5 (sonden som daglig inngangspunkt) eller K5 Prinsipp 3 (motivasjon/velkomst) |
| `e2.jpg`                                 | **Elevlandingsside — dagens timeplan** — tre timer for dagen (Norsk, Matematikk ×2) med klokkeslett, XP-bar Level 7 nederst. Viser kjerneflaten eleven jobber fra.                                  | K5 Prinsipp 5 (autonomistøtte/oversikt) eller K4 som illustrasjon av prototypen    |
| `e3.jpg`                                 | **Skrytevegg** — sidepanel som skyver inn fra høyre med lærertilbakemeldinger, emoji-reaksjoner (👍❤️) og én skriftlig kommentar fra læreren ("Du husket mye!") knyttet til ulike fag.              | K5 Prinsipp 3 (motivasjon/lærerros)                                                |
| `e4.jpg`                                 | **Oppgavevisning i én time** (Matematikk 3. time) — én oppgave "Mattemaraton" med 50 poeng, stor FULLFØR-knapp, fremdriftsbar 5/6. Viser enkel, selvinstruerende oppgavepresentasjon.               | K5 Prinsipp 2 (tidsbesparelse) eller Prinsipp 5 (autonomistøtte)                   |
| `e5.jpg`                                 | **Modal: Fullførte oppdrag** — liste over 5 fullførte oppgaver med poeng og "Angre"-knapper. Viser "ferdigstilte gjøremål-bunke" (6 stemmer WS2).                                                   | K5 Prinsipp 3 (gamification) eller som del av kollasj                              |
| `e6.jpg`                                 | **Innleveringsmodal** — "Er du sikker på at du er ferdig?" med valgene Ta opp lyd / Kamera / Bilde og stor grønn FULLFØR-knapp. Viser medieinnlevering og alternativ uttrykksform.                  | K5 Prinsipp 5 (medieinnlevering/autonomistøtte)                                    |
| `E timeplan.jpg`                         | **Ukeoversikt (elev)** — alle 5 dager side om side, dagens dag (Torsdag) uthevet med "I DAG"-badge, alle timer avhakt. XP-bar Level 7.                                                              | K5 Prinsipp 2 (oversikt) eller K4 som del av prototypoversikt                      |
| `E hamburgermeny.jpg`                    | **Navigasjonsmeny** — sidepanel med Dagen i dag / Fag & Oppgaver / Timeplan / Belønninger / Logg ut. Nivå 7-avatar.                                                                                 | Egner seg best i kollasj, viser navigasjonsstruktur                                |
| `E fag og oppgaver-visning.jpg`          | **Fagoversikt** — fire fagkort (Engelsk, Naturfag, Samfunnsfag, Kroppsøving) med fremdriftstekst og rød varselbadge.                                                                                | K5 Prinsipp 2 (oversikt/organisering)                                              |
| `E oppgaver og quizer.jpg`               | **Oppgaveliste i Samfunnsfag** — fire oppgavekort (to vanlige + to quiz), hjelpekø-knapp "Nr 3" nede til høyre. Viser hjelpekøen i elevkontekst.                                                    | K5 Prinsipp 5 (hjelpekø)                                                           |
| `E aktivert hjelpekø.jpg`                | **Hjelpekø aktivert (elev)** — landingsside med oransje "Nr 3"-badge på hjelpekø-knappen nede til høyre. Eleven ser sin plass i køen.                                                               | K5 Prinsipp 5 (hjelpekø, anti-stigma)                                              |
| `E quiz.jpg`                             | **Quiz i gang** (Geografi, spørsmål 1/3) — flervalgsspørsmål, svar valgt, "Svar med lyd"-knapp. Lilla/rosa gradient.                                                                                | K5 Prinsipp 3 (quiz/gamification) eller K5 Prinsipp 5 (lyd)                        |
| `E quiz med innspilt lyd.jpg`            | **Quiz siste spørsmål** (3/3, tekst + lyd) — tekstfelt med elevens svar og grønt "Lydopptak klart"-felt. Kombinert skriftlig og muntlig svar.                                                       | K5 Prinsipp 5 (medieinnlevering/alternativ uttrykksform)                           |
| `E avatarvelger.jpg`                     | **Avatar-velger** — emoji-rutenett med kategorier, løve valgt. Enkel personalisering uten eksponert informasjon.                                                                                    | K5 Prinsipp 1 (universell/anti-stigma, anonym avatar) eller Prinsipp 3             |
| `E belønninger visning.jpg`              | **Belønninger-siden** — kortene "Min Blomsterhage" og "Mine Kuponger".                                                                                                                              | K5 Prinsipp 3 (belønningssystem) — egner seg i kollasj                             |
| `E blomsterhage.jpg`                     | **Blomsterhagen** — fullskjermillustrasjon med én blomst i tidlig stadium. Visualiserer kronblad-belønningssystemet.                                                                                | K5 Prinsipp 3 (blomsterhage/gamification)                                          |
| `E halvveis til målet modal`             | **"Halvveis!"-modal** — XP-bar 63% mot Nivå 8, liste over belønninger på neste nivå fra læreren, forslag til "raskeste vei" i Samfunnsfag. Informasjonstett — vurderes forenklet i neste iterasjon. | K6 som eksempel på fremtidig forbedringspunkt (for mye info)                       |
| `Knappen som forårsaket angst i ws3.jpg` | **Arkivknapp med rød badge** — mørk rund knapp med boks-ikon og "3"-badge. Deltakerne i WS3 misforsto ikonet som en sletteknapp.                                                                    | K4 4.6 (WS3 pain point, ikon-forvirring) eller K6 forbedringspunkter               |

---

## Læregrensesnitt (L)

| Filnavn                                                                                                                   | Beskrivelse                                                                                                                                                                          | Foreslått plassering                                                       |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `L Landingsside med oversikt og hurtighandlinger - statistikk er en plassholder.jpg`                                      | **Læreroversikt** — tre informasjonskort: Elever (nylig besøkt), Hjelpekø (3 aktive), Hurtighandlinger. Aktivitetsfeed.                                                              | K4 4.5 (lærergrensesnitt-intro) eller K5 Prinsipp 2                        |
| `L Mine elever 1.jpg`                                                                                                     | **Klasseoversikt** — Klasser-fanen, 7A utvidet med hjelpekø-toggle grønn/på, elever listet med avatar og modus.                                                                      | K5 Prinsipp 1 (hele klassen) eller K5 Prinsipp 2                           |
| `L Mine elever 2 - oppretting av egen gruppe.jpg`                                                                         | **Modal: Opprett ny gruppe** — gruppenavn "Tirsdag - Lesegruppe", 6 elever på tvers av klasser (7A og 7C).                                                                           | K5 Prinsipp 2 (tidsbesparelse, grupper på tvers)                           |
| `L Mine elever 2 - oppretting av egen gruppe 2.jpg`                                                                       | **Grupper-fanen** — "Tirsdag - Lesegruppe" med 6 elever, hjelpekø-toggle og rediger/slett-knapper.                                                                                   | Egner seg i kollasj med forrige bilde                                      |
| `L Mine elever 3.jpg`                                                                                                     | **Elev-tabell** — 121 elever med Klasse, Nivå og Modus-kolonne (badge per elev: "Hage" eller "Kun Poeng"). Viser individuell opt-in.                                                 | K5 Prinsipp 3 (opt-in spillelementer per elev)                             |
| `L hjelpekøliste.png`                                                                                                     | **Hjelpekø (lærer)** — tre elever i kø med ventetid, "Ferdig"-knapper. Samme kø som eleven ser som "Nr 3".                                                                           | K5 Prinsipp 5 (hjelpekø sett fra lærersiden)                               |
| `L flytter elev opp på hjelpekølista uten at elevene trenger å vite det jf WS3 - Dette var en bug som ble en feature.jpg` | **Hjelpekø — omrokert rekkefølge** — en elev løftes fra tredje til første prioritet via dra-og-slipp, usynlig for elevene. Bug som ble feature (WS3).                                  | K4 4.7 (Transformasjoner, bug→feature) eller K6 6.1 (autonomi/anti-stigma) |
| `L individuell timeplan for enkeltelev der avvik fra klassens timeplan er merket med ordet Personlig.jpg`                 | **Personlig timeplan (enkeltelev)** — eksempelklasse med "Personlig"-badge på en lesegruppe og "Endret"-badge på en matematikktime.                                                | K5 Prinsipp 2 (individualisering)                                          |
| `L Timeplaner.jpg`                                                                                                        | **Timeplan for 7A, uke 20** — 5-dagers grid, fargekodede fag, klokkeslett, "Endret"-badge, opplastingsknapp. Viser det samlende timeplanverktøyet.                                   | K5 Prinsipp 2 (samlende verktøy/tidsbesparelse)                            |
| `L Timeplaner redigering av enkelttime i en elevs timeplan.jpg`                                                           | **Modal: Rediger time** — "Hele klassen" vs "Kun denne eleven", fag, dager, tider, type, toggle "Lagre som fast timeplan".                                                           | K5 Prinsipp 2 (individuell tilpasning) — egner seg i kollasj               |
| `L ai parser under Planer.jpg`                                                                                            | **Planer — opplastingsskjerm** — dra-og-slipp for .docx, "Slik fungerer AI-planleggeren"-ekspander. Før parsing.                                                                     | K4 4.5 (AI-parsing intro)                                                  |
| `Parset ukebrev øverste del.jpg`                                                                                          | **AI-parset ukebrev, øvre del** — Uke 5, "Beskjeder og informasjon" (5 avsnitt fra ukebrevet), start av "Læringsmål". Viser at ukebrev tolkes til strukturert innhold.               | K5 Prinsipp 2 (Smart Import/tidsbesparelse)                                |
| `Parset ukebrev nederste del - Alle felter kan trykkes på og redigeres før man publiserer.jpg`                            | **AI-parset ukebrev, nedre del** — timeplaner for 7B og 7C som klikkbare rutenett, "Lagre og Publiser"-knapp. Alle felt redigerbare.                                                 | K5 Prinsipp 2 — kollasj med forrige bilde                                  |
| `L fag og oppgaver.jpg`                                                                                                   | **Oppgavebibliotek** — rutenett med fagfilter, søkefelt og "+ Ny Oppgave". Gjenbrukbare oppgaver.                                                                                    | K5 Prinsipp 2 (bibliotek/gjenbruk)                                         |
| `L oppgaveoppretting 1.jpg`                                                                                               | **Oppgaveoppretting steg 1** — tittel, beskrivelse, fag, typevalg (Vanlig / Quiz).                                                                                                   | K5 Prinsipp 2 — kollasj med neste bilde                                    |
| `L oppgaveoppretting 2 - oppgaven knyttes til en time og til en elev.jpg`                                                 | **Oppgaveoppretting steg 2** — tildeling til klasser/elever, knytting til konkret time (Torsdag 10:10 Matematikk, blå), gjentakelse ukentlig.                                        | K5 Prinsipp 2 (tidsstyring/tidsbesparelse)                                 |
| `L oppgaveoppretting quiz.jpg`                                                                                            | **Quiz-byggeren** — spørsmålseditor med svartype-valg og "Legg til spørsmål".                                                                                                        | K5 Prinsipp 3 (quiz) — egner seg i kollasj                                 |
| `L Belønninger.jpg`                                                                                                       | **Belønningsbibliotek** — fire belønningskort med scope og ENGANGS-badge. Viser at læreren oppretter reelle belønninger.                                                             | K5 Prinsipp 3 (belønningssystem)                                           |
| `L oppretting av belønning.jpg`                                                                                           | **Modal: Ny Belønning** — tittel, beskrivelse, emoji-ikon, valuta (Nivå), kostnad, antall ganger.                                                                                    | K5 Prinsipp 3 — kollasj med forrige bilde                                  |
| `L velkomstmelding til elever.jpg`                                                                                        | **Meldinger-siden** — datovelger, historikk, og skjema for ny melding til navngitte elever med fritekst. Personlig velkomstmelding (foreslått WS1).                                  | K5 Prinsipp 3 (personlig velkomst fra WS1) eller Prinsipp 2                |
| `L visning av quizsvar med mulighet til å spille av elevens innspilte lyd, og mulighet for reaksjon og kommentar.png`     | **Quizsvar-panel (lærer)** — en elevs flervalg, tekstsvar og avspillbare lydinnlevering. Emoji-hurtigreaksjon, kommentarfelt og "Send i retur".                                    | K5 Prinsipp 5 (medieinnlevering, lærer-elev-dialog)                        |

---

## Plasseringsplan per kapittel

### Kapittel 4 — Designprosess og data

Anbefalt å illustrere **prototypen som helhet** (4.5 Mellomperiode 2) med en kollasj:

> **Kollasj A — Elevgrensesnitt (anbefalt 4 skjermer):**
> `E1.jpg` + `e2.jpg` + `E oppgaver og quizer.jpg` + `E aktivert hjelpekø.jpg`
> _Viser: velkomst → timeplan → oppgaveliste med hjelpekø → hjelpekø aktivert_

> **Kollasj B — Læregrensesnitt (anbefalt 4 skjermer):**
> `L Landingsside.jpg` + `Parset ukebrev øverste del.jpg` + `L hjelpekøliste.png` + `L Mine elever 1.jpg`
> _Viser: oversikt → AI-parsing → hjelpekø → klasseoversikt_

**Enkeltbilde i 4.6 (WS3, pain point):**

- `Knappen som forårsaket angst i ws3.jpg` — illustrerer arkivknapp-misforståelsen

**Enkeltbilde i 4.7 (Transformasjoner/beslutninger):**

- `L flytter elev opp på hjelpekølista.jpg` — bug som ble feature

---

### Kapittel 5 — Analyse og evaluering

Én eller to illustrasjoner per prinsipp, helst i kollasj for å spare plass:

| Prinsipp                          | Foreslåtte bilder                                                                      |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| **P1 Universell tilgjengelighet** | `L Mine elever 3.jpg` (opt-in modus per elev)                                          |
| **P2 Tidsbesparelse**             | Kollasj: `Parset ukebrev øverste del.jpg` + `Parset ukebrev nederste del.jpg`          |
| **P3 Motivasjon/gamification**    | Kollasj: `E blomsterhage.jpg` + `e3.jpg` (skrytevegg) + `L Belønninger.jpg`            |
| **P4 Plattformuavhengighet**      | Ingen eget bilde nødvendig (prinsippet er teknisk og vises ikke visuelt)               |
| **P5 Autonomistøtte**             | Kollasj: `E aktivert hjelpekø.jpg` + `L hjelpekøliste.png` + `e6.jpg` (lydinnlevering) |

Etter Tabell 1 (samsvarstabell): ingen ekstra bilde nødvendig.

---

### Kapittel 6 — Diskusjon og konklusjon

- `E halvveis til målet modal.jpg` — illustrerer forbedringspunkt (for mye informasjon i modalen) i 6.3
- `L visning av quizsvar.png` — kan brukes i 6.1 (autonomistøtte, lærers tilbakemelding)

---

## Bilder som egner seg best i kollasjer (ikke enkeltvis)

Disse bildene er mest nyttige som del av en kollasj og bør ikke stå alene:

- `E hamburgermeny.jpg`
- `E belønninger visning.jpg`
- `E5.jpg` (fullførte oppdrag)
- `L Mine elever 2 - oppretting av egen gruppe 2.jpg`
- `L Timeplaner redigering av enkelttime.jpg`
- `L oppgaveoppretting 1.jpg`
- `L oppgaveoppretting quiz.jpg`
- `L oppretting av belønning.jpg`

---

## Bilder som trolig ikke tas med i oppgaven

Disse er nyttige som dokumentasjon, men gir trolig lite merverdi i selve teksten:

- `E timeplan.jpg` — overlapper med `e2.jpg`
- `E fag og oppgaver-visning.jpg` — overlapper med `E oppgaver og quizer.jpg`
- `L ai parser under Planer.jpg` — før-tilstanden dekkes bedre av de to "Parset"-bildene
