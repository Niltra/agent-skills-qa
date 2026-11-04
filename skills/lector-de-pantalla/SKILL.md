---
name: lector-de-pantalla
description: Escribe lo que oye un lector de pantalla al recorrer una web y mide el ruido: imágenes sin alternativa, alt que es el nombre del fichero, textos repetidos, enlaces "leer más", botones sin nombre, saltos de encabezado e idioma declarado que no coincide con el contenido. Úsala antes de publicar una web o cuando axe pasa pero la página sigue siendo inusable con lector.
---

# Lector de pantalla

axe comprueba que existe un `alt`. No comprueba que ese `alt` sirva. El resultado es una página que pasa el escaneo y que, leída en voz alta, dice: "imagen, imagen, imagen, leer más, leer más, botón".

Esta skill no comprueba reglas: reconstruye el árbol de accesibilidad en orden y lo transcribe.

## Cuándo se activa

- axe pasa y aun así la página no se entiende sin verla.
- Antes de publicar una landing, una tienda o un formulario.
- Cuando un cliente pide "que pase el test de accesibilidad".
- Al auditar un tema o plantilla que se repite en mil páginas.

## Uso

```bash
node lector.mjs https://tuweb.com
node lector.mjs ./fixture/malo.html --out shots
```

```
lector: ./fixture/malo.html
15 nodos, 6 imágenes, 4 enlaces, idioma declarado "es"

LO QUE OYE
  banner
    link "logo.png"
      img "logo.png"
    heading "Tienda"
    img "Producto"
    img "Producto"
    img "Producto"
    link "leer más"

RUIDO: 8 problemas

  imagen sin alternativa     el lector no dice nada
  alt = nombre del fichero   logo.png
  alt genérico               imagen
  texto repetido             "leer más" se anuncia 3 veces
  salto de encabezado        h1 -> h3
```

Sale con código 1 si hay ruido y guarda el árbol completo en `shots/lector.txt`.

## Qué comprueba

| Check | Qué detecta |
|---|---|
| `imagen sin alternativa` | `<img>` sin `alt` ni nombre accesible |
| `alt = nombre del fichero` | `alt="hero-final-2.jpg"` |
| `alt genérico` | `alt="imagen"`, `"foto"`, `"logo"` |
| `alt demasiado largo` | más de 125 caracteres: algunos lectores lo cortan |
| `enlace sin nombre útil` | vacío o `"leer más"`, `"aquí"`, `"ver más"` |
| `botón sin nombre útil` | icono sin `aria-label` ni texto |
| `texto repetido` | el mismo nombre 3 veces o más |
| `salto de encabezado` | `h1 -> h3` sin `h2` |
| `idioma declarado incorrecto` | `<html lang="es">` con el texto en inglés |

## Configuración

`config.json`, `--config otro.json` o flag. Precedencia: defaults → `config.json` → `--config` → flag.

| Clave | Por defecto | Qué hace |
|---|---|---|
| `repeatLimit` | 3 | a partir de cuántas repeticiones avisa |
| `maxNodes` | 60 | cuántos nodos imprime en la transcripción |
| `genericAlt` | lista | palabras de alt que no aportan |
| `genericLink` | lista | textos de enlace que no aportan |
| `scroll` | true | recorre la página antes de leer |

## Cómo se arregla

- El `alt` describe lo que la imagen aporta en esa página, no lo que es. Un logo enlazado dice el destino: "Inicio de Acme".
- Si la imagen es decorativa, `alt=""` y el lector la salta.
- Un enlace dice a dónde va: "Ver precios", no "leer más".
- Un botón de icono necesita `aria-label`.
- El `lang` tiene que ser el del contenido real, no el de la plantilla.

## Límites honestos

- No juzga si la descripción es correcta: solo si es útil. Eso lo decide una persona mirando la imagen.
- La detección de idioma necesita unas 100 palabras y un texto mayoritariamente en un solo idioma. En páginas cortas o bilingües no opina.
- Trabaja sobre el árbol de accesibilidad del navegador: no ejecuta NVDA ni VoiceOver.
- **No lee el contenido de los iframes.** El árbol del documento principal no los atraviesa. Un formulario o un widget dentro de un iframe no se audita con esto.
- Sí atraviesa shadow DOM abierto, y sí respeta `dir="rtl"`.
- No revisa contraste ni orden de foco: eso es `contraste-real` y `web-qa-visual`.
- Los nodos sin texto (`banner`, `main`) se muestran en la transcripción aunque no sean un problema.
