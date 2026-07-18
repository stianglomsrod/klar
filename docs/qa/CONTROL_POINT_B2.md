# Kontrollpunkt B2 – varig blomsterbelønning

**Status:** Implementert og automatisert verifisert i database, tjenester,
Chromium, WebKit og den responsive visuelle matrisen 18. juli 2026. Fysisk
VoiceOver/NVDA-retest er åpen.

**Epic:** [E02 – Progresjon og belønninger](../epics/E02_PROGRESS_AND_REWARDS.md)

**Kontrakt:** [Domenekontrakten](../product/DOMAIN_CONTRACT.md), særlig § 3.3,
§ 7 og § 10

## Mål for slicen

B2 gjør den første opptjente belønningen i Klar 3.0 reell og varig: Når eleven
har en tilgjengelig belønningstildeling fra en førstegangs nivåmilepæl, kan
eleven frivillig velge farge på ett kronblad. Valget registreres atomisk én
gang, vises i en rolig blomsterhage og består etter angre, lærerretur,
nivåfall, refresh og enhetsbytte.

Slicen bygger videre på B1s XP-ledger, milepæler og unike entitlements. Den
innfører ingen parallell nivåberegning i klienten og ingen browsergrant til
belønningsmutasjoner.

## Kildegrunnlag og valgte referanser

- Produkteierens egen fortellerstemme i
  [videoomvisningen](../../Prototypen/Videoomvisning/README.md) behandles som
  historisk produktintensjon, ikke som bakgrunnslyd. Ved 06:40–06:58 viser og
  forklarer den nivåoppgang, valg av kronblad samt en pågående og ferdig
  blomst. Ved 08:14–08:19 forklarer den at angre åpner oppgaven igjen og
  reverserer poengene. Ved 08:24–08:45 viser den læreropprettede belønninger
  som kuponger eleven kan velge å bruke. Talesporet sier ikke hva som skal
  skje med valgte eller uvalgte belønninger etter XP-reversering.
- At valgt belønning består, og at samme nivå ikke gir ny belønning ved
  gjenvinning, er en senere eksplisitt produktbeslutning i Klar 3.0-arbeidet.
  Den er normativt innarbeidet i domenekontrakten § 7.3 og E02.
- [06:43 – level-up](../../Prototypen/Videoomvisning/00-06-43-level-up.png) og
  [level-up-modalens valgmuligheter](<../../Prototypen/E%20levelupmodal%20med%20valgmuligheter%20NY.jpg>)
  viser valgsituasjonen. Regelen om én varig entitlement per milepæl følger
  domenekontrakten og B1, ikke skjermbildene alene. Modalens store animasjoner,
  konfetti, hoveravhengighet og klientskriv porteres ikke.
- [Fargelegging av nytt kronblad](<../../Prototypen/E%20fargelegging%20av%20nytt%20kronblad%20NY.jpg>)
  brukes for palett, navngitte farger og fem kronblader per blomst.
- [Blomsterhagen](<../../Prototypen/E%20blomsterhage.jpg>) og
  [ny blomst i hagen](<../../Prototypen/E%20ny%20blomst%20i%20hagen%20som%20eleven%20kan%20flytte%20på%20NY.jpg>)
  brukes for samlingsmetaforen. Fri dra-og-slipp, kontinuerlig bevegelse og
  stor tom dekorflate er legacy-uttrykk og blir ikke kjernekrav i B2.
- [Bildeoversikten](../../Prototypen/Bildeoversikt.md) og
  [UI/UX-referansen](../product/UI_UX_REFERENCE.md) er kurateringen av hva som
  skal spores, forenkles eller forkastes.
- `origin/master` og `archive/2x-ui` brukes bare for historisk flytspor. Gammel
  Supabase-tilgang, RLS, klientmutasjoner og klientberegnet progresjon skal
  ikke importeres.
- `origin/master` viser en blandet legacy-atferd: høyvannsmerket hindrer ny
  level-up-prompt, mens angre fjerner høyere ventende nivåer og
  læreropprettede rewards; kronblad lagres separat og beholdes. Denne
  klientstyrte inkonsistensen porteres ikke.

## Produktbeslutninger

1. B2 leverer bare den avklarte, personlige blomsterbelønningen. Kupongvalg og
   innløsning er normativt avklart i domenekontrakten § 10.2 og E09, men ligger
   utenfor B2 og er ikke implementert i dagens pilot.
2. Belønningen er frivillig. Å forlate siden eller lukke nettleseren lar den
   laveste tilgjengelige tildelingen vente; ingenting velges automatisk.
3. Ett valgt kronblad bruker nøyaktig én nivå-entitlement. Den laveste
   tilgjengelige tildelingen velges først, og databasen tildeler kronbladets
   neste uforanderlige samlingsnummer. Fem kronblader danner én blomst; neste
   flower-claim begynner på neste blomst. Klienten kan ikke velge eller
   manipulere plasseringen.
4. Fargepaletten har åtte tekstlig navngitte, kontrastkontrollerte valg:
   rød, turkis, grønn, rosa, lilla, oransje, gul og blå. Farge er aldri eneste
   bærer av valg eller status.
