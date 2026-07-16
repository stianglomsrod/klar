# Klar 3.0 – dokumentasjonskart

Dette området skiller mellom **målbildet for Klar 3.0** og **det som faktisk er
implementert i den avgrensede piloten i dag**. Dokumenter skal aldri bruke et
planlagt krav som bevis på at funksjonen finnes.

## Autoritativ rekkefølge

Ved motstrid gjelder følgende rekkefølge:

1. eksplisitte produktbeslutninger fra produkteier, innarbeidet i
   [domenekontrakten](./product/DOMAIN_CONTRACT.md);
2. masteroppgavens fem designprinsipper og funnene fra den siste evalueringen;
3. de utvalgte Klar-skjermbildene og den dokumenterte oppgaveflyten;
4. øvrig UI og kode fra Klar 2.x som interaksjons- og visuell referanse;
5. eldre dokumentasjon, skisser og tidlige designartefakter som historikk.

For sikkerhet, personvern, data og autorisasjon er 3.0-arkitekturens grenser et
ufravikelig minimum og overstyrer enhver eldre løsning.

Skjermbilder er eksempler på hvordan prinsippene tidligere ble virkeliggjort.
De er ikke en ordre om å kopiere gamle komponenter, datatilganger eller kjente
tilgjengelighetsfeil.

## Start her

- [Domenekontrakt](./product/DOMAIN_CONTRACT.md) – autoritativt målbilde,
  begreper, tilstander, regler og UX-invarianter.
- [UI/UX-referanse](./product/UI_UX_REFERENCE.md) – kuratert visuell og
  interaksjonsmessig retning fra oppgaven, skjermbildene og 2.x-erfaringene.
- [Implementeringsplan](./IMPLEMENTATION_ROADMAP.md) – avhengigheter,
  kontrollpunkter og anbefalt rekkefølge.
- [Epic-oversikt](./epics/README.md) – sporbare arbeidsområder og status.
- [Pilotrunbook](./PILOT_RUNBOOK.md) – det nåværende, avgrensede pilotmiljøet
  og verifiserte driftsgrenser.
- [Visuell QA-mal](./qa/VISUAL_QA_TEMPLATE.md) – matrise og dokumentert
  kontrollpunkt for responsive, tilgjengelige elev- og ansattflater.
- [Kontrollpunkt 0](./qa/CONTROL_POINT_0.md) – arbeidsloop, lokal testharness,
  verifikasjonsstatus og gjenværende porter.
- [Visuell QA for kontrollpunkt 0](./qa/CONTROL_POINT_0_VISUAL_QA.md) – utfylt
  matrise, semantisk vurdering og kjente produktgap.
- [Kontrollpunkt A1](./qa/CONTROL_POINT_A1.md) – implementert
  autorisasjonskjerne med grønne automatiske porter; manuelle enhetsporter
  pågår og loggføres separat.

## Dokumenttyper

| Type | Svarer på | Kan beskrive fremtid? |
| --- | --- | --- |
| Domenekontrakt | Hva Klar skal bety og hvordan reglene henger sammen | Ja |
| Epic | Hvilket avgrenset resultat som skal bygges og bevises | Ja |
| Implementeringsplan | I hvilken rekkefølge avhengighetene skal løses | Ja |
| README | Hva arbeidskopien gjør nå, og hvordan den kjøres | Nei |
| Pilotrunbook | Hva som kan åpnes og verifiseres i gjeldende pilot | Nei |

## Historisk materiale

Rotdokumenter som beskriver Schedule Picker, eldre PWA-arbeid eller
produksjonsstatus ble skrevet for 2.x. De kan forklare tidligere intensjon, men
er ikke krav eller implementasjonsbevis for 3.0. Den gamle UI-koden ligger i
`archive/2x-ui`, og den gamle databasen i `supabase-2x`.

Når et historisk mønster tas inn i 3.0, skal det først uttrykkes i
domenekontrakten eller en epic og deretter implementeres med 3.0-autorisasjon,
serverstyrte mutasjoner og tester.
