# E02 – Progresjon og belønninger

**Status:** Pågår – B1-kjernen er verifisert

**Kontrakt:** [§ 7 Oppgavestatus, XP, nivå og belønning](../product/DOMAIN_CONTRACT.md#7-oppgavestatus-xp-nivå-og-belønning)

**Avhenger av:** E05 og E06

## Resultat

Fullføring gir XP umiddelbart og forutsigbart. Elevangre og ansattretur trekker
tilbake nøyaktig samme XP, mens en belønning eleven allerede har valgt aldri
forsvinner. Samtidighet, retry og gjentatt fullføring kan ikke brukes til
farming.

Kontrollpunkt [B1](../qa/CONTROL_POINT_B1.md) har levert oppgavestatus,
snapshotsatt XP, append-only ledger, nivåmodell, unik milepæl/entitlement,
elevangre og ansattretur. Det som gjenstår i epicen er særlig autoritativt
belønningsvalg/claim, separat ansattstyrt motivasjonsramme og elevpreferanse,
samt de endelige rolige belønningsflatene. 2.x viser ønsket produktintensjon,
men bruker flere klientskriv og skal ikke porteres direkte.

[Kontrollpunkt D2](../qa/CONTROL_POINT_D2.md) er et delbevis for iterasjons-
og XP-grensen: flytt beholder samme assignment, historikk og ene XP-mulighet,
mens en eksplisitt ny utsending får nye assignments og en separat framtidig
XP-mulighet uten å omskrive originalen.

## Omfang og invariants

- Elevens domenestatus er tildelt, fullført eller åpnet igjen. Åpning av en
  oppgave er ikke en obligatorisk «i gang»-status.
- Overgang inn i fullført krediterer oppgavens snapshotsatte XP.
- Overgang ut av fullført oppretter en kompenserende reversering.
- Samme målstatus er en idempotent no-op.
- Nåværende nivå kan gå ned; høyeste nådde nivå og milepælhistorikk gjør det
  aldri.
- Det finnes høyst én belønningstildeling per elev og nivå.
- Valgt blomst, kupong eller annen belønning beholdes og kan brukes etter
  nivåfall.
- Uvalgt belønning kan settes på vent og reaktiveres, men aldri dupliseres.
- Ny, eksplisitt oppgaveiterasjon kan gi ny XP. Gjentakelse av samme iterasjon
  gir bare netto én aktiv kreditering.
- Assignment og uforanderlig progresjonshistorikk består når et
  klassemedlemskap avsluttes. Aktivt medlemskap kreves likevel for ny
  tildeling, elevlesing og både elev- og ansattstyrte progresjonskommandoer.

## Foreslått domenemodell

- `task_assignments`/oppgaveiterasjon: `points_value_snapshot` og versjon.
- `student_task_state`: status, versjon, aktivt fullføringsforsøk og returdata.
- `student_xp_ledger`: uforanderlig kredit/reversering, aktør,
  oppgaveiterasjon, fullføringssekvens og lenke til reversert post.
- `student_progress`: beregnet/cachet XP-saldo, nivå og høyeste nivå; ledgeren
  er fasit.
- `level_reward_entitlements`: unik `(student_id, level)`, med ventende,
  tilgjengelig eller valgt tilstand.
- `reward_claims`: nøyaktig ett valg per entitlement, inkludert belønningstype
  og historisk snapshot.
- En ansattstyrt motivasjonsramme som angir hvilke elementer eleven kan bruke,
  og en separat elevpreferanse som bare kan redusere/skjule innenfor rammen.

Navnene kan justeres i implementasjonen, men garantiene kan ikke svekkes.

## Autoritative operasjoner

Én serverstyrt, transaksjonell kommando skal:

1. autorisere elev eller ansatt mot konkret iterasjon;
2. låse/versjonskontrollere oppgavestatus og progresjon;
3. validere tillatt overgang;
4. skrive status og fullføringshistorikk;
5. kreditere eller reversere ledgerpost;
6. beregne nivå og opprette eventuell unik milepæl/entitlement;
7. skrive auditthendelse;
8. returnere semantisk samme resultat ved retry med samme request-ID.

Belønningsvalg skal være en separat, transaksjonell serverkommando som låser
entitlement og håndhever én claim samt eventuelle globale begrensninger.
Klienten skal aldri sende eller skrive en autoritativ XP-saldo eller rolle.

Kupongens senere innløsning er et eget, uavklart livsløp. Unik reward claim
beviser at eleven bare valgte belønningen én gang; den avgjør ikke hvem som kan
markere kupongen brukt, hvordan feilinnløsning rettes eller hvordan dobbel bruk
hindres. Dette må kontraktsfestes før kuponginnløsning implementeres.

## UX-regler

- Standardbekreftelsen etter en oppgave er kort og rolig.
- Førstegangs level-up kan feires; samme nivå som gjenvinnes skal ikke gi en ny
  stor feiring eller ny premie.
- Elevangre skal være lett tilgjengelig fra fullførtvisningen og bruke nøytralt
  språk.
- Ansattretur skal vises som «åpnet igjen» med en kort forklaring.
- Poengreversering skal forklares uten skam eller «straff»-språk.
- Når motivasjon skjules, skal oppgaveflyten fortsatt fungere og opptjent data
  bestå.
- Ingen toppliste, offentlig poengsammenligning eller konkurranserangering.
- All feiring respekterer redusert bevegelse og kan dempes/skjules av eleven.

## Akseptansekriterier

- [x] Fullføring og XP-kreditering lykkes eller feiler samlet.
- [x] Dobbeltklikk, to faner og nettverksretry gir én kreditering.
- [x] Elevangre reverserer nøyaktig aktiv kredit og kan ikke bli negativt
  duplisert.
- [x] Lærer og vikar kan returnere i aktivt omfang; andre avvises.
- [x] Ny fullføring etter angre/retur gjenoppretter korrekt netto XP.
- [x] En oppgave som krysser flere nivåer oppretter én entitlement per nytt
  nivå.
- [ ] Valgt belønning består og kan brukes etter nivåfall.
- [x] Uvalgt belønning dupliseres ikke når nivået gjenvinnes.
- [ ] To samtidige, forskjellige belønningsvalg kan ikke begge lykkes.
- [x] Senere endring i oppgavens XP-verdi omskriver ikke historikken.
- [x] Avsluttet klassemedlemskap bevarer historikken, men stanser nye
  tildelinger, direkte browserlesing, elevkommandoer og ansattretur.
- [ ] Autoriserte ansatte kan angi tilgjengelige motivasjonselementer i eget
  omfang; andre ansatte og eleven kan ikke utvide denne rammen.
- [ ] Eleven kan redusere eller skjule tilgjengelige elementer selv.
- [x] Deaktivering/skjuling sletter ikke ledger, milepæler eller belønninger.
- [x] Audit viser aktør, årsak, overgang og tekniske ID-er uten unødvendig
  elevfritekst.

## Testmatrise

Databasetestene skal dekke lovlige og ulovlige overganger, rollback midt i
transaksjonen, samtidige kommandoer, gjentatt request-ID, flere nivåer,
angre/retur før og etter claim, endret XP-verdi, ny iterasjon og isolasjon
mellom elever/organisasjoner.

Tjeneste- og E2E-tester skal i tillegg dekke kort bekreftelse, rolig modus,
reduced motion, pending belønning etter refresh/enhetsbytte og forståelig retur.

## Risiko og ferdigbevis

Største risiko er dobbel sannhet mellom lagret saldo og ledger. Ledgeren skal
alltid kunne regenerere/cache-verifisere saldoen. Migrasjonen må ikke stole på
manipulerbare 2.x-tellere.

Epicen er ferdig når migrasjon, RPC-er, autorisasjonsmatrise, samtidighetstester
og elev-/lærerflyt er verifisert, og når feilinjeksjon viser at ingen delvis
status eller belønning kan oppstå.