5. Førstegangs milepæl gir kort, rolig feedback i den eksisterende
   oppgaveflyten. B2 tvinger ikke fram en modal. En vedvarende, diskret lenke
   til blomsterhagen gjør at eleven kan velge senere.
6. Når samme nivå gjenvinnes, opprettes verken ny claim, ny entitlement eller
   ny stor feiring. En valgt belønning endres ikke av nivåfall.
7. B2 innfører en separat `flower_rewards_allowed`-ramme med standardverdi
   `false`. Bare en AAL2-verifisert ansatt med `student_support.update` i
   elevens aktive klasseomfang kan åpne eller lukke rammen. Eleven kan ikke
   utvide den.
8. «Blomsterhagen» vises som et reelt navigasjonsmål bare når ansatte har
   åpnet rammen og elevens separate `flower_rewards_visible` er aktiv.
   `progress_enabled` styrer bare poeng- og fremdriftsspråk. Ingen av
   preferansene er claim-autorisasjon. Skjuling er presentasjon; claim,
   entitlement, ledger og milepæler består.
9. Hagen er en rolig, ordnet samling i denne slicen. Dra-og-slipp, fri
   hagekomposisjon, avatar, streak, klassekonkurranse og kupongside er ikke
   B2-mål.

## Autorisasjons- og datagrense

- Den ansattstyrte rammen oppdateres av en egen service-role-RPC etter AAL2- og
  kapabilitetskontroll både i tjenesten og med låst staff assignment i
  databasen. Elevens eksisterende preferanse-RPC kan ikke skrive denne
  kolonnen.
- Belønningsvalg utføres av en service-role-RPC bak en autorisert serveraction.
  RPC-en krever at aktøren er samme elev, at organisasjonsmedlemskapet og minst
  ett elevmedlemskap i en aktiv klasse i samme organisasjon består, at den
  ansattstyrte rammen er åpen, og at entitlements tilhører eleven. Valgte
  belønninger følger dermed eleven ved klasseovergang i samme organisasjon;
  medlemskap i den historiske kildeklassen er ikke nødvendig.
- RPC-en låser entitlement-raden, krever status `available`, oppretter én
  uforanderlig claim og setter entitlement til `selected` i samme transaksjon.
- Request-ID gir retry-idempotens. Samme request med samme fingerprint gir
  samme resultat; samme request med et annet valg avvises. To samtidige,
  forskjellige valg for samme entitlement kan ikke begge lykkes.
- Lesing skjer gjennom en caller-bound RPC med elevens autentiserte
  sesjonsklient. Den binder `auth.uid()` til aktivt medlemskap og returnerer
  bare egne tilgjengelige entitlements og valgte kronblader.
- Browserrollen får ikke `insert`, `update` eller `delete` på progresjons- eller
  belønningstabeller. Claim-historikk er append-only, har eksplisitt RLS/grants
  og kan bygges fra tom database.
- Revisjonshendelsen bruker tekniske ID-er, valgt fargetoken og aktør, uten
  passord, elevkode, TOTP, dokumentinnhold eller unødvendig elevfritekst.

## Akseptansekriterier

- [x] En tilgjengelig entitlement vises etter refresh og kan stå uvalgt uten å
  blokkere oppgaveflyt eller navigasjon.
- [x] Eleven kan velge ett av åtte navngitte kronblad, og valgt resultat
  fremkommer i en varig blomsterhage.
- [x] Samme request kan trygt prøves igjen uten nytt claim eller ny mutasjon.
- [x] To samtidige, forskjellige valg for samme entitlement kan ikke begge
  lykkes.
- [x] En annen elev, ansatt, annen organisasjon, utløpt medlemskap og feil
  entitlement avvises uten informasjonslekkasje.
- [x] Direkte browsermutasjon og kall til service-RPC-en utenfor servergrensen
  er avvist av grants/RLS.
- [x] Claim og entitlement blir enten begge lagret eller ingen av dem.
- [x] Claim-historikken kan ikke oppdateres eller slettes.
- [x] Elevangre og ansattretur kan senke nivået, men valgt kronblad og
  blomsterplass består.
- [x] Gjenvunnet nivå gir ingen duplikatclaim, ingen ny entitlement og ingen
  ny stor feiring.
- [x] Kun en autorisert AAL2-ansatt kan åpne/lukke blomsterhagerrammen for en
  elev i eget klasseomfang; elev, feil klasse, annen organisasjon og utløpt
  ansattoppdrag kan ikke utvide rammen.
- [x] Når ansattrammen lukkes eller eleven skjuler blomsterhagen, forsvinner
  hageinngangen, mens opptjente og valgte data består og kommer tilbake når
  begge lag igjen er aktive. `progress_enabled` styrer poengspråket separat.
- [x] Hagen har én tydelig `h1`, logisk overskriftsstruktur, synlig fokus,
  navngitte fargevalg, status som ikke er fargeavhengig og sentrale trykkmål på
  minst 44×44 CSS-piksler.
