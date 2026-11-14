# 012 · Composición asistida: melodía sugerida y copia con variación

> Estado: **propuesta, sin programar** (2026-11-14). Para que la decidas: §9 reúne lo que hay que elegir; §8 es cómo lo haría, por fases.
> Parte de: 002 (melodía con la voz), 003 (el aro), 005 (células, copiar §15), 011 (modos; §14 «convertir en canción»), 010 (sonidos).
> Decidido (2026-11-15): las sugerencias **siguen el estilo actual** (escala, tempo y patrones típicos, §3.2b) y tienen **un interruptor propio en ⋯, «Sugerencias»**, separado de «Ayuda»; apagado, **no se propone nada** (§3.4).
> Principio común: **la app propone, la persona manda.** Todo sale **en fantasma** (tenue, hueco, suave), **tocar = aceptar** y **«otra» = probar otra**.
> Nunca se escribe nada en la canción sin que se acepte (o se edite), y siempre se puede **deshacer**.

## 1. Idea

Dos ayudas para componer sin saber componer:

1. **Melodía sugerida** (en Jugar): con un ritmo hecho, la app propone una melodía **en la escala del estilo** que encaje con los golpes. **Si canto, manda mi voz.**
2. **Copia con variación** (en Componer): al copiar una célula, la app propone **variaciones** para avanzar en la canción (más energía, menos, variar la melodía, redoble).

Se **encajan con «Convertir en canción»** (011 §14.2): esa función **es una receta de variaciones** (intro = menos energía, subida = sin bombo + redoble, drop = la original…), así que
las variaciones de la §5 se hacen **antes** y la conversión las reutiliza (§6).

## 2. Primero, el error que dio la idea: una melodía que no canté

La idea nació de un fallo (haciendo **solo beatbox** se rellenó una melodía que no se cantó) que **gustó**. Antes de convertirlo en función, hay que **evitarlo como error**: si no, la
«melodía sugerida» y la «melodía por fuga» se mezclarían, y la segunda a veces suena mal. Lo que he mirado (el 2026-11-14, sin el audio del micro de esa toma: ver «Qué no he podido comprobar»):

### 2.1 Cómo llega una nota a la canción (el camino)

`analysis.worker.ts` → `LiveMelody` (`liveMelody.ts`): YIN (`pitch.ts`, **65–1000 Hz**) saca la altura de cada trozo de audio → `segmentNotes` (`notes.ts`) agrupa los tramos con voz en notas
(≥ 0,1 s, volumen ≥ 0,004, probabilidad de voz ≥ 0,7) → el worker **avisa** de cada nota («melodic») en cuanto dura 0,1 s → el motor (`onMelodic`) la apunta como golpe de **melodía**
en la frase. Solo si la «melodía con la voz» está activada (⋯, beta) y el micro **no oye los altavoces** (`melodyBlocked`, que sale de la prueba de eco del arranque con **clics agudos**).

### 2.2 Lo que he encontrado (con señales sintéticas y los samples reales del kit)

| Qué entra por el micro | ¿Notas de melodía? | Por qué |
|---|---|---|
| **El bajo del techno** (do₂, 65 Hz, sierra, corcheas) con **muy poco volumen** (0,02 de 1) | **Sí: 21 notas en 5 s, todas en el mismo MIDI 36** | 65 Hz cae justo dentro del rango de YIN (≥ 65 Hz); al ser **a golpes** (corcheas), el «piso» de ruido es bajo y cada nota pasa el listón (`minPeakRms` 0,004 es **muy** bajo) |
| **El bombo del kit «Electrónico»** (uzu, ≈ 63 Hz) como fuga | **Sí: 9 notas en 4 s (MIDI 35,9)**, incluso con la décima parte de volumen | El mismo motivo: su tono grave está dentro de 65–1000 Hz. **Los kits viejos (909, acústico, 808, vinilo) no lo hacían** (tonos más bajos o sin tono): empezó con el cambio de kit de la spec 010 |
| **Un «bum» con tono** (voz grave, 120 Hz) de **≥ 0,2 s** | **Sí**, una nota por «bum» (MIDI 46,5 = la♯₂) | Una vocal sostenida es una nota; con el «bum» largo, el detector no distingue «bum» de «nota». Un «bum» de ≤ 0,16 s **no** sale |
| Los acordes del fondo (triángulo, 100–130 Hz, continuos) | No | Son continuos: suben el «piso» y no superan 2× ese piso |
| Una **voz cantada** (re₃ a do₄, 0,3 s; o semicorcheas de 0,12 s) | Sí, bien (lo que se quiere) | — |

