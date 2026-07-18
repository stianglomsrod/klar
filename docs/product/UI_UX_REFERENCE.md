# Klar 3.0 – UI/UX-referanse

> **Status:** Kuratert designreferanse for målproduktet. Domeneregler og
> produktbeslutninger i [domenekontrakten](./DOMAIN_CONTRACT.md) har forrang.
> Referansen beskriver ønsket retning, ikke ferdig implementasjon.

## Grunnlag

Retningen er samlet etter gjennomgang av masteroppgaven og dens figurer,
prototypebildene og den tidligere Klar-implementasjonen i commit
`8677e0a31c0caaaecdaf08fed82afe498e59cf43` (med `archive/2x-ui` som lokal
kuratering), samt produkteierens tidskodede
[videoomvisning](../../Prototypen/Videoomvisning/README.md). De offentlige
produktbildene finnes i
[Klar-casen](https://stianglomsrod.no/prosjekter/#klar). Fire ekstra reelle
Klar-flater finnes i
[porteføljens legacy-galleri](https://github.com/stianglomsrod/portfolio-site/tree/legacy-nextjs/public/images/cases/klar).

Skjermbildene er bevis på designintensjon og tidligere interaksjon, ikke
pixelspesifikasjoner. Senere produktavklaringer overstyrer detaljer i bildene.
Særlig gjelder dette oppgaveflyten, køstatus og fraværet av en automatisk
etter-skoletid-modus.

Videoens talespor er relevant fordi det forklarer hvorfor en kontroll finnes,
ikke bare hvordan den så ut. Det bekrefter særlig at oppgaver kan knyttes til
økter og iterasjoner, at eleven kan levere i flere modaliteter, at angre
reverserer poeng, og at lærerens interne køprioritering ikke trenger å
eksponeres for eleven. Skjermens synlige kønummer er derfor klassifisert som et
antimønster selv om køflyten ellers er en produktintensjon.

Den tidskodede koblingen mellom det som faktisk blir sagt, gjeldende kontrakt,
åpne valg og implementeringsstatus føres i
[`NARRATED_PROTOTYPE_INTENT.md`](./NARRATED_PROTOTYPE_INTENT.md). Synlige
legacy-detaljer skal ikke få høyere vekt enn produkteierens forklaring av hva
flyten var ment å oppnå.

## Rollebasert visuell modell

### Elevflaten

- Lav informasjonstetthet og én tydelig handling om gangen.
- Lys skifer-/blå bakgrunn, hvite eller svakt transparente flater, tydelig
  dybde og store avrundede hjørner.
- Store berøringsmål og korte norske handlingsord.
- Lekne elementer, illustrasjon og emoji kan brukes for trygghet og mestring,
  men aldri slik at oppgaven eller navigasjonen blir urolig.
- Aktuell undervisningsøkt er stor og tydelig; forrige tones ned og neste er
  mindre. Dette er den tidsstyrte «fisheye»-modellen fra prototypen.
- Footer er den stabile verktøylinjen for progresjon/belønning, timer og den
  kontekstavhengige hånden. Den skal respektere safe-area og ikke dekke innhold.
- Oppgaveinstruksjonen kan ha opplesing og trinnvis støtte. Det finnes ingen
  egen «I gang»-knapp.
- Første «Fullfør» åpner et rolig sjekkpunkt. Kamera, mikrofon, bilde og tekst
  er valgfrie; `✓ Ferdig` bekrefter også uten vedlegg.
- Quiz/test får en tydeligere lilla oppgaveverden, men bruker samme dag,
  progresjon og leveringsregler som andre oppgaver.
- Level-up kan åpne en liten invitasjon til belønning, aldri et tvunget avbrudd.
  Ventende kronblad eller kupong finnes igjen i footeren/docken.

### Ansattflaten

- Høyere informasjonstetthet, hvite kort, tynne skillelinjer og skifer/indigo
  som grunnspråk.
- Desktop bruker fast venstremeny og innholdsområde. Mobil bruker drawer og
  sekvensielle kort/sheets; iPad kan bruke sidepanel eller delt visning.
- Dashboard prioriterer nylig brukte elever, aktiv hjelpekø, hurtighandlinger,
  samlet oppgavestatus og aktivitetsfeed.
- Detaljer og raske handlinger åpnes i sidepanel/sheet slik at læreren beholder
  konteksten.
- Smart Import viser kilde og uke først, deretter grupperte beskjeder, mål,
  økter og oppgaver som kan redigeres før publisering.

## Navigasjon og informasjonshierarki

Anbefalt ansattnavigasjon bygger på de reelle prototypeflatene:

- Oversikt;
- Mine elever/klasser og grupper;
- Fag og oppgaver;
- Timeplaner;
- Belønninger;
- Meldinger bare dersom kontrollpunkt N senere gir funksjonen en godkjent
  kontrakt og egen epic;
- Planer/Smart Import;
- vikar- og tilgangsforvaltning for autoriserte administratorer.

Elevens toppnivå skal være mindre og oppgaveorientert:

- dagen i dag;
- fag og oppgaver;
- timeplan;
- egne belønninger når aktivert.

I gjeldende 3.0-kjerne er «Dagen i dag» og «Fag og oppgaver» implementert.
Timeplan, belønninger og meldinger skal ikke vises som døde navigasjonsmål før
de har en reell, kontraktsfestet flate. Fagoversikten bruker én lenke per fag,
beholder ferdige og gjenåpnede oppgaver i samme sammenheng og respekterer
elevens valg om stille fremdriftsvisning.

Navigasjonen skal aldri konkurrere med aktuell økt. På små skjermer kan
sekundærnavigasjon ligge bak en kjent meny, mens footerhandlingene for den
aktive konteksten forblir lette å nå.

## Visuell intensitet og materialitet

Klar skal være rolig uten å bli klinisk, lekent uten å bli støyende og varmt
uten å bli babyaktig. Uttrykket må tåle aldersspennet fra omtrent fem til
tretten år. Arbeidsflater prioriterer oversikt og forutsigbarhet; magien
samles i sjeldne mestringsøyeblikk og frivillige belønningsrom.

Tre intensitetsnivåer brukes bevisst:

1. **Arbeid:** lyse flater, tydelig typografi, få samtidige valg og nesten
   stillestående bakgrunn.
2. **Mikromagi:** taktil knapprespons, myke lag, forsiktig lys og kort feedback
   ved lagring, hjelp og fullføring.
3. **Belønningsrom:** rikere dybde, papir-/gouache-/akvarelltekstur,
   penselrespons, natur og sjeldne feiringer uten rangering eller mas.

Prototypens gjenkjennelige skifer, blått og indigo beholdes som produktets
arbeidsspråk. Naturpalett, tekstur og lys kan være sterkere i hagen og
malerverkstedet. Unngå babyfont, tilfeldige emoji, generisk konfetti,
overivrig maskot og spillelementer som konkurrerer med skolearbeidet.

## Fag og semantiske farger

Den tidligere prototypens fagpalett kan brukes som gjenkjenningsstøtte:

| Fag | Retning |
| --- | --- |
| Norsk | Rød |
| Matematikk | Blå |
| Engelsk | Oransje |
| Samfunnsfag | Rav/amber |
| Naturfag | Grønn |
| KRLE | Lilla |
| Kunst og håndverk | Fiolett |
| Kroppsøving | Rosa/rose |
| Mat og helse | Smaragd |

Farge er sekundær. Fagnavn, symbol og struktur skal fortsatt identifisere
innholdet for elever som ikke oppfatter fargen.

Talesporet beskriver også egendefinerte fag der lærerens valgte symbol og farge
følger inn i elevflaten. Dette er en utsatt intensjon, ikke implementert
pilotatferd. En senere løsning må ha forståelige standardvalg og kan aldri
bruke farge alene som identifikasjon.

Semantisk retning:

- indigo: primær handling og valgt navigasjon;
- blå: hjelp og informativ status;
- smaragd/grønn: vellykket/fullført;
- rav: oppmerksomhet eller venting;
- rød: destruktiv handling eller feil, aldri vanlig elevprogresjon;
- lilla: quiz/spesiell oppgavetype;
- gul: XP/poeng;
- rosa/oransje: belønning og feiring.

## Ikon- og språkregler

- Bruk mønstre eleven møter i vanlige apper og PWA-er: hånd, hake, kryss,
  kamera, mikrofon, bilde, høyttaler, tilbake, meny og søk.
- Ikonførst betyr lav synlig tekstmengde, ikke manglende semantikk. Hver kontroll
  skal ha tilgjengelig navn, rolle og tilstand.
- Kombiner symbol og et kort ord når betydningen kan være tvetydig.
- Bruk norsk bokmål, konkrete verb og samme ord i alle flater.
- Unngå voksen fagterminologi i elevflaten og unngå blandet norsk/engelsk som
  «LEVEL» eller «Teacher Dashboard».
- Status bør beskrive neste mulige handling, ikke bare systemtilstand.

## Bevegelse og feiring

- Vanlig lagring, køstatus og fullføring skal ha rolig og kort feedback.
- Førstegangs level-up, ferdig blomst og valgt belønning kan bruke mer uttrykk,
  men eleven skal kunne redusere eller skjule dette.
- Samme nivå som gjenvinnes etter XP-reversering skal ikke gjenta stor feiring.
- Reduced motion skal gi et komplett statisk alternativ uten funksjonstap.
- Automatisk, kontinuerlig bevegelse skal unngås i arbeidsflaten. Den frivillige
  hagen kan ha rolig ambient vind og sommerfugler når «Ro i hagen» er av, fordi
  liv er en del av selve opplevelsen der. Bevegelsen stopper i bakgrunnen og i
  reduced motion og påvirker aldri progresjon.
- Den gamle tette «halvveis»-feiringen er ikke modell for ny UI. En ferdig
  femkronbladblomst er derimot en sjelden milepæl og kan få en mer
  uttrykksfull, avbrytningssikker blomstring.

## Interaktiv quiz/test

Quiz/test er en egen oppgavetype, ikke et LMS-resultatkort. Den beholder
prototypens tydelige lilla karakter og gir eleven én oppgave om gangen:

- stor spørsmålstekst og valgfri opplesing;
- tekstfelt, semantiske radioknapper, avkrysningsbokser eller valgfritt
  lydsvar;
- rolig fremdrift, «Forrige» og «Neste» uten tidspress;
- autolagring, pause og fortsettelse etter refresh;
- tydelig advarsel dersom eleven vil levere med ubesvarte spørsmål; og
- ingen prosent, poengtavle eller grønn «riktig»-markering når læreren ikke har
  definert og produktet ikke støtter automatisk fasit.

Valgkort kan være store og taktile, men native semantics skal bestå. Lærerens
gjennomgang viser elevens faktiske besvarelse og forsøkssekvens, ikke en
konstruert korrekthet. XP presenteres som anerkjennelse av gyldig levering,
aldri av antall riktige.

## Malerverksted og levende hage

Blomsterhagen er et flaggskip og et frivillig kreativt minispill. Den skal ikke
se ut som et vanlig hvitt admin-kort med noen CSS-sirkler. Et eget
renderingslag, en dokumentert kunstpipeline og en fysisk iPad-port skal gi
taktil maling, dybde og et levende, personlig sted uten at React/DOM mister
ansvaret for semantikk og kontroll.

### Malerverksted

- En pågående blomst står tydelig i sentrum i et eget fullskjermsrom.
- Eleven velger et ledig kronblad, dypper en stor pensel i navngitte fargebrønner
  og maler med synlige, overlappende strøk og flere farger.
- Penselrespons, tekstur og fargeblanding skal føles umiddelbar. Dekning er
  tilgivende og vises gjennom kronbladet, ikke som en prosentmåler.
- Angre, gjør om, tøm, fortsett senere og «Behold kronbladet» ligger rolig og
  forutsigbart. Første serverbekreftede, gyldige strøk reserverer
  belønningsvalget.
- En semantisk komponist tilbyr samme egenart med grunnfarge, aksentfarger og
  navngitte mønstre for skjermleser, switch og tastatur. Dette er en likeverdig
  skapende vei, ikke en tekstlig beskrivelse av et utilgjengelig canvas.

### Blomstring og hage

- Femte kronblad utløser én sjelden blomstring. Reduced motion viser samme
  ferdige resultat som et statisk sceneskifte.
- Den ferdige blomsten venter trygt på planting hvis eleven går ut av flyten.
- Fri drag/berøring er den taktile hovedmetoden. Enkelttrykk, retningstaster,
  D-pad, navngitte hagesoner og valgfri automatisk plassering gir samme
  funksjon.
- Plantene beveger seg forsiktig i seedet vind. Sommerfugler kan utforske,
  lande, hvile og lette, men er aldri oppgaver eller samleobjekter.
- Ingen blomst visner. Hagen krever ingen vanning, daglig besøk, mating eller
  streak og gir aldri XP for lek eller vedlikehold.

Motorvalget avgjøres etter en spike mellom et lite Canvas 2D-oppsett og PixiJS
med WebGL på faktisk iPad 9. generasjon. WebGPU er ikke et krav. Phaser eller
en generell fysikkmotor tas bare inn dersom målinger viser en konkret gevinst;
rolig vind, sommerfuglstyring og plantekollisjon bør først løses med små,
deterministiske systemer. Desktop-FPS eller en pen demo er ikke tilstrekkelig
bevis.

## Hjelpekø

Elevens synlige modell har bare to hovedtilstander:

1. håndsymbol når læreren har åpnet kø for elevens klasse/økt;
2. hånd + «Står i kø», med kompakt kryss ved nytt trykk.

Det skal ikke vises plassnummer, andre elever, ventetidsløfte eller skjult
prioritering. Fra en oppgave sendes konteksten med automatisk; fra footeren er
forespørselen generell.

Ansattflaten kan vise eksakt rekkefølge, ventetid, oppgavekontekst og ansvarlig
ansatt. Drag kan være en rask desktopmetode, men må suppleres med flytt
opp/ned/først for tastatur og berøring.

En åpen kø skal skille tydelig mellom tre voksenhandlinger:

- «Bli med» gir køhandlinger og løpende oppdateringer;
- «Forlat køen» stopper bare den aktuelle ansattes deltakelse og varsler;
- «Steng kø» stopper nye elevforespørsler for alle, men lar deltakerne tømme
  det som allerede står i kø.

En ikke-deltakende ansatt kan se en kort status og orientere seg, men
elevkortene skal være uten handlingskontroller. Deltakerantallet skal være
synlig for ansatte. En ansatt som eier en forespørsel skal få en konkret beskjed
om å løse, frigi eller overføre før «Forlat køen» kan brukes. Siste deltaker skal
ledes til «Steng kø» i stedet for å kunne etterlate en åpen, ubemannet kø.
Mens køen tømmes i `closing`, skal en ikke-siste deltaker uten eid arbeid fortsatt
kunne velge «Forlat køen»; kollegaens køflate og elevens status fortsetter uten
avbrudd.

Hvis alle deltakere forsvinner på grunn av utløpt eller tilbakekalt tilgang,
vises køen som `stenger`. Har den fortsatt elever, skal en autorisert ansatt få
en rolig «Bli med»-handling for å overta og tømme den. Dette er en
gjenopprettingsflyt, ikke en ny kø.

## Responsive mål

- Mobil er ikke en krympet desktop. Tabeller blir kort, sheets blir
  fullskjermflater og primærhandlinger holdes innen rekkevidde.
- iPad portrett følger ofte mobilens sekvens; landskap kan bruke delt visning.
- PC bruker større oversikt, fast meny og sidepaneler uten å endre begrepene.
- Alle kjerneflyter skal testes ved 360×640, 640×360, 768×1024, 1024×768 og
  desktop, i tillegg til 200 prosent zoom.
- Sticky/fixed elementer skal aldri skjule fokus eller siste innholdselement.

## Kjente 2.x-avvik som ikke skal kopieres

- arkivikon som ble forstått som sletting;
- røde badges som skapte unødig uro;
- eksakt elevplass i en kø læreren samtidig kunne omprioritere;
- en informasjonstett «halvveis»-modal;
- hover-only-handlinger og drag som eneste metode;
- egendefinerte dialoger uten navn, fokusfelle, Escape og fokusretur;
- klikkbare `div`-elementer i stedet for semantiske kontroller;
- engelsk resttekst, døde lenker og dekorativ statistikk uten handling;
- velkomsttilstand lagret «for alltid» når innholdet egentlig var daglig;
- kontinuerlig animasjon uten reduced-motion-alternativ.

## Flater som fortsatt er referanser

- elevens dagsplan med forrige/aktuell/neste;
- elevens oppgave-/fagflate og fullføringssjekkpunkt;
- fast elevfooter med progresjon, timer og hjelp;
- lærerens dashboard og aktivitetsfeed;
- klasser, grupper og elevadministrasjon;
- hjelpekøens ansattpanel;
- Smart Import med redigerbar, menneskekontrollert forhåndsvisning;
- oppgavegjennomgang og retur; reaksjon og kommentar er en åpen retning som
  krever avklart personvern, moderering og oppbevaring;
- valgfri blomsterhage, kuponger og level-up-belønning;
- quiz/test med ett spørsmål om gangen, opplesing og lærerreview;
- malerverksted med flerfargede strøk, femkronbladblomst og planting; og
- levende hage med rolig fysikk, sommerfugler og full alternativ betjening.

De avklarte delene av disse flatene skal reimplementeres på 3.0-domenet og ikke
kopieres sammen med 2.x-klientmutasjoner, gamle RLS-regler eller kjente
tilgjengelighetsavvik. Åpne retninger må først avgjøres i domenekontrakten.
