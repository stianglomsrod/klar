# E1 – visuelle QA-bevis

Bildene i denne mappen genereres av den autentiserte E1-Playwright-flyten med
kun syntetiske lokale data. De dokumenterer verifiserte tilstander og
viewports; de er ikke pixel-golden-baselines og brukes ikke til å godkjenne en
test ved automatisk bildesammenligning.

Filnavnene oppgir rolle, tilstand og viewport. Endringer skal vurderes
semantisk mot `docs/product/UI_UX_REFERENCE.md`, valgt prototypegrunnlag og
akseptansekriteriene i `docs/qa/CONTROL_POINT_E1.md`.

| Fil | Viewport | Dokumenterer |
| --- | --- | --- |
| [`student-hand-360x640.png`](./student-hand-360x640.png) | 360 × 640 | Ikonbasert elevhånd, kompakt aktiv tilstand og footer som ikke skjuler hovedinnhold. |
| [`student-task-help-768x1024.png`](./student-task-help-768x1024.png) | 768 × 1024 | Oppgaveknyttet hånd i den åpne oppgaven uten ekstra begrunnelsesskjema. |
| [`teacher-active-360x640.png`](./teacher-active-360x640.png) | 360 × 640 | Mobilkomposisjon for aktiv kø med tilgjengelige claim/resolve-handlinger. |
| [`teacher-active-1024x768.png`](./teacher-active-1024x768.png) | 1024 × 768 | iPad-landskap med FIFO, ventetid og oppgavekontekst. |
| [`teacher-active-1440x900.png`](./teacher-active-1440x900.png) | 1440 × 900 | Desktopkø med samme semantiske rekkefølge og uten elevsynlig prioritet. |
| [`teacher-natural-closed-1024x768.png`](./teacher-natural-closed-1024x768.png) | 1024 × 768 | Naturlig øktslutt og lukket tilstand etter autoritativ reconcile. |

Bildene er Chromium-dokumentasjon. WebKit kjøres som separat funksjonstest og
skal ikke skrive over disse filene. De er ikke pixel-golden-mastere; ved senere
endringer vurderes hierarki, hovedhandling, kognitiv belastning, symbolbruk,
tilgjengelighet og tone.
