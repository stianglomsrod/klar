# Klar

**Et digitalt hjelpemiddel for elever som trenger støtte til struktur, prioritering og hjelpesøking i skolehverdagen — uten at støtten blir et stigma.**

Klar er designproduktet fra min masteroppgave i digital læringsdesign (OsloMet, 2026): en fungerende PWA-prototype med både lærer- og elevgrensesnitt, utviklet gjennom deltakende design med lærere som meddesignere.

🎬 [Videogjennomgang av prototypen](https://www.youtube.com/watch?v=yg6kgcdzIYM) · 🌐 [Portefølje og mer om prosjektet](https://stianglomsrod.no)

---

## Hva Klar gjør

**For læreren:**
- **Smart Import** — AI-parsing av eksisterende ukebrev til strukturerte oppgaver, timeplaner og beskjeder. Alt tolket innhold går gjennom et redigerbart forhåndsvisningssteg før publisering; det pedagogiske ansvaret ligger alltid hos læreren.
- Klasse- og elevadministrasjon, gjenbrukbare oppgave- og belønningsmaler, hjelpekø-oversikt og vikarbrukere.

**For eleven:**
- Oppgaveliste med tydelig struktur og tidsindikator for gjenstående tid i timen.
- **Hjelpekø** (FIFO) — et lavterskel-alternativ til å rekke opp hånda.
- Opt-in motivasjonssystem: XP, nivåer, blomsterhage med kronblader, belønningskuponger og oppmøtestreak.
- Medieinnlevering (lyd, bilde, kamera) og tekst-til-tale som alternative uttrykks- og støtteformer.

Designet er forankret i fem designprinsipper som utgjør masterens kunnskapsbidrag: universell tilgjengelighet (anti-stigma), tidsbesparelse og lav terskel for læreren, motivasjon gjennom opt-in spillelementer, plattformuavhengighet, og autonomistøtte som stillas — støtte som skal kunne trekkes tilbake etter hvert som eleven mestrer mer.

## Teknologi

Next.js / React / TypeScript · Supabase (autentisering, roller, PostgreSQL med PLpgSQL-migrasjoner) · PWA (responsiv, installasjonsfri, lisensfri)

## Arbeidsform: agentisk utvikling med dokumentert styring

Prototypen er utviklet med AI-agenter som produksjonspartner (GitHub Copilot / Claude Sonnet, Gemini 2.5 Pro), der alle designbeslutninger, funksjonskrav og kvalitetsvurderinger er mine. Styringslaget rundt agentene er dokumentert i repoet:

| Dokument | Formål |
|---|---|
| [`DOCUMENTATION_INDEX.md`](./DOCUMENTATION_INDEX.md) | Inngang til all prosjektdokumentasjon |
| [`PROJECT_DNA.md`](./PROJECT_DNA.md) | Prosjektets mål, prinsipper og rammer — grunnlag for onboarding av nye agenter |
| [`HANDOVER_STATE.md`](./HANDOVER_STATE.md) | Løpende tilstand for å holde sunne kontekstvinduer mellom økter |
| [`TECH_DEBT.md`](./TECH_DEBT.md) | Kjent teknisk gjeld, eksplisitt og prioritert |
| [`CODE_AUDIT.md`](./CODE_AUDIT.md) | Kodegjennomganger og kvalitetskontroll |
| [`FINAL_VERIFICATION_REPORT.md`](./FINAL_VERIFICATION_REPORT.md) | Verifikasjon mot krav før leveranse |

Som eksempel på arbeidsflyten er én enkelt funksjon (Schedule Picker) dokumentert gjennom hele livssyklusen: refaktoreringsplan, implementasjonssjekkliste, testing, visuell guide og sluttbrukerdokumentasjon for lærere.

## Bakgrunn og status

Klar er andre iterasjon av et designprodukt. Forløperen ([pd-app-frontend](https://github.com/stianglomsrod/pd-app-frontend) / [pd-app-backend](https://github.com/stianglomsrod/pd-app-backend), Vue + Django) ble designet med ungdomsskoleelever som meddesignere og fungerte som sonde i masterarbeidet. Klar ble bygget fra grunnen av basert på data fra tre workshops med lærere, og evaluert av lærerdesignerne i den avsluttende workshopen.

**Dette er en forskningsprototype, ikke en produksjonsklar skoleløsning.** Personvern- og ansvarsspørsmål knyttet til AI-parsing i produksjon (databehandleravtaler, prosesseringssted, logging og sletting) er identifisert, men ikke løst. Ingen persondata fra prosjektet er delt med KI-tjenester. Neste naturlige steg er brukertesting med elever.

Demo-tilgang gis på forespørsel: stianglomsrod@gmail.com

---

*Stian Glomsrød · Master i digital læringsdesign, OsloMet 2026 · [stianglomsrod.no](https://stianglomsrod.no)*
