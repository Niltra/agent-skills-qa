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

Cada skill se activa por su descripción; no hay que invocarla a mano.

## Uso

```bash
node skills/rompelayout/rompelayout.mjs "https://tuweb.com/{locale}/" --locales es,en,de
node skills/contraste-real/contraste.mjs https://tuweb.com --level AA
node skills/formulario-que-no-miente/formulario.mjs https://tuweb.com/contacto
node skills/lector-de-pantalla/lector.mjs https://tuweb.com
```

Los cuatro salen con código 1, así que valen como gate de CI.

## Configuración

Cada skill con motor lee su `config.json`. Precedencia: **defaults → `config.json` → `--config otro.json` → flag**. Un flag desconocido falla en vez de ignorarse.

```json
{ "level": "AA", "target": null, "width": 1280, "maxItems": 30 }
```

## Tests

```bash
npm test              # contrato de las skills + los cuatro motores
npm run conformance   # 35 casos con verdad conocida
npm run fuzz          # contraste: 586 bloques generados
npm run fuzz:layout   # layout: 60 cajas generadas
npm run test:launch   # skill-launch (Python + Pillow)
```

Todo corre contra fixtures que rompen a propósito. Sin red, sin claves, sin modelos.

```
ok: 6 skills cumplen el contrato
ok: 2 hard breaks + 2 ellipsis, clean locales pass, bad flags fail, config respected
ok: AA gradient, AAA borderline, WCAG numbers exact, config respected, bad flags fail
ok: 7 checks catch the liar, 7 pass on the honest form, config respected
ok: 8 ruidos detectados, pagina limpia aprobada, idioma y errores de uso
```

## Banco de conformidad

`npm run conformance` ejecuta 35 casos generados en local, cada uno con un defecto conocido y el resultado esperado escrito de antemano. Sin red, sin claves, sin webs de terceros.

Cubre ratios WCAG exactos (21, 4.54, 3.03), texto sobre degradado, texto con degradado recortado, `mix-blend-mode`, opacidad, `sr-only`, texto invisible, roturas por idioma, el mismo fallo en base y destino, `ellipsis` intencionado, SVG, ancho de 375 px, canvas 3D, contenido revelado al hacer scroll y las 7 pruebas del formulario una por una.

## Fuzz

Dos generadores crean casos aleatorios con la respuesta calculada de antemano, así que miden precisión y no solo que no reviente:

```bash
npm run fuzz          # contraste: calcula el ratio WCAG por su cuenta y lo compara
npm run fuzz:layout   # layout: cajas que caben o no caben por diseño
```

Última ejecución: 586 bloques de contraste y 60 cajas de layout, con **0 falsos positivos y 0 falsos negativos**. `--seed` y `--pages` cambian la muestra.

## Scroll, animaciones y 3D

- **Scroll**: los motores recorren la página antes de medir, así entra el contenido que solo aparece al hacer scroll. Se desactiva con `--scroll false`.
- **3D / WebGL**: el texto dentro de un `<canvas>` no existe en el DOM y no se puede medir. Los motores informan del porcentaje de pantalla que ocupa el canvas; si es casi toda la página, `contraste-real` sale con 2 en vez de dar un falso aprobado.
- **Lo que no hace**: leer texto rasterizado dentro del canvas. Eso pide OCR y no está.

## Fuentes

- [`SOURCES.md`](SOURCES.md): cada número que aparece aquí, con enlace.

## Extra

[`tools/skill-launch`](tools/skill-launch) genera la tarjeta social, el GIF, el README y los borradores de lanzamiento de cualquier skill.

## Licencia

MIT.
