# Plan secundario para seguir sin supervisión (2026-11-16)

> Se aplica **después** de `specs/PLAN-AUTONOMO.md` (mismas reglas, herramientas y trampas: sin push, sin preguntas, un commit por parte con tests + typecheck + build en verde, lo no verificable se anota «sin probar», nada que pueda perder datos guardados). Lee primero `specs/ESTADO.md`. Aprobado de antemano.

## Cola, en orden de efecto sobre coste
1. **Spec 015, fase 2 (el fluido):** ondas de color por nota en el agua (la paleta única: rosa/lila/azul por altura de la nota) y estela del dedo; con la melodía grabada, que se vean las notas al sonar. Reutiliza `AroCanvas` (ondas) y el vigilante de frames (`frameGovernor`); con movimiento reducido, solo un cambio de brillo. Después, las «venas» por los hilos entre células (partículas por `colonyPick.threads`) **solo si se puede medir el rendimiento**.
2. **Spec 015, zona muerta del teclado de agua** alrededor de los botones (como `fxAt` del Escenario) y que «Agua» no se active por tocar el selector o los controles; y guardar el estado en los ajustes si resulta cómodo.
3. **Spec 014, fases 1b–3 (datos):** reglas de variación en las plantillas (`songTemplates`: fill de caja cada 4, hat abierto cada 2, cambio de nota del bajo cada 8) **solo en canciones nuevas** (nunca cambiar las guardadas), automatización por compás (volumen/filtro) y transiciones (uplifter/downlifter con el sinte `riser`, impacto `boom` al caer el drop, silencio antes de caer) — como opción de «Convertir en canción» y de los remixes nuevos. Tests puros y código evaluado en Node.
4. **Mejoras pequeñas anotadas:** «audio no disponible» en la bola de una voz cuyo audio falta; que **fundir** no reinicie la música si sonaba (pasar a B en la línea de compás); animación y anillo azul de fundir (011/005 §21.6); el 👁 de Mis canciones grabable en vídeo.
5. **Spec 015, fase 3 (célula de melodía):** el modo teclado dentro de una célula (la gota entera como instrumento), un botón «+ melodía» que crea una célula libre con solo melodía; la figura generativa (curva de Lissajous en 2D con profundidad) como prototipo opcional; adjuntar por **fundir** (`mergeCells`).
6. **Calidad:** más tests de lógica en composables (`useSuggestions`, `useVideoExport`, `useTutorial`); cobertura de `app/composables/**`; partir `useAudioEngine.ts` solo con tests de apoyo y en pasos pequeños.

## Qué NO hacer sin la persona
Push, publicar `kits/coderbeats-kits`, pruebas en iOS/de oído (anotar «sin probar»), cambiar formatos guardados sin migración y tests.

## Al terminar o si se acaba el uso
Actualizar `specs/ESTADO.md` (hecho con commits, saltado y por qué, decisiones a revisar, qué probar en el móvil en orden). Árbol limpio, servidor de pruebas parado (`fuser -k 3999/tcp`).
