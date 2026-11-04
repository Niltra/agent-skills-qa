# agent-skills-qa

Seis skills para agentes que auditan una web con evidencia. Sin claves de API, sin modelos, todo local.

![rompelayout](docs/rompelayout.png)

## Las skills

| Skill | Qué demuestra | Estado |
|---|---|---|
| [`rompelayout`](skills/rompelayout) | dónde se rompe la web al cambiar de idioma | motor + tests |
| [`contraste-real`](skills/contraste-real) | si el texto se lee encima de una foto o un degradado | motor + tests |
| [`formulario-que-no-miente`](skills/formulario-que-no-miente) | si el formulario falla al enviar vacío, con doble clic o sin lector de pantalla | motor + tests |
| [`lector-de-pantalla`](skills/lector-de-pantalla) | qué oye de verdad un lector de pantalla y cuánto ruido hay | motor + tests |
| [`dice-vs-hace`](skills/dice-vs-hace) | si el agente dice la verdad al cerrar una tarea | procedimiento |
| [`declaracion-eaa`](skills/declaracion-eaa) | la declaración de accesibilidad y el expediente que pide la EAA | procedimiento |

## Por qué juntas

La EAA se aplica desde junio de 2025. Comercio y servicios cubiertos necesitan una declaración de accesibilidad **publicada** y un **expediente** que la respalde. La automatización detecta en torno al 57% de los problemas; el resto es manual y hay que documentarlo.

```
contraste-real ─┐
lector ─────────┤
formulario ─────┼─→ evidencia fechada ─→ declaracion-eaa
rompelayout ────┤
dice-vs-hace ───┘   (nada se declara sin prueba)
```

![contraste-real](docs/contraste.png)

## Instalar

Copia cada carpeta de `skills/` a `~/.config/opencode/skill/` o `~/.claude/skills/`.

Los cuatro motores usan Playwright. En la máquina donde los ejecutes:

```bash
npm install playwright
npx playwright install chromium
```

Cada skill se activa por su descripción; no hay que invocarla a mano.

## Uso

```bash
node ~/.config/opencode/skill/rompelayout/rompelayout.mjs "https://tuweb.com/{locale}/" --locales es,en,de
node ~/.config/opencode/skill/contraste-real/contraste.mjs https://tuweb.com --level AA
node ~/.config/opencode/skill/formulario-que-no-miente/formulario.mjs https://tuweb.com/contacto
node ~/.config/opencode/skill/lector-de-pantalla/lector.mjs https://tuweb.com
```

Salen con 0 si está limpio, 1 si encuentran algo y 2 si no se puede medir. Ese 2 es el que evita el falso aprobado.

## Configuración

Cada skill con motor lee su `config.json`. Precedencia: **defaults → `config.json` → `--config otro.json` → flag**. Un flag desconocido, vacío o no numérico falla en vez de desactivar el umbral.

```json
{ "level": "AA", "target": null, "width": 1280, "maxItems": 30 }
```

## Tests

```bash
npm test              # contrato de las skills + los cuatro motores
npm run test:package  # cada skill copiada sola
npm run conformance   # 47 casos con verdad conocida
npm run consistency   # los cinco parsers se comportan igual
npm run fuzz          # contraste: 586 bloques generados
npm run fuzz:layout   # layout: 60 cajas generadas
npm run fuzz:lector   # lector: 300 comprobaciones generadas
npm run test:launch   # skill-launch (Python + Pillow)
```

Todo corre contra fixtures que rompen a propósito. Sin red, sin claves, sin modelos.

```
ok: 6 skills cumplen el contrato
ok: 2 hard breaks + 2 ellipsis, clean locales pass, bad flags fail, config respected
ok: AA gradient, AAA borderline, WCAG numbers exact, config respected, bad flags fail
ok: 7 checks catch the liar, 7 pass on the honest form, config respected
ok: 8 ruidos, pagina limpia, idioma, casos raros, SPA y errores de uso
```

## Banco de conformidad

`npm run conformance` ejecuta 47 casos generados en local, cada uno con un defecto conocido y el resultado esperado escrito de antemano. Sin red, sin claves, sin webs de terceros.

Cubre ratios WCAG exactos (21, 4.54, 3.03), alfa, texto sobre degradado, texto con degradado recortado, `mix-blend-mode`, opacidad, `sr-only`, texto invisible, texto solo en iframe, roturas por idioma, recorte por ancestro, el mismo fallo en base y destino, `ellipsis` intencionado, SVG, ancho de 375 px, canvas 3D, contenido revelado al hacer scroll, shadow DOM, SPA con render diferido, nombres con comillas y barras, RTL, formulario GET, select vacío, `contenteditable` y `role="status"`.

## Fuzz

Tres generadores crean casos aleatorios con la respuesta calculada de antemano:

```bash
npm run fuzz          # contraste: calcula el ratio WCAG por su cuenta y lo compara
npm run fuzz:layout   # layout: cajas que caben o no caben por diseño
npm run fuzz:lector   # lector: defectos y elementos limpios, con su veredicto
```

Última ejecución: 586 bloques de contraste, 60 cajas de layout y 300 comprobaciones del lector, con **0 falsos positivos y 0 falsos negativos**. `--seed` y `--pages` cambian la muestra.

## Scroll, animaciones y 3D

- **Scroll**: `rompelayout`, `contraste-real` y `lector` recorren la página antes de medir. Se desactiva con `--scroll false`.
- **3D / WebGL**: el texto dentro de un `<canvas>` no existe en el DOM y no se puede medir. Los motores informan del porcentaje de pantalla que ocupa el canvas; si es casi toda la página, `contraste-real` sale con 2 en vez de dar un falso aprobado.
- **Lo que no hace**: leer texto rasterizado dentro del canvas. Eso pide OCR y no está.

## Fuentes

- [`SOURCES.md`](SOURCES.md): cada número que aparece aquí, con enlace.

## Extra

[`tools/skill-launch`](tools/skill-launch) genera la tarjeta social, el GIF, el README y los borradores de lanzamiento de cualquier skill.

## Licencia

MIT.
