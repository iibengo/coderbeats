# Spec 050 · «Pulso» dentro de Remixes del Laboratorio (prueba, corta)

## Por qué
Ion quiere que el Laboratorio quede **muy limpio**: el remix, el visual «Pulso» (spec 049) y el pad de partes para cambiar de versión, y «Lab solo sería eso». Decisión de Ion (2026-11-19, tres preguntas): **probar primero** dentro de Remixes (sin quitar nada todavía), el pad son **las partes del remix** y **no se apagan capas tocando las columnas** (solo partes). Si la prueba gusta, otra spec decidirá qué pantallas del Lab se quitan.

## Qué es
- En Remixes, un enlace pequeño («vista: círculos / pulso», como el del zoom) cambia el lienzo de **círculos** (el de siempre, con sus capas tocables) a **Pulso**: las cinco columnas del visual, sin capas tocables. Se guarda en `coderbeats:lab:vista:v1` (datos, validados al leer; sin él, círculos: **todo igual que hoy**). El pad de **partes** de debajo no cambia: se toca una parte y entra en el siguiente compás; la parte que suena, blanca; la que va a entrar, parpadea.
- **Actuando** (lo que se toca entra y sale cuando la persona quiere, la música no sigue un orden fijo), Pulso lee **lo que suena en directo**: los golpes del motor (`engine.onVisual`, tipo `hit`, con su instante de audio), no una línea de tiempo calculada de antemano. Un golpe se pone en una cola sin asignar objetos y se aplica cuando llega su instante (el reloj de lo que se oye, `clockNow().time`, ya compensa la latencia de salida). **El flash blanco** sale al cambiar la parte que suena y el **nombre de la parte** se ve en el visual.
- **Escuchando** («escuchar el remix original» o «mi versión», un orden fijo) usa la **línea de tiempo** de esa canción y el reloj del motor (compás y fase), como `/visual`.
- `app/lib/visuals/pulso.ts` gana: **dos tamaños** (vertical 540 × 960 para vídeo e historias; compacto 540 × 700 para esta pantalla, con las columnas más bajas), el **modo en directo** (`makePulsoLive`, `pushLive`, `setLivePart`) y `liveLane` (qué carril es un golpe: la batería, la suya; `bass`, el bajo; `chords`, la melodía; un loop de melodía, el de su sinte, y el volumen que se oye, `hitLevel`).
- **No cambia nada de lo que existe:** `LabStage`, el motor, el Estudio y las demás pantallas del Laboratorio siguen igual; Pulso entra por un componente nuevo (`LabPulso.vue`).

## Cambios pedidos por Ion tras probarlo (2026-11-19)
- **La línea del compás se rellena:** la línea de abajo (antes, un suelo que se ensanchaba con el bombo) se **rellena de izquierda a derecha con cada compás** y vuelve a empezar al pasar al siguiente, con **cuatro marcas** (los tiempos); engorda un poco con el bombo (el peso). La fase sale del reloj del motor (`clockNow().barPhase`) en directo y del instante con la línea de tiempo. Se ve también con movimiento reducido (es un indicador).
- **Pasar solo a la siguiente parte («Auto»):** al acabar sus compases, la parte siguiente entra en el compás justo (se pide en el último de la actual: `autoNext`, pura y con tests); la última sigue en bucle hasta que la persona haga algo; tocar una parte a mano la pone y desde ahí sigue solo. Un enlace **«Auto: sí/no»** (`coderbeats:lab:auto:v1`, **sí por defecto**); apagado, nada avanza solo, como antes. Al grabar «mi versión» los cambios automáticos quedan anotados como cualquier otro. El texto de ayuda cambia según esté activo.
- **Pulso es la vista por defecto** (`coderbeats:lab:vista:v1`; quien ya eligió círculos lo conserva).
- ⚠ **Tensión con el principio 4** («la app nunca toca sola sin que se note su gesto») y con lo que decía Remixes («nada avanza solo»): Ion lo propuso expresamente; queda **apagable** y activado por defecto. **A revisar** tras probarlo en el móvil: si la persona siente que la música «va sola», o si prefiere empezar con Auto apagado.

