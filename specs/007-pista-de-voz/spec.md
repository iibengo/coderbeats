# 007 · Pista de voz en bucle (loop station)

> Estado: **borrador, para revisar** (2026-11-14). No se programa nada hasta que se apruebe.
> Parte de: spec 001 (frases y loops, §16), 002 (melodía con la voz), 003 (el aro y los carriles que graban, E4), 005 (células, grupos y tempo) y 006 (Mis canciones).
> Idea del usuario (2026-11-14): una pista de **voz real** en bucle, como una loop station (Boss RC-505).

## 1. Idea

Hasta ahora la voz se **interpreta**: el beatbox se convierte en golpes de batería y la melodía, en notas de un sinte. Esta spec añade lo contrario: grabar **tu voz tal cual** (cantar, hablar, un "ooh", un coro) y dejarla sonando en bucle, encima del resto.

- Un **carril "voz"** en la célula. **Mantenerlo pulsado lo arma.**
- Con Play, **al cantar se graba desde la línea de compás**; al parar, **la frase se cierra en 1, 2 o 4 compases** y **suena en bucle desde el compás siguiente**, como el beatbox.
- **Cantar otra vez:** *completa* = se suma otra capa (coros); *sustituye* = la reemplaza.
- **Visual:** la **onda de tu voz dibujada en círculo** en su franja del aro, **iluminándose donde pasa la aguja**.
- Puede ir en **una célula** (solo esa parte de la canción) o en una **célula libre** (suena toda la canción).
- **Interruptor de autotune:** al nacer el loop, la voz se **afina a la escala del estilo conservando tu timbre**.
- **Más adelante:** autotune en directo con cascos de cable.

## 2. Alcance

**Dentro (primera versión completa, por fases, §12):**
- El carril "voz" (armar con mantener), la grabación alineada al compás, el cierre en 1, 2 o 4 compases y el bucle.
- Capas (completa) y sustitución, hasta un límite (§7).
- La franja de la voz en el aro con la onda circular (§8).
- Guardar el audio con la canción (§9).
- Autotune al nacer el loop (§10).
- Laboratorio `/lab/pista` (solo en desarrollo) para medir lo que de verdad decide el diseño (§11, fase 0).

**Fuera (siguientes pasos):**
- Autotune en directo (fase final, §10.4), efectos de voz más allá de la mezcla (eco, reverb) y estirar el tiempo si cambia el tempo (§6.3).
- Compartir o exportar una canción **con** su audio (hoy las canciones viven en el navegador; §9).
- Grabar sin cascos con altavoces (§5: solo con cascos).
- Cambiar de tono o armonizar a varias voces.

## 3. Decisiones de partida

1. **La voz grabada es un loop más** (`FreeLoop` de un tipo nuevo, `'voz'`), con su bola, su mute, su borrado, su fase y su nacimiento en línea de compás: reutiliza frases, sustituye o completa, células, grupos y la fila de bolas.
2. **Con cascos, siempre** (§5). Sin ellos, el carril no se puede armar (igual que la melodía, spec 002 §10).
3. **El audio no vive en el código Strudel** (§6): el código mostrado lleva una línea comentada. No se cumple "pegado en strudel.cc suena igual" para la voz, y se avisa.
4. **El audio no vive en `localStorage`** (§9): vive en IndexedDB.
5. **Lo difícil se mide antes de construirlo** (§11): el bucle sin costuras, la latencia, la fuga y el tamaño.

## 4. Flujo de usuario

