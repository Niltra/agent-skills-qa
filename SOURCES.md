# Fuentes

Cada número que aparece en este repo, con de dónde sale. Si una afirmación no está aquí, no se publica.

| Afirmación | Dónde se usa | Fuente | Fecha |
|---|---|---|---|
| 96% de los devs no confían del todo en que el código de IA sea correcto | `PROMO.md`, LinkedIn | [Sonar, State of Code 2026](https://www.sonarsource.com/blog/state-of-code-developer-survey-report-the-current-reality-of-ai-coding/) | ene 2026 |
| Solo 48% verifica siempre antes de commitear | `PROMO.md` | Sonar, misma encuesta | ene 2026 |
| 89% de organizaciones han tenido un incidente en producción relacionado con IA | `PROMO.md` | [Qodo, vía Forbes](https://www.forbes.com/sites/timkeary/2026/10/23/ai-agents-created-ai-code-slop-but-can-they-fix-it/) | oct 2026 |
| El autoinforme inexacto del agente crece como causa de fallo | `dice-vs-hace` | [EMNLP 2026, 20.574 sesiones](https://aclanthology.org/2026.emnlp-main.1011.pdf) | 2026 |
| La EAA se aplica desde el 28 de junio de 2025 | `declaracion-eaa` | [EUR-Lex, resumen oficial](https://eur-lex.europa.eu/EN/legal-content/summary/accessibility-of-products-and-services.html) | — |
| Multas: hasta 100.000 € (DE), 60.000 € (IE), 50.000 € + 25.000 € (FR) | `declaracion-eaa`, `PROMO.md` | Level Access, citado por [A11yFlow](https://www.a11yflow.dev/blog/european-accessibility-act-developer-guide) | 2026 |
| EN 301 549 v4.1.1 (septiembre 2026) adopta WCAG 2.2 AA | `declaracion-eaa` | [AccessibleEU](https://accessible-eu-centre.ec.europa.eu/content-corner/news/european-accessibility-standard-en-301-549-has-been-updated-2026-09-07_en) | 7 sep 2026 |
| La cita en el Diario Oficial se espera hacia diciembre de 2026 | `declaracion-eaa` | A11yFlow, que cita la previsión de la NDA irlandesa | 2026 |
| La automatización detecta en torno al 57% de los problemas por volumen | `declaracion-eaa`, `README.md` | Deque 2021, citado por A11yFlow | 2021 |
| Criterios nuevos de WCAG 2.2 (2.4.11, 2.5.7, 2.5.8, 3.2.6, 3.3.7, 3.3.8) | `declaracion-eaa` | [W3C, WCAG 2.2](https://www.w3.org/TR/WCAG22/) | — |

## Reglas generales, no mediciones

- **"El alemán es más largo que el inglés"**: es la regla de expansión de i18n, no una medición de este repo. Por eso el README no pone porcentaje.
- **Los ratios de los fixtures** (1.6:1, 1.75:1, 3.83:1) sí los mide el motor. Se reproducen con `npm test`.

## Lo que este repo no afirma

- Que sustituya una auditoría manual.
- Que garantice conformidad legal con la EAA.
- Que detecte todos los fallos de layout o de contraste.
