# Kontrollpunkt D3 – Fag og oppgaver

**Status:** Implementert og automatisk verifisert 17. juli 2026. Fysisk
D3-retest med VoiceOver/NVDA gjenstår.

**Epic:** [E01 – Elevens dag og oppgaveflyt](../epics/E01_STUDENT_DAY_AND_TASK_FLOW.md)

**Kontrakt:** [Domenekontrakten](../product/DOMAIN_CONTRACT.md), særlig § 6,
§ 7 og § 12

## Mål for slicen

D3 gir eleven en sekundær oversikt over alle oppgaveiterasjoner som eleven kan
se nå, gruppert etter fag. «Dagen i dag» forblir startsiden og den aktuelle
undervisningsøkten beholder førsteprioritet. Fagoversikten skal gi orientering,
ikke innføre en parallell oppgavestatus eller en ny måte å fullføre på.

Eleven åpner en fagdetalj og bruker den eksisterende oppgavedialogen,
fullføringssjekkpunktet, XP-operasjonen, angrehandlingen og den kontekstuelle
hjelpeflyten. Samme assignment er samme oppgave i begge elevflater.

## Kildegrunnlag og valgte referanser

- Produkteierens egen fortellerstemme i
  [videoomvisningen](../../Prototypen/Videoomvisning/README.md) er historisk
  produktintensjon, ikke bakgrunnslyd. Ved 08:10 forklares «Fag og oppgaver»
  som en samlet, sekundær oversikt ved siden av dagens økter.
- [08:10 – Fag og alle oppgaver](../../Prototypen/Videoomvisning/00-08-10-all-tasks.png)
  gir kortenes informasjonsrekkefølge: symbol, fagnavn og konkret
  fullføringstelling.
- [Fagoversikten](<../../Prototypen/E%20fag%20og%20oppgaver-visning.jpg>)
  brukes for rolig kortgrid og faglig gjenkjenning. Rød arkivbadge, skjult
  ferdiginnhold, «LEVEL» og kontinuerlig spillbevegelse porteres ikke.
- [Elevmenyen](<../../Prototypen/E%20hamburgermeny.jpg>) brukes for den lille
  elev-IA-en. D3 viser bare destinasjonene som faktisk finnes: «Dagen i dag»
  og «Fag og oppgaver». Draweren åpner fra samme venstre side som knappen.
- [Fagdetaljen](../../Prototypen/e4.jpg) brukes for fagidentitet og
  oppgavehierarki. Den store legacy-heroen, arkivknappen og direkte
  klientmutasjoner porteres ikke.
- [UI/UX-referansen](../product/UI_UX_REFERENCE.md) er autoritativ for
  responsiv komposisjon, språk, symbolbruk, farge som sekundær støtte og
  tilgjengelighet.
- `origin/master` er kun historisk flytspor. Gammel Supabase-tilgang, RLS,
  klientberegnet progresjon og egne statusmutasjoner importeres ikke.

## Produktbeslutninger

1. Katalogen viser publiserte assignments i elevens nåværende organisasjon og
   aktive klassemedlemskap når `visible_from` er passert. Framtidige
   assignments og historiske, avsluttede klasseomfang skal ikke lekke.
2. Fag er den trimmede, normaliserte fagteksten på oppgavedefinisjonen.
   Manglende fag samles under «Andre oppgaver». Store/små bokstaver alene
   oppretter ikke to fag.
3. Fullførte fag og oppgaver blir stående rolig i samme oversikt. D3 har ikke
   et elevarkiv og bruker ingen alarmbadge.
4. Fagkortet er én lenke og viser tekstlig telling i tillegg til symbol og
   pastellflate. Når eleven har valgt fremdriftsvisning, vises også «x av y»,
   et rolig statusord og en tilgjengelig fremdriftsindikator. I stille modus
   vises bare antall oppgaver; farge er aldri eneste identifikator.
5. Fagdetaljen viser uferdige og gjenåpnede oppgaver før ferdige oppgaver,
   uten å omskrive den autoritative rekkefølgen eller statusen.
6. Oppgaveåpning muterer ingenting. Fullføring og angre bruker de samme
   versjonssjekkede serverhandlingene som dagsflaten.
7. Elevmenyen inneholder ingen døde lenker til timeplan, belønninger, chat
   eller andre planlagte funksjoner.