1. **Armar.** Se mantiene pulsada (≈0,5 s, con el anillo de siempre, 003 E4.1) la franja de la voz o, si aún no existe, su hueco en el borde del aro. Armado = la franja se ve con el borde brillante y una pulsación suave (sin rojo: no está en la paleta, 003 E1.2). Mantener otra vez lo desarma. **No se guarda**: al abrir la app, desarmado.
2. **Cantar.** Con Play y armado, la app **graba siempre en segundo plano** (un búfer circular) y, cuando oye voz, **marca el inicio de la frase en la línea de compás en la que empezó** (§6.1). El audio de ese compás se conserva **entero desde su línea**, también lo que se cantó antes de que se detectara la voz (por eso se graba antes).
3. **Cerrar.** La frase se cierra **igual que la del beatbox** (spec 001 §16.15): por silencio de unos tiempos o al llegar al máximo, y su longitud es **1, 2 o 4 compases** (el span redondeado hacia arriba, ≤ el máximo de ⋯).
4. **Nace.** El loop empieza a sonar **en la siguiente línea de compás**, con la fase de la frase (como los de batería), y su onda cae al agua como las bolas.
5. **Otra vez.** Cantar de nuevo con el carril armado crea otra frase, y según ⋯ → "Repetir" (spec 001 §16.19):
   - **completa**: se suma **otra capa** (un coro). Cada capa es su propio loop y su propia bola;
   - **sustituye**: reemplaza la **última capa grabada** (la anterior sigue sonando hasta el nacimiento de la nueva, sin hueco ni solape, como el resto, §16.15).
6. **Desarmar.** El carril sigue sonando; solo deja de grabar.

### 4.1 Con el resto de carriles

Mientras la voz está armada, **la batería y la melodía no graban** (carril exclusivo): lo que cantas o dices es audio, no golpes ni notas, y la clasificación del beatbox suspendida evita que "bum" o "ts" dentro de tu frase creen loops de batería a la vez. Al desarmar, vuelven. (Decisión a revisar, §13.1: la alternativa es grabar la voz *y además* clasificar.)

### 4.2 En células y grupos

- Un loop de voz vive en su **célula** y suena cuando esa célula suena (en la canción, durante sus vueltas; 005 §4). Copiar una célula copia sus loops de voz **sin duplicar el audio** (mismo identificador, §9).
- En una **célula libre** (grupo en paralelo, 005 §16) suena toda la canción, en su orden.
- Como la batería, **en estado canción con varias células no se graba** (005 §4.4); en bucle sí.

## 5. Cascos, fuga y Bluetooth

### 5.1 Fuga (sin cascos)

El micro oiría el fondo y la batería. Con **batería, melodía o un coro** el problema se agrava: **cada capa grabada se graba otra vez dentro de la siguiente** y el bucle se llena de música repetida (una realimentación lenta). Por eso:
- **Solo con cascos.** Si la prueba de eco al empezar detecta fuga (`echo.bleed`), el carril **no se puede armar** y se ve el icono de cascos pequeño (como la melodía).
- La prueba de eco es **al empezar**, una sola vez (spec 002 §16.10). Para la voz esto es más grave (se graba audio, no solo se clasifica): se mide en la fase 0 si hace falta **vigilarla en vivo** (cuánto del fondo conocido hay en lo que entra por el micro) y, si el navegador lo permite, usar su **cancelación de eco** (`echoCancellation`) en una captura propia de la voz. Hoy la app la desactiva para el beatbox.

### 5.2 Retraso: cable y Bluetooth

- La voz entra **tarde** respecto a la rejilla: oyes el fondo con el retraso de salida y tu voz llega al micro con el de entrada. Lo que se graba va retrasado la **ida y vuelta** que ya mide la calibración (`latencySec`, 003 E6): al cortar la frase en la línea de compás se **adelanta** el audio esa cantidad, como los golpes de batería (`tCorr = tiempo − latencySec`).
- **Con cable** la ida y vuelta es corta y estable: sirve. **Con Bluetooth** hay dos problemas distintos:
  1. **Retraso grande y variable** (~200–300 ms que cambia entre sesiones, 003 E6.8): la voz queda desalineada del compás aunque se calibre.
  2. **Calidad del micro**: al usar el micro de unos auriculares Bluetooth el sistema pasa al perfil de "manos libres" (**8–16 kHz, sonido de teléfono**) y, en iOS, no se puede usar el micro del aparato con la salida Bluetooth.
  - Propuesta: **el carril avisa y pide cable** si la ida y vuelta calibrada pasa de ~120 ms o el micro entra a menos de 24 kHz; se puede armar igualmente, con el aviso.