## Reglas de diseño (`specs/DISENO.md`)
Fondo negro, colores de instrumento de `VOICE_HEX`, texto ≥ 11 px reales (`fontPx`), partes sin color (blanca la que suena, parpadeo la que entra, tenues las demás: **como ahora**), botones de 44 px, un solo `requestAnimationFrame`, sin asignar objetos por fotograma (la cola de golpes es un array tipado fijo), movimiento reducido (sin destellos ni flash).

## Principios (`specs/PRINCIPIOS.md`)
1. **Una pantalla, una cosa** ✔ no añade pantallas: cambia la imagen de la que ya hay, y deja la puerta a quitar otras.
2. **No se puede sonar mal** ✔ no toca el sonido.
3. **Respuesta inmediata** ✔ la barra sube en el golpe (instante de audio, con la latencia compensada).
4. **Se siente tuyo** ✔ la persona decide cuándo cambia de parte; en Pulso ya no apaga capas (⚠ pierde ese control; con el enlace vuelve a los círculos).
5. **Pocas cosas a la vez** ✔ cinco columnas; lo viejo se apaga rápido.
6. **Compartir fácil** ⚠ «Mi vídeo» sigue usando el lienzo de la vista elegida; **sin comprobar** cómo queda un vídeo desde Pulso.
7. **Precedente** ✔ spec 049 y los visualizadores de audio de reels ⚠ sin probar con alguien que no conozca la app.
8. **Antes de añadir, quitar** ⚠ se añade una vista y no se quita nada **todavía**; es el paso previo a quitar (decisión de Ion tras probarlo).

## Decisiones a revisar
- El tamaño compacto (540 × 700) y dónde queda el pad en un móvil pequeño.
- Si el flash de cambio de parte y la caída de cada voz sientan bien al tocar (en el móvil, no en el escritorio).
- Quedan para después: un selector de remix arriba (hoy, el enlace «otro»), quitar las otras pantallas del Lab y el vídeo desde Pulso.

## Hecho y sin hacer
**Hecho (2026-11-19):** `app/lib/visuals/pulso.ts` (dos tamaños, modo en directo con cola fija, `liveLane`, línea del compás), `app/components/lab/LabPulso.vue` y su enchufe en `LabRemix.vue` (vista, golpes en directo, línea de tiempo al escuchar, Auto), `autoNext` en `labRemixes.ts`, textos en es/en/eu, 31 tests nuevos entre los de la spec 049 y estos.
- **Comprobado en el navegador sin pantalla (pantalla real de Remixes):** con Pulso, la Intro y el Break solo encienden las cuerdas y el Drop las cinco voces; escuchando el remix entero va por la línea de tiempo (0:15 Estrofa, 0:36 Drop); el lienzo de **círculos sale idéntico píxel a píxel** (`lab-remix-igual.mjs`: «IGUAL que antes del zoom»); **Auto**: tocando la Subida (4 compases = 6,6 s) la parte siguiente se pide a los 5,1 s y suena a los **6,7 s**; con «Auto: no» se queda donde está; la línea se rellena (90 % → 23 % ya en el compás siguiente → 57 %).
- **Un fallo que salió al probarlo y se corrigió:** el motor sigue emitiendo los golpes del **fondo del estilo** (bajo y acordes) aunque esa capa esté apagada (se silencian en el audio, no en los eventos), y la columna del bajo se encendía en la Intro; ahora solo cuentan si la capa está encendida (`bgSounds`), como hace el Estudio con `bgParts`.
- Los guiones `lab-remix.mjs` y `lab-remix-igual.mjs` parten ahora de «círculos y Auto apagado» (`labClassic` en `lab-lib.mjs`); el segundo excluye de la comparación los enlaces de zoom, vista y auto.
**Sin hacer (apuntado):** un selector de remix arriba (hoy, el enlace «otro»), decidir qué pantallas del Lab se quitan (esperando a que Ion lo pruebe en el móvil), el vídeo «Mi vídeo» **desde Pulso** (el lienzo es 540 × 700 y el exportador está hecho para el cuadrado: **sin comprobar**), la fluidez a 60 fps en un iPhone y la latencia con Bluetooth.
