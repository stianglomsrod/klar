# E04 – Smart Import og ukeplaner

**Status:** Pågår – C1-datagrunnlag og første manuelle revisjon er verifisert

**Kontrakt:** [§ 9 Smart Import og ukeplanrevisjoner](../product/DOMAIN_CONTRACT.md#9-smart-import-og-ukeplanrevisjoner)

**Avhenger av:** E05 og E06

## Resultat

En lærer kan laste opp én DOCX, få tolket undervisningsøkter, beskjeder,
læringsmål og oppgaver, kontrollere alt i en strukturert forhåndsvisning og
publisere en sporbar ukeplan. Reimport viser endringer og konflikter uten å
duplisere, overskrive manuelle valg eller ødelegge elevhistorikk.

Nåværende 3.0 har `weekly_plans`, uforanderlig første `plan_revision`, stabile
økt-/oppgaveidentiteter, snapshots, mottakerproveniens og en autorisert,
idempotent og atomisk første publisering. Læreren bygger foreløpig klasseuken
manuelt og kontrollerer dato, tid, økter og oppgavetitler før publisering.

DOCX-flyten er fortsatt en separat task-only forhåndsvisning og kan bare
publisere løse oppgaver. Dokumentproveniens, beskjeder, læringsmål,
serverlagrede utkast, senere revisjoner, diff, treveis reimport og rollback er
ikke implementert.

## Levert i C1

- unik klasse/uke i Europe/Oslo med mandag som ukestart og eksplisitt
  `lock_version`;
- uforanderlig revisjon 1 med stabile økt- og oppgavenøkler og eksakt
  innholdssnapshot;
- økter med eller uten oppgaver og dagsavgrenset synlighet;
- mottakerlisten snapshots én gang; samtidig elevopptak gir hele planen eller
  ingen del av den;
- request-idempotens, semantisk no-op, planlås, stale-avvisning, audit og
  transaksjonell tilbakeføring uten delgraf ved feil;
- eksplisitt organisasjons- og klasseavgrensning, RLS/grants og AAL2/
  `plan.publish` i server og database;
- menneskelig kontrollsteg og responsiv lærerflate for første publisering;
- ingen automatisk backfill av historiske løse oppgaver eller oppdiktet
  provenance.

Elever som meldes inn etter publisering får ikke automatisk oppgavene i den
allerede publiserte revisjonen. Inntil en egen autorisert backfill-/ny-
revisjonsoperasjon finnes, skal elevlisten ferdigstilles før publisering.

## Omfang

- ukeplan per organisasjon, målgruppe og `week_start_date`;
- strukturbevarende DOCX-lesing, inkludert tabeller og kildeposisjon;
- beskjeder, mål, økter/tid, fag, mottakere og oppgaver i samme kandidat;
- serverlagret utkast, mapping, varsler og redigering;
- menneskelig kontrollpunkt før publisering;
- immutable revisjoner, audit og rollback av aktiv revisjon;
- eksakt og kanonisk dokumenthash;
- treveis sammenslåing ved reimport;
- stabile oppgave-/øktidentiteter og vern av elevstatus/XP;
- multi-klasse-dokument med eksplisitt mapping.

Valg av ekstern KI-tjeneste, automatisk publisering og automatisk endring av
permanent grunntimeplan er utenfor epicen. Piloten beholder lokal tolking til
annen behandling er eksplisitt godkjent.

## Importflyt

1. Valider filtype, arkivstruktur, størrelse og sikkerhetsgrenser.
2. Beregn eksakt SHA-256 og kanonisk innholdshash.
3. Les avsnitt, tabeller, rader og celler til en dokumentstruktur med
   kildepekere.
4. Tolk én typed kandidat med uke, målgrupper, økter, beskjeder, mål og
   oppgaver.
5. Lagre kandidat og parser-versjon som et serverbundet utkast.
6. La lærer løse klasse-/fagmapping, lav sikkerhet og manglende felt.
7. Diff mot aktiv planrevisjon og vis uendret, ny, endret, fjernet og konflikt.
8. Publiser valgte avgjørelser i én autorisert transaksjon med forventet
   planversjon.
9. Opprett ny immutable revisjon og audit med tekniske ID-er/tellinger.

## Reimportregler

- Identisk filhash: no-op og «allerede importert».
- Semantisk likt innhold med endrede Word-metadata: kanonisk no-op.
- Nytt element: foreslå legg til.
- Kun kilden endret: oppdater automatisk hvis Klar-feltet fortsatt matcher
  forrige importbase og elementet ikke har elevhistorikk. En vesentlig endring
  i innhold en elev allerede har sett, skal lage ny versjon eller iterasjon for
  framtidig bruk; elevens historiske snapshot omskrives aldri.
- Kun Klar endret: behold lærerens endring.
- Begge endret ulikt: konflikt side ved side; Klar-versjonen er forhåndsvalgt.
- Fjernet, urørt element: foreslå arkivering og krev godkjenning.
- Fjernet oppgave med elevaktivitet: bevar identitet, status, vedlegg og XP;
  trekk den eventuelt fra framtidig visning, aldri hard-slett.
- Fuzzy treff kan foreslås, men aldri slås sammen lydløst.

## Foreslått domenemodell

- `weekly_plans` med unik organisasjon/målgruppe/ukestart og `lock_version`;
- `plan_revisions` med immutable snapshot og forrige revisjon;
- `plan_imports` med hasher, parser-versjon, aktør, mapping og tilstand;
- `plan_import_items` med type, `logical_key`, kildepeker, normalisert payload,
  hash, confidence, konfliktvalg og live-ID;
- stabile entiteter for økt, beskjed og mål;
- stabil lenke mellom planoppgave, oppgavedefinisjon og iterasjon;
- organisasjonsbundet fagregister med aliaser.

Den permanente grunntimeplanen og ukentlige forekomster/overstyringer skal være
ulike begreper. Import kan foreslå endring av grunntimeplan, men krever en egen
navngitt handling og bekreftelse.

## Gjennomgangs-UI

- Førstesiden viser kilde, uke, målgrupper, parser, varsler og telling per
  kategori.
- Innhold grupperes i økter, beskjeder, mål og oppgaver; læreren kan redigere
  direkte uten å miste kildeverdien.
- Konflikter viser base, gjeldende Klar og ny kilde med tydelig valgt resultat.
- Mobil bruker sekvensielle kort per seksjon; iPad/PC kan bruke side-ved-side.
- Publiseringsknappen er utilgjengelig før obligatorisk mapping og konflikter
  er løst, men den skal forklare hva som mangler.
- Bekreftelsen oppsummerer berørte klasser, uke, nye/endret/arkiverte elementer
  og om eksisterende elever påvirkes.

## Akseptansekriterier

- [ ] Tabellbasert DOCX bevarer dag, tid, fag og kildeposisjon.
- [ ] Én kandidat kan inneholde alle fire domeneområdene samtidig.
- [ ] Utkast overlever refresh og er bundet til riktig bruker/org/uke/import.
- [ ] Samme fil og semantisk samme fil gir ingen duplikater.
- [ ] Treveis merge skiller kildendring fra manuell lærerendring.
- [ ] Konflikt krever eksplisitt valg og beholder Klar som standard.
- [ ] Oppgave med elevhistorikk/fullføring beholder ID, innholdssnapshot,
  status og XP ved reimport/fjerning.
- [ ] Vesentlig kildeendring av en oppgave med elevhistorikk oppretter ny
  versjon/iterasjon og omskriver ikke innhold eleven så.
- [x] Første manuelle publisering er atomisk, idempotent og avvises ved stale
  planversjon.
- [ ] Aktiv revisjon kan rulles tilbake uten å slette senere historikk.
- [ ] Multi-klasse-mapping kan ikke lekke eller publisere på tvers av org.
- [ ] Grunntimeplan endres aldri som sideeffekt av ukeimport.
- [ ] UI fungerer med tastatur, skjermleser, 200 % zoom, mobil, iPad og PC.

## Tester og ferdigbevis

Testkorpus skal dekke tabeller, fritekst, kombinasjonsdokument, identisk og
kanonisk reimport, nye/endrede/fjernede elementer, alle treveisgrener,
konkurrerende lærere, week 1 på tvers av år, multi-klasse, fullført oppgave,
transaksjonsfeil og rollback. Korpus skal bruke syntetiske data uten virkelige
elevopplysninger.

Epicen er ferdig når importen kan demonstreres ende-til-ende fra representativ
DOCX til publisert revisjon og trygg reimport, med databasetester, auditbevis og
ingen duplikat eller historikktap.

Delbeviset for den første manuelle planrevisjonen finnes i
[Kontrollpunkt C1](../qa/CONTROL_POINT_C1.md). Det lukker ikke Smart Import-
epicen.
