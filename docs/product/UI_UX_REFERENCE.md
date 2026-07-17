# Klar 3.0 – UI/UX-referanse

> **Status:** Kuratert designreferanse for målproduktet. Domeneregler og
> produktbeslutninger i [domenekontrakten](./DOMAIN_CONTRACT.md) har forrang.
> Referansen beskriver ønsket retning, ikke ferdig implementasjon.

## Grunnlag

Retningen er samlet etter gjennomgang av masteroppgaven og dens figurer,
prototypebildene, den tidligere Klar-implementasjonen i `archive/2x-ui` og på
`origin/master`, samt produkteierens tidskodede
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
- Meldinger;
- Planer/Smart Import;
- vikar- og tilgangsforvaltning for autoriserte administratorer.

Elevens toppnivå skal være mindre og oppgaveorientert:

- dagen i dag;
- fag og oppgaver;
- timeplan;
- egne belønninger når aktivert.

I gjeldende 3.0-kjerne er «Dagen i dag» og «Fag og oppgaver» implementert.
Timeplan og belønninger skal ikke vises som døde navigasjonsmål før de har en
reell flate. Fagoversikten bruker én lenke per fag, beholder ferdige og
gjenåpnede oppgaver i samme sammenheng og respekterer elevens valg om stille
fremdriftsvisning.

Navigasjonen skal aldri konkurrere med aktuell økt. På små skjermer kan
sekundærnavigasjon ligge bak en kjent meny, mens footerhandlingene for den
aktive konteksten forblir lette å nå.

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
- Automatisk, kontinuerlig bevegelse skal unngås; den gamle tette
  «halvveis»-feiringen er ikke modell for ny UI.

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
- valgfri blomsterhage, kuponger og level-up-belønning.

De avklarte delene av disse flatene skal reimplementeres på 3.0-domenet og ikke
kopieres sammen med 2.x-klientmutasjoner, gamle RLS-regler eller kjente
tilgjengelighetsavvik. Åpne retninger må først avgjøres i domenekontrakten.
