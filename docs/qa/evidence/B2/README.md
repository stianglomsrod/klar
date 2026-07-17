# B2 – kuratert visuelt QA-bevis

Bildene dokumenterer den syntetiske, read-only hagefixturen etter at ett
turkist kronblad er valgt og ett nytt kronblad venter. De ble generert lokalt
17. juli 2026 med:

```text
npm run test:e2e:visual -- --spec=tests/e2e/visual/student-flower-reward.visual.spec.ts
```

Testen velger oransje lokalt i skjemaet for å vise valgt tilstand, men sender
ikke claimen. Alle data, navn og ID-er er syntetiske. Bildene inneholder ingen
passord, elevkode, TOTP, Supabase-nøkkel eller ekte persondata.

## Bilder

| Fil | Kontrollert komposisjon |
| --- | --- |
| [`flower-reward-360x640.png`](./flower-reward-360x640.png) | Smal mobil: én kolonne med store, navngitte fargevalg og synlig hovedhandling. |
| [`flower-reward-640x360.png`](./flower-reward-640x360.png) | Mobil landskap: tett høyde uten horisontal overflow eller skjult handling. |
| [`flower-reward-768x1024.png`](./flower-reward-768x1024.png) | iPad portrett: palett før hage, med tydelig vertikal leseretning. |
| [`flower-reward-1024x768.png`](./flower-reward-1024x768.png) | iPad landskap: valg og samling side om side uten å bli en krympet desktopflate. |
| [`flower-reward-1440x900.png`](./flower-reward-1440x900.png) | Desktop: avgrenset arbeidsbredde, én tydelig claim-handling og rolig hage. |
| [`flower-reward-reflow-200.png`](./flower-reward-reflow-200.png) | 200 % reflow og WCAG-tekstavstand: innholdet forblir lesbart og uten horisontal overflow. |

## Kontrollresultat

- 7 av 7 målrettede Chromium-tester bestått;
- axe A/AA uten kjente avvik;
- sentrale trykkmål minst 44×44 CSS-piksler;
- reduced motion aktivert;
- ingen horisontal overflow;
- én `h1`, navngitte radioalternativer og status som ikke er avhengig av farge;
- ingen tvungen modal, konfetti, automatisk valg eller drag-only-interaksjon.

Bildene er semantiske QA-bevis. De er ikke screenshot-baselines og skal ikke
oppdateres automatisk for å få en test grønn.
