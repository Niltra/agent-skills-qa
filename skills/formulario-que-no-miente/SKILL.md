---
name: formulario-que-no-miente
description: Prueba un formulario con un navegador real: envío vacío, espacios que no cuentan, doble clic, foco que vuelve al primer campo roto, errores anunciados con aria y autocompletado. Úsala antes de publicar cualquier formulario de contacto, registro, newsletter o pago.
---

# Formulario que no miente

Un formulario pasa la revisión visual y falla en lo de siempre: acepta el envío vacío, pierde el foco cuando aparece el error, manda dos peticiones si el usuario hace doble clic, y el lector de pantalla nunca se entera de que algo falló.

Esta skill lo prueba con un navegador de verdad. No envía nada: intercepta los POST y los cuenta.

## Cuándo se activa

- Antes de publicar un formulario de contacto, registro o pago.
- Cuando llegan mensajes vacíos o duplicados.
- Cuando un usuario de lector de pantalla no sabe por qué no puede enviar.

## Uso

```bash
node formulario.mjs ./fixture/bad.html
node formulario.mjs https://tuweb.com/contacto --out shots
```

```
formulario: ./fixture/bad.html
3 campos, 7 pruebas

  FALLO  nombre accesible       nombre
  FALLO  envío vacío bloqueado  1 peticiones enviadas
  FALLO  error anunciado        sin aria-live ni role=alert
  FALLO  foco al primer error   ningún campo con aria-invalid
  FALLO  espacios no cuentan    1 peticiones enviadas
  FALLO  doble envío            2 peticiones con doble clic
  FALLO  autocompletado         sin autocomplete: nombre, email, tel
```

Sale con código 1 si algo falla, y guarda `shots/formulario.png`.

## Las 7 pruebas

| # | Prueba | Qué debe pasar |
|---|---|---|
| 1 | Nombre accesible | cada campo tiene `label`, `aria-label` o `aria-labelledby`. Un `placeholder` no cuenta |
| 2 | Envío vacío bloqueado | no navega y no dispara ninguna petición |
| 3 | Error anunciado | hay texto en `aria-live` o `role=alert` **y** el campo lleva `aria-invalid="true"` |
| 4 | Foco al primer error | el foco cae en un campo marcado como inválido |
| 5 | Espacios no cuentan | `"   "` no vale como relleno |
| 6 | Doble envío | dos clics seguidos producen **una** petición |
| 7 | Autocompletado | `autocomplete` correcto en email, teléfono y nombre |

## La octava, a mano

| Prueba | Qué mirar |
|---|---|
| Enter y Tab | Enter en el último campo envía; el orden de tabulación sigue el visual; no hay `autofocus` que robe el foco al cargar |

No se automatiza porque depende del diseño de cada formulario.

## Configuración

`config.json`, `--config otro.json` o flag. Precedencia: defaults → `config.json` → `--config` → flag.

| Clave | Por defecto | Qué hace |
|---|---|---|
| `out` | `shots` | carpeta de la captura |
| `width` / `height` | 1280 / 900 | viewport |
| `wait` | 700 | ms de espera tras enviar |
| `settle` | 250 | ms de espera tras cargar |

## Cómo reportar

Tabla con prueba, resultado y evidencia. Sin evidencia no cuenta. Si un campo no se pudo rellenar, se dice: un formulario que no se puede probar no está aprobado.

## Arreglos que valen

- Validar en el cliente **y** en el servidor. El cliente es para el usuario; el servidor es la verdad.
- `aria-invalid` + `aria-describedby` en el campo, y el mensaje en un `aria-live` que ya exista en el DOM.
- Desactivar el botón mientras hay una petición en curso, y reactivarlo si falla.
- Nunca borrar lo que el usuario escribió al mostrar un error.

## Límites honestos

- No prueba el envío real ni mira la bandeja de entrada: cuenta peticiones, no confirma que lleguen.
- No valida reglas de negocio (cupones, stock, edad mínima).
- Los lectores de pantalla se simulan por DOM (`aria-live`, `role=alert`), no se ejecuta NVDA ni VoiceOver.
- No rellena campos dentro de `iframe` ni shadow DOM cerrado.
- El doble clic se dispara en el mismo instante. Un usuario humano tarda más; si el formulario solo se protege por tiempo, esta prueba no lo detecta.
