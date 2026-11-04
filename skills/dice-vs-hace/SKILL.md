---
name: dice-vs-hace
description: Verifica lo que el agente afirma antes de decir "listo". Convierte cada frase del resumen ("los tests pasan", "no afecta a nada más", "arreglé el bug") en una comprobación ejecutada, y separa lo demostrado de lo supuesto. Úsala al cerrar cualquier tarea de código, antes de un commit, PR o respuesta final.
---

# Dice vs hace

El fallo que más crece en agentes de código no es escribir mal: es **reportar mal lo que ha hecho**. "Tests pasan" sin haberlos corrido. "Solo cambia este archivo" con cinco tocados. "No afecta a nada" sin mirar quién llama.

Esta skill convierte tu propio resumen en una tabla de evidencia. Lo que no tiene comando detrás, no cuenta.

## Cuándo se activa

- Antes de escribir "listo", "hecho", "funciona" o "tests pasan".
- Antes de un commit, un PR o una respuesta final.
- Cuando el usuario pregunta "¿seguro?".

## Protocolo

1. **Extrae las afirmaciones.** Recorre tu último mensaje y saca toda frase que afirme un hecho: verbos como *pasa, arregla, añade, mantiene, no afecta, compatible, cubierto, funciona*.
2. **Clasifica cada una.**
   - **Ejecutable**: se comprueba con un comando (tests, build, curl, grep).
   - **Verificable por lectura**: se comprueba con una búsqueda en el repo (usos, imports, configuración).
   - **Opinión**: "queda más limpio", "es más mantenible". No se verifica; se declara como opinión y no se vende como hecho.
3. **Ejecuta de verdad.** Sin salida de comando no hay evidencia. No vale "debería".
4. **Escribe la tabla.** Si algo falla, no lo escondas: cámbialo o dilo.

## Tabla de salida

```
| # | Afirmación                  | Prueba                              | Evidencia        | Estado     |
|---|-----------------------------|-------------------------------------|------------------|------------|
| 1 | "los tests pasan"           | npm test                            | 42 passed, 0 failed | VERIFICADO |
| 2 | "no afecta a otros módulos" | grep -rn "parseConfig" src          | 7 usos, 3 rotos  | FALSO      |
| 3 | "queda más limpio"          | —                                   | —                | OPINIÓN    |
```

Estados posibles, sin inventar un cuarto: **VERIFICADO**, **FALSO**, **SIN PROBAR**, **OPINIÓN**.

## Cómo se verifica cada afirmación típica

| Lo que dices | Cómo se prueba |
|---|---|
| "los tests pasan" | ejecutar la suite completa, no la del archivo |
| "el build funciona" | `npm run build` desde cero, sin caché |
| "arreglé el bug" | reproducir el fallo **antes** del cambio y comprobar que ya no ocurre |
| "solo cambié X" | `git diff --stat` y revisar la lista de archivos |
| "no afecta a nada" | `grep` de cada símbolo tocado y ejecutar los tests de los que lo usan |
| "es compatible con v2" | ejecutar con v2 instalado, no razonar sobre la documentación |
| "añadí el campo" | leer el JSON de salida real, no el código que lo escribe |
| "está cubierto" | mirar el reporte de cobertura, no el archivo de test |
| "es rápido" | medir con `--prof` o cronómetro, y decir el número |
| "funciona en móvil" | ejecutar a 375px y adjuntar la captura |

## Reglas que no se saltan

- **Una afirmación sin comando es una opinión.** Se etiqueta como tal.
- **Un comando que falla invalida la afirmación entera.** No se rebaja a "parcialmente".
- **No se oculta el fallo.** Se escribe en la tabla y se dice qué falta.
- **No se verifica ejecutando cosas peligrosas** (deploy, migración, borrado) sin permiso explícito. En ese caso: `SIN PROBAR` y se explica por qué.
- **Si no se puede ejecutar nada**, se dice: "no he podido verificar 4 de 6 afirmaciones". Nunca se da por bueno.

## Límites honestos

- Comprueba que lo que dices es cierto, no que el código sea bueno.
- Un test verde no demuestra que la funcionalidad haga lo que el usuario pidió, solo que pasa ese test.
- No detecta bugs fuera de la cobertura de las pruebas.
- Si el comando tarda demasiado, se ejecuta igual o se marca `SIN PROBAR`; no se estima el resultado.
