# E05 – Ansattilgang og vikar

**Status:** Pågår – A1-autorisasjonskjernen er implementert; øvrige
virkeområder og senere pedagogiske funksjoner gjenstår

**Kontrakt:** [§ 4 Aktører, roller og ressursomfang](../product/DOMAIN_CONTRACT.md#4-aktører-roller-og-ressursomfang)

**Avhenger av:** E06

## Resultat

Kontaktlærer, faglærer, ITO-/spesialpedagog og vikar kan gjøre de samme
pedagogiske kjernehandlingene når de har et aktivt oppdrag på den konkrete
klassen, gruppen, faget eller eleven. Lik funksjon betyr ikke global tilgang.
Vikaren bruker personlig konto, AAL2 og automatisk utløp.

Kontrollpunkt A1 har levert personlig AAL2-identitet, klasse- og
tidsavgrensede oppdrag, fast `class_pedagogy_v1`, hard autorisasjons-cutover,
owner-only kontrollflate, tilbakekalling og audit for dagens pedagogiske
kjerne. Gruppe-, fag-, elev- og øktomfang, notetilgang og funksjonene fra de
senere produktepicene er fortsatt planlagt. Epicen er derfor pågår, ikke
ferdig.

## Prinsippmodell

Skille mellom:

- **identitet:** den innloggede personen;
- **organisasjonsrolle:** eier/ansatt/elev;
- **jobbetikett:** kontaktlærer, faglærer, ITO eller vikar;
- **ressurstildeling:** klasse, gruppe, fag, elev og eventuelt økt;
- **gyldighet:** start, slutt og tilbakekalling;
- **kapabilitet:** pedagogiske handlinger tillatt i oppdraget.

Jobbetiketten alene gir ingen rettighet. Hver forespørsel må autoriseres mot
ressurs, organisasjon, tid, kapabilitet og AAL2.

## Pedagogiske kapabiliteter

Et aktivt oppdrag kan gi de samme operative handlingene:

- lese og publisere ukeplan/oppgaver;
- se elevstatus og frivillige oppgavevedlegg;
- åpne igjen/returnere oppgave;
- administrere relevant elevstøtte og motivasjonsrammer;
- åpne, overta, prioritere og løse hjelpekø;
- autoriseres for relevante pedagogiske notater når en egen notefunksjon
  senere finnes;
- flytte eller sende ut ny oppgaveiterasjon.

Eier/admin alene skal forvalte organisasjon, kontoer, tildelinger,
sikkerhetsinnstillinger og permanent tilgang. En vikar skal ikke kunne utvide
eget omfang eller varighet.

## Vikaropprettelse og livsløp

1. Autorisert eier/admin velger navngitt bruker, tidsrom og ressurser.
2. Systemet viser eksplisitt hvilke elevdata og handlinger oppdraget åpner.
3. Vikaren autentiserer personlig og fullfører AAL2; delt dagslenke eller delt
   konto er ikke tilstrekkelig.
4. Oppdraget blir aktivt ved start og opphører automatisk ved slutt eller
   `revoked_at`.
5. Aktive sesjoner må miste autorisasjon når oppdraget utløper/tilbakekalles,
   også om en side står åpen.
6. Opprettelse, endring, bruk av privilegert handling og utløp revideres.

## Implementert grunnmodell og videre utvidelse

- `staff_assignments`: org, bruker, jobbetikett, start/slutt, revoked,
  oppretter og versjon.
- `staff_assignment_scopes`: klasse/gruppe/fag/elev/økt med konsistente FK-er.
- `staff_assignment_capabilities`: eksplisitt kapabilitetssett eller en
  versjonert profil med sikker standard.
- Sentral autorisasjonstjeneste som evaluerer alle relevante handlinger.
- Databaser/RLS og serverhandlinger skal begge avgrense; service role kan ikke
  brukes som erstatning for domenesjekken.
- Audit bruker assignment-ID slik at handlingen kan knyttes til oppdraget som
  faktisk ga tilgang.

Standard er deny-by-default. Nye kapabiliteter blir utilgjengelige til de er
eksplisitt lagt i riktig profil og testet.

## Notater og personvern

«Tilgang til alt» betyr pedagogisk funksjon i aktivt omfang, ikke all historikk
i organisasjonen. E05 skal reservere en eksplisitt, deny-by-default kapabilitet
for relevante støtteopplysninger og notater. Selve notemodellen, lagring og UI
er ikke del av denne epicen og må få egen leveranse før funksjonen aktiveres.
Svært følsom eller langsiktig historikk skal ha eget need-to-know-omfang og
tydelig revisjon. Teknisk audit skal aldri brukes som elevjournal.

## Akseptansekriterier

- [ ] Alle fire jobbetiketter kan utføre samme kjernehandling med likt aktivt
  omfang.
- [ ] Samme brukere avvises på annen klasse, elev, fag, organisasjon eller
  utenfor tidsrommet.
- [x] Vikar bruker personlig identitet og AAL2.
- [x] Vikaroppdrag aktiveres og utløper automatisk på serveren.
- [x] Tilbakekalling stopper nye handlinger og revaliderer aktiv sesjon.
- [x] Ingen ansatt kan gi seg selv eller andre større tilgang uten adminrett.
- [x] Nye kapabiliteter er deny-by-default.
- [ ] Serverhandling, RPC og direkte read-path testes negativt per ressurs.
- [x] Audit viser aktør, assignment, kapabilitet, ressurs og tidspunkt.
- [ ] Massehandlinger verifiserer hvert mål; ett tillatt mål kan ikke smugle
  med et ikke-tillatt mål.
- [ ] Kapabilitetsmodellen kan representere notetilgang separat og nekter den
  som standard; epicen påstår ikke at en notefunksjon er implementert.

## Testmatrise og risiko

Matrisen skal krysse jobbetikett × kapabilitet × ressursnivå × før/under/etter
gyldighet × AAL1/AAL2 × egen/annen organisasjon. Test også klokkegrense,
tilbakekalling mens side er åpen, flere samtidige oppdrag, slettet klasse,
gruppe på tvers av klasser og batch med blandet tilgang.

Største risiko er at en generell «teacher»-sjekk omgår assignment-omfanget.
Kodesøk og tester skal dokumentere at alle nye kjernehandlinger bruker den
sentrale kontrollen.

## Ferdigbevis

Epicen er ferdig når autorisasjonsmatrisen er automatisert, RLS/RPC-smoke viser
isolasjon, en simulert vikar kan arbeide i riktig klasse og mister tilgang ved
utløp, og audit kan forklare hvilket oppdrag som autoriserte hver handling.