## 6. El audio: cómo se graba y cómo suena

### 6.1 Grabar alineado al compás

- El worklet de captura ya da el audio con la **marca de tiempo exacta** (`currentFrame`); el worker de análisis lo recibe en bloques de 512 muestras. Se añade un **búfer circular de audio** (unos 16 s a la frecuencia del contexto, ~3 MB en `Float32`) en el worker, solo con el carril armado y Play.
- **Detector de voz** (VAD) en el worker: volumen sobre el piso de ruido y/o probabilidad de voz de YIN (ya existe, spec 002). Sirve para **abrir la frase** (primer sonido con voz) y para **mantenerla abierta** mientras haya voz: la frase de la voz no usa golpes sino **actividad** (un evento por tiempo mientras hay voz), de modo que un "oooh" largo no cierra la frase por silencio.
- Al cerrar, el main pide al worker el trozo **de la línea de compás de inicio a la de fin**, con la latencia corregida, y lo recibe como `Float32Array` transferible. Si la frase dura menos de 1, 2 o 4 compases se **rellena de silencio** hasta el compás entero (el loop dura siempre compases enteros).
- **Normalización**: se baja el pico a −3 dBFS si pasa de ahí; sin subir lo flojo (no se amplifica el ruido). Un pequeño fundido de 5 ms en los extremos evita el clic.

### 6.2 Reproducir

Dos caminos; se decide en la fase 0 (§11):

- **A (propuesto): por Strudel.** El audio se registra como una muestra con un identificador propio (`samples({ vozAB12CD: [url] })`) y la línea es `s("vozAB12CD").loopAt(<compases>)` (con `.clip(1)`). Así hereda **sin código nuevo** las ventanas de las células, el silenciar (línea comentada), la versión anterior hasta el nacimiento, el sidechain y las etiquetas `.color("l<id>")` que dan los eventos al aro.
- **B (alternativa): un reproductor propio** con `AudioBufferSourceNode` programado en las líneas de compás, con su propio control de qué sonaría en cada compás según las células y los grupos. Más control del bucle y del tempo, más código.
- Qué decide: que **el bucle no tenga costura ni deriva** tras decenas de vueltas con `loopAt`, y cuánto cuesta cargar la muestra en superdough. Se mide (§11).

### 6.3 El tempo

El loop se graba a **un tempo** (el de la canción en ese momento, `bpm` del loop). Si luego cambia (005 §6, tempo fácil), con el camino A `loopAt` lo **acelera o frena con su altura** (cambia el tono: ±10 % ≈ ±1,6 semitonos). v1: **se avisa** con una marca en la bola ("fuera de tempo") y se permite. Estirar sin cambiar el tono (WSOLA) queda para más adelante.

### 6.4 Mezcla

La voz es un loop más en la mezcla automática (`lib/mix.ts`): se le da un balance propio (alrededor de −2 dB respecto al bombo, a afinar de oído) y entra en el reparto 1/√n. Con **varias capas** se baja un poco cada una para que el coro no sature. Va al orbit **7** (la melodía usa 5 y 6, spec 002 §6) y el **sidechain** del bombo la empuja menos que al fondo. Reverb y eco de la voz: más adelante.

## 7. Modelo de datos

```ts
export type LoopInstrument = Instrument | 'mel' | 'voz'

export interface FreeLoop {
  // … como hoy
  /** solo voz: el audio guardado (IndexedDB, §9) y cómo se grabó */
  voice?: {
    /** identificador del audio: letras y números, `^v[a-z0-9]{6,20}$` */
    audio: string
    /** tempo al que se grabó (bpm) y compases (1, 2 o 4: ya están en `bars`) */
    bpm: number
    /** frecuencia de las muestras guardadas (Hz) */
    sampleRate: number
    /** afinado: 0 = tal cual, 1 = a la escala del estilo (§10) */
    tuned: boolean
  }
}
```