**Dos causas, entonces:**
- **A. Fuga del fondo grave**: el bajo y el **bombo del kit Electrónico** salen por los altavoces o se cuelan por los cascos, el micro lo oye y el detector lo toma por voz (**el bajo y el bombo están dentro del rango de la voz que se busca, y debajo de lo que alguien canta**). La prueba de eco del arranque (clics agudos) **no lo detecta**.
- **B. «Bum» con tono**: un golpe de voz con vocal larga se toma por nota, y **encima se traga el golpe**: hoy un onset que cae dentro de una nota se **absorbe como melodía** (`absorbed`) **antes** de preguntar al clasificador, así que el «bum» pierde su bombo.

### 2.3 Lo que se arregla (como error, antes de la función)

| # | Arreglo | Detalle | Cómo se comprueba |
|---|---|---|---|
| **F1** | **Subir el mínimo de YIN de 65 a 80 Hz** (`DEFAULT_PITCH_OPTIONS.fmin`) | Por debajo de ≈ MIDI 39 no se canta (el bajo c₂ = 65 Hz, el bombo ≈ 61–63 Hz y el b₁ del dembow quedan fuera); la voz cantada grave (do₃ = 130 Hz) y las semicorcheas **se siguen detectando** | **Test con señales**: bajo c₂ y bombo del kit → **0 notas**; canto re₃–do₄, do₃ y semicorcheas → **las mismas notas que hoy** |
| **F2** | **La puerta de batería**: una nota **corta** (< 0,3 s) cuyo ataque coincide con un golpe que el clasificador reconoce como **batería con confianza** (≥ 0,6) **no es melodía**: es el golpe | Para eso el aviso de la nota **espera la decisión** (0,35 s, `MELODY_DECISION_SEC`, la misma que ya espera el golpe): el tiempo de la nota no cambia (se apunta en su sitio), solo llega algo después; **el golpe sale como batería, no «absorbido»** | **Test**: un «bum» de 0,22 s (sintético) **da un bombo y no una nota**; un «na» cantado de 0,22 s con el mismo tono **sigue siendo nota** (el clasificador no lo reconoce como golpe) |
| **F3** | **Una nota debe poder sostenerse**: no se avisa hasta los **0,15 s** (hoy 0,1) si no tiene golpe que la acompañe | Menos parpadeo de notas que son fragmentos | Test con los fragmentos de entrada de `notes.test.ts` |
| **F4** (opcional) | **Prueba de fuga grave** en el arranque: dos notas graves además de los clics; si el detector las ve como notas, `melodyBlocked` | Detectaría la fuga **aunque** F1 no baste (un fondo más agudo) | Test con una señal que contiene esas notas |

**Qué no he podido comprobar:** no tengo el audio del micro de la toma en que pasó (las grabaciones de pantalla llevan el sonido de la app, no el de la voz), así que **las causas A y B salen de reproducirlas con señales sintéticas y los samples reales**: ambas dan notas
que la app no debería dar. Si la próxima vez que pase se copia el **diagnóstico** (⋯ → registro, las líneas `nota …` y `golpe …`), se sabrá cuál fue. Los arreglos **cubren las dos**.

## 3. Melodía sugerida

### 3.1 Qué hace la persona

En **Jugar**, con **un ritmo hecho** y sin melodía (ni cantada ni sugerida aceptada), la franja de la melodía **muestra una melodía en fantasma** (puntos huecos, muy tenues) y **suena suave** en el loop:

