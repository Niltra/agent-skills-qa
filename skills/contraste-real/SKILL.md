---
name: contraste-real
description: Mide el contraste WCAG real de cada texto contra los píxeles que tiene detrás, incluidas imágenes, degradados, vídeo y overlays, no contra el color declarado en CSS. Úsala cuando axe no pueda decidir, con heroes de imagen, fondos con degradado, texto sobre vídeo o cualquier caso de "no se lee bien".
---

# Contraste real

axe calcula el contraste con el `background-color` del CSS. Si detrás hay una foto, un degradado o un vídeo, axe **no puede** y lo salta. Ahí es donde el texto deja de leerse.

Esta skill mide contra los píxeles de verdad: oculta el texto, captura lo que queda detrás y compara.

## Cuándo se activa

- Texto encima de una imagen, un degradado o un vídeo.
- axe devuelve `incomplete` en contraste.
- Un hero con overlay oscuro y el cliente dice "no se lee".
- Antes de publicar cualquier landing con imagen de fondo.

## Uso

```bash
node contraste.mjs https://tuweb.com --level AA
node contraste.mjs ./fixture/index.html --level AAA --out shots
node contraste.mjs https://tuweb.com --target 7 --width 375
```

```
contraste AA: 4.5:1 normal, 3:1 grande
4 textos medidos, 2 por debajo

ratio  min   texto                              fondo
1.6    3     … > section.hero > h1              #c5b9a1
             "Facturas sin fricción"  52px 700
```

Guarda `shots/contraste.png` con un recuadro rojo en cada texto que falla, y sale con código 1.

## Configuración

Todo se puede fijar en `config.json`, en un `--config otro.json`, o por flag. Precedencia: defaults → `config.json` → `--config` → flag.

| Clave | Por defecto | Qué hace |
|---|---|---|
| `level` | `AA` | umbrales: AA (4.5 / 3) o AAA (7 / 4.5) |
| `target` | `null` | fuerza un ratio mínimo e ignora `level` |
| `width` / `height` | 1280 / 900 | viewport |
| `largeTextPx` | 24 | a partir de aquí cuenta como texto grande |
| `largeBoldPx` | 18.66 | umbral de "grande" si está en negrita |
| `maxItems` | 30 | cuántos fallos listar |
| `settle` | 300 | ms de espera antes de medir |
| `out` | `shots` | carpeta de la captura |

## Cómo mide

1. Recoge cada elemento con texto propio: color, tamaño, peso y rectángulo.
2. Pone todo el texto en `transparent` y quita `text-shadow`.
3. Captura la página entera: esos píxeles son exactamente el fondo de cada letra.
4. Restaura el texto y calcula el contraste contra **el peor píxel** de la caja, no contra la media.

El peor píxel es deliberado: un degradado que aclara por la derecha rompe el texto aunque la media pase.

## Cómo arreglarlo

En orden: oscurecer el overlay hasta que el peor píxel pase; mover el texto fuera de la zona variable de la imagen; cambiar el color del texto. El `text-shadow` no cuenta como arreglo, solo maquilla.

## Límites honestos

- Solo mide texto presente en el DOM en ese momento: no estados hover, modales ni carruseles.
- Necesita que el texto cambie entre la captura con texto y sin texto. Si no cambia (texto tapado), no se mide.
- El texto invisible (mismo color que el fondo) sí se detecta: compara el color del texto con el color dominante de su caja.
- No se mide: texto con `mix-blend-mode`, `filter`, opacidad menor que 1, o degradado recortado a las letras. Se cuentan aparte como "no medibles".
- Tope de 16.000 px de alto por página. Lo que queda por debajo se cuenta como "fuera de la captura".
- Con animaciones se mide el estado final. Si el color cambia con la animación, el número es el de ese fotograma.
- Si no consigue medir ningún texto, sale con código 2. Nada medido no es todo correcto.
- No sustituye a axe: axe sigue siendo mejor para el resto de reglas.
