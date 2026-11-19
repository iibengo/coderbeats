# Spec 049 · Visualizador aparte (corta)

## Por qué
Hoy las imágenes de la app viven dentro de sus pantallas (`VisualStage.vue`, 2440 líneas; `LabStage.vue`, un lienzo fijo de 680 × 680) y el vídeo se hace **grabando en tiempo real** lo que se pinta mientras suena el audio. Para un tema como el Lacrimosa en drill (oscuro, pesado, de golpes secos) los nodos y células dicen poco: no transmiten peso ni cortes. Y cada retoque del sonido obliga a pasar por todo el vídeo.

Idea (de Ion, 2026-11-19): **desacoplar el visualizador de la canción**. Una canción ya es datos (loops con la posición de cada golpe, tempo y compases): se puede sacar de ella una **línea de tiempo de eventos** (instante, voz, fuerza) y la energía por compás **sin motor de audio y sin reproducir**, y dibujar desde ahí. Es el primer paso; el segundo (vídeo más rápido que el tiempo real, juntándolo con el audio offline de `specs/PENDIENTES.md`) queda fuera de esta spec.

## Qué es
- **`app/lib/timeline.ts` (puro, con tests):** `songTimeline(song, style)` → `{ bpm, barSeconds, duration, bars, events[], lanes, sections[], barEnergy[] }`. Cada golpe de cada loop encendido se pone en su instante (compás de la célula, vuelta del loop, paso de 16 por compás, tempo de la canción o del estilo). Cinco **carriles** = las cinco voces de la paleta (`Voice`: bombo, bajo, caja, melodía, platillo). Qué sinte va a qué carril: batería (`bd`, `sd`, `hh`) a la suya; `sub` y `bass` al bajo; `hat`, `hatOpen` y la percusión de muestra al platillo; `crash` al platillo; `boom` e `impacto` al bombo; los demás sintes (cuerdas, coro, acordes, melodía) a la melodía; el riser y el downlifter no tienen carril (son subidas, no golpes).
- **`app/lib/visuals/pulso.ts` (puro, con tests):** el primer estilo, **«Pulso»**, **vertical 9:16** (lienzo fijo de **540 × 960**, escalado con CSS): fondo `INK`, **cinco columnas** (una por voz, con su color de `VOICE_HEX`), cada una con una barra cuya altura es la **energía de esa voz en ese instante** (cada golpe suma su fuerza y se apaga rápido: platillo 0,07 s, caja 0,18 s, melodía 0,35 s, bombo 0,30 s, bajo 0,45 s), con una línea clara arriba y un **destello seco** en el golpe; un **suelo** que se ensancha con el bombo (el peso del drop); un **flash** blanco breve al cambiar de sección y su nombre. Pocos elementos, alto contraste.
- **Ruta de prueba `/visual` (solo `nuxt dev`, en `dev/visual.vue`, sin entrar en el build ni en la navegación):** abre un remix por su id (`?r=lacrimosa-drill`), lo dibuja con su propio reloj (reproducir/pausa y un deslizador para ir a cualquier instante, `?t=45` para fijar un instante) con **«▶ con sonido»**, que reproduce el remix con el motor de siempre (como «escuchar el remix original» del Laboratorio) y hace que la imagen **siga su reloj** (`clockNow`: compás y fase de lo que se oye, ya compensada la latencia de salida); el deslizador y `?t=` miran un instante **sin sonido** (el audio no se puede saltar). Gancho `window.__visual` para las capturas del navegador sin pantalla.
- **No cambia nada de lo que existe:** no se toca `VisualStage`, `LabStage`, `useVideoExport` ni el motor.

## Reglas de diseño que cumple (`specs/DISENO.md`)
Fondo negro; un instrumento, un color, el de `VOICE_HEX`; texto de al menos 11 px reales (`fontPx(base, escala)`); **movimiento reducido** (sin flash ni destellos; las barras siguen la energía, que es respuesta al sonido y no un adorno); un solo `requestAnimationFrame`; **sin asignar objetos dentro del bucle de dibujo** (todo se precalcula al construir la escena; la búsqueda de eventos es binaria sobre arrays tipados).

