# Visuell QA – kontrollpunkt 0

## Omfang

- **Slice:** arbeids- og QA-fundament, ikke ny produktatferd
- **Dato:** 15. juli 2026
- **Roller:** syntetisk elev og eier/lærer med AAL2
- **Browsere:** Chromium og WebKit
- **Referanser:** `Prototypen/e2.jpg`, `Prototypen/e4.jpg`,
  `Prototypen/e6.jpg` og `Prototypen/Bildeoversikt.md`
- **Antimønstre kontrollert:** elevens kønummer, informasjonstett
  «halvveis»-modal, alarmerende arkivsymbol og krympet desktop

Screenshots er midlertidige, ignorerte `test-results`-artefakter med bare
syntetiske data. De er inspisert manuelt, men skal ikke committes som
pixel-baselines.

## Automatisert matrise

Alle radene bestod funksjon, axe WCAG A/AA, horisontal overflow, runtime-feil
og reduced motion i både Chromium og WebKit.

| Rolle | Viewport | Resultat | Visuell vurdering |
| --- | --- | --- | --- |
| Elev | 360×640 | Bestått | Kort stables uten klipping; hovedhandlingene er tydelige. |
| Elev | 640×360 | Bestått | Vertikal scrolling er nødvendig og forventet; ingen sideveis scrolling. |
| Elev | 768×1024 | Bestått | Rolig énkolonnekomposisjon med god avstand. |
| Elev | 1024×768 | Bestått | Innholdet beholder lesbar bredde og hierarki. |
| Elev | 1440×900 | Bestått | Sentrert arbeidsflate uten unødig informasjonsstøy. |
| Lærer | 360×640 | Bestått | Opprett-skjemaet stables og knappen får full bredde. |
| Lærer | 640×360 | Bestått | Kompakt radlayout uten klipping; siden kan rulle vertikalt. |
| Lærer | 768×1024 | Bestått | Skjema og klasseliste har tydelig visuell rekkefølge. |
| Lærer | 1024×768 | Bestått | Effektiv bruk av bredden uten desktop-tabell på liten flate. |
| Lærer | 1440×900 | Bestått | Rolig oppsettsflate med én klar opprett-handling. |

## Semantisk vurdering

Det nåværende pilotskallet ivaretar referanseintensjonen om et rolig hierarki,
få samtidige valg, store trykkmål og en tydelig neste oppgave. Mobil er reelt
stablet, ikke bare skalert desktop. Lærerens oppsett er enkelt og responsivt.
Chromium og WebKit viser samme informasjonsrekkefølge og tilnærmet samme
komposisjon.

Kontrollpunktet godkjenner testharnessen, ikke dagens flater som ferdig målbilde.
Følgende kjente produktgap ble synlige og skal føres inn i relevante slicer:

1. Elevflaten har «Start oppgaven» og statusen «Ikke startet». Målflyten åpner
   oppgaven direkte og trenger ingen egen «I gang»-handling.
2. Hjelp vises som et stort, alltid tilgjengelig tekstkort. Målet er en kjent
   hånd i footeren bare når læreren har åpnet kø for den aktive klassen/timen.
3. Fullføringssjekkpunktet med frivillig tekst, lyd og bilde er ikke implementert
   i denne pilotflaten ennå; `e6.jpg` er fortsatt intensjonsreferanse.
4. Lærerens side er en fungerende oppsettsflate, men ikke det endelige
   arbeidsdashboardet med kø, nylig brukt kontekst og hurtighandlinger.

Ingen av gapene er introdusert av kontrollpunkt 0, og de skal ikke repareres i
denne infrastrukturslicen.

## Manuelle porter

- [ ] Ekte 200 % browserzoom/reflow
- [ ] VoiceOver eller NVDA på berørt kjerneflyt
- [ ] Ekte touch på mobil og iPad
- [ ] Kamera-/mikrofontillatelse når fullføringssjekkpunktet implementeres
- [ ] Menneskelig forståelighetstest med målgruppen

Offentlig innlogging er automatisk tastaturtestet. Full tastaturflyt for hver
autentiserte produktslice legges til sammen med slicens handlinger.

## Beslutning

**Godkjent med kjente produktgap.** Kontrollpunkt 0 gir repeterbar visuell og
autentisert QA på målformatene. Dagens pilot-UI er ikke godkjent som endelig
Klar 3.0-design; avvikene over er eksplisitte innganger til senere epics.
