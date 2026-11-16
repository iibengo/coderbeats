# Spec 019 · Remixes en el Laboratorio

Estado: hecha (sin probar de oído ni en iPhone). Etiqueta anterior: `lab-v1`. Se añade una pantalla y no se toca ninguna otra (solo `LabShell` gana una opción `hideStyle` y `LabStage` expone el lienzo para el vídeo).

## 1. Qué es
Eliges un remix y **actúas** sus partes: Intro, Subida, Drop y Final como cuatro botones grandes. Nada avanza solo: tocas una parte y entra en el siguiente compás; te quedas en ella lo que quieras. Dentro de cada parte, círculos para encender y apagar capas (como en Capas) y el DJ. «● Grabar mi versión» apunta lo que actúas; «🎬 Mi vídeo» lo comparte.

## 2. Reglas de los remixes del Laboratorio (`app/lib/labRemixes.ts`, tests en `tests/unit/labRemixes.test.ts`)
- Cuatro partes por remix; **como mucho 4 capas por parte**; cada parte arranca con capas que suenan solas en bucle.
- **Contraste:** la Subida no lleva bombo; el Drop lleva todo (ritmo con bombo, caja y platillo, bajo, acordes y tema) y es la parte más llena.
- **El tema se reconoce en los primeros 4 compases:** empieza en el primer compás y cabe en el bucle de 4.
- Se parte de las notas y patrones del Estudio (`remixes.ts`, solo se exportan constantes; el Estudio no cambia); la versión del Laboratorio las agrupa y simplifica (sin el filtro por compás ni el «wowo», sin grupos en paralelo, sin 12 células).
- **Duración ≈ 1 min** (Intro 8 · Subida 4 · Drop 16 · Final 4 = 32 compases: 60 s a 128, 64 s a 120). Test: entre 45 y 90 s.
- **Lo grabado:** hasta 2 min (64 compases a 128 bpm). Cuando faltan ≈ 8 s (4 compases) entra el Final solo y se acaba en el compás justo. «■ Terminar» hace lo mismo antes de tiempo. El vídeo dura exactamente lo que la grabación (se graba la canción resultante).

## 3. Cómo cumple PRINCIPIOS.md
1. **Una pantalla, una cosa:** actuar un remix. ✔ (La grabación y el vídeo son del mismo acto.)
2. **No puede sonar mal:** remixes curados, escala y tonalidad fijas; apagar capas nunca deja la parte vacía por defecto. ✔
3. **Respuesta inmediata:** ⚠ la parte entra **en el siguiente compás** (≤ 2 s), como pediste; el botón y el círculo central parpadean en el mismo instante («entra…»). Las capas y el DJ responden como en Capas.
4. **Se siente mío:** yo elijo cuándo cambia todo y se queda mi versión guardada (clave propia `coderbeats:lab:take:v1`). ✔
5. **Pocas cosas a la vez:** 4 partes + ≤ 4 capas + DJ. ⚠ el DJ es lo más prescindible; se mira en el móvil.
6. **Fácil de compartir:** ✔ vídeo de mi versión (compartir o guardar).
7. **Precedente:** lanzar clips al compás (Ableton Live, Launchpad, Incredibox). ✔
8. **Quitar antes de añadir:** 12 células → 4 partes; sin el wowo ni los grupos. ✔

## 4. Decisiones
- «Escuchar el remix original» pone el remix **del Laboratorio** (≈ 1 min, las cuatro partes con sus capas de salida), no el del Estudio (hasta 4 min), para mantener la duración. El del Estudio sigue en su Remixes.
- Entrar en una parte restablece sus capas de salida.
- Pararlo (■) mientras graba descarta la grabación a medias.
- Al terminar, la grabación se guarda sola por remix (una por remix) y suena sola.

## 5. Sin probar
De oído y en iPhone (sobre todo: el cambio de parte en el compás, el final en el compás justo, el vídeo). En Chrome con guion: `tests/browser/lab-remix.mjs` y `lab-remix-tope.mjs`.

## 6. Pendiente
- **Mozart (Sinfonía n.º 40):** el tema está «de oído»; **no he podido contrastarlo con la partitura** (no hay acceso a la edición; la de IMSLP es la fuente a mirar, compases 1–20). No se han cambiado las notas.