## Principios (`specs/PRINCIPIOS.md`)
1. **Una pantalla, una cosa** ✔ una ruta de pruebas, un estilo, un lienzo; no entra en la app.
2. **No se puede sonar mal** ✔ no toca el sonido.
3. **Respuesta inmediata** ✔ el destello y la barra salen en el mismo fotograma que el golpe.
4. **Se siente tuyo** ⚠ aquí solo se mira (vista previa): no hay toque. Es una herramienta para ver el remix; la autoría sigue siendo del Laboratorio y el Estudio.
5. **Pocas cosas a la vez** ✔ cinco columnas, lo viejo se apaga rápido.
6. **Compartir fácil** ✔ prepara la imagen vertical de las historias; la exportación a vídeo es el siguiente paso.
7. **Precedente** ✔ los visualizadores de audio verticales de reels y de portadas animadas, y la propia investigación de la app (cada gesto, sonido e imagen al instante) ⚠ sin probar con alguien que no conozca la app.
8. **Antes de añadir, quitar** ⚠ se añade un módulo y no se quita nada (no se toca el visualizador actual). Compensa que es **solo desarrollo** y no suma pantallas.

## Decisiones a revisar
- El **tamaño 540 × 960** y la **escala de las barras** (la energía se recorta en 1: con muchos golpes seguidos la barra queda al tope) se eligen a ojo.
- Los **tiempos de caída** de cada voz son una propuesta; se afinan mirando capturas y, mejor, en un móvil.
- Qué sinte va a qué carril (arriba) es una decisión mía; el riser y el downlifter se quedan sin carril por ahora.
- Un segundo estilo («Peso»: una sola forma que late con el 808) y más estilos quedan como idea.

## Hecho y sin hacer
**Hecho (2026-11-19):**
- `app/lib/timeline.ts` (`songTimeline`, `laneOf`, `hitLevel`): 72 compases del Lacrimosa = 1396 golpes, 5 carriles, 8 secciones con sus instantes. Un detalle que salió al mirar las capturas: la línea de tiempo **debe reflejar lo que se oye**, no la fuerza guardada (las cuerdas suaves tienen fuerza 0 y suenan al 33 %); por eso `hitLevel` lleva la fuerza a `suelo`–1 como el audio (0,55 en general; 0,35 el charles; 0,33 las cuerdas). Si se cambian esos suelos en `song.ts`, hay que cambiarlos también aquí.
- `app/lib/visuals/pulso.ts` («Pulso» 540 × 960): cinco columnas, energía con caída por voz, suelo del bombo, flash de sección, textos con `fontPx`, movimiento reducido, sin asignar objetos por fotograma. La barra suma los golpes y se **comprime** (`1 − e^(−1,6·x)`); la melodía pesa 0,55 (suma cuerdas y coro y se comía el contraste con la batería).
- `dev/visual.vue` (`/visual?r=<id>&t=<s>`, solo `nuxt dev`, **no entra en el build**, comprobado): reloj propio, reproducir/pausa y deslizador; gancho `window.__visual`.
- 26 tests (`timeline.test.ts`, `visualPulso.test.ts`). **Capturas del navegador sin pantalla** de siete instantes (intro, estrofa, subida, drop, break, puente y el cambio al drop): la historia del remix se lee (intro solo cuerdas, break solo cuerdas, drop con las cinco voces y el suelo ámbar, flash al entrar el drop).
- **Sincronía con el sonido (comprobada, 2026-11-19):** en el navegador sin pantalla, pulsando «▶ con sonido», se grabó el audio 34 s y se anotó el tiempo que marcaba la imagen: **el grave del Estrofa entra en el audio cuando la imagen marca 13,24 s (en la línea de tiempo, 13,19 s): desfase de +0,05 s**; la imagen avanza a 1,000 s de canción por segundo real y la consola no da errores. En un iPhone/Bluetooth la latencia de salida puede ser otra (`outputLatency()` la estima, no la mide): **sin comprobar**.
**Sin hacer:** el vídeo offline (necesita el audio offline de `PENDIENTES.md`), un selector de estilos y un segundo estilo, probarlo en un iPhone (**60 fps y fluidez sin comprobar**), y ver si a alguien que no conozca la app le dice algo.
