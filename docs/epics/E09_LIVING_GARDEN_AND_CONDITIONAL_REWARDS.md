# E09 – Levende blomsterhage og betingede belønninger

**Status:** Planlagt – produktretningen er avklart; motor og kunstretning skal
bevises i en spike før produksjonsimplementasjon

**Sist avklart:** 18. juli 2026

**Kontrakt:** [§ 7.5 Førstegangs nivåoppgang](../product/DOMAIN_CONTRACT.md#75-førstegangs-nivåoppgang)
og [§ 10 Motivasjonsstøtte, belønninger og levende hage](../product/DOMAIN_CONTRACT.md#10-motivasjonsstøtte-belønninger-og-levende-hage)

**Avhenger av:** E02, E05, E06 og E07. R6a avhenger i tillegg av E10
DCK1–DCK3. R6b avhenger av E08 Q4, E09 R1–R5 og E10 DCK1–DCK3.

## Resultat

Klar får et frivillig, personlig og teknisk ambisiøst kreativt minispill.
Eleven kan bruke én unik nivåbelønning til å male et kronblad med egne strøk og
flere farger. Fem kronblad fullfører en blomst som kan plantes i en levende
hage med rolig vind og sommerfugler. Dersom læreren har opprettet relevante
belønninger, kan eleven i stedet velge en kupong.

Opplevelsen skal være taktil og imponerende for barn, men den robuste 3.0-
motoren for XP, entitlement, autorisasjon og anti-farming forblir fasit.
Grafikkmotoren får aldri skrive XP eller forretningsstatus direkte.

## Ikke-forhandlingsbare produktregler

- Hagen og kuponger er helt fraværende når de ikke er tilgjengelige.
- En milepæl gir høyst ett valg: kronblad eller én kupong.
- Level-up tilbyr «Velg nå» og «Senere» og avbryter ikke pågående arbeid.
- Første serverbekreftede, gyldige penselstrøk reserverer kronbladvalget; et tomt besøk gjør det
  ikke.
- XP-retur, refresh, ny enhet eller skjuling sletter aldri kreativt arbeid,
  blomster eller utstedte kuponger.
- Femte kronblad gir nøyaktig én blomstring og én ferdig blomst.
- Strøk, dekning, tidsbruk, besøk, planting, sommerfugler og oppussing gir aldri
  XP eller nye claims.
- Ingen blomst visner, og hagen krever aldri vanning, mating, streak eller
  vedlikehold.
- Frihåndsmaling og drag kan være hovedopplevelsen, men er aldri eneste
  betjeningsform.

## Betinget belønningsvalg

I tabellen betyr «Hage på» effektiv tilgjengelighet: ansattens ramme tillater
hagen **og** eleven har ikke valgt å skjule den.

| Hage | Aktuell lærerbelønning | Elevens valg |
| --- | --- | --- |
| På | Ingen | Kronblad eller «Senere» |
| Av | Én eller flere | Én kupong eller «Senere» |
| På | Én eller flere | Kronblad eller én kupong eller «Senere» |
| Av | Ingen | Rolig nivåmarkering uten tom belønningsflate |

«Senere» oppretter ikke claim og har ingen utløpsfrist. Flere ventende
entitlements behandles i nivårekkefølge, én om gangen. Når eleven gjenvinner et
tidligere nivå, gjenbrukes samme entitlement uten ny belønning eller feiring.

### Skjuling og deaktivering

Ansattens hageramme er et tak; elevens preferanse kan bare skjule innenfor den.
Når læreren deaktiverer hagen, skal bekreftelsen opplyse hvor mange reserverte
utkast og ferdige blomster som blir midlertidig skjult. Nye strøk og
sluttføring stoppes, mens utkast, claims og plasseringer settes i en trygg,
gjenopptakbar tilstand. Reaktivering viser identisk arbeid. Elevens egen
skjuling har samme ikke-destruktive resultat og kan reverseres uten voksenhjelp.

Arkivering eller stans av nye lærerbelønninger skjuler aldri en kupong eleven
allerede eier. Den skal fortsatt kunne forespørres brukt og innløses innenfor
gyldig ansattomfang. Senere aktivering gir som standard bare nye milepæler
tilgang; retroaktiv åpning krever en eksplisitt, forhåndsvist ansatthandling.

## Kuponger

### Lærer

En autorisert ansatt kan opprette en belønningsdefinisjon med kort tittel,
symbol, alderspasset beskrivelse, ansvarlig omfang og eventuelle enkle vilkår.
Definisjonen kan avgrenses til elev, gruppe eller klasse og arkiveres for nye
valg. Opprettelse og arkivering skal vise hvilke elever/utstedte kuponger som
berøres, uten å tilbakekalle noe som allerede er valgt.

### Elev og innløsning

Claim oppretter en varig kupong med snapshot av definisjonen. Eleven kan velge
«Bruk kupong», som lager en forespørsel. En autorisert ansatt bekrefter faktisk
innløsning. Samtidige bekreftelser kan ikke bruke kupongen to ganger.

Tilstander:

```text
issued -> redemption_requested -> redeemed
   ^              |                  |
   |              +-> issued        +-> corrected -> issued
   +-----------------------------------------------+
```

Avbrutt forespørsel går tilbake til `issued`. Feilinnløsning rettes med en
kompenserende hendelse og ny brukbar tilstand; historikk slettes ikke. Elevens
flate bruker positive, konkrete ord og unngår «ugyldig» eller straffespråk.

## Blomst- og kronbladsmodell

Eksisterende `flower_petal_v1` migreres deterministisk som uforanderlige
legacy-artefakter i claimrekkefølge. Grupper på fem blir ferdige,
uplantede blomster uten retroaktiv feiring; siste delgruppe blir elevens ene
`growing`-blomst og kan få resterende plasser som v2-kronblad. Migrasjonen
oppretter ingen nye claims eller XP og skal kunne rulles tilbake uten å endre
v1-kilden.

### Foreslåtte ressurser

- `student_flowers`: stabil blomstersekvens og status `growing`,
  `complete_unplaced` eller `planted`; høyst én aktiv uferdig blomst per elev.
- `flower_petal_projects`: entitlement, blomst, kronbladplass, status,
  renderer-/skjemaversjon og autosaverevisjon.
- `flower_petal_draft_snapshots`: kompakt, validert, motoruavhengig
  render-command-struktur som kan uttrykke både normaliserte frihåndsstrøk og
  semantiske farge-/mønsterfelt, med beregnet dekning.
- `flower_petal_artifacts`: uforanderlig sluttstruktur, kanonisk
  forhåndsvisning/hash, coverage-versjon og renderer-/verktøyversjon.
- `reward_claims`: additiv type `flower_petal_v2`, fortsatt unik per
  entitlement.
- `flower_completion_events`: nøyaktig én hendelse per ferdig blomst, med
  avbruddsikker feiringsstatus.
- `garden_placements`: hagescene/bed, normalisert x/y og revisjon; plassering
  kan endres uten å endre claim.

Sammensatte nøkler binder organisasjon, elev, entitlement, blomst og plass.
Browseren får ingen direkte skrivetilgang.

### Autoritative kommandoer

- `save_flower_petal_draft` med CAS og request-ID; første gyldige save
  reserverer entitlement og lagrer strøket i samme transaksjon;
- `finalize_flower_petal` med dekning, artefakt og claim;
- `acknowledge_flower_completion` uten nytt claim;
- `place_or_move_flower` med validert jordmaske;
- `claim_coupon`, `request_coupon_redemption`, `redeem_coupon` og
  `correct_coupon_redemption`.

`finalize_flower_petal` skal atomisk låse entitlement, prosjekt og blomst,
validere feature-ramme, elev, organisasjon, payload, dekning og ledig plass,
opprette artefakt og claim, fullføre blomsten bare ved fem unike kronblad,
opprette én completion-event og returnere samme resultat ved retry.

Kanonisk servervalidering skal bruke samme versjonerte kommandoformat,
coverage-regel og hashgrunnlag som Canvas-, Pixi- og DOM-komponisten. Klientens
preview er aldri autoritativ. R0/R2 låser grenser for strøk, punkter, bytes og
serverarbeid og en transparent bake-/forenklingsregel før grensen nås.

Første draft-save og samtidig XP-reversering/feature-deaktivering følger én
dokumentert låserekkefølge. Save som vinner først bevarer reservert arbeid;
reversering eller deaktivering som vinner først avviser serversave uten claim,
beholder den lokale endringen trygt og forklarer hva eleven kan gjøre videre.

## Malerverksted

1. Eleven åpner en ventende belønning og velger kronblad.
2. Den ene pågående blomsten står i et eget fullskjerms verksted.
3. Eleven velger et ledig kronblad og en navngitt fargebrønn.
4. Penselen maler flere, overlappende strøk innenfor kronbladmasken.
5. Første strøk reserveres og lagres på server i samme operasjon. Senere strøk
   lagres lokalt ved avslutning og synkroniseres kort etterpå.
6. Angre, gjør om, tøm og «Fortsett senere» bevarer en forståelig tilstand.
7. Når en tilgivende dekningsregel er nådd, ser kronbladet helt malt ut.
8. «Behold kronbladet» sluttfører på serveren; klienten kan aldri erklære
   claim alene.

Ingen prosentmåler vises. Barnet skal ikke treffe kantpiksler. Strøk kan
forenkles og resamples, men rå pointer events skal ikke lagres. Utkast lagres i
en organisasjon-/elev-/prosjektbundet IndexedDB-cache og på server; ingen
hemmeligheter eller svarmedia legges i cachen.

Den lokale cachen skal ha schema-versjon, kvote, utløp og streng namespace.
Appen skal aldri laste et annet caller-scope, og synkroniserte data slettes
lokalt etter policy. Ved logout, brukerbytte eller utløpt sesjon skal neste
bruker ikke kunne lese forrige elevs data. Usynkronisert arbeid skal kreve
reconnect eller et eksplisitt, forklart forkast før logout; R2 skal trusselteste
denne balansen på delt skoleutstyr.

Før reservasjonen krever verkstedet nettforbindelse og kan ikke love at et
optimistisk penselmerke er bevart. Etter serverbekreftet reservasjon kan eleven
fortsette gjennom et kort nettbrudd. To enheter blindfletter aldri samme utkast. En eksplisitt «Kronbladet er åpent
et annet sted – fortsett her?» overtar den autoritative revisjonen. Offline kan
eleven male videre lokalt, men sluttføring og claim krever serverbekreftelse.
Hvis en annen enhet allerede har overtatt eller sluttført, beholdes den lokale
kopien isolert til eleven velger autoritativ versjon; den flettes eller slettes
aldri lydløst.

## Blomstring og planting

Kronblad 1–4 gir en kort, varm respons og lar eleven vende tilbake til dagen.
Det femte kronbladet:

1. fullfører blomsten atomisk;
2. oppretter én gjenopptakbar completion-event;
3. viser en sjelden blomstring med lys, lag, kronblad og valgfri lyd;
4. viser et komplett statisk sceneskifte ved reduced motion;
5. legger blomsten i en plantekasse dersom flyten avbrytes; og
6. lar eleven plante med fri berøring/drag eller alternativ kontroll.

Plassering bruker normaliserte koordinater og validert jordmaske. Et usynlig
snap-grid, y-basert dybde og myk kollisjonsunngåelse gir stabilt resultat på
ulike skjermer. Flytting senere endrer bare plassering.

## Kunstretning

Uttrykket skal være personlig og aldersåpent:

- håndmalt gouache-/akvarell- eller papirtekstur;
- klare silhuetter, varm materialitet og god kontrast;
- rolig naturpalett med sterkere lys/metning bare ved sjeldne milepæler;
- synlig penseltekstur og kontrollert fargeblanding;
- lagdeling, lys og dybde fremfor kontinuerlig konfetti;
- kort synlig språk og rikere, presise skjermleserbeskrivelser;
- navngitte farger, mønstre og teksturer uten avhengighet av farge alene; og
- ingen babyfont, pliktmaskot eller kopierte stock-game-assets.

Før produksjon skal det finnes en liten stilbibel, storyboard for level-up,
maling, blomstring og planting, representative final-quality assets og
dokumentert lisens/proveniens. Kunstpakken trenger blomsterdeler med masker og
pivoter, minst én hagescene, teksturatlas i flere kvaliteter, penseltekstur,
sommerfugler og statiske reduced-motion-varianter.

Stilbibelen låses først etter en dokumentert art-review mot prototypehierarkiet
og korte observasjoner med produkteier samt minst én relevant lærer-/
brukerrepresentant. Rubrikken vurderer aldersspenn, taktilitet, personlig
uttrykk, ro, lesbarhet, reduced motion og om resultatet faktisk oppleves
magisk – ikke bare teknisk korrekt.

## Rolig fysikk og liv

### Vind

En lavfrekvent, seedet vindvektor driver små fjærbevegelser i stilk og blader.
Fase varierer per blomst slik at hagen ikke beveger seg mekanisk i takt.
Amplitude og hastighet begrenses, og ticker stopper når dokumentet skjules.

### Sommerfugler

Et lite antall sommerfugler følger seedede, myke steering-baner og kan utforske,
lande på en blomst, hvile, «drikke» og lette igjen. Berøring kan få en
sommerfugl til å fly videre, men gir ingen belønning. De skjuler aldri kontroller
eller krever handling.

### Hage

Synlige objekter culles og kvalitetsprofilen begrenser partikler og dyr.
Plantekollisjon skal hindre at en blomst blir helt borte bak en annen, uten å
gjøre planting til en presis pusleoppgave. Nye bed kan senere utvide hagen uten
at gamle blomster arkiveres som tap.

En generell fysikkmotor innføres ikke bare for disse effektene. Små,
deterministiske spring-, steering- og kollisjonssystemer er første kandidat.

## Likeverdige betjeningsformer

Canvas/WebGL er presentasjon, ikke kontrollmodell. React/DOM eier knapper,
dialoger, status og alternativer.

- **Direkte:** én peker, store fargebrønner og kronbladmål; ingen pressure,
  tilt, multitouch, hover eller rask gest kreves.
- **Tastatur:** velg farge/kronblad som knapper, flytt penselen med piler og mal
  med Mellomrom/Enter; undo, redo og lagre har egne kontroller.
- **Switch:** kort skannerekkefølge, D-pad, ingen tidsgrenser og valgfri «Lag et
  forslag»/«Finn en fin plass».
- **Skjermleser:** semantisk komponist for grunnfarge, aksentfarger og uttrykk
  som bølger, striper, prikker eller myke felt, med opplest forhåndsvisning.
- **Planting:** navngitte soner som «foran til venstre», «midt i hagen» og
  «bak til høyre», med valgfri finjustering.

Alle veier lager samme `flower_petal_v2`-artefakt og samme hageplassering.
«Ro i hagen» stopper ambient bevegelse. Reduced motion er fullstendig og
funksjonelt, ikke et tomt canvas. Lyd, ambient bevegelse og
feiringsintensitet har uavhengige preferanser.

## Motor- og kunstspike

### Kandidater

**Native Canvas 2D** har minst bundle og god kontroll over maling/fallback, men
krever mer egen kode for scenegraph, batching og atlas.

**PixiJS 8 med WebGL** er en sterk kandidat for masker, dynamiske teksturer,
atlas og hagescene. WebGPU skal ikke være produksjonskrav. Klars eget
DOM-kontrollag beholdes uansett motor.

**Phaser/full spillmotor** går bare videre dersom spike viser en målbar fordel
for scene-, input-, lyd- eller fysikklivssyklus. Ellers er den for stor og
overlapper med Next/React-skallet.

### Obligatorisk spike-scenario

Begge reelle kandidater skal demonstrere:

- flerfarget maling med maske, undo og dekningsberegning;
- 200 ferdige blomster, rolig vind og inntil seks sommerfugler;
- planting, flytting, orientation og background/resume;
- reduced motion og DOM-basert alternativ kontroll;
- tvungen renderer-init/runtime-feil for begge kandidater, samt WebGL
  context-loss/recovery for Pixi-kandidaten; og
- dynamisk import uten SSR- eller hydration-avvik.

R0 har først pass/fail på alle arkitekturdrivende harde krav: paint latency,
200-scene, decoded teksturminne, bundle, orientering/background, operativ
fallback og relevant context-loss. Hver kandidat må bruke representative,
personaliserte blomster og bestå minst ti minutters fysisk soak. Kandidater som
feiler forkastes før vekting. Mellom beståtte kandidater vektes fysisk
iPad-stabilitet og paint latency høyest, deretter scene-FPS/minne,
Next-integrasjon, semantisk DOM, kunstpipeline, deterministisk QA og
utviklerergonomi. Ingen motor velges på desktop-FPS alene. Valget og forkastede
alternativer dokumenteres i en ADR.

## Ytelsesbudsjett og fysisk port

Målenheten er minst tilgjengelig iPad 9. generasjon med faktisk Safari/iPadOS.

- paint input-to-render p95: høyst 50 ms;
- scene frame time p95 i normalprofil: høyst 20 ms;
- ingen blokkert elevinput over 100 ms under maling;
- ingen tapt penselsti ved rask fingerbevegelse;
- rutespesifikk initial JavaScript: høyst 250 KiB gzip;
- første kunstpakke: høyst 1,5 MiB; samlet lazy-loadet hagepakke: høyst 5 MiB;
- device-pixel-ratio begrenses til 2; aktiv decoded GPU-teksturbruk har hardt
  tak på 64 MiB;
- varm navigasjon interaktiv innen 2,5 sekunder og definert kald/throttled
  navigasjon innen 4 sekunder;
- orienteringsbytte stabilt innen 500 ms uten tap av utkast/plassering;
- ticker stopper i bakgrunnen og i statisk reduced-motion-scene;
- 30 minutters fysisk soak med maling, 20 orienteringsbytter og ti
  background/resume-sykluser uten reload eller voksende feil; og
- ti åpne/lukke-sykluser uten voksende antall canvas, tickers, listeners eller
  teksturer.

Lav kvalitetsprofil skal bevare alle handlinger og kan bare redusere visuelle
effekter. Etter tre mislykkede reparasjonsrunder skal motor eller grafisk omfang
replannes, ikke presses gjennom porten.

Måleprotokollen i R0 skal angi produksjonsbuild, sampleantall, p95-metode,
kald/throttled nettprofil, visualViewport-stabilitet og decoded GPU-estimat.
Personaliserte kronblad bakes til kanoniske 128/256-varianter; LOD, culling,
synlighetsstyrt upload og eviction skal bevise 200-blomst-scenen innenfor
teksturtaket.

## Kontrollpunkter

### R0 – Produkt-, kunst- og motorspike

- kontrakt, storyboard, stilbibel og representative final-quality assets;
- motoruavhengig render-command-format, kanonisk coverage/hash og
  payloadgrenser;
- Canvas 2D mot PixiJS-spike og ADR;
- harde pass/fail-gates, ti minutters fysisk iPad-soak og fullt operativ
  DOM-basert fallback;
- dokumentert art-review med produkteier og relevant brukerrepresentasjon.

**Utgang:** motor og art direction valgt med fysisk bevis.

### R1 – Kupongdefinisjon og innløsning

- additive migrasjoner, RLS/grants og autoriserte kommandoer;
- betinget synlighet, snapshot, request/redeem/correct;
- retry, samtidighet, arkivering og negativt AAL2-/organisasjons-/elevomfang;
- «fra nå av» som standard og eksplisitt forhåndsvisning ved retroaktiv åpning.

**Utgang:** kupongen kan ikke forsvinne eller brukes dobbelt.

### R2 – Kronbladdomene, reservasjon og autosave

- v2-migrasjoner, entitlement, blomst, prosjekt, artefakt og plassering;
- deterministisk v1→v2-migrasjon uten nye claims eller feiring;
- atomisk reservasjon + første strøk, CAS, enhetsovertakelse og isolert lokal
  cache;
- race mot XP-retur/deaktivering, finalize/claim, audit, anti-farming og
  dataminimering.

**Utgang:** livsløpet er bevist uten grafisk klient.

### R3 – Malerverksted

- taktil flerfarget pensel, tilgivende dekning og undo/redo;
- fortsett senere og motorfallback;
- fullt operativ fallback som kan male/komponere og sluttføre;
- tastatur-, switch- og skjermleserkomponist;
- fysisk touch-, VoiceOver- og NVDA-port.

**Utgang:** samme personlige kronblad kan skapes med alle betjeningsformer.

### R4 – Blomstring og planting

- femte kronblad fullfører én gang;
- avbruddsikker completion-event;
- normal/reduced-motion-feiring;
- fri planting, D-pad, navngitte soner og pending placement.
- append-only audit for sluttføring, én-gangs blomstring og plassering/flytting.

**Utgang:** avbrudd og retry kan ikke miste eller duplisere blomsten.

### R5 – Levende hage

- produksjonskunst, teksturatlas og responsive scener;
- seedet vind, sommerfugler, dybde, kollisjon, culling og kvalitetsprofiler;
- 200-blomst-scene, context-loss og full fysisk ytelsesport.

**Utgang:** hagen består art-review-rubrikken og samtlige målbare hard gates.

### R6a – Samlet kupongflyt

- «Velg nå/Senere» og progresjonsdock i kupong-only og ingen-belønning-flyt;
- kupongfeature uten tomme spor;
- XP-retur, lærerretur, refresh, flere faner og ansattinnløsning;
- alle viewports, AAL2, Switch Control, VoiceOver, NVDA og reduced motion.

**Utgang:** full nivå→kupongvalg→forespørsel→innløsning/retur-til-arbeid-flyt
er bevist.

### R6b – Samlet hage- og returflyt

- «Velg nå/Senere», deretter «Mal kronblad», progresjonsdock og eksklusivt
  blandet kupong-/kronbladvalg;
- feature toggles uten tomme spor;
- XP-retur, lærerretur, refresh, flere faner, enhetsbytte og motorfallback;
- eksakt retur til opprinnelig økt, oppgave og quizspørsmål etter «Senere»,
  ferdig kronblad, avbrutt blomstring og planting;
- alle viewports, 200 prosent, Switch Control, VoiceOver, NVDA og reduced
  motion.

**Utgang:** full nivå→valg→skaping/innløsning→retur-til-arbeid-flyt er bevist.

## Akseptansekriterier

- [ ] «Senere» mister ikke entitlement og avbryter ikke oppgaveflyten.
- [ ] Første serverbekreftede, gyldige strøk reserverer kronbladet; tomt besøk
  eller offline inngang gjør det ikke.
- [ ] Første save reserverer og lagrer atomisk, også i race mot XP-retur eller
  deaktivering, uten taps- eller halvtilstand.
- [ ] Flere farger og strøk består etter refresh, orientering og enhetsbytte.
- [ ] To faner kan ikke finalisere samme entitlement eller kronbladplass.
- [ ] Femte kronblad oppretter én blomst og én completion-event.
- [ ] Avbrutt feiring/planting kan gjenopptas uten nytt claim.
- [ ] Blomsten kan plantes og flyttes med direkte og alternative kontroller.
- [ ] XP-reversering påvirker ikke reservert eller valgt kreativt arbeid.
- [ ] Hagen gir aldri XP og krever aldri vedlikehold.
- [ ] Vind og sommerfugler pauser i bakgrunnen og forsvinner ved reduced motion.
- [ ] Skjult hage etterlater ingen synlig mangel og sletter ingen data.
- [ ] Kuponger vises bare når relevant definisjon eller eid kupong finnes.
- [ ] Samme kupong kan ikke innløses to ganger; retting bevarer historikken.
- [ ] Arkivering stopper nye valg, men eid kupong forblir synlig og innløsbar.
- [ ] Opprettelse/arkivering, innløsning, retting og retroaktiv åpning krever
  AAL2 og eksplisitt virkeområde; AAL1 og annet org-/elevomfang avvises.
- [ ] Senere aktivering gjelder nye milepæler som standard; retroaktiv åpning
  kan ikke skje uten forhåndsvisning og eksplisitt ansatthandling.
- [ ] Motorfeil lar eleven fortsette, sluttføre, plante alternativt og returnere
  til arbeid gjennom DOM-fallbacken.
- [ ] Lokal cache kan ikke leses av neste elev på delt enhet og mister ikke
  usynkronisert arbeid uten eksplisitt valg.
- [ ] Audit viser reservasjon, sluttføring, blomstring og plassering med
  ID/omfang/versjon/hash, aldri strøk eller dragpunkter.
- [ ] Lyd, ambient bevegelse og feiringsintensitet kan styres uavhengig.
- [ ] Alle «Velg nå/Senere»-, male-, blomstrings-, plante- og fallbackutfall
  returnerer eleven til eksakt økt, oppgave eller quizspørsmål.
- [ ] Fysisk iPad oppfyller samtlige ytelsesbudsjetter.

## Utenfor omfang

- offentlig hage, toppliste, handel eller visning av andre elevers blomster;
- vanning, plantehelse, mating, daglig stell eller kalenderbasert forfall;
- lootbokser, virtuell valuta eller kjøp;
- XP for kreativ aktivitet;
- sanntidsvær eller serverlagring av ambient simulasjon;
- WebGPU-avhengighet i første produksjonsleveranse;
- dekorasjoner, flere hagekapitler og oppussing med ny progresjon før
  kjerneopplevelsen er bevist.

## Ferdigbevis

Epicen er ferdig først når domene, grafikk, fysisk respons og alternative
kontroller består samme samlede flyt. En pen desktop-demo, grønn komponenttest
eller enkel ensfarget blomst er ikke ferdigbevis.
