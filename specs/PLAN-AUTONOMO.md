# Plan para seguir sin supervisión (2026-11-15)

> **Léelo entero al reanudar.** La persona **no está** y **no puede aprobar nada**: **no pidas permisos ni hagas preguntas** (ni `AskUserQuestion`). Decide lo más simple, apúntalo en «decisiones a revisar» de su spec y sigue. Al empezar, lee también `specs/ESTADO.md` (qué se hizo y qué quedó pendiente).

## Reglas (no negociables)
1. **Sin push. Nunca.** Un commit por parte, con el pie `Co-Authored-By` que indique el sistema. Rama `main`.
2. **Antes de cada commit:** `npx vitest run`, `npm run typecheck` y `npm run build` en verde. Si algo falla y no se arregla pronto, **no se commitea**: se anota en `ESTADO.md` y se pasa a lo siguiente.
3. **Nada que pueda perder datos guardados** (Mis canciones, calibración, ajustes, IndexedDB de voz): se salta y se anota. No borrar audios ni claves de `localStorage`. No cambiar formatos guardados sin migración y tests.
4. **Si no se puede verificar**, se anota «sin probar» y se sigue; nunca se afirma que algo funciona sin haberlo comprobado.
5. **Si una parte se atasca ~20 min de trabajo**, se deja anotada (qué se probó, qué se sospecha) y se pasa a la siguiente.
6. **Gasto de uso bajo:** respuestas cortas, leer solo lo necesario, probar en el navegador solo lo imprescindible (ver «Herramientas»). No rehacer lo ya hecho.
7. **Seguridad:** nada de evaluar código recibido de fuera; lo importado pasa por los guards estrictos (`isSong`, `isSavedSong`, `isVoiceId`). Los datos de usuario no salen a servicios externos.
8. **No tocar** `tem/` ni `docs/anecdotas.md` (son de la persona, sin versionar).

## Herramientas y trampas conocidas
- **Servidor para probar:** `NUXT_IGNORE_LOCK=1 nohup npx nuxt dev --port 3999 > /tmp/dev.log 2>&1 &` y esperar con `curl` hasta que responda (el puerto 3000 puede ser de la persona: no tocarlo). Pararlo al terminar con `fuser -k 3999/tcp`.
- **Pruebas con navegador:** `tests/browser/*.mjs` (Chrome sin pantalla, micro de mentira). Necesitan `puppeteer-core`: `npm i --no-save puppeteer-core` en un directorio temporal y enlazar `tests/browser/node_modules` (está en `.gitignore`). `window.__engine` y `window.__stage()` existen **solo en desarrollo**; el motor usa `window.__cb` (no tocarlo). El micro de mentira (un pitido) se clasifica como «bombo»: contamina los loops; usar `engine.pilot.begin()` para ignorarlo.
- **Trampas del shell:** **no usar `pkill -f` ni `pgrep -f` con un patrón que aparezca en el propio comando** (se mata el shell). **No usar `sleep` largo seguido de otra orden**: usar `Monitor` con un bucle `until` o ejecutar en segundo plano con `nohup … > log &` y leer el log. No encadenar `tail` sobre procesos largos (no sale nada hasta el final).
- **Specs de referencia:** 009 (piloto/previsualizar), 011 (modos), 012 (sugerencias), 013 (vídeo), 014 (producción), 015 (melodía fácil), 007 (voz), 005 (células, fundir).

## Cola, en este orden (cada parte, un commit)
1. **Bloqueo al cambiar de canción mientras suena** (pendiente en `ESTADO.md`; ya existía antes de la cola, reproducible con `tests/browser/repro-bloqueo-cambio.mjs`). Máximo ~30 min: bisecar dentro de `replaceSong`/`play`/observadores (`useSuggestions`, `usePrefs`), y probar quitar un observador cada vez. Si se arregla: test o guion que lo cubra. Si no, dejar los hallazgos en `ESTADO.md`.
2. **Spec 014 · Producción, fases 1–3 (solo datos, sin tocar el audio):** humanización (swing y variación de volumen opcionales), reglas de variación en las plantillas, automatización por compás y transiciones (uplifter/downlifter, impacto de drop, silencio antes de caer). Funciones puras con tests y código Strudel evaluado en Node. **Opcional por canción/interruptor; las guardadas no cambian.**
3. **Spec 015 · fase 0 y 1:** medir el espacio libre en Jugar (función pura sobre la geometría, con tests en vertical/horizontal/móvil pequeño) y un **teclado de agua mínimo** (`waterToNote` puro con tests: escala, acorde, cuantizado; grabar como loop `'mel'` reutilizando `fxToLoops`/`suggestMelody`), primero **solo en Jugar, un dedo, con zona muerta**, apagable y con deshacer.
4. **Spec 013 · fase 4:** exportar la previsualización (arranca el piloto, micro bloqueado, la etiqueta del piloto queda dentro) y el botón en Mis canciones. IOS: «sin probar».
5. **Mejoras pequeñas anotadas:** fundir con animación/anillo azul; «audio no disponible» en la bola de voz; que fundir no reinicie la música si sonaba; avance a B en la línea de compás.
6. **Calidad sin cambio visible:** tests de más composables y utilidades; rendimiento por frame **solo si se puede medir**. Partir `useAudioEngine.ts`/`AroCanvas.ts` **solo** con tests de apoyo y en pasos pequeños; si hay duda, no.

## Qué NO hacer sin la persona
- Publicar `kits/coderbeats-kits` en GitHub, hacer push, o cambiar la cuenta/datos de nadie.
- Pruebas en iOS/Safari o de oído (se dejan listas y anotadas como «sin probar»).
- Cualquier cambio que rompa canciones guardadas o enlaces compartidos.

## Al terminar o si se acaba el uso
Actualizar **`specs/ESTADO.md`** con: lo hecho (commits), lo saltado y por qué, decisiones a revisar (cada una en su spec) y una **lista corta de qué probar en el móvil, en orden**. Dejar el árbol limpio (sin commits a medias) y el servidor de pruebas parado.