- **Sin `hits`**: un loop de voz lleva `hits: []`; lo que vale es `voice`. Los lugares que recorren los golpes (aro, edición) lo saltan.
- **Como mucho 4 capas de voz por célula** y **8 en la canción** (con las otras clases, `MAX_LOOPS` sigue siendo 8 por célula; el límite de capas se avisa en el diagnóstico al llegar).
- **Validación estricta (seguridad, obligatoria):** `isFreeLoop` exige `voice.audio` con el patrón de arriba, `bpm` en 20–400 y `sampleRate` entero entre 8 000 y 96 000. **El identificador se escribe en el código Strudel**, así que se genera aquí (no se lee tal cual) y solo pasa si cumple el patrón; el audio en sí se busca en IndexedDB por esa clave y **nunca se interpreta**. Tests de inyección como los de la melodía.
- El **sinte** no aplica; `synth` solo vale para `'mel'`.

## 8. Visual: la onda en círculo

- Una franja nueva, **"voz"**, **la más exterior** (como el surco de un disco): `BAND_ORDER = [bd, bass, sd, mel, hh, voz]`. Color propio de la paleta (un verde agua tenue, a decidir; no rojo). Como la melodía, **aparece** cuando el carril está armado o hay una voz (con la transición de peso de siempre).
- **La onda:** la envolvente del audio (el pico de cada ~1/180 de vuelta), dibujada como barritas radiales **simétricas a lo largo de la franja**, de modo que una vuelta del aro = un compás (loops de 2 o 4 compases: la vuelta que suena, como el resto, 003 E1.1).
- **Se ilumina donde pasa la aguja:** más brillo en el trozo que acaba de pasar, con la estela de 003 E3.4; el resto, tenue.
- **Grabando:** la onda **crece con la aguja** en tiempo real (el volumen ahora), y al cerrar la frase "se asienta" con el compás completo.
- **Capas:** se dibujan **superpuestas** y más tenues cada una; tocar la bola de una la resalta en el aro (003 E1.1).
- **Armado:** borde de la franja brillante y una pulsación lenta (con movimiento reducido: solo el borde).
- La envolvente se **calcula una vez** al nacer el loop (y al cargar la canción) y se guarda junto al audio; el dibujo solo la recorre (nada que recalcular por frame).

## 9. Guardar el audio

**El problema:** un compás de voz a 48 kHz en 32 bits son ~0,5 MB; 4 compases a 90 bpm son **~2 MB**; varias capas y varias células suman decenas de MB. `localStorage` tiene unos 5 MB **en total** y guarda texto (el audio en base64 pesa un 33 % más): **no vale**.

- **IndexedDB**, un almacén `voz` con `{ id, pcm: ArrayBuffer (16 bits), sampleRate, envelope, createdAt }`. El audio se guarda en **16 bits** y, para la voz, a **24 kHz** (suficiente por debajo de 12 kHz): ~0,5 MB por cada 10 s. Con **Opus** (`MediaRecorder`) sería ~40 KB, pero el relleno del códec rompe la precisión de muestra del bucle y el soporte en iOS es incierto: queda como opción si el tamaño se vuelve un problema (§11).
- **Qué guarda Mis canciones (006):** solo el loop con `voice.audio` (la referencia). Al abrir una canción, si falta un audio (se borró el almacenamiento) el loop se ve **"audio no disponible"** (apagado, sin borrar) y el resto suena.
- **Recolección:** al guardar o al borrar una canción, los audios que ya no usa **ninguna canción ni la sesión actual** se borran (recuento de referencias). Copiar una célula no copia audio.
- **Límites:** 60 MB en total y 3 MB por frase; al pasarse, aviso y no se guarda (el loop sigue sonando esa sesión).
- **Riesgo del navegador:** Safari puede **vaciar el almacenamiento** de una web que no se usa en ~7 días (si no está instalada como app). Se dice en el aviso al guardar una canción con voz y se recomienda instalarla (PWA).
- **Privacidad:** el audio **no sale del dispositivo** (no hay servidor); se dice en la hoja de ajustes junto al carril.
- **Exportar o compartir una canción con voz** queda fuera: de momento la canción guardada es solo del navegador que la grabó.

