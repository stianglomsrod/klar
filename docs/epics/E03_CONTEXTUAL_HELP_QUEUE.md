# E03 – Kontekstuell hjelpekø

**Status:** Planlagt

**Kontrakt:** [§ 8 Hjelpekø](../product/DOMAIN_CONTRACT.md#8-hjelpekø)

**Avhenger av:** E01, E05 og E06

## Resultat

Når en ansatt åpner kø for en klasse/gruppe og undervisningsøkt, dukker et
kjent håndsymbol opp i elevens footer og inne i oppgaver. Ett trykk setter
eleven i kø; kontrollen viser kort «Står i kø». Et nytt trykk gir en kompakt
kryss-av-handling. Eleven trenger ikke lese forklaringer eller velge grunn.

Ansatte ser og styrer den faktiske køen. Eleven ser aldri køplass eller stille
omprioritering. Nåværende v3 har deler av forespørselslivsløpet og valgfri
oppgave-FK, men mangler aktiv øktkø, elevens oppgavekobling og reviderbar
prioritering.

## Omfang

- opprette, overvåke og stenge kø per klasse/gruppe og økt;
- generell forespørsel fra footer;
- valgfri, automatisk oppgavekontekst fra åpen oppgave;
- én aktiv forespørsel per elev i samme kø;
- kompakt elevstatus og avmelding;
- ansattrekkefølge, ventetid, overtakelse, løsning, frigivelse og overføring;
- atomisk, reviderbar prioritering;
- realtime og gjenoppretting etter forbindelsesbrudd.

Epicen omfatter ikke elevchat, krav om begrunnelse, synlig kønummer,
ventetidsløfte eller eksponering av andre elever.

## Elevens interaksjonskontrakt

| Tilstand | Synlig kontroll | Handling |
| --- | --- | --- |
| Kø lukket | Ingen hånd | Ingen køhandling tilbys |
| Kø stenger, ingen aktiv forespørsel | Ingen hånd | Ingen ny forespørsel tilbys |
| Kø stenger, aktiv forespørsel | Hånd + «Står i kø» | Eleven kan fortsatt krysse bort; ansatt må håndtere eller avslutte |
| Kø åpen, ikke i kø | Håndsymbol | Trykk oppretter forespørsel |
| Aktiv forespørsel | Hånd + «Står i kø» | Trykk åpner kompakt kryss/avbryt |
| Avbryter | Kort ventetilstand | Dobbel innsending blokkeres |
| Avsluttet, kø fortsatt åpen | Håndsymbol | Ny forespørsel er mulig |

Elevkontrollen skal ikke skille synlig mellom ventende og overtatt. Den skal ha
korrekt `aria-label`, trykket/aktiv tilstand og skjermlesermelding uten å gjøre
den synlige flaten teksttung.

Forespørsel fra footer har ingen oppgave-ID. Forespørsel fra oppgaven bruker
den åpne iterasjonen som kontekst. En eksisterende generell forespørsel kan få
oppgavekontekst uten å miste køtid eller intern posisjon.

## Ansattflyt og prioritering

- FIFO er standard innen samme prioritet.
- Ansatte ser elev, ventetid, oppgave/fag dersom koblet, ansvarlig ansatt og
  nøyaktig intern rekkefølge.
- Bare én ansatt kan eie/overtake en forespørsel av gangen.
- Eieren kan løse den; eksplisitte handlinger frigir eller overfører eierskap.
- Autoriserte ansatte kan flytte opp/ned eller først. Drag kan tilbys på PC,
  men aldri være eneste metode.
- Omprioritering skjer i én versjonskontrollert serveroperasjon og logger aktør,
  tidspunkt, før/etter og en kort strukturert grunnkode.
- Eleven og andre elever får ingen informasjon om prioriteringen.

Stenging setter først køen i `stenger` og stopper nye forespørsler. Elever uten
aktiv forespørsel mister hånden, mens en elev som allerede står i kø beholder
«Står i kø» og avmeldingsmuligheten til forespørselen er håndtert eller
eksplisitt kansellert. Først da blir køen `lukket`.

## Data og autorisasjon

- `help_queue_sessions`: organisasjon, målgruppe, økt, åpnet/stengt, ansvarlig
  og versjon.
- `help_requests`: kø, elev, valgfri oppgaveiterasjon, status, intern rang,
  eier og tidsstempler.
- Unik aktiv forespørsel per `(queue_session, student)`.
- Serverkommandoer for open/close, request/cancel, contextualize, claim,
  release/transfer, resolve og reorder.
- Alle kommandoer sjekker aktivt elev-/ansattomfang og køtilstand.
- Realtime er kun transport; autoritativ status hentes på nytt etter reconnect.

## Responsive flater

- Elev: vedvarende footer-kontroll med safe-area og minst 44 × 44 målflate.
- Mobil lærer: fullskjerm-sheet med store alternative flytteknapper.
- iPad portrett: fullskjerm; landskap: sidepanel eller split view.
- PC: fast eller lett tilgjengelig livepanel med klassefilter og ventetid.
- Sheet/dialog skal ha navn, fokusfelle, Escape, lukkekontroll og fokusretur.
- Ingen dragbevegelse skal være nødvendig, og drag skal ikke kollidere med
  scrolling på berøringsskjerm.

## Akseptansekriterier

- [ ] Hånden vises bare for elever i riktig målgruppe mens riktig kø er åpen.
- [ ] Ett trykk oppretter én forespørsel og viser «Står i kø».
- [ ] Nytt trykk gjør avmelding mulig med et kompakt kryss.
- [ ] Footerforespørsel fungerer uten oppgave; oppgaveforespørsel får kontekst.
- [ ] Oppgavekontekst kan legges til uten ny forespørsel eller nullstilt tid.
- [ ] Eleven ser aldri køplass, andre elever eller omprioritering.
- [ ] To ansatte kan ikke overta samme forespørsel samtidig.
- [ ] Reorder er atomisk, reviderbart og har tastatur-/touch-alternativ.
- [ ] Stenging bruker en eksplisitt `stenger`-tilstand og etterlater ingen
  usynlig aktiv forespørsel.
- [ ] Reconnect, dobbeltrykk og retry gir semantisk stabil status.
- [ ] Handling utenfor aktiv klasse/økt/ansattoppdrag avvises.
- [ ] Flyten fungerer på mobil, iPad og PC ved 200 % zoom og med skjermleser.

## Tester og ferdigbevis

Minimumstester: organisasjons-/klasseisolasjon, køåpning, én-aktiv-regel,
valgfri FK-validering, claim-race, reorder-race, close med ventende, expiry,
realtime reconnect, elevavmelding og alle responsive kontrollmodi.

Epicen er ferdig når køen kan brukes gjennom en hel simulert undervisningsøkt
med minst to ansatte og flere elever uten duplikat, strandet forespørsel eller
lekkasje av prioritet, og når audit og tilgjengelighet er verifisert.
