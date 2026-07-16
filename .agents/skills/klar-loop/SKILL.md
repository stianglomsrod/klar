---
name: klar-loop
description: Implementer og verifiser én avgrenset, vertikal Klar 3.0-slice gjennom domene-, sikkerhets-, kode-, nettleser-, tilgjengelighets- og visuell QA-sløyfer. Bruk når Codex skal bygge eller endre en epic, brukerflyt eller kontrollpunkt i Klar og arbeide autonomt frem til et dokumentert grønt checkpoint.
---

# Klar-loop

Arbeid mot ett eksplisitt resultat. Gjenta implementering og kontroll, men
ikke utvid scopet eller fortsett uten stoppvilkår.

## 1. Avgrens slicen

- Bekreft repo, branch og arbeidskopi med `git status --short --branch`.
- Les `README.md`, `docs/PILOT_RUNBOOK.md`, `AGENTS.md`, domenekontrakten,
  implementeringsroadmapet, relevant epic og UI/UX-referansen. Kontroller
  epic-avhengigheter og checkpointets inngangskrav før slicen velges.
- Les bare de delene av `Prototypen/Bildeoversikt.md` og bildene som gjelder
  slicen. Noter både intensjoner og antimønstre.
- Formuler resultat, ikke-mål, akseptansekriterier og nødvendige testbevis.
- Lag en plan med ett aktivt steg. Hold én hovedskribent for kildekode.

Stopp før implementering dersom slicen krever en uavklart produktbeslutning
eller utvider en sikkerhets-/datagrense.

## 2. Etabler baseline

- Kjør de smaleste eksisterende testene som dekker området.
- Inspiser nåværende UI i nettleser når slicen er visuell.
- Registrer eksisterende feil separat; ikke tilskriv dem den nye diffen.
- Ved dataendring: identifiser invarianter, autorisasjonsmatrise, retry,
  samtidighet, audit og migrasjon fra tom database.
- Ved tidsstyrt tilgang eller atferd: bruk autoritativ server-/DB-tid og
  deterministiske grensetester. Ikke bruk lange sleeps eller stol på en falsk
  browserklokke for serverregler.

## 3. Implementer en tynn komplett flyt

- Implementer migrasjon/domene og serveroperasjon før UI når data muteres.
- Behold voksenhandlinger bak AAL2 og klasse-/organisasjonsavgrensning.
- Bruk service role bare på serveren. Ikke gjenaktiver 2.x-klientmutasjoner.
- Legg til målrettede positive og negative tester sammen med atferden.
- Hold diffen liten nok til at den kan vurderes og reverseres som én leveranse.

## 4. Kjør den raske indre sløyfen

Gjenta til målrettet atferd er grønn:

1. Kjør relevante enhets-, tjeneste- og databasetester.
2. Kjør typecheck/lint for endret område.
3. Kjør aktuell Playwright-spec i én primær viewport per berørt rolle.
4. Kontroller axe, tastatur og horisontal overflow i den endrede tilstanden.
5. Ta screenshots og sammenlign semantisk med de valgte prototypebildene.
6. Rett årsaken, ikke snapshotet eller testen, med mindre forventningen er
   dokumentert feil.

Bruk én separat browser context/storage state per aktør på samme
`127.0.0.1`-origin, inkludert eier, lærer, vikar, elev og negative
kryssorganisasjonsaktører når slicen krever dem. Bruk bare lokal Supabase og
syntetiske fixtures.

## 5. Gjennomfør uavhengige kontroller

- Be en read-only-agent kontrollere domene, autorisasjon, datatap og
  samtidighet når det er relevant.
- Be en annen read-only-agent kontrollere visuell retning, responsivitet og
  tilgjengelighet for UI-endringer.
- Gi agentene rå diff, kontrakt, testresultat og screenshots; ikke gi dem den
  ønskede konklusjonen.
- Hovedagenten vurderer funnene og gjør eventuelle kodeendringer.

## 6. Kjør og loggfør fysisk QA når slicen krever det

- Bruk bare en eksplisitt godkjent fysisk enhet, syntetiske data og et navngitt
  lokalt mål. Ikke eksponer eller muter et linket prosjekt.
- Lås starteren til eksakt commit og rent arbeidstre. Kontroller faktisk
  bindeadresse og alle berørte porter, ikke bare loopback.
- Ved LAN-test: bruk minste mulige brannmurregel for eksakt enhet og port,
  verifiser lokal Supabase før eksponering, og dokumenter sikker teardown med
  stoppede tjenester og gjenopprettet brannmur. Logg aldri passord, elevkode,
  TOTP-hemmelighet, cookie eller nøkkel.
- Før én gjennomføringsrad per faktisk kjøring med kandidat, enhet, OS,
  browser/hjelpemiddel, scenario og resultat. Behold mislykkede og delvise
  kjøringer når en senere retest består.
- Stopp den berørte porten ved første avvik. Registrer reproduksjon, retting og
  eier; legg til automatisk regresjon; kjør så samme scenario fysisk på samme
  enhetstype og ny eksakt commit. Automatisk grønt bevis lukker ikke alene et
  fysisk avvik.
- Ved responsivt DOM-bytte: test live orientering/reflow mens fokus står i
  navigasjon, dialog og input. Separate statiske viewports beviser ikke
  fokusoverføring eller bevart tilstand.

## 7. Kjør full kontrollpunktport

Kjør minst:

- `git diff --check`;
- `npm run verify:checkpoint`;
- lokal database-reset og migrasjon fra tom database ved dataendringer;
- direkte negative RLS-/RPC-tester, og oppgradering fra representativ
  eksisterende tilstand når en migrasjon endrer eksisterende strukturer;
- `npm run test:e2e:auth` for autentiserte flater når lokal Supabase er
  tilgjengelig;
- visuell QA ved relevante mål: 360×640, 640×360, 768×1024, 1024×768 og
  1440×900;
- tastatur, 200 % reflow, reduced motion og axe for berørte kjerneflyter.

Ikke bruk et eksternt eller linket Supabase-prosjekt for å gjøre porten grønn.
Ikke oppdater pixel-baselines automatisk.

## 8. Avslutt checkpointet

- Oppdater relevant epic med faktisk status og konkrete test-/QA-bevis.
- Gjennomgå hele diffen, staged filer og hemmelighetsrisiko.
- Commit bare slicen i ett eller noen få naturlige, grønne kontrollpunkter når
  brukeren har bedt om implementering. Push bare ved uttrykkelig beskjed.
- Rapporter hva som er ferdig, hvilke porter som bestod og hva som eventuelt
  fortsatt krever ekte enhet, skjermleser eller lokal infrastruktur.

## Stoppvilkår

Stopp og replannér når ett av disse inntreffer:

- samme feil gjentas to ganger eller tre reparasjonsrunder er brukt;
- en ny produktavgjørelse, destruktiv dataendring eller større scope kreves;
- uventede brukerendringer overlapper slicen;
- sikkerhetsgrensen eller autorisasjonsmodellen er uklar;
- nødvendig lokal infrastruktur mangler.

Manglende Docker eller lokal Supabase er en eksplisitt uverifisert port, ikke
grunn til å rette testene mot pilotmiljøet. Fortsett gjerne statisk arbeid som
ikke trenger infrastrukturen, men marker aldri slicen grønn eller ferdig når en
obligatorisk DB-, RLS-, AAL2- eller E2E-port ikke er kjørt.