## 10. Autotune

### 10.1 Qué hace

Un **interruptor en ⋯** ("Afinar la voz", apagado por defecto). Con él, **al nacer el loop** la voz se corrige a la **escala del estilo** (la de la melodía, spec 002 §5) **conservando el timbre**, y con un deslizador de **fuerza** (de "suave", que solo corrige lo claramente desafinado, a "total"). Se conserva el **audio original** para poder desactivarlo después sin volver a grabar (el afinado se rehace desde el original).

### 10.2 Cómo (propuesta)

1. **Altura**: el YIN ya hecho (`lib/pitch.ts`) sobre la frase, con la probabilidad de voz. Las partes **sin voz** (consonantes, respiraciones) no se tocan.
2. **Notas**: la segmentación de la 002 (`segmentNotes`) da cada nota con su mediana; **la nota de la escala más cercana** (con el desempate por acorde, `snapToScale`) es el objetivo. Con fuerza < 1, solo una fracción del camino.
3. **Desplazamiento**: **TD-PSOLA** (superposición de ventanas sincronizadas con el período): cambia la altura **sin cambiar la duración ni los formantes** (el timbre). Es el método de los afinadores clásicos. Alternativas más sencillas: remuestrear + OLA por nota (los formantes se desplazan: suena "ardilla" si pasa de ±2 semitonos) o una librería como Rubber Band (WASM, GPL, ~300 KB; no corrige por nota, solo desplaza todo).
4. **Suavizado**: la corrección entra y sale con una rampa de 30–60 ms ("velocidad de afinado"); un glissando intencionado (cambio de nota > 1,5 semitonos en < 150 ms) se respeta.

Se hace **fuera del hilo principal** (en el worker) y **una sola vez** por loop (~1–3 s para 4 compases en un móvil, a medir); mientras tanto el loop nace sin afinar y se cambia al terminar (en la siguiente línea de compás).

### 10.3 Cómo se comprueba

- **Tests sintéticos** (siempre): voz sintética con formantes y vibrato (`tests/helpers/voice.ts`) desafinada a +40 y −35 cents: la altura sale a ≤ 10 cents de la nota; los formantes (envolvente espectral) se conservan; la duración no cambia; los silencios y consonantes no se tocan; un glissando intencionado se respeta.
- **Laboratorio A/B** (`/lab/pista`): tu toma tal cual frente a afinada, con la fuerza ajustable, para decidir de oído y elegir el método.
- **Criterio:** ≥ 90 % de las notas de tus tomas a ≤ 20 cents de su objetivo con fuerza total, sin artefactos audibles en lo que ya estaba afinado.

### 10.4 Más adelante: afinado en directo con cascos de cable

Corregir mientras cantas exige una **latencia total baja** (idealmente < 25 ms) y que **te oigas a ti** por los cascos (no solo el micro). Requisitos y riesgos: un **AudioWorklet** con bloques de 128 muestras, la altura de bloques anteriores (YIN con ventana de 2048 son ~43 ms: hace falta un detector más rápido o con adelanto), un PSOLA causal, **solo cable** (el Bluetooth hace imposible la latencia). Se reevalúa tras la fase 5.

## 11. Fase 0: laboratorio `/lab/pista` (solo en desarrollo)

