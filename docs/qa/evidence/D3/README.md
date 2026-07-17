# D3 – kuratert visuelt QA-bevis

Bildene i denne mappen er tatt 17. juli 2026 fra den lokale, syntetiske
Playwright-fixturen for kontrollpunkt D3. De inneholder ingen ekte persondata,
elevkoder, passord, TOTP-hemmeligheter eller eksterne Supabase-data.

De er kuraterte bevis på komposisjon og responsivitet, ikke pixelbaserte
golden-mastere. Historiske bilder i `Prototypen/` brukes som semantiske
referanser; disse bildene viser den implementerte 3.0-atferden.

| Fil | Dokumenterer |
| --- | --- |
| `chromium-360x640-subjects.png` | Mobiloversikt i én kolonne, tydelig faglenke og footerplass. |
| `chromium-640x360-menu.png` | Kompakt mobil-landskap med venstrestilt meny og drawer. |
| `chromium-768x1024-subjects.png` | iPad-portrett med to rolige kortkolonner. |
| `chromium-1440x900-subject-detail.png` | Desktop fagdetalj med én `h1`, `h2` «Oppgaver» og gjenbrukt oppgaveflyt. |
| `chromium-720x450-reflow.png` | 200 prosent reflow-proxy uten horisontal overflow. |
| `webkit-360x640-subjects.png` | WebKit-kontroll av mobiloversikten. |

Kildetestene er
[`student-subjects.visual.spec.ts`](../../../../tests/e2e/visual/student-subjects.visual.spec.ts)
og den funksjonelle
[`student-subjects.spec.ts`](../../../../tests/e2e/authenticated/student-subjects.spec.ts).
Hele matrisen dekker også 1024×768, selv om bare et kuratert utvalg er lagret
permanent her.
