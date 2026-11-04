---
name: rompelayout
description: Detecta qué elementos de una web se rompen al cambiar de idioma. Abre la página en cada locale y señala texto cortado, hijos que se salen de su contenedor y scroll horizontal, con selector exacto y captura con recuadros. Úsala antes de publicar una web multiidioma, o cuando el alemán, el francés o el inglés rompan botones, menús o títulos.
---

# rompelayout

Una web en español se ve bien. En alemán, "Guardar cambios" pasa a "Änderungen dauerhaft speichern" y el botón lo corta. Tú no te enteras hasta que lo ve un usuario alemán.

Esta skill abre la web en cada idioma, mide el tamaño real de cada caja de texto y te dice qué se rompió, dónde y con qué selector.

## Cuándo se activa

- Antes de publicar una web con más de un idioma.
- Cuando alguien reporta "el botón se corta en alemán".
- Al añadir un locale nuevo a un proyecto que ya estaba en producción.
- En CI, para bloquear un deploy que rompe el layout en un idioma.

## Uso

```bash
# URL remota: {locale} se sustituye por cada idioma
node rompelayout.mjs "https://tuweb.com/{locale}/" --locales es,en,de

# Local, móvil
node rompelayout.mjs "./site/{locale}.html" --locales es,en,de --width 375
```

Salida:

```
locale  problemas
es      0
en      0
de      3

de  → ./shots/de.png
  [child-out ] header.nav > nav.nav-links
               "Startseite Funktionen Preisgestaltung Datenschutzerklärung"
  [clipped-x ] div.card > h2
               "Grundstücksverkehrsgenehmigung"
```

Código de salida 1 si un idioma que no es el base rompe. El primero de `--locales` es la referencia.

## Qué significa cada check

| Check | Qué ha pasado |
|---|---|
| `clipped-x` | el texto no cabe a lo ancho y el CSS lo recorta (`overflow: hidden/clip`, `text-overflow: ellipsis`) |
| `clipped-y` | el texto no cabe a lo alto y se recorta |
| `child-out` | un hijo se sale de un contenedor que recorta: típico menú o fila de tags |
| `viewport` | el elemento se sale del ancho de la pantalla |
| scroll horizontal | la página entera gana scroll lateral solo en ese idioma |

## Cómo leer el resultado

1. Mira la captura primero: los culpables van con recuadro rojo.
2. El selector es el camino desde `body` hasta el elemento. Reproduce el fallo con ese selector, no a ojo.
3. Arreglo habitual: quitar el `white-space: nowrap`, permitir `flex-wrap`, cambiar ancho fijo por `min-width` + `max-width`, o bajar el tamaño de fuente por debajo de cierto ancho con `clamp()`.
4. Vuelve a ejecutar. Sin salida nueva, no hay arreglo.

## Límites honestos

- Recorre la página antes de medir, para que aparezca el contenido que depende del scroll.
- El contenido dentro de un `<canvas>` (3D/WebGL) no se puede medir: se informa del porcentaje de pantalla que ocupa.
- No traduce. Le das la URL de cada idioma ya traducida.
- Solo ve el estado inicial de la página: no abre modales, menús ni hover.
- Un texto que se desborda *sin* recorte no lo marca. Solo detecta recorte, escape de contenedor y salida de viewport.
- Iguala contra el **idioma base**: lo que ya está roto ahí no cuenta como fallo de traducción.
- Un recorte con `text-overflow: ellipsis` se marca como "revisar", no como fallo: puede ser intencionado.
- Ignora `<svg>` y cajas menores de 8 px (textos `sr-only` para lectores de pantalla).
- No compara píxeles entre idiomas. Para regresión visual están Percy, Chromatic o los snapshots de Playwright.
- No detecta solapamientos ni texto encima de una imagen.

## Criterio de terminado

Un idioma pasa cuando `problemas` es 0 a 375px y a 1280px, y la captura no muestra ningún recuadro rojo. Si no se puede ejecutar, se dice; no se estima.