Antes de construir, se mide lo que decide el diseño. Como `/lab/voz` (spec 002 §9):
1. **Bucle sin costura (§6.2):** grabar 1, 2 y 4 compases con un clic de referencia, reproducirlos **N veces** (por Strudel con `loopAt` y por `AudioBufferSourceNode`) y medir en la salida el período entre los clics (deriva en ms tras 10, 50 y 200 vueltas) y la costura (salto de nivel en el empalme). **Objetivo:** deriva < 1 ms tras 200 vueltas y sin clic audible.
2. **Latencia (§5.2):** grabar palmadas contra un clic con cable, y con Bluetooth si se tiene; medir el error tras corregir con la ida y vuelta calibrada, y su variación entre sesiones.
3. **Fuga (§5.1):** con el fondo por los altavoces, cuánto del fondo hay en la grabación (dB), con y sin `echoCancellation`, y qué pasa al acumular 3 capas.
4. **Almacenamiento (§9):** tiempo y tamaño de guardar y leer 4 compases en IndexedDB a 16 bits/24 kHz; y si `MediaRecorder` da Opus en tu navegador y móvil.
5. **Autotune (§10):** TD-PSOLA frente al método sencillo con tus tomas (A/B), y su tiempo de cálculo.
Hito: te enseño los números antes de seguir.

## 12. Plan y fases

- **F0. Laboratorio** (§11): mide el bucle, la latencia, la fuga, el almacenamiento y el afinado. Decide A o B (§6.2) y las cifras de §5 y §9.
- **F1. Mínimo — cantar y oír tu voz en bucle:** carril armable (sin la franja todavía: una bola), búfer circular y detector de voz en el worker, frase de voz en el `PhraseTracker`, corte alineado y con la latencia corregida, loop `'voz'` (validación y tests), reproducción, silenciar y borrar. Solo en memoria. Solo con cascos.
- **F2. Visual:** la franja "voz" con la onda circular que se ilumina con la aguja y crece al grabar; armado con su pulsación.
- **F3. Capas:** completa y sustituye, hasta el límite, con su mezcla (§6.4) y cada capa en su bola.
- **F4. Guardar:** IndexedDB, Mis canciones con voz, límites, recolección y "audio no disponible".
- **F5. Autotune al nacer:** el método elegido en F0, el interruptor y la fuerza en ⋯, el original conservado.
- **F6. Autotune en directo** (con cable): §10.4.

## 13. Riesgos

| Riesgo | Qué pasa | Mitigación |
|---|---|---|
| **Fuga sin cascos** | El micro graba el fondo y la batería; cada capa se regraba dentro de la siguiente: realimentación lenta y barro | Solo con cascos (prueba de eco, carril bloqueado, icono); medir la vigilancia en vivo y `echoCancellation` en la fase 0; limitar capas |
| **Retraso con Bluetooth** | Ida y vuelta de ~200–300 ms que cambia entre sesiones: la voz queda desalineada aunque se calibre; el micro del auricular suena a teléfono (8–16 kHz) | Avisar y pedir cable si la ida y vuelta pasa de ~120 ms o el micro baja de 24 kHz; recalibrar al cambiar de cascos; no recomendar Bluetooth |
| **Tamaño del audio guardado** | 4 compases a 90 bpm en 32 bits son ~2 MB; `localStorage` no vale; el navegador puede vaciar IndexedDB | IndexedDB a 16 bits y 24 kHz (~0,5 MB por 10 s), límites (60 MB, 3 MB por frase), recolección por recuento, aviso de Safari y PWA; Opus solo si hace falta |
| **Costura o deriva del bucle** | Un clic en el empalme o un desfase que crece vuelta tras vuelta | Longitud de muestras **exacta** (compases enteros a la frecuencia del contexto), fundidos de 5 ms, medida en la fase 0; camino B (reproductor propio) como alternativa |
| **Cambio de tempo** | Con `loopAt` la voz cambia de tono al acelerar o frenar | Aviso "fuera de tempo" en la bola; estirar sin cambiar el tono (WSOLA) más adelante |
| **El código no es reproducible** | La voz no existe en strudel.cc; se rompe "el código mostrado, pegado, suena igual" | La línea va comentada con una nota; se dice en ⋯ → Código |
| **Memoria y CPU en el móvil** | Búfer de 16 s, varias capas decodificadas y el afinado en el iPhone | Búfer solo con el carril armado y Play; afinado en el worker y una sola vez; tope de capas; medir en la fase 0 |
| **Calidad del afinado** | Artefactos metálicos o "ardilla" en cambios grandes | PSOLA (conserva formantes), fuerza ajustable, respetar glissandos y partes sin voz, A/B de oído, original conservado |
| **Seguridad** | El identificador del audio va al código Strudel | Se genera en la app, patrón estricto en `isFreeLoop`, el audio se busca por clave y no se interpreta; tests de inyección |
| **Privacidad** | Se guarda tu voz | Solo en tu dispositivo, sin red; se dice en ajustes; borrar la canción borra su audio |
| **Interacción con la melodía y la batería** | Dos clasificadores y la voz cruda sobre el mismo micro | Carril exclusivo (§4.1); a revisar |