8. D3 endrer ingen XP-, milepæl-, belønnings- eller planregel og innfører
   ingen browsermutasjon eller tabellgrant. Den autentiserte elevrollen får
   bare `execute` på én caller-bound, read-only katalog-RPC.

## Autorisasjons- og lesegrense

- Elevsesjonen autoriseres før kataloglesing. RPC-en binder aktøren til
  `auth.uid()` og bruker ett transaksjonstidspunkt for hele projeksjonen.
- RPC-en binder elevidentiteten til assignment-radene og gjør indre join mot
  aktivt organisasjonsmedlemskap og aktivt klassemedlemskap. Den returnerer
  bare publiserte definisjoner der `visible_from` er passert.
- Bare `authenticated` kan kjøre RPC-en. `anon` og `service_role` er eksplisitt
  nektet, og runtime-tjenesten bruker elevens sesjonsklient – ikke en
  service-role-lesing.
- Et medlemskap som er avsluttet før katalogkallet gir tomt omfang selv om
  oppgavehistorikken fortsatt finnes. Klassearkivering følger foreløpig den
  eksisterende medlemskapsmodellen; dersom arkivering skal avslutte all
  pedagogisk tilgang, må det løses systemisk i medlemskap, RLS og progresjon,
  ikke bare i D3-projeksjonen.
- Eleven kan bare utløse eksisterende kommandoer mot egen, fortsatt synlige
  assignment med eksakt `state_version` og `schedule_version`.
- Det innføres ingen direkte skrivetilgang fra browseren.

## Akseptansekriterier

- [x] `/v3/student` forblir landing, med «Dagen i dag» markert i elevmenyen.
- [x] «Fag og oppgaver» viser alle og bare elevens nå synlige assignments fra
  aktive klassemedlemskap, også planlenkede og eldre løse kompatibilitetsoppgaver.
- [x] Framtidige assignments, andre elever/organisasjoner og avsluttede
  klasseomfang vises ikke.
- [x] Fagkortet er én tydelig lenke med symbol, fagnavn og oppgavetelling.
  Valgt fremdriftsvisning styrer om status og fremdriftsindikator også vises.
- [x] Ukjente eller manglende fag får en rolig, tekstbærende fallback uten
  kollisjon i ruteidentiteten.
- [x] Ferdige fag og oppgaver forblir synlige uten arkivbadge eller
  straffende språk.
- [x] Fagdetaljen gjenbruker samme assignment-ID, oppgavedialog, nullvedleggs-
  sjekkpunkt, fullføring, XP, angre og oppgaveknyttet hjelp som dagsflaten.
- [x] Fullføring i fagdetaljen oppdaterer varig status; tilbakeføring eller
  refresh viser samme resultat på begge elevflater.
- [x] Stale fane, dobbeltklikk og retry kan ikke gi ekstra XP eller en ny
  oppgavestatus.
- [x] Draweren åpner fra venstre, har navngitt navigasjon, `aria-current`,
  fokusfelle, Escape, lukkeknapp og fokusretur til menyknappen.
- [x] Hovedoverskriften og fagdetaljens overskriftsstruktur er logisk i
  tastatur- og semantikkontrollene.
- [ ] Den konkrete D3-flyten er retestet fysisk med VoiceOver og NVDA.
- [x] Sentrale trykkmål er minst 44×44 CSS-piksler; fokus er synlig; axe A/AA,
  reduced motion, WCAG-tekstavstand og 200 % reflow består.
- [x] 360×640 bruker én kolonne, 640×360 en kompakt komposisjon, 768×1024 to
  kolonner, 1024×768 og 1440×900 inntil tre rolige kolonner, uten horisontal
  overflow eller at footeren dekker siste kort/fokusmål.
- [x] Chromium og WebKit består funksjonell elevflyt og hele D3s visuelle
  viewportmatrise.

## Ikke-mål

- Ingen tekst-, lyd- eller bildevedlegg. Det krever et eget avklart
  lagrings-, skannings-, personvern- og slettingskontrollpunkt.
- Ingen belønningsclaim, kuponginnløsning, blomsterhage, streak, avatar eller
  klassekonkurranse. Varig blomsterclaim planlegges som neste B2-slice;
  kuponginnløsning er fortsatt uavklart.
- Ingen uke-/timeplanvisning, søk, filter, lærerdefinert fagsymbol/-farge,
  elevarkiv eller automatisk skjuling av ferdig arbeid.