- **Tocarla (la franja) = aceptarla**: pasa a ser un loop de melodía normal (se llena, suena a su volumen, se puede mover y borrar como cualquiera).
- **«↻ otra»** (un chip pequeño junto a la franja): propone **otra** (la siguiente semilla).
- **«✕»** o **seguir tocando** otra cosa durante un rato **la deja de proponer** esta vez (no insiste).
- **Si canta, manda su voz**: en cuanto el detector avisa de una nota (ya sin las falsas de la §2) la **sugerida se retira** y no vuelve a salir mientras haya voz (y 2 compases después).
- **Al arrancar la guía** (011 §12.2), el paso **«toca la franja de la melodía»** ya enseña la sugerida: el paso «canta» pasa a ser **«canta, o toca la sugerida»**.
- Un ajuste propio en ⋯: **«Sugerencias»** (§3.4). Apagado, nada de esto.

### 3.2 Cómo se compone la sugerida (puro: `lib/suggestMelody.ts`)

Entradas: el **estilo** (escala y **acordes por compás**: `STYLE_MUSIC[style].scale` y `chordTones`), los **golpes** de los loops de batería (4 compases), el **registro** del sinte, y una **semilla** (entero). **Sin azar escondido**: misma entrada y misma semilla = misma melodía.

**El ritmo de la melodía encaja con los golpes:**
1. **Anclas**: los golpes de **caja** (el contratiempo) y de **bombo** (el apoyo) son los candidatos a sílaba fuerte; los de **platillo**, a sílaba débil. La melodía usa **entre 3 y 8 notas por compás** (según el estilo: techno y dnb más; hip hop menos), todas en **posiciones donde ya hay un golpe o en su rejilla de corcheas**.
2. **Frase de 4 compases = 2 + 2**: un **motivo de 2 compases** y su **respuesta** (mismo ritmo, otro final). Es lo que hace que suene a «frase» y no a ruido.

**La altura es de la escala y del acorde:**
3. Se mueve **por grados** (saltos de 1 o 2 grados casi siempre; de vez en cuando uno de 3, nunca más de una quinta); **en el primer golpe de cada compás y en los de bombo, una nota del acorde de ese compás** (`chordTones`), y en los demás, de la escala.
4. **Arco**: el motivo sube y la respuesta baja; **termina en la tónica** (o la quinta, si es la frase abierta). Sin tres notas iguales seguidas ni repetir el mismo salto más de dos veces.
5. Se mete en el **registro** del sinte (`fitRegister`, 002 §5) y se pasa por **`assistMelody`** (la misma limpieza de la melodía cantada) para que **cualquier nota quede en la escala**.

La salida es un loop de melodía normal (`MelodyHit[]`, 4 compases), que es lo que se aceptaría.

### 3.3 Cómo suena y cómo se ve

