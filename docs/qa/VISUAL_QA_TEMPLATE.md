# Visuell QA – kontrollpunkt

Kopier denne malen til relevant epic eller checkpointnotat. Ikke commit
screenshots med persondata eller midlertidige TOTP-/innloggingsopplysninger.

## Omfang

- Slice/epic:
- Kandidatcommit:
- Eventuell rettings-/retestcommit:
- Dato:
- Tester:
- Roller:
- Browser(e):
- Fysisk enhet, OS og hjelpemiddel:
- Testmiljø/origin (uten hemmeligheter):
- Referansebilder fra `Prototypen/`:
- Kjente antimønstre kontrollert:

## Matrise

| Rolle | Viewport | Funksjon | Axe | Overflow | Tastatur | Reduced motion | Artefakt/resultat |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Elev | 360×640 |  |  |  |  |  |  |
| Elev | 640×360 |  |  |  |  |  |  |
| Elev | 768×1024 |  |  |  |  |  |  |
| Elev | 1024×768 |  |  |  |  |  |  |
| Elev | 1440×900 |  |  |  |  |  |  |
| Ansatt | 360×640 |  |  |  |  |  |  |
| Ansatt | 640×360 |  |  |  |  |  |  |
| Ansatt | 768×1024 |  |  |  |  |  |  |
| Ansatt | 1024×768 |  |  |  |  |  |  |
| Ansatt | 1440×900 |  |  |  |  |  |  |

Bruk bare radene som er relevante for slicen, men behold alle fem målklassene
for nye skall og kjerneflyter.

## Semantisk sammenligning

- Er hovedhandlingen åpenbar uten forklaring?
- Er informasjonsmengden tilpasset rollen og alderen?
- Er forrige, aktuell og neste kontekst forståelig?
- Er ikon, kort tekst og tilstand konsistente?
- Er farge bare sekundær informasjonsbærer?
- Dekker footer, sticky flater eller skjermtastatur innhold/fokus?
- Har mobil/iPad en reell komposisjon, ikke bare krympet desktop?
- Har kjente 2.x-antimønstre kommet tilbake?

## Manuell kontroll

- [ ] Ekte 200 % browserzoom/reflow
- [ ] Bare tastatur og synlig fokus
- [ ] VoiceOver/NVDA på berørt kjerneflyt
- [ ] Ekte touch på mobil/iPad
- [ ] Live orienteringsbytte mens fokus står i navigasjon, dialog og input
- [ ] Kamera-/mikrofontillatelse når relevant
- [ ] Feiring/timing med og uten reduced motion
- [ ] Forståelighet for målgruppen vurdert av menneske

## Gjennomføringslogg

Før én rad per faktisk kjøring. En delvis eller mislykket kjøring beholdes når
en senere retest består.

| ID | Port/scenario | Kandidat | Enhet/browser/hjelpemiddel | Resultat | Bevis/notat |
| --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |

## Avvik, retting og retest

| ID/alvorlighet | Funnet på commit/enhet | Reproduksjon | Tiltak | Automatisk regresjon | Fysisk retest og commit | Status |
| --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |

Stopp den berørte manuelle porten ved første avvik. Rett årsaken, legg til en
automatisk regresjon der det er mulig, og kjør deretter samme scenario på den
samme enhetstypen og den nye eksakte commiten. Et automatisk grønt resultat
alene lukker ikke et fysisk avvik.

**Beslutning:** Godkjent / godkjent med kjent avvik / ikke godkjent

**Begrunnelse:**
