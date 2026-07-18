# E08 – Interaktive quizer og lærersjekk

**Status:** Planlagt

**Sist avklart:** 18. juli 2026

**Kontrakt:** [§ 6.4 Interaktiv quiz/test](../product/DOMAIN_CONTRACT.md#64-interaktiv-quiztest)

**Avhenger av:** E01, E02, E04, E05, E06 og E07

## Resultat

Læreren kan lage, versjonere og sende ut en interaktiv quiz/test som en ekte
oppgavetype. Eleven svarer på ett spørsmål om gangen, kan få innhold lest opp,
pause og fortsette, levere med en forståelig advarsel om ubesvarte spørsmål og
få samme robuste fullførings-/XP-regler som andre oppgaver. Læreren ser den
faktiske, leverte besvarelsen og kan la oppgaven stå fullført eller returnere
den.

Første versjon er formativ og lærerreviewet. Den er ikke en karakterprøve og
har ingen automatisk fasit, prosent eller XP etter riktighet.

**Nåtilstand:** 3.0 har ingen quizmodell eller aktiv quizflate. Alt under Q1–Q4
er planlagt målprodukt.

## Historisk intensjon som beholdes

Commit `8677e0a31c0caaaecdaf08fed82afe498e59cf43` viser en tydelig
quizbygger, egne lilla elevflater, ett spørsmål av gangen, tekst-, enkeltvalg-
og flervalgssvar, opplesing, lydsvar og advarsel før levering med ubesvarte
spørsmål. Dette er produktspor som skal reimplementeres på 3.0-domenet.

Legacy-flaten brukte samtidig ord som antydet «riktig» uten å ha en modellert
fasit. Den delen er et avvik og skal ikke kopieres.

## Oppgavedefinisjon

En interaktiv oppgaverevisjon inneholder:

- tittel, fag, kort introduksjon og definert XP-verdi;
- ordnet liste av stabile spørsmål-ID-er;
- spørsmålstekst og valgfri opplesbar støtte;
- primærtype `text`, `single_choice` eller `multiple_choice`;
- ordnede valg med stabile valg-ID-er for valgtyper;
- eksplisitt om frivillig lyd kan supplere eller erstatte primærsvaret; og
- skjemaversjon og opprettet/publisert metadata.

Et publisert spørsmål skal ikke redigeres på stedet. Endring oppretter en ny
definisjonsrevisjon. En assignment snapshoter revisjonen og XP-verdien eleven
mottar; fullføringsforsøket snapshoter assignmentverdien ved levering.
Servervaliderte grenser for antall spørsmål/valg, tekstlengde, lyd og samlet
payload låses i Q1 og deles av lærerbygger, publisering og submit.

## Elevflyt

1. Eleven åpner oppgaven fra dag eller fagoversikt uten «I gang»-status.
2. Introduksjonen forklarer kort hva som skal skje og at svar lagres.
3. Ett spørsmål vises om gangen med tydelig, ikke-stressende progresjon.
4. Svar lagres som privat, serverautoritativt utkast; en kort, minnebundet kø
   holder usynkroniserte endringer ved et forbigående nettbrudd.
5. Eleven kan gå forrige/neste, hoppe over og avslutte for å fortsette senere.
6. «Lever» viser antall ubesvarte spørsmål og lar eleven gå tilbake eller
   bekrefte.
7. Serveren oppretter ett uforanderlig besvarelsessnapshot og fullføringsforsøk
   atomisk, med XP-kredit etter E02.
8. Elevangre eller lærerretur bevarer forsøket og seeder en ny kladd med
   `based_on_attempt_id`. Først neste levering oppretter forsøkssekvens N+1.

Det skal ikke finnes klokke, automatisk videresending, tilfeldig rekkefølge
eller røde feilmarkører i første versjon. Ubesvart er tillatt informasjon, ikke
en valideringsfeil.

## Lærerflyt

### Bygging

Læreren velger «Quiz/test» i oppgavebiblioteket, legger til spørsmål, velger
svartype og forhåndsviser elevvisningen. Byggeren skal ha:

- eksplisitte etiketter og native felt;
- tastaturstyrt rekkefølge med flytt opp/ned som alternativ til drag;
- løpende lagret utkast uten skjult publisering;
- feilmelding ved manglende spørsmålstekst eller manglende valg;
- tydelig skille mellom «Lagre utkast», «Forhåndsvis» og «Publiser revisjon».

### Gjennomgang

Læreren ser spørsmål, det eleven faktisk svarte, ubesvarte spørsmål, frivillig
lyd og forsøkssekvens. Gjennomgangen skal ikke konstruere poengsum. Retur bruker
E01/E02s begrunnelse, audit og XP-reversering. Senere feedbackfunksjoner skal
ikke bygges inn før egne personvern- og modereringsregler er avklart.
Ansatte kan aldri lese elevens aktive utkast; review gjelder bare et levert,
uforanderlig forsøk. Lesing krever AAL2 og aktuelt leseomfang, mens retur i
tillegg krever konkret returkapabilitet.

## Utkast, levering og samtidighet

- Ett aktivt utkast er unikt per elev og assignment og peker til eksakt
  publisert spørsmålsrevisjon og eventuelt `based_on_attempt_id`.
- Spørsmål, valg, utkast, svar, medier og forsøk bindes med sammensatte
  organisasjon-/klasse-/elev-/assignment-nøkler. Strengt validert og
  normalisert payload er fasit; uvalidert JSONB er ikke tillatt sannhet.
- Et interaktivt forsøk er uforanderlig og 1:1 med ett
  `task_completion_attempt`. Browserklienten har ingen direkte read av aktive
  kladder utenfor elevens caller-bound projeksjon og ingen direkte DML til
  quiz-, status-, XP- eller medietabellene.
- Hvert svar lagres med expected draft-/answer-version, request-ID og CAS.
  Stale skriv til samme spørsmål returnerer autoritativ verdi og eksplisitt
  konflikt; ulike spørsmål kan lagres parallelt.
- En ny autentisert enhet leser siste serverkladd og skriver mot samme CAS.
  Det finnes ingen egen «takeover»-tilstand eller skjult last-write-wins.
- Usynkroniserte svar kan bare stå i bruker- og sesjonsbundet minne. De tømmes
  ved logout/utløpt sesjon og lagres ikke varig i localStorage/IndexedDB før
  kryptering, brukerbinding, utløp og sletting er kontraktsfestet.
- Levering låser assignment, utkast og fullføringsstatus, validerer
  forventet task-/schedule-/question-set-/draft-versjon og oppretter
  svarsnapshot, fullføringsforsøk, status, XP og audit i én transaksjon. Utkastet
  lukkes/tombstones og kan ikke skrives etter submit.
- Retry med samme request-ID returnerer samme forsøk. To faner kan ikke levere
  samme forsøkssekvens to ganger; samme request-ID med annen payload avvises.
- Elevangre og lærerretur reverserer bare aktiv XP-kredit, bevarer forsøket og
  seeder en ny kladd. Gjenvunnet nivå oppretter aldri ny milepæl, entitlement
  eller stor feiring.
- Flytt av samme assignment bevarer utkast og forsøk. Eksplisitt reissue lager
  en ny assignment med tom kladd; svar kopieres aldri automatisk.
- Revisjonsloggen lagrer aktør, omfang, attempt-ID, schema/content-hash og
  nødvendig aggregert antall, aldri per-spørsmålstatus, svartekst, valg-ID,
  lydinnhold eller request-payload. Det samme gjelder exceptions og logger.

## Medieport for lydsvar

Tekst- og valgflyten kan leveres før lyd. Lydalternativet skal ikke kunne velges av
læreren eller vises for eleven før E01s mediegrense har avklart og testet
lagringsregion, format, maksimumsstørrelse/-varighet, filkontroll,
tilgangsomfang, oppbevaring og sletting.

Når porten åpnes, skal lyd bruke privat storage og kortlivet,
assignment-/spørsmålsbundet opplasting. Serveren validerer organisasjon, elev,
objektsti, MIME, byteantall og ferdig upload før utkastet kan referere til
filen. Avbrutte/provisoriske objekter får utløp og sikker opprydding. Avspilling
krever ny, kortlivet autorisasjon; ingen offentlig URL eller lydinnhold lagres i
audit. Forfalsket media-ID, annen elevs objekt og sen upload etter levering skal
avvises eksplisitt.

## Tilgjengelighet og responsivitet

- Native radio- og checkbox-semantikk beholdes selv når valgene ser ut som
  store kort.
- Opplesing kan startes, pauses og stoppes og skal ikke starte automatisk.
- Fremdrift og ubesvartstatus formidles med tekst og semantikk, ikke bare farge.
- Fokus flyttes til spørsmålsoverskriften ved kontrollert neste/forrige, men
  ikke ved autosave.
- Lagrestatus bruker en rolig statusflate og annonserer ikke hvert tastetrykk.
- Ubesvartbekreftelsen er en navngitt dialog med fokusfelle, Escape og
  fokusretur. Mikrofontillatelse forklares før systemprompt, og avslag beholder
  primærsvaret uten feiltilstand.
- Sentrale elevmål er minst 44 × 44 CSS-piksler; Safari chrome og
  skjermtastatur kan ikke skjule svarfelt, navigasjon eller «Lever».
- Mobil og iPad portrett viser én kolonne. Landskap og desktop kan bruke et
  rolig oversiktsfelt uten å krympe svarmålene.
- Alle handlinger fungerer med tastatur, VoiceOver, NVDA, Switch Control,
  200 prosent zoom og reduced motion.

## Kontrollpunkter

### Q1 – Definisjon og lærerbygger

- additive tabeller/migrasjoner, RLS og revisjoner;
- tekst, enkeltvalg, flervalg og valgfritt lydsvar;
- utkast, forhåndsvisning og publisering;
- sentraliserte størrelsesgrenser og schema-/payloadvalidering;
- negativ autorisasjon, tom database og upgrade fra gjeldende skjema.

### Q2 – Elevutkast og gjenopptakelse

- ett spørsmål om gangen og opplesing;
- serverautoritativ autosave, refresh, kort nettbrudd og CAS på ny enhet;
- ubesvart advarsel og alternativ betjening;
- ingen oppgavestatus eller XP før levering.

### Q3 – Atomisk levering og lærerreview

- uforanderlig snapshot og forsøkssekvens;
- fullføring/XP, angre og retur;
- retry, to faner, samtidighet og delvis feil;
- lærerreview uten tilgang til aktiv kladd eller falsk korrektmarkering;
- elevangre, lærerretur, ny kladd og nytt forsøk uten milepælfarming.

### Q4 – Samlet rolle- og enhetsport

- owner, lærer, ITO og vikar innenfor/utenfor oppdrag;
- AAL1, annen organisasjon/klasse/elev, utløpt/tilbakekalt oppdrag, avsluttet
  medlemskap og forfalskede assignment-/question-/option-/media-ID-er;
- elev/ansatt i separate browser contexts på samme origin;
- alle målviewports, WebKit, fysisk iPad og skjermleser;
- dokumentert visuell sammenligning mot de kuraterte prototypeflatene;
- privat lydflyt bare dersom medieporten er åpnet; ellers dokumentert fravær
  uten død kontroll.

## Akseptansekriterier

- [ ] Lærer kan publisere en quizrevisjon uten å endre tidligere iterasjoner.
- [ ] Eleven kan besvare tekst, enkeltvalg og flervalg, bruke valgfri lyd når
  medieporten er åpen og fortsette etter refresh.
- [ ] Opplesing er tilgjengelig uten å blokkere øvrige kontroller.
- [ ] Eleven kan levere med ubesvarte spørsmål etter tydelig bekreftelse.
- [ ] Levering, besvarelsessnapshot, status og XP er én atomisk operasjon.
- [ ] XP er identisk uavhengig av svarets innhold og antatt riktighet.
- [ ] Retry og to faner oppretter ikke dobbelt forsøk eller dobbel XP.
- [ ] Angre/retur bevarer forsøk én og seeder ny kladd med korrekt
  XP-reversering; først ny levering oppretter forsøk to.
- [ ] Retur og ny levering rekrediterer XP én gang uten ny milepæl,
  entitlement, claim eller stor level-up-feiring.
- [ ] Flytt bevarer samme kladd/assignment, mens reissue gir ny assignment og
  tom kladd uten automatisk kopiering av svar.
- [ ] Lærer uten aktuelt oppdrag kan verken lese svar eller returnere oppgaven.
- [ ] Ingen UI omtaler svar som riktige eller gale uten en framtidig,
  kontraktsfestet fasitmodell.
- [ ] Lyd er enten fullt privat, validert og oppryddingstestet eller helt
  utilgjengelig i både lærerbygger og elevflate.

## Utenfor omfang

- karakter, resultatprosent, rangering og høyinnsatsprøve;
- automatisk fasit, retting eller KI-vurdering;
- tidsbegrensning, overvåking og juksdeteksjon;
- spørsmålsbank på tvers av organisasjoner;
- tilfeldig rekkefølge eller adaptiv vanskelighetsgrad;
- en generell sjekkliste utenfor oppgave-/forsøksmodellen.

## Ferdigbevis

Epicen er ferdig når definisjon, utkast, levering, review, angre og retur er
bevist fra tom database og representativ upgrade gjennom autentisert E2E,
samtidighets-, rollback- og autorisasjonstester, standardoppgaveregresjon,
visuell QA og fysisk iPad-/skjermleserport, uten poeng- eller
korrekthetslogikk som ikke finnes i kontrakten.