- Ingen ny oppgavestatus, «I gang»-knapp, quizkrav eller egen XP-beregning.

## Responsiv og semantisk retning

- Mobil bruker én kortkolonne med naturlig høyde, 16 px sideinnrykk og
  tilstrekkelig bunnplass til footer og safe-area. Mobil landskap skal ikke
  tvinge kvadratiske kort.
- iPad portrett bruker to kortkolonner; iPad landskap og desktop kan bruke tre.
  Fagdetaljen beholder én rolig leseretning og eksisterende responsive dialog.
- Oversikten har én `h1`, en kort introduksjon og en semantisk liste av lenker.
  Fagdetaljen har tilbakekontroll, symbol, én `h1`, telling og `h2` «Oppgaver».
- Pastellfarge, symbol og fremdriftsstripe støtter gjenkjenning. Fagnavn,
  statusord og telling bærer meningen.

## Baseline før kodeendring

| Port | Resultat 17. juli 2026 |
| --- | --- |
| `npm test` | Bestått: 53 tester i 20 suiter. |
| Git | Ren `3.0`, elleve commits foran `origin/3.0`; ingen push. |

## Verifikasjonsresultat

| Port | Resultat 17. juli 2026 |
| --- | --- |
| Rene tester | Bestått: 57 tester i 21 suiter, inkludert normalisering, stabil ruteidentitet, sortering, fallback og stille fremdriftsmodus. |
| TypeScript og målrettet lint | Bestått uten feil eller advarsler. |
| Tom database | `npm run test:db:staff:empty` bestått, inkludert katalog-RPC, grants, omfang og framtidsskjuling. |
| Representativ oppgradering | `npm run test:db:staff:upgrade` bestått; historisk fullført assignment forblir synlig og avgrenset. |
| Autentisert Chromium | 13 tester bestått, inkludert fullfør/angre/XP fra fagdetalj og varig resultat på dagsflaten. |
| Autentisert WebKit | De samme 13 testene bestått. |
| Visuell Chromium | Oppsett + seks D3-viewporter bestått med axe, trykkmål, tekstspacing, reduced motion og overflow-kontroll. |
| Visuell WebKit | Samme oppsett og seks viewporter bestått. |
| Full kontrollpunktport | `npm run verify:checkpoint` bestått: lint, streng kjernelint, typecheck, 57 tester, produksjonsbuild og 4 offentlige Playwright-tester. Audit hadde ingen high/critical; to moderate transitive PostCSS-funn i Next.js gjenstår fordi foreslått tvangsfiks er brytende. |

## Avvik og retester

1. Realtime-invalidering var først bare montert når fremdrift eller åpen kø
   var synlig. Den ble flyttet til en alltid montert, read-only wrapper og
   retestet i begge nettlesere.
2. Første fagdetalj gjentok fagnavnet som både sidehero og listeoverskrift.
   Den ble strammet inn til én `h1` og én `h2` «Oppgaver», og tastatur-/axe-
   kontrollen ble kjørt på nytt.
3. En visuell oversikt ble først tatt etter at testen hadde scrollet til siste
   kort. Testen nullstiller nå scroll før bildet; ingen baseline ble overskrevet.
4. Gjenåpnede oppgaver fikk først et generelt fremdriftsord. De vises nå som
   «Se på nytt» og sorteres før ferdige oppgaver uten straffende språk.
5. Sluttauditen fant at menyens fokusloop/Escape og oppgaveknyttet hjelp fra
   fagdetaljen var implementert, men ikke direkte bevist av D3-testene. Begge
   påstandene fikk eksplisitte assertions og bestod deretter målrettet smoke
   og hele D3-matrisen i både Chromium og WebKit.

## Kuratert visuelt bevis

De syntetiske skjermbildene og hva hvert bilde dokumenterer finnes i
[`evidence/D3`](./evidence/D3/README.md). De er QA-bevis, ikke pixel-golden-
mastere og inneholder ingen ekte persondata eller hemmeligheter.

## Åpen manuell port

Automatisert WebKit, semantikk og axe erstatter ikke en fysisk skjermleser.
Før E01s samlede enhetskriterium kan lukkes skal meny, fagliste, fagdetalj,
oppgavedialog, fullføring og fokusretur prøves med VoiceOver på iPad/Safari og
NVDA i en støttet desktopnettleser. Faktisk enhet og resultat føres her eller i
runbooken; tidligere A1-runder teller ikke automatisk som D3-bevis.
