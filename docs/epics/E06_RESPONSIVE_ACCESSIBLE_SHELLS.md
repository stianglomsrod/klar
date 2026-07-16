# E06 – Responsive og tilgjengelige skall

**Status:** Pågår – ansattskall og A1-primitives er implementert; samlet
produktmatrise og manuelle enhetsporter gjenstår

**Type:** Tverrgående

**Kontrakt:** [§ 11 Responsivitet og tilgjengelighet](../product/DOMAIN_CONTRACT.md#11-responsivitet-og-tilgjengelighet)

**Avhenger av:** Ingen; skal brukes av alle andre epics

## Resultat

Klar har ett sammenhengende elevskall og ett ansattskall som gjør alle
kjerneflyter funksjonelle på mobil, iPad i begge retninger og PC. Elevflaten er
ikonførst, rolig og lesesvak-vennlig. Ansattflaten kan være tettere, men har
samme semantiske, motoriske og responsive kvalitet.

Dette er mer enn breakpoints: navigasjon, footer, sheets, dialoger,
statusmeldinger, fokus og feiltilstander må være felles primitives. A1 har
levert første ansattskall med desktopnavigasjon, mobilskuff,
dialog-/sheet-primitives, fokusfelle/-retur og trygg tilgangstapstilstand.
Chromium og WebKit er automatisk kontrollert på fem målviewports med reduced
motion, axe A/AA, runtime- og overflow-sjekker. Hele produktmatrisen og de
fysiske zoom-, skjermleser-, touch-, safe-area-, tastatur- og
orienteringsportene gjenstår.

## Designregler

### Elev

- Én tydelig primærhandling og lav informasjonstetthet.
- Kjente symboler: hånd, hake, kryss, kamera, mikrofon, bilde, høyttaler,
  tilbake og meny.
- Kort synlig tekst når symbolet ikke alene er entydig; alltid tilgjengelig
  navn og tilstand.
- Fast footer kan vise progresjon, timer og aktiv hånd, men skal aldri dekke
  innhold, tastaturfokus eller systemets safe-area.
- Ingen hover, skjult gest eller lesetung forklaring i hovedflyten.

### Ansatt

- PC: fast sidemeny og plass til tabell/delt visning/livepanel.
- iPad landskap: sidepanel eller delt visning; portrett: sheet/fullskjerm.
- Mobil: navigasjonsdrawer og sekvensielle kort/sheets; alle kjernehandlinger
  beholdes selv om store tabeller omformes.
- Mobilmenyens trigger skal ligge på samme ledende kant som draweren åpner fra,
  og visuell rekkefølge skal samsvare med DOM- og fokusrekkefølge.
- Når et breakpoint erstatter mobil- og desktopnavigasjon med ulike synlige
  DOM-trær, skal fokus flyttes eksplisitt til tilsvarende synlig kontroll eller
  aktiv lenke etter layoutbyttet. Fokus i hovedinnholdet skal ikke kapres.
- Massehandlinger skal vise valgt omfang og konsekvens før bekreftelse.

## Felles primitives

- hopp-lenke, landemerker, overskriftshierarki og `lang="nb"`;
- knapper, lenker, toggles, tabs og menyer med native semantikk;
- dialog og sheet med navn, fokusfelle, Escape/lukk, bakgrunnsinaktivitet og
  fokusretur;
- toast/status med korrekt live-region uten unødvendig fokusflytting;
- tom-, laste-, lagre-, offline-, reconnect- og feiltilstander;
- synlig fokus med kontrast på alle bakgrunner;
- felles responsive spacing, maksimal tekstbredde og safe-area;
- reduced-motion-variant for feiring, overgang, drag og autooppdatering;
- ikke-fargebaserte statussignaler og testet kontrast.

Drag-and-drop kan være en ekstra snarvei. Alle draghandlinger skal ha
tastatur-/touchalternativer som flytt opp/ned/først eller velg mål.

## Målematrise

Minimum automatisert og visuell kontroll:

| Klasse | Viewport | Primær input |
| --- | --- | --- |
| Liten mobil | 360 × 640 | Berøring |
| Mobil landskap | 640 × 360 | Berøring |
| iPad portrett | 768 × 1024 | Berøring/tastatur |
| iPad landskap | 1024 × 768 | Berøring/tastatur |
| PC | 1440 × 900 eller større | Mus/tastatur |

Alle skal også testes ved 200 % zoom/reflow. Kritiske flyter skal testes med
skjermleser og bare tastatur. Feiring og autooppdatering skal prøves med
redusert bevegelse. Nettverksavbrudd/reconnect skal inngå der realtime brukes.

## Kjerneflyter som må dekkes

- innlogging og MFA;
- elevens dagsflate, oppgave, fullføringssjekkpunkt og valgfri media;
- elevens hånd/«Står i kø»/avmelding;
- lærerens klasse/elev, oppgave, retur og ny iterasjon;
- aktiv hjelpekø og alternativ til reorder-drag;
- Smart Import-opplasting, mapping, konflikt, bekreftelse og feil;
- opprettelse og kontroll av tidsavgrenset vikaroppdrag;
- progresjon, level-up, belønningsvalg og rolig/reduced-motion-modus.

## Akseptansekriterier

- [ ] Ingen kjernehandling forsvinner ved noen målviewport.
- [ ] Ingen side har utilsiktet horisontal scrolling ved målviewport/200 %.
- [ ] Fast header/footer skjuler aldri fokusert eller ankerlenket innhold.
- [ ] Alle handlinger kan utføres med tastatur uten musefelle.
- [ ] Dragfunksjoner har likeverdig alternativ og fungerer med berøring.
- [ ] Dialog/sheet annonseres, holder fokus, lukkes og returnerer fokus riktig.
- [ ] Status, feil og realtime-endring annonseres programmatisk.
- [ ] Elevens ikonknapper har minst anbefalt 44 × 44 målflate, tilgjengelig navn
  og forståelig trykket/aktiv tilstand.
- [ ] Farge er aldri eneste bærer av fag, status, kø eller feil.
- [ ] Reduced motion fjerner ikke innhold, bekreftelse eller belønning.
- [ ] Tekst kan forstørres og systemfont/linjeavstand overstyres uten tap.
- [ ] Axe A/AA har ingen ukjente brudd i kjerneflytene; manuell kontroll dekker
  forhold automatiske verktøy ikke kan bevise.

## Test- og ferdigbevis

Opprett gjenbrukbare Playwright-hjelpere for viewport, keyboard-only, axe,
reduced motion og overflow. Visuell QA skal lagre representative skjermbilder
for alle fem målklasser og dokumentere manuell skjermleser-/touchkontroll.
Separate portrett-/landskapsbilder er ikke tilstrekkelig når navigasjonen
bytter DOM ved breakpointet: automatisert viewport-round-trip med fokusbevis
skal pares med fysisk VoiceOver-/TalkBack-retest på rettingscommiten.

E06 er ikke «ferdig én gang». Hver epic må lenke til sine E06-bevis. Status kan
settes til «Pågår» når skall/primitives og matrise finnes, men kan først settes
til «Ferdig» når samlet pilotkandidat har bestått alle kjerneflytene.