## 14. Criterios de aceptación (primera versión completa)

1. Con cascos y el carril armado, **cantar con Play crea un loop de voz** que empieza en la siguiente línea de compás, con su bola, sin botón extra. La voz **cae en el compás** (con la latencia corregida, ≤ 20 ms de error con cable).
2. La frase se cierra en **1, 2 o 4 compases** y el loop repite **sin costura ni deriva** (< 1 ms tras 200 vueltas).
3. **Completa** suma una capa; **sustituye** reemplaza la última sin hueco ni solape.
4. La **onda circular** de la voz se dibuja en su franja, se ilumina donde pasa la aguja y crece mientras grabas.
5. Funciona **en una célula** (solo esa parte) y **en una célula libre** (toda la canción).
6. Una canción con voz **se guarda y se abre** con su audio (IndexedDB); si falta, el loop dice "audio no disponible" y lo demás suena.
7. Con el **autotune** activado, ≥ 90 % de las notas a ≤ 20 cents de la escala del estilo, con el timbre y la duración intactos; se desactiva sin regrabar.
8. **Sin cascos** (fuga) no se puede armar y se ve el icono; con Bluetooth se avisa.
9. Ninguna tarea del hilo principal de más de 50 ms; el audio no se corta al grabar, afinar o guardar.

## 15. Decisiones a revisar y preguntas abiertas

1. **Carril exclusivo (§4.1):** voz armada = batería y melodía no graban. Alternativa: grabar la voz *y* clasificar a la vez (se oye tu beatbox dentro del audio *y* nacen golpes: se duplica).
2. **Sustituye = la última capa (§4.1.5).** Alternativas: todas las capas, o la que se elija tocando su bola.
3. **Reproducción por Strudel o propia (§6.2):** propuesta A (Strudel con `loopAt`), a decidir con la fase 0.
4. **Dónde va la franja (§8):** la más exterior (propuesta) o entre la melodía y el platillo.
5. **Capas máximas:** 4 por célula y 8 en la canción (a afinar de oído y con la memoria del móvil).
6. **Calidad guardada:** 16 bits a 24 kHz (propuesta) o 48 kHz, o Opus.
7. **Tempo cambiado (§6.3):** se avisa y suena a otra altura (propuesta), o el loop se silencia hasta volver al tempo.
8. **El afinado y los acordes:** la escala del estilo (propuesta, como la melodía), o también el acorde de cada compás como destino prioritario.
9. **Voz en una célula de la canción con varias células:** hoy no se graba con la canción avanzando (005 §4.4); ¿aquí se permite grabar *entrando* en bucle? Igual que la batería (propuesta).
10. **¿Mis canciones debería avisar de lo que pesa el audio** (p. ej. "esta canción ocupa 12 MB") y dejar borrar solo el audio?
