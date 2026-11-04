# Bench: qué se ha probado en webs reales

Fecha: 4 de noviembre de 2026. Todos los sitios son públicos y se visitan con `GET`. No se ha enviado nada.

Reproducible con:

```bash
node bench/run.mjs
```

Salida cruda de cada caso en `bench/results/`.

## Resultados

### rompelayout (roturas por idioma)

| Sitio | Idiomas | Fallos nuevos | Revisar |
|---|---|---:|---:|
| mozilla.org | en-US, de | 0 | 0 |
| developer.mozilla.org | en-US, de | 0 | 0 |
| es/de.wikipedia.org · Madrid | es, de | 0 | 0 |
| es/en/fr.wikipedia.org · Madrid | es, en, fr | 0 | 0 |
| wordpress.org | en, de | 0 | 0 |
| php.net/manual | en, de | 0 | 0 |

Cero roturas nuevas. En todos los casos había problemas que **ya existen en el idioma base** (entre 2 y 40) y se descuentan: no los causa la traducción.

### contraste-real (texto sobre fondo real)

| Sitio | Medidos | Por debajo | No medibles | Fuera de captura |
|---|---:|---:|---:|---:|
| mozilla.org | 144 | 0 | 18 | 0 |
| developer.mozilla.org | 109 | 0 | 86 | 0 |
| github.com | 118 | 1 | 16 | 0 |
| stripe.com | 274 | 10 | 155 | 0 |
| es.wikipedia.org · Madrid | 808 | 2 | 3 | 4411 |

## Lo que se verificó a mano

Esta sección es la importante. Todo lo demás son números de una herramienta que puede equivocarse.

| Caso | Qué pasó | Veredicto |
|---|---|---|
| mozilla.org · footer social | 20 avisos en inglés **y** en alemán | Falso positivo: el idioma base ya fallaba. Arreglado descontando la base |
| mozilla.org · tarjetas del launchpad | Decía ratio 1.0 con fondo negro | Falso positivo: la caja incluía el icono del logo y medía el logo, no el fondo de las letras. Verificado con captura: "Firefox" era negro sobre blanco. Arreglado midiendo solo los píxeles que eran letra |
| de.wikipedia.org · índice | 5 avisos de texto cortado | Falso positivo: eran textos `sr-only` de 12 px para lectores de pantalla. Arreglado ignorando cajas menores de 8 px |
| developer.mozilla.org · mandala | 1 aviso de viewport | Falso positivo: texto decorativo dentro de un `<svg>`. Arreglado ignorando SVG |
| developer.mozilla.org · contributor spotlight | Ratio 1.0 sobre blanco | Texto con degradado recortado a las letras: el color calculado no es el pintado. Ahora se marca como no medible |
| es.wikipedia.org · Madrid | 0 medidos y decía "ok" | Falso **aprobado**: la página mide 79.373 px y la captura fallaba en silencio. Arreglado con tope de 16.000 px, contador de descartados y salida 2 si no se mide nada |
| stripe.com · hero | 10 avisos | Al menos uno verificado: el titular es **verde sobre un degradado rosa** (ratio 1.02 en el fotograma capturado). El color cambia con la animación |

## Fallos de la herramienta encontrados y corregidos

1. Comparaba contra un color, no contra el fondo real. Corregido.
2. Contaba problemas que ya existían en el idioma base. Corregido.
3. Medía iconos y logos dentro de la caja del texto. Corregido con máscara de tinta.
4. Marcaba texto `sr-only`. Corregido con el mínimo de 8 px.
5. Fallaba en SVG. Corregido.
6. Daba por bueno un sitio sin haber medido nada. Corregido: ahora sale 2.
7. La captura se cortaba en páginas largas sin avisar. Corregido: tope de 16.000 px y contador.

## Lo que este bench no demuestra

- **No es una auditoría de accesibilidad** de esos sitios. Solo mide contraste y roturas de layout.
- **No mide toda la página** en webs de más de 16.000 px: en Wikipedia se quedan 4.411 elementos fuera.
- **No verifica todos los hallazgos**. Los 10 de Stripe y el de GitHub no se han revisado uno a uno.
- **No prueba formularios en webs de terceros** a propósito: enviar datos a un sitio que no es tuyo no es aceptable. `formulario-que-no-miente` solo se ha probado contra fixtures propios.
- **No sustituye** una revisión con lector de pantalla real.
