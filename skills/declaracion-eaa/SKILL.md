---
name: declaracion-eaa
description: Prepara la declaración de accesibilidad y el expediente de evidencia que exige la European Accessibility Act (EAA / EN 301 549) para webs y apps de comercio y servicios en la UE. Comprueba el salto de WCAG 2.1 a WCAG 2.2 y redacta la declaración pública sin inventar ningún dato. Úsala si vendes en la UE o si un cliente te pide conformidad de accesibilidad.
---

# Declaración EAA

La EAA se aplica desde el 28 de junio de 2025. Multas por país: hasta 100.000 € en Alemania (BFSG), 60.000 € en Irlanda, 50.000 € + 25.000 € en Francia. No es una buena práctica: es una obligación legal.

Cada web o app de servicios en la UE necesita **dos cosas distintas**: una declaración pública de accesibilidad y un expediente interno que la respalde. Casi nadie tiene el segundo, y sin él la declaración es una frase sin pruebas.

## Cuándo se activa

- Webs o apps de comercio electrónico, banca, transporte, e-books o telecomunicaciones en la UE.
- Un cliente pide "conformidad de accesibilidad" o un VPAT/ACR.
- Antes de una compra pública o de una due diligence.
- Cuando cambia el estándar: EN 301 549 v4.1.1 (septiembre 2026) pasa el listón a **WCAG 2.2 AA**.

## Fechas que importan ahora

| Fecha | Qué pasa |
|---|---|
| 28 jun 2025 | La EAA se aplica. Lo que publiques hoy ya debe cumplir. |
| sep 2026 | EN 301 549 v4.1.1, basada en WCAG 2.2 AA. |
| ~dic 2026 | Se espera la cita en el Diario Oficial. Hasta entonces el estándar legal citado sigue siendo v3.2.1 (WCAG 2.1 AA). |
| 28 jun 2030 | Fin de la transición para servicios anteriores a 2025. No es un salvoconducto para lo nuevo. |

Adelantarse a WCAG 2.2 es trabajo que no se tira: es la dirección confirmada.

## Salto 2.1 → 2.2 que hay que revisar

Estos son los criterios nuevos de nivel A y AA. Si vienes de una auditoría 2.1, esto es lo que te falta:

| Criterio | Qué comprueba | Cómo se prueba |
|---|---|---|
| 2.4.11 Focus Not Obscured (AA) | el foco no queda tapado por cabeceras fijas, cookies o banners | recorrer con Tab y comprobar que el elemento enfocado está visible |
| 2.5.7 Dragging (AA) | toda acción de arrastrar tiene alternativa de un solo clic | deslizadores, sliders de precio, reordenar listas |
| 2.5.8 Target Size (AA) | objetivos táctiles de mínimo 24x24 px | medir iconos, cierres de modal, radios |
| 3.2.6 Consistent Help (A) | la ayuda aparece en el mismo sitio en todas las páginas | comparar posición de "contacto" o "ayuda" |
| 3.3.7 Redundant Entry (A) | no se pide dos veces el mismo dato en un proceso | checkout en dos pasos, misma dirección de envío y facturación |
| 3.3.8 Accessible Authentication (AA) | login sin exigir memoria ni puzles cognitivos | pegar contraseña, gestor de contraseñas, sin CAPTCHA de memoria |

Además, 4.1.1 Parsing ya no se evalúa. No lo incluyas como hallazgo: te resta credibilidad ante un auditor.

## Qué se produce

1. **La declaración pública** (`declaracion-accesibilidad.md`), que se publica en la web. Estructura mínima:
   - Fecha de la declaración y fecha de la última revisión.
   - Alcance: qué web, qué apps, qué idiomas, qué quedó fuera.
   - Estado de conformidad: conforme / parcialmente conforme / no conforme, con el estándar y el nivel exactos.
   - Requisitos no cumplidos, uno por uno, con la alternativa que ofrece mientras tanto.
   - Mecanismo de contacto y de reclamación, accesible y con plazo de respuesta.
   - Enlace al procedimiento de aplicación de la autoridad nacional.
2. **El expediente** (`expediente/`), que no se publica:
   - Fecha, herramienta y comando de cada comprobación.
   - Capturas fechadas por página y viewport.
   - Resultado de axe y de las pruebas manuales (teclado, foco, formularios, contraste real).
   - Lista de criterios WCAG 2.2 evaluados, con veredicto y evidencia.
   - Limitaciones declaradas: lo que no se pudo probar y por qué.

## Regla de honestidad

Cada frase de la declaración cita una evidencia del expediente. Si no hay comando o captura, la frase se borra o se marca como limitación. Una declaración con un dato inventado es peor que no tener declaración: convierte un fallo técnico en un problema legal.

No declares "conforme" con gates en rojo. Declara "parcialmente conforme", lista lo que falla y di cuándo piensas arreglarlo.

## Cómo se apoya en las otras skills

| Skill | Evidencia que aporta |
|---|---|
| `web-qa-visual` | consola, overflow, axe, teclado, foco, reduced-motion, SEO |
| `contraste-real` | contraste contra píxeles reales, donde axe no llega |
| `formulario-que-no-miente` | errores anunciados, foco, autocompletado, doble envío |
| `rompelayout` | roturas por idioma, que también son barreras |
| `dice-vs-hace` | que ninguna afirmación de la declaración sea supuesta |

## Límites honestos

- No es asesoría legal. La transposición varía por país y hay que confirmar el régimen nacional.
- Cubre servicios digitales (web y app). Los productos físicos necesitan documentación técnica, declaración UE de conformidad y marcado CE: no es lo mismo.
- La automatización detecta en torno al 57% de los problemas por volumen. Sin pruebas manuales, la declaración no se sostiene.
- La exención de microempresa aplica solo a obligaciones de servicio, no a producto.
- Hasta que la Comisión cite EN 301 549 v4.1.1 en el Diario Oficial, el estándar citado sigue siendo v3.2.1. Se puede y se debe apuntar a 2.2, pero hay que decir a qué versión se declara conformidad.