- [x] 360×640, 640×360, 768×1024, 1024×768 og 1440×900 har en egen, rolig
  komposisjon uten horisontal overflow eller skjult hovedhandling.
- [x] Chromium består funksjonell elevflyt, axe A/AA, 200 % reflow,
  WCAG-tekstavstand og reduced-motion-kontroll.
- [x] WebKit består samme runtimeport uten Next.js RSC-fallbackfeil.
- [ ] Den konkrete B2-flyten er retestet fysisk med VoiceOver og NVDA.

## Ikke-mål og åpne beslutninger

- Ingen kuponginnløsning, korrigering av brukt kupong eller ansattgodkjenning
  av kupong i B2. Den kontraktfestede flyten hører til E09 og er fortsatt
  utilgjengelig i dagens pilot.
- Ingen generell kapabilitetsmodell for streak, kuponger eller andre
  motivasjonselementer. B2 leverer bare den minste separate ansattrammen for
  blomsterhage og elevens separate valg om å vise/skjule selve hagen.
- Ingen dra-og-slipp, kontinuerlig animasjon, konfetti, lyd, hover-only,
  toppliste, offentlig sammenligning eller farming-loop.
- Ingen endring i XP-trinn, nivåterskler, oppgavestatus eller medievedlegg.

## Baseline før kodeendring

| Port | Resultat 17.–18. juli 2026 |
| --- | --- |
| `npm test` | Bestått: 57 tester i 21 suiter. |
| Git | Ren `3.0`, tolv commits foran `origin/3.0`; ingen push. |

## Verifikasjonsresultat

| Port | Resultat 17.–18. juli 2026 |
| --- | --- |
| `npm run test:db:staff` | Bestått: tom database, representativ oppgradering, RLS/grants, rollback, retry, samtidige claims, claim/undo-race og klasseovergang. |
| `npm run test:e2e:auth -- --spec=tests/e2e/authenticated/student-flower-reward.spec.ts` | Bestått i Chromium: 2 tester. Hele elev-/lærerløkken, axe og sluttbevis i databasen er grønn. |
| `npm run test:e2e:visual -- --spec=tests/e2e/visual/student-flower-reward.visual.spec.ts` | Bestått i Chromium: 7 tester på fem målviewports, 200 % reflow, WCAG-tekstavstand, reduced motion, 44×44-mål, overflow og axe A/AA. |
| `npm run test:e2e:full:webkit` | Bestått 58/58 18. juli, inkludert B2s komplette blomsterflyt, axe/reflow og streng runtimefeilkontroll. |
| `npm run verify:checkpoint` | Bestått 18. juli med lint, kjernelint, TypeScript, enhetstester, produksjonsbuild og offentlig Chromium-E2E. |

## Avvik og retester

- **B2-E2E-01 – service-role-fixture forsøkte direkte insert.** Avvist som
  forventet av tabellgrants. Retest bruker en parameterisert, transaksjonell
  testfixture via den eksisterende vakten for lokal
  `postgres://loopback:54322/postgres`; produksjonsgrants ble ikke utvidet.
- **B2-E2E-02 – sammenfoldet oppgave og skjult radio ga motoravhengige
  testklikk.** Testen bruker nå synlig disclosure-tekst og synlige
  fargeetiketter, slik den faktiske eleven gjør. Chromium-retest er grønn.
- **B2-VIS-01 – sticky toppbar ble sydd inn midt i helsidesbildet.**
  Trykkmålskontrollen hadde scrollet siden før opptak. Retesten går tilbake til
  dokumenttoppen før screenshot; produktlayouten var uendret og alle sju
  visuelle tester er grønne.
- **B2-WK-01 – WebKit/Next.js RSC-runtime, lukket 18. juli.** De første
  rundene viste at testens harde refresh/redirect kunne vinne over en legitim
  RSC-oppdatering og selv skape `access control checks`/`Load failed`. Retesten
  venter på routeroppdateringen og bruker en fersk autentisert side når
  persistens eller redirect skal bevises. `observeRuntimeErrors` er fortsatt
  streng og har ingen allowlist. Full WebKit-matrise bestod 58/58.
- **Arvet testadvarsel utenfor B2, lukket 18. juli:** To uavhengige
  bevisoppslag i D2-fixturen delte én `pg`-klient parallelt. De kjøres nå
  sekvensielt; databaseporten består uten driveradvarselen. Reell samtidighet
  bruker fortsatt separate forbindelser.

Ingen screenshot-baseline er oppdatert for å skjule et avvik.

## Kuratert visuelt bevis

Seks syntetiske B2-bilder og forklaring ligger i
[`docs/qa/evidence/B2/`](./evidence/B2/README.md). Bildene er QA-bevis, ikke
pixel-golden-mastere.

## Åpen manuell port

Automatisert semantikk og axe erstatter ikke fysisk skjermleser. Inngang til
hagen, ventende claim,
fargevalg, bekreftelse, fokusretur og valgt blomst prøves med VoiceOver på
iPad/Safari og NVDA i en støttet desktopnettleser. Faktisk resultat og retest
føres her eller i pilotrunbooken.
