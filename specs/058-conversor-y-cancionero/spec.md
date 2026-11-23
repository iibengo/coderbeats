# Spec 058 · El conversor entra en el repo, con un agente «cancionero» (corta)

## Por qué
Ion quiere que cualquiera (también quien no sabe programar) pueda hacer canciones para coderbeats con Claude Code u opencode y el conversor de notas, y que la herramienta, que va aparte de la app, **siga a la app** (estilo `drill`, sintes nuevos, la forma del Lacrimosa en drill). Hasta ahora el conversor vivía fuera del repo (`~/dev/coderbeats-herramientas`) por culpa de las canciones con derechos de autor que lo rodeaban (2026-11-23).

## Qué entra y qué no
- **Entra:** `tools/conversor/notas-a-json.mjs`, una guía nueva (`guia.md`, sacada de la antigua sin ningún tema con derechos), `AGENTE.md` y `ejemplos/` con **solo cuatro textos**: Himno de la alegría (dominio público) y tres originales (minimal, dub y drill).
- **No entra:** las ~35 canciones de la carpeta privada (Star Wars, Harry Potter, Titanic…), `golden-conversor.json` antiguo, `probar-conversor.mjs`, la guía antigua ni los `.bak`. Siguen **fuera** del repo.
- **Agentes** `cancionero` para Claude Code (`.claude/agents/cancionero.md`) y opencode (`.opencode/agent/cancionero.md`): cortos, remiten a `tools/conversor/AGENTE.md` (una sola fuente de verdad).

## Cómo sigue a la app
- Al conversor: estilo `drill` (140 bpm y patrón de la app) y sintes `coro`, `cuerdas`, `sub`, `stabw`, `leadw`; `--capacidades` imprime lo que sabe.
- `tests/unit/conversor.test.ts`: **falla** si la app tiene un estilo o un sinte que el conversor no (o no está justificado), si un patrón de batería difiere, o si algún ejemplo cambia de `.json` o la app lo rechaza al importar.
- La prueba ya encontró dos desfases: el charles de `dnb` y de `dembow` del conversor no coincidía con el de la app. Se alinearon con la app; el `.json` de `ejemplo-melodia` (dembow) **cambia a propósito** (hash nuevo en la prueba).

## El agente: reglas
Una pregunta cada vez, lenguaje sencillo, **solo dominio público u original** (si piden un tema moderno, ofrece una pieza original con el mismo ambiente, sin copiar su melodía), canciones en `mis-canciones/` (ignorada por git), **sin commit ni push** salvo que se lo pidan, **sin tocar el código de la app**, y **mejorar el conversor solo con permiso y con la prueba en verde**.

## Principios
1 ✔ el agente hace una cosa por pregunta · 2 ✔ el conversor avisa de compases que no suman y de notas fuera de la escala · 3 — no aplica (herramienta de texto) · 4 ✔ la persona decide estilo, melodía y forma · 5 ✔ la forma pide pocas capas y partes (8 y 4) · 6 ✔ el `.json` se comparte por archivo · 7 ✔ el flujo de la antigua guía, que funcionó con canciones reales · 8 ✔ se quita la dependencia de una carpeta fuera del repo.

## Decisiones a revisar
- El agente **no transcribe temas con derechos de autor**, ni siquiera para uso privado (antes se hacía a mano). Si Ion quiere ese uso, solo en su carpeta privada y con otra herramienta.
- Que `mis-canciones/` (ignorada) sea el sitio por defecto de las canciones del agente.
- El conversor no sabe aún: sinte propio para el bajo y los acordes (808 `sub`, `cuerdas`), deslizamiento del 808, volumen por parte, compás distinto de 4/4 y aviso de los límites de 8 partes y 4 capas. Están en la guía como «lo que se puede pedir».

## No comprobado
**Ningún agente se ha probado en una sesión real** (ni en Claude Code ni en opencode): solo he comprobado que los archivos existen y que el conversor y su prueba pasan. Nada se ha oído. El formato de `.opencode/agent/*.md` está escrito de memoria y hay que probarlo.