- **Suena**: como **loop provisional** (`suggested`), **a ~35 % del volumen** y con el sinte del estilo en versión suave (pad), **solo en el motor** (no sale en el código mostrado, no se guarda, no entra en `songCode` de `display`; con un comentario «// melodía sugerida (sin aceptar)» solo en el del motor). **No se envía a la grabación**: es solo para oírla.
- **Se ve** en la **franja de la melodía** con los puntos **huecos y muy tenues** (el mismo estilo que las sugerencias del estilo, 003 E3.3), sin ondas ni destellos.
- **Al aceptar**: el loop provisional se **convierte** en un loop normal (nueva id, `synth` del estilo, volumen normal). Un **deshacer** la quita.

### 3.2b Siguen el estilo actual

Todo lo que se propone sale **del estilo que está elegido** (`style`), nunca de uno genérico. Se lee de los datos del estilo que ya existen (`styles.ts`, `constants.ts`); **no hay datos nuevos por estilo salvo una tabla de densidad** (abajo).

| Del estilo | Qué se usa | De dónde |
|---|---|---|
| **Escala** | Las notas de la melodía son **solo de la escala del estilo** (si menor, do menor, etc.); en los apoyos, del **acorde** de ese compás | `STYLE_MUSIC[style].scale` y `chordTones` |
| **Tempo y rejilla** | La densidad **se ajusta al tempo**: una nota no dura menos de ≈ 0,12 s (a 90 bpm, semicorcheas; a 174 bpm de dnb, **corcheas**, porque ese estilo graba cada 2 pasos). Una variación que acelera el platillo **no pasa de la rejilla del estilo** | `STYLES[style].bpm` (o el tempo fijado con los 4 toques) y `quantizeEvery` |
| **Patrones típicos** | Los **anclas** de la melodía son los golpes de batería **y** los huecos que el estilo pide (lo que `priors` y `templates` consideran su ritmo), y las variaciones de «+ energía» añaden golpes **donde el estilo ya los pone** | `STYLE_MUSIC[style].priors` y `templates` |
| **Sinte** | El de la sugerida es el del estilo (versión suave) | `STYLE_MUSIC[style].synth` |
| **Tonalidad del remix** | En una canción de un remix (008) se sigue **el estilo de la canción** (el techno del Mozart: do menor) | el estilo de la canción |

**Densidad por estilo** (propuesta, a afinar de oído; notas de la melodía por compás): **hip hop** 3–5 (frases con aire) · **house** 4–7 · **dnb** 3–5 (en corcheas, ligero sobre el ritmo rápido) · **dembow** 4–6, **cayendo sobre la caja del dembow** (pasos 3 6 11 14) · **techno** 5–8 (nota pedal repetida y apagada a semicorcheas, como el Dies Irae, 008 §9).
**Si cambia el estilo o el tempo, lo que está propuesto se rehace** (una propuesta sin aceptar no se queda con el estilo anterior). Lo ya **aceptado** no se toca: es la canción.

### 3.4 El interruptor «Sugerencias»

- **Un ajuste propio en ⋯, «Sugerencias»**, **separado de «Ayuda»**. **«Ayuda»** (`assist`) **corrige** lo que la persona toca (cuantizar a la rejilla, imantar a la escala); **«Sugerencias»** **propone** cosas nuevas. Se pueden combinar de cualquier forma.
- **Apagado, no se propone nada**: ni la melodía sugerida (ni su fantasma ni su sonido), ni las variaciones al copiar, ni el paso de la guía que habla de la sugerida. La app se comporta **exactamente como hoy**.
- **Se guarda** por dispositivo con las demás preferencias (`StudioPrefs.suggestions`, con su guarda y migración; por defecto, **activado**).
- **Lo que no es una propuesta sigue funcionando** aunque esté apagado: la **conversión en canción** y cada variación **pedida a mano** son acciones **explícitas** (un botón), no sugerencias; si se **apagan** las sugerencias mientras hay una propuesta a la vista, **se retira** (no se acepta ni se pierde nada).

## 4. Lo que NO hace la melodía sugerida

- No decide el **sinte** (el del estilo) ni los **efectos**; no toca la batería ni el bajo.
- No se usa en **Componer** (allí se compone con células; la ayuda es de Jugar) ni con varias células a la vista (la sugerida es de **la célula que se ve**).
- **No sustituye** a lo cantado ni a lo escrito a mano: solo sale con la franja **vacía**.

## 5. Copia con variación

### 5.1 Qué hace la persona

En **Componer**, al **copiar** una célula (arrastrar el asa a agua vacía; 005 §7.1 y §15), la copia sale **suelta**, como hoy, pero **con una variación propuesta y marcada** (borde a trazos): una fila de chips junto a ella:

| Chip | Qué hace la copia |
|---|---|
| **+ energía** | **Platillo más rápido** (corcheas → semicorcheas), **caja o bombo extra** (un golpe en un hueco que el estilo pide), bajo y acordes **encendidos**, filtro más abierto |
| **− energía** | **Sin bombo** y la batería a la mitad (la melodía se queda); si la célula ya está pelada, solo la **melodía** |
| **variar la melodía** | **Otro ritmo** (mismos golpes de caja/bombo como anclas, otras sílabas), **octava** (arriba o abajo, dentro del registro) o **respuesta a la frase anterior** (§5.3) |
| **redoble** | **Redoble de caja al final** (4 semicorcheas en el último tiempo del último compás; con loops de 1 compás, se hace de 4 para poder ponerlo) |
| **igual** | Una copia exacta (como hoy) |

- Las variaciones **siguen el estilo actual** (§3.2b): el platillo no pasa de la rejilla y el tempo del estilo, los golpes extra salen de sus `priors`, la melodía se queda en su escala. Y **solo se proponen con «Sugerencias» encendido** (§3.4).
- **Tocar la copia = aceptar** (se quita el borde a trazos y los chips). **«↻ otra»** = otra variación **del mismo tipo** (siguiente semilla), siempre **partiendo de la original** (no de la anterior propuesta).
- **Nunca se pierde nada**: la copia es **una célula suelta** (005 §15.1: sin hilos y sin sonar, tenue); si la persona la mueve, la engancha o la edita, **se da por aceptada**. «↶ deshacer» (el chip de 8 s) la quita.
- **Orden de los chips**: el que más ayuda a **avanzar la canción** primero: si la célula es la **última de su grupo**, **+ energía** (para ir hacia el drop); si ya lleva **todas las capas**, **− energía** (para el respiro); en una **melodía**, **variar**.

### 5.2 Las variaciones, una a una (puras: `lib/variations.ts`)

`varyCell(cell, tipo, semilla, estilo) → Cell` (la célula nueva; **la original no se toca**). Reglas **de los datos**, sin sonidos nuevos:

- **+ energía**: del patrón de platillo, se añaden los golpes que faltan hasta las semicorcheas (los que ya están **no se mueven**); un golpe de caja o de bombo **en el hueco con más peso del prior del estilo** (`priors`, 003 E5) que no esté ya; `parts.bass` y `parts.chords` a verdadero; `lpf` (si lo hay) **sube** un 40 %.
- **− energía**: **se quitan los golpes de bombo**; el platillo se queda a la mitad (se conservan los de posición par); **la caja se queda** si hay, salvo que ya no haya bombo (entonces se quita también); `parts.bass` a falso; **se conservan melodía y acordes**.
- **variar la melodía** (en la franja de la melodía): (a) **ritmo**: se **reparten** las mismas notas de otra manera sobre los anclas (caja/bombo) y la rejilla; (b) **octava**: +12 o −12 si cabe en el registro; (c) **respuesta** (§5.3).
- **redoble**: los últimos 4 pasos del último compás del loop de caja pasan a `sd sd sd sd` (si el loop es de 1 compás, **primero se repite a 4** y luego se pone el redoble); no toca otros loops.

### 5.3 La respuesta a la frase anterior

La melodía de la célula original es **la pregunta**; la copia tiene que **contestar**:
1. **Mismo ritmo** que la original (reconocible), con la **forma invertida** (cada intervalo cambia de signo respecto a la primera nota) y **cada nota imantada a la escala** (`snapToScale`).
2. **Termina distinto**: si la pregunta acaba en una nota que **no es la tónica** (frase abierta), la respuesta **acaba en la tónica** (cerrada), y al revés.
3. Todo en el **registro** del sinte.

## 6. Cómo se encaja con «Convertir en canción» (011 §14.2)

«Convertir en canción» **no tiene lógica propia**: es una **receta de variaciones** sobre la célula, por estilo (datos puros, `lib/songTemplates.ts`):

| Parte | Vueltas | Variación sobre la célula original |
|---|---|---|
| **Intro** | 4 | **− energía** (una vez o dos, hasta quedarse con el fondo y una capa) |
| **Entra** | 4–8 | **− energía** una sola vez (con melodía si la hay) |
| **Subida** | 4 | **− energía** (sin bombo) + **redoble** + `lpf` que se abre (como los risers de 008) |
| **Drop** | 8 | **la original** (o **+ energía** si ya estaba llena) |
| **Final** | 2–4 | **− energía** hasta los acordes, con `lpf` que baja |

Así: **mejorar una variación mejora la conversión**, y la conversión **se prueba** con las mismas funciones puras. Y la **melodía sugerida** (§3) puede **alimentar la conversión**: «convertir» sobre un ritmo sin melodía acepta una sugerida (con aviso) para que el Drop la lleve.

## 7. Datos y código (para estimar)

| Pieza | Dónde | Notas |
|---|---|---|
| Arreglos de la fuga (F1–F4) | `pitch.ts` (`fmin`), `liveMelody.ts` y `analysis.worker.ts` (la puerta de batería), `echoGate.ts` (F4) | Cambian lo que se detecta, no el modelo |
| `suggestMelody` | `lib/suggestMelody.ts` (puro) | Usa `STYLE_MUSIC`, `melodyAssist` y `melodyView` |
| El interruptor «Sugerencias» | `useAudioEngine.ts` (`suggestions`, como `assist`), `usePrefs.ts`, `prefsGuard.ts`, `SettingsSheet.vue` | Una casilla; las dos ayudas lo miran antes de proponer |
| La sugerida en el motor | `useAudioEngine.ts` (`suggestion`: `{ hits, seed, synth } \| null`, **no** en `Song`) | Una línea extra en `songCode('engine')` a bajo volumen |
| La sugerida a la vista | `VisualStage.vue`/`AroCanvas.ts` (puntos huecos en la franja), chip «↻ otra» | El estilo de 003 E3.3 |
| `varyCell` | `lib/variations.ts` (puro) | Usa `priors`, `assist.ts`, `melodyView` |
| La propuesta en Componer | `useAudioEngine.ts` (`proposal`: `{ cellId, sourceId, kind, seed } \| null`, **no** en `Song`) + chips en la colonia | |
| Recetas de «Convertir» | `lib/songTemplates.ts` (puro) | 011 §14.2 |

**El modelo `Song` no cambia.** Las propuestas son **estado del motor**, no datos guardados; lo que se acepta es una célula o un loop como cualquier otro.

## 8. Cómo lo haría (fases, una por commit, cada una útil sola)

| Fase | Qué | Por qué en este orden |
|---|---|---|
| **S1** | **Arreglos F1 y F2** (la fuga y el «bum» con tono) con sus tests de señales; F3 si cuadra | Es un **error real**, independiente de lo nuevo, y la melodía sugerida **no tiene sentido** si la falsa sigue saliendo |
| **S2** | `suggestMelody` (puro) con tests: determinista, todo en escala, nota de acorde en los apoyos, termina en la tónica, 4 compases, dentro del registro, **semillas distintas dan melodías distintas**, y para **cada estilo y cada remix** | Se afina **sin interfaz**, mirando las notas que salen |
| **S3** | La sugerida **a la vista y a oídas**: fantasma en la franja, suena suave, aceptar, «otra», «✕», y **la voz manda**; ajuste en ⋯; el paso «toca la franja» de la guía | Es lo que se prueba **a mano** |
| **S4** | `varyCell` (puro) con tests: **la original no cambia**, cada tipo hace lo que dice, **todo sigue siendo una célula válida** (`isCell`), idempotencia razonable, para cada estilo y remix | Es el cimiento de §5 y de §6 |
| **S5** | **Copia con variación** en Componer: propuesta marcada, chips, aceptar, «otra», deshacer | Interfaz sobre S4 |
| **S6** | **Convertir en canción** (011 §14.2) con `songTemplates` sobre S4 y la sugerida | Cierra el círculo |
| (luego) | **Componer en directo** (011 §14.1) | Usa lo anterior: nombrar partes y variaciones |

**Lo primero que haría es S1**: es lo único que **ya está roto** (un fallo que dio una melodía que nadie cantó) y es pequeño: dos cambios en el detector y dos tests de señales.
Después **S2 y S3** (la melodía sugerida, que es lo que **más se nota** y lo que dio la idea) y, con ella ya buena, **S4–S6** (las variaciones y la conversión).

## 9. Decisiones (2026-11-15)

1. **Sale sola**, con el interruptor «Sugerencias» (§3.4), por defecto activado.
2. **Volumen de la sugerida: ≈ 35 %** (y suena siempre, no solo al tocar la franja). La densidad por estilo de la §3.2b es una propuesta a afinar de oído.
3. **«Otra» sigue una secuencia fija y reproducible** por ritmo (la misma entrada da las mismas sugerencias en el mismo orden).
4. **Una variación se acepta sola** si se edita la copia (nunca se pierde nada); tocarla también la acepta.
5. **F4 no por ahora**: F1–F3 bastan.
6. **Las variaciones solo en Componer (copiar) y en «Convertir en canción»**; no hay botón de variar en Jugar.
7. **Nombres de los chips:** «+ energía», «− energía», «variar melodía», «redoble».

## Fuentes de lo medido

Las pruebas de la §2.2 son **señales sintéticas y los WAV reales del kit** pasados por `LiveMelody` (`app/lib/liveMelody.ts`) con sus opciones por defecto; se convertirán en tests (S1).
