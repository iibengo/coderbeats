# Spec 005 · Células (la canción)

Estado: **aprobada** (2026-11-13), con las decisiones de §12.
Parte de: spec 001 (§14.1, "Spec futura: células") y spec 003 (el aro, terminada). Va **antes que la melodía** (spec 002): cambia el orden de §14.1.
Revisada contra el código de `main` (91854eb).

## 1. Idea

- Cada **célula** es un aro como el de hoy (spec 003): sus loops, su bajo y sus acordes.
- Una **canción** es varias células que suenan una tras otra, cada una un número de **vueltas** (1 vuelta = 1 compás, E1.1 de la 003).
- El objetivo principal es **crear tu propia canción**. Las demos y plantillas son para aprender e inspirarse.
- Una canción de una sola célula es **exactamente la app de hoy**: nada cambia para quien no quiera canciones.

**Principio de reparto: "de cerca se toca, de lejos se compone".**
- **De cerca** (una célula en pantalla): se toca la célula, como hoy. Golpes con el dedo, beatbox, bolas.
- **De lejos** (la colonia): se compone la canción. Crear, copiar, ordenar, vueltas y borrar células.

Así ningún gesto de hoy cambia de significado y el centro del aro no carga con más funciones (§6).

## 2. Alcance

**Dentro**
- Modelo de canción (células, orden, vueltas) con persistencia y migración de lo guardado.
- Motor: las células suenan una tras otra en la línea de compás exacta, con su bajo y sus acordes.
- Transición de agua entre células, y una cámara que sigue a la que suena.
- **Bucle**: tocar una célula la deja sonando en bucle hasta soltarla.
- Colonia: zoom alejado, mapa, viajar a una célula.
- Crear: célula vacía, copiar (dividir), cambiar el orden y las vueltas, borrar.
- Tempo fácil (4 toques).
- Plantillas por estilo y demos-canción de los tres estilos.
- Código Strudel de la canción entera, que suena igual en strudel.cc.

**Fuera (siguientes pasos)**
- Fusionar dos células.
- Modo reel (cámara 3D) y exportar.
- Biblioteca, guardar varias canciones y compartir por enlace (§14.1, con la spec 004).
- Estilo o kit distintos por célula: la canción tiene un estilo, un kit y un tempo.
- Células libres (satélites), en paralelo a la canción: idea en §13.1.

## 3. Modelo de datos (`lib/cells.ts`, puro)

```ts
export type Turns = 1 | 2 | 4 | 8

export interface Cell {
  id: number
  /** loops de la célula; `phaseBar` pasa a ser relativo al inicio de la célula */
  loops: FreeLoop[]
  /** bajo y acordes del fondo que suenan en esta célula */
  parts: Parts
  /** compases que suena antes de pasar a la siguiente */
  turns: Turns
  /** posición en el mapa (unidades = radio de una gota) y profundidad 0..1 (0 = delante) */
  at: { x: number; y: number; depth: number }
}

export interface Song {
  version: 1
  cells: Cell[]
  /** orden de reproducción (ids); por defecto, el de creación */
  order: number[]
  /** tempo propio; null = el del estilo */
  bpm: number | null
  nextCellId: number
  /** ids de loop únicos en toda la canción (el motor los usa en `color("l<id>")`) */
  nextLoopId: number
}
```

**Lo que cambia respecto al código de hoy**
- `LoopsState` (`lib/freeLoops.ts`) deja de ser el estado raíz. Las funciones puras de loops (`addPhrase`, `mergeLoops`, `loopEdit.ts`) siguen igual, pero trabajan sobre la célula que se toca.
- **`phaseBar` relativo a la célula.** Cada vez que una célula empieza, sus loops empiezan por su compás 0. En una canción de una célula que empieza en el compás 0, es lo mismo que hoy.
- **Vueltas y loops largos:** las vueltas de una célula nunca bajan del loop más largo. Una célula con un loop de 4 compases solo admite 4 u 8. Si grabas un loop de 4 compases en una célula de 1 vuelta, la célula pasa a 4.
- **`MAX_LOOPS = 8` pasa a ser por célula.** Como mucho **16 células** por canción.
- El estilo, el kit, el tempo, los efectos (filtro, espacio, calor) y el modo de fondo son de la canción, no de cada célula.
- **Persistencia:** nueva clave `coderbeats:song:v1`. Al abrir, si solo existe `coderbeats:loops:v1`, se migra a una canción de una célula con esos loops, `parts` = el `bgManual` guardado y `turns` = el loop más largo. La clave vieja se deja de escribir.

## 4. Cómo suena

### 4.1 Dos estados: canción y bucle

| Estado | Qué suena | Cámara | Micro |
|---|---|---|---|
| **Canción** | cada célula sus vueltas, en orden; tras la última, vuelve a la primera | sigue a la que suena | **no graba** si hay 2 células o más (§4.4) |
| **Bucle** | una célula, repetida entera (sus `turns` compases) | en esa célula | graba en esa célula, como hoy |

- **Entrar en bucle:** tocar el aro de la célula que suena, que la deja ahí mientras juegas con ella; o tocar otra célula (un marcador del borde, o una célula de la colonia), que hace que la cámara viaje y que esa célula entre en la siguiente línea de compás.
- **Salir del bucle:** "▶ seguir" en la chapa de vueltas (§6). La canción sigue desde esa célula y le toca terminar sus vueltas a partir de ese compás.
- **Play** arranca desde la célula que se ve, en estado canción. Con una sola célula, canción y bucle son lo mismo: la app de hoy.
- Si la orden de bucle llega en los 0,3 s antes de una línea de compás, cuando la transición ya está decidida, el bucle se aplica a la célula que entra (es la que ya se está viendo). Es el mismo margen que las frases (§16.12).

### 4.2 Motor (`useAudioEngine.ts` y `lib/song.ts`)

- **Un plan puro** (`lib/cells.ts`), que se testea sin audio:
  - `advance(song, cursor, bar)` da la célula que suena en el compás global `bar` y su compás de inicio, a partir de la que sonaba (`cursor`). Tiene en cuenta el orden, las vueltas y el bucle, y se pone al día aunque el cursor se haya quedado atrás varios compases.
  - `windowAt(song, cursor)` da los tramos que van en el código del motor: la célula que suena y la siguiente, con sus compases de inicio y final.
- **El código del motor solo lleva la célula que suena y la siguiente**, cada una acotada a sus compases con números fijos:
  ```js
  stack(/* célula 3 */ …).filterHaps((h) => h.whole.begin >= 120 && h.whole.begin < 128),
  stack(/* célula 4 */ …).filterHaps((h) => h.whole.begin >= 128 && h.whole.begin < 136),
  ```
  - Se reevalúa al **entrar** en cada célula, para añadir la siguiente. Así la siguiente siempre está en el código una célula entera antes de sonar.
  - En bucle, la célula va sin límite final.
  - Es el mismo mecanismo que `bornAt` y `prev` de hoy (filtrar haps por compás). No hay `ref()` que consultar en cada hap, y el código que se evalúa no crece con el número de células.
- **Fase de los loops:** la rotación de `loopTokens` usa `inicioDeLaCélula + phaseBar` en vez de `phaseBar`.
- **Bajo y acordes por célula:** hoy entran y salen con rampas de 1–2 compases sobre nodos nativos (`rampPart`). Entre células cambian **en seco en la línea de compás**, con un fundido de unos 10 ms para que no haya chasquidos. Es lo que hace un DJ en un drop; la suavidad la pone el barrido (§4.3). Dentro de una célula, las bolas "bajo" y "acordes" siguen funcionando como hoy y cambian los `parts` de esa célula.
- Los modos de fondo "progresivo" y "completo" solo se aplican a canciones de una célula. Con más de una, mandan los `parts` de cada célula. "Sin fondo" (y tocar con dos dedos) sigue apagando el fondo de toda la canción.

### 4.3 Barrido de filtro en la transición

- En los **2 últimos tiempos** de la última vuelta, el filtro de la canción se abre un poco hacia agudos (`djf` de 0,5 a 0,62). Vuelve a 0,5 justo en la línea de compás, con el mismo adelanto de 0,15 s que usa `drop()` hoy.
- Es suave a propósito: si se duda, menos. Las plantillas (fase 4) pueden pedir otros pasos (§8).
- No suena con el filtro ya movido por ti: si tu filtro no está en 0,5, no hay barrido.

### 4.4 Micro en estado canción

**Propuesta: con 2 células o más, en estado canción no se graba.** Los golpes salen en el diagnóstico como "ignorado: canción avanzando".
- **Por qué:** un loop nace en la siguiente línea de compás (§16.12), y en canción esa línea puede ser ya de otra célula. Nacería donde no lo esperabas.
- **Para grabar:** tocas la célula (bucle) y haces beatbox, como hoy.

## 5. Cómo se ve

### 5.1 Cámara

- Un **mundo 2D** donde cada célula está en `at`. De cerca, la cámara centra la célula en el rectángulo libre (E1.8 de la 003), con el zoom de hoy (`coderbeats:aro:v1`).
- **Mientras suena, la cámara sigue a la célula que toca.** Si mueves el mapa tú (fase 2), deja de seguirla hasta que tocas "seguir".
- **`AroCanvas` pasa a dibujar varias gotas** con una transformación de cámara. De cerca se dibujan como mucho dos (la que suena y la que entra). En la colonia, todas con menos detalle (§7.2).

### 5.2 Transición de agua

Con los tiempos atados al reloj (`clockNow`, E1.6) y "L" = la línea de compás donde cambia:
1. **Última vuelta, segunda mitad:** la célula se estira hacia la siguiente y forma un **puente de agua**: el contorno de la gota se deforma hacia la otra con el mismo ruido que la hace respirar.
2. **Dos últimos tiempos:** el barrido de filtro (§4.3). Un brillo tenue corre por el puente hacia la siguiente.
3. **De 1 tiempo antes de L a 1 tiempo después:** la cámara se desliza con una curva suave, sin rebote.
4. **En L, exacta:** la nueva se enciende, que es cuando suena. La anterior se apaga en 1 tiempo y el puente se retrae.

- **Con movimiento reducido:** sin estiramiento ni puente; la cámara corta en L y hay un fundido de opacidad de 0,2 s.
- Si las dos células están muy lejos (en la colonia), el puente se dibuja igual. Como mucho mide 3 radios; si están más lejos, se ve solo la cámara viajando.

### 5.3 Marcadores del borde

- Cada célula fuera de pantalla es un **puntito en el borde**, en la dirección donde está.
  - La siguiente que va a sonar se ve en rosa `#F496BC`; las demás, en blanco tenue.
  - Con muchas, se agrupan los puntitos que quedan a menos de 16 px unos de otros.
- **Tocar un puntito** hace viajar a esa célula, que queda en bucle (§4.1).
- Quedan dentro del rectángulo libre, sin pisar el estilo, "⋯", Play ni las bolas.

## 6. Repartir las funciones del centro

§14.1 avisaba de que el centro acumulaba borrar, tempo, dividir y vueltas. Propuesta:

| Función | Dónde | Por qué ahí |
|---|---|---|
| **Borrar un golpe** | **el centro**, como hoy (llevar el golpe al centro) | es lo único que el centro hace hoy y se queda así |
| Puntitos del compás (1–4) | junto al centro, como hoy (E1.1) | solo se ven, no se tocan |
| **Vueltas y bucle** | **chapa de vueltas**: una gotita pegada al borde de la gota, arriba, donde empieza la aguja | se ve sin tapar golpes y está lejos del centro |
| **Cambiar las vueltas** | en la colonia, tocar el **número** de la célula (1 → 2 → 4 → 8) | es estructura: se compone de lejos |
| **Dividir (copiar)** | en la colonia, arrastrar desde una célula y soltar en agua vacía | ídem; de cerca un dedo es siempre el aro (E1.5) |
| **Orden** | en la colonia, arrastrar de una célula a otra | ídem |
| **Tempo** | tocar el **BPM** junto al nombre del estilo, arriba | el tempo es de la canción, no de una célula |

**La chapa de vueltas** (de cerca)
- Muestra la vuelta en la que va la célula con puntitos (●●○○ = vuelta 2 de 4; con 8, dos filas de 4).
- **En canción**, tocarla deja la célula en bucle: los puntitos pasan a un ∞ pequeño. **En bucle**, muestra "▶ seguir" y, al tocarla, la canción sigue (§4.1).
- **Con una sola célula** no se ve.

**Tempo fácil** (fase 3)
- Tocar el BPM lo enciende en rosa: "toca 4 veces".
- Cuatro toques en cualquier sitio, o 4 bombos con la boca, fijan el tempo (la media de los 3 intervalos, redondeada a un BPM entero, dentro de ±25 % del tempo del estilo).
- Se aplica en la siguiente línea de compás. El motor rearranca como hoy al cambiar de estilo (`restart()`).
- Mantener el BPM vuelve al tempo del estilo.
- Si en 3 s no llegan los 4 toques, se cancela sin cambiar nada.

## 7. La colonia (zoom alejado)

### 7.1 Navegar

- **Entrar:** pellizcar para alejar más allá del zoom mínimo de la gota; el zoom es continuo y la cámara sale a la colonia. En escritorio, con la rueda.
- **Salir:** tocar una célula (la cámara viaja y la acerca) o pellizcar para acercar.
- **Gestos en la colonia** (un dedo sí mueve aquí, porque no hay aro que tocar):

  | Gesto | Qué hace |
  |---|---|
  | arrastrar agua | mover el mapa (la cámara deja de seguir; aparece "seguir") |
  | tocar una célula | viajar a ella, en bucle (§4.1) |
  | tocar el número de una célula | vueltas 1 → 2 → 4 → 8 (fase 3) |
  | tocar agua vacía | célula nueva (fase 3) |
  | arrastrar desde una célula | sale un hilo de agua: soltarlo en agua vacía = copia, y sobre otra célula = orden (fase 3) |
  | mantener una célula (0,6 s) | borrarla, con el mismo anillo que las bolas (fase 3) |
  | pellizcar | zoom |

- Los dos dedos no tienen filtro ni espacio en la colonia (se usan de cerca). En escritorio, arrastrar con el ratón mueve el mapa.

### 7.2 Cómo se ven

- Cada célula es su gota en pequeño, con sus franjas y sus golpes como puntos, sin ondas ni estela.
  - Solo la que suena lleva aguja y se enciende con los golpes.
  - Las silenciadas o vacías se ven fantasma.
- **Profundidad:** las del fondo, algo más pequeñas (hasta un 70 %) y tenues. Al mover el mapa se desplazan menos que las de delante (parallax). Solo se mira: al tocar, se elige la de delante.
- **Hilos de orden:** líneas de agua muy tenues que unen las células en el orden en que suenan. Por el hilo de la que suena ahora corre el brillo de la transición.
- **Número de vueltas** junto a cada célula, pequeño, en blanco tenue.
- El vigilante de frames (E1.7) baja primero el detalle de las células de fondo.

## 8. Plantillas y demos (fase 4)

- **Cada estilo sabe hacer canciones:** `lib/songTemplates.ts`, con las secciones (nombre, vueltas, partes del fondo, qué instrumentos se esperan) y el paso entre ellas.

  | Estilo | Estructura (vueltas) |
  |---|---|
  | drum and bass | intro 4 · subida 4 · drop 8 · final 2 |
  | house | intro 8 · subida 4 · drop 16 · salida 8 |
  | hip hop 90 | intro 4 · estrofa 8 · estribillo 8 · estrofa 8 · estribillo 8 |

- **Pasos entre secciones:** `barrido` (el de §4.3, por defecto), `subida` (el filtro se cierra a lo largo de toda la célula y se abre de golpe en el drop) y `corte` (un tiempo sin batería antes de la línea).
- **"Usar estructura de <estilo>"** en ⋯ pone las células vacías de la plantilla, con sus vueltas y sus partes, y tú las llenas. Si ya tienes una canción, pide confirmación, como "Cargar demo".
- En las células vacías de una plantilla, las sugerencias del estilo (E3.3) salen en las franjas que la sección espera.
- **"Cargar demo"** carga la canción completa del estilo.

## 9. Código Strudel

- **El que se ve y se copia** (en ⋯) es la canción entera con `arrange` de Strudel (disponible en `@strudel/core`). Una sección por célula, en orden:
  ```js
  setcpm(174/4)
  arrange(
    [4, stack(/* intro */ …)],
    [4, stack(/* subida */ …)],
    [8, stack(/* drop */ …)],
    [2, stack(/* final */ …)],
  ).djf(0.5)
  ```
- Pegado en strudel.cc suena la canción, sin barrido: el barrido solo existe en el motor.
- Con una sola célula, el código es el de hoy, sin `arrange`.
- Lo silenciado va comentado, como hoy. El bucle no cambia el código mostrado.

## 10. Aceptación

1. Con la demo de drum and bass (fase 1), las 4 células suenan en orden, cada una sus vueltas, y la canción vuelve a empezar. Cada cambio cae en la línea de compás exacta: ni un golpe de más ni de menos en la frontera (test del plan y prueba de oído).
2. La cámara sigue a la que suena y la transición de agua acaba en la línea de compás. La aguja y las ondas siguen a tempo con lo que se oye (E1.6).
3. Tocar el aro de la célula que suena la deja en bucle. "▶ seguir" la suelta y la canción continúa. Tocar un marcador del borde viaja a esa célula, que queda en bucle.
4. En bucle, el beatbox graba en esa célula. En canción con 2 células o más, no graba y lo dice el diagnóstico.
5. Una canción de una célula se comporta y suena exactamente como hoy, y el código mostrado es el mismo (tests de igualdad de `songCode`).
6. Los loops guardados antes de esta spec aparecen como una canción de una célula.
7. El código copiado suena en strudel.cc con la misma estructura.
8. 60 fps en el iPhone durante una transición, y en la colonia con 8 células sonando.
9. Con movimiento reducido, todo funciona sin estiramiento, puente ni parallax, y la cámara corta.
10. (Fase 3) Crear, copiar, reordenar, cambiar vueltas y borrar células funcionan con el dedo y con ratón; el tempo se fija con 4 toques o 4 bombos.

## 11. Fases

Cada parte termina en algo que se prueba en el iPhone y en un commit con visto bueno, con movimiento reducido y vigilante de frames para lo que dibuje.

**Fase 1 · Ver y oír una canción**
- **1.1 Dos células que suenan una tras otra** (lo mínimo):
  - `lib/cells.ts` (modelo, `advance` + `windowAt`, migración) y `songCode` con células (motor y `arrange`), con tests;
  - el motor reevalúa al entrar en cada célula y cambia bajo y acordes en seco;
  - "Cargar demo" en drum and bass carga la canción (§8, con los loops del reel). Los otros estilos siguen con su demo de una célula.
  - Visual mínimo: la cámara salta en la línea de compás a la célula que suena, sin puente.
  - Hito: oír la demo entera con fronteras limpias.
- **1.2 Transición de agua:** estiramiento, puente, deslizamiento de cámara y barrido de filtro (§4.3, §5.2).
- **1.3 Bucle y marcadores:** tocar la célula que suena la deja en bucle, con la chapa de vueltas; los marcadores del borde; el micro graba solo en bucle (§4.4).

**Fase 2 · Mapa** (§7; decisiones en §12, 9–13)
- **2.1 Alejar y ver** (lo mínimo):
  - el zoom sigue por debajo del mínimo de la gota hasta que caben todas las células (mínimo = ajustar a todas, no fijo);
  - se dibujan todas como gotas pequeñas, sin ondas ni estela; la que suena, en rosa, y la cámara sobre ella;
  - tocar una célula viaja a ella en bucle (`travelTo`) y el zoom vuelve a cerca;
  - `lib/aro/colony.ts` (puro, con tests): zoom → modo, ajustar a todas, posiciones, qué célula hay bajo el dedo;
  - Hito: con la demo sonando, alejar, ver las 4 células, tocar el drop y ver cómo entra.
- **2.2 Mover el mapa y "◎ seguir":** un dedo o el ratón arrastran el mapa y la cámara deja de seguir; "◎ seguir" (centrar) la devuelve a la que suena. Los marcadores del borde se ocultan en la colonia.
- **2.3 Profundidad y parallax:** las del fondo hasta un 70 % y más tenues, con parallax al mover el mapa; al tocar se elige la de delante.
- **2.4 Hilos y números:** hilos de orden entre células, con el brillo de la transición corriendo por el de la que suena, y número de vueltas junto a cada una.
- **2.5 Rendimiento:** detalle reducido de las células de fondo en el vigilante de frames; prueba con 8 células sonando.
- Cada parte lleva su movimiento reducido (sin parallax, la cámara corta) y su cuota del vigilante de frames.

**Fase 3 · Crear**
- 3.1 Célula vacía (cae como una gota), borrar célula y "Borrar todo" (= canción de una célula vacía).
- 3.2 Copiar (dividir) y orden con el hilo de agua.
- 3.3 Vueltas (número en la colonia) y tempo fácil (§6).

**Fase 4 · Plantillas y demos**
- Plantillas por estilo y "usar estructura", pasos `subida` y `corte`, y demos-canción de house y hip hop (§8).

### Demo de drum and bass (fase 1.1)

Hecha con los loops de `DEMOS.dnb` (el reel):

| Célula | Vueltas | Batería | Fondo |
|---|---|---|---|
| intro | 4 | platillo | acordes |
| subida | 4 | bombo y caja | acordes (vienen de la intro; el bajo se guarda para que entre fuerte en el drop) |
| drop | 8 | bombo, caja y platillo | bajo y acordes |
| final | 2 | — | acordes |

Colocadas en el mapa en una curva suave, de izquierda a derecha, a distintas profundidades.

## 12. Decisiones (aprobadas el 2026-11-13)

1. **Centro:** solo borrar golpes (§6). Vueltas y bucle van en la chapa; dividir, orden y vueltas, en la colonia; el tempo, en el BPM.
2. **"Tocar una célula la deja en bucle hasta soltarla":** el bucle se suelta con "▶ seguir", no levantando el dedo. Si se soltara al levantar el dedo, no se podría editar la célula con calma mientras suena.
3. **Al terminar la canción, vuelve a empezar.** Encaja con un instrumento para jugar. "Parar al final" irá con el modo reel.
4. **Sin grabación en estado canción** con 2 células o más (§4.4).
5. **Bajo y acordes cambian en seco** entre células; el barrido pone la suavidad (§4.2).
6. **Crear células, solo en la colonia.** De cerca, tocar fuera de la gota sigue sin hacer nada (E1.5), para no crear células sin querer.
7. **Un estilo, un kit y un tempo por canción.**

8. **Subida de la demo de drum and bass:** bombo y caja más los acordes, sin platillo ni bajo. El bajo se guarda para el drop (tabla de §11).

**Fase 2 (aprobadas el 2026-11-13)**

9. **Entrada en la colonia con histéresis:** entre el zoom mínimo de la gota (0,5) y 0,4 se queda cerca, como hoy; por debajo de 0,4 es colonia. Un pellizco algo pasado no te saca de la célula.
10. **Gestos en la colonia:** un dedo mueve el mapa o toca una célula; los dos dedos no tienen filtro ni espacio, pero **tocar con dos dedos sin moverlos sigue cambiando el fondo sí / no**. Cerca, nada cambia.
11. **Qué se oculta al alejar:** la chapa de vueltas, los marcadores del borde y las bolas de loops, de bajo y de acordes (son de la célula que se ve). **Play se sigue viendo.**
12. **Dos "seguir":** el de la chapa ("▶ seguir") continúa la canción; el del mapa es "◎ seguir" y dice "centrar": devuelve la cámara a la célula que suena.
13. **El zoom de la colonia no se guarda:** solo se guarda el de cerca (`coderbeats:aro:v1`), para no abrir la app alejada.

## 13. Ideas para revisar

Ideas anotadas el 2026-11-13. **No están decididas ni entran en ninguna fase todavía**: se revisan
antes de la fase 3 o después.

### 13.1 Células libres (satélites)

- Una **célula libre** es una célula especial que **no está en el orden de la canción**. Suena en
  paralelo, a la vez que la célula que toque, y **sigue sonando aunque la canción cambie de célula**.
- **Por dentro es una célula normal**: su aro, sus carriles, y puede llevar cualquier cosa
  (melodía, bombos, cajas…). Lo más habitual será la melodía.
- **En el mapa flota aparte, sin hilos**, como un satélite de la colonia.
- **Se enciende y se apaga cuando yo quiera**; si no, suena sin fin.
- **Más adelante:**
  - varias células libres;
  - elegir en qué células de la canción suenan.
- **Encaje con la melodía (spec 002):** al cantar, poder mandarla a una célula libre.

**Puntos a revisar antes de decidir** (salen de cómo está hecho hoy):
- **Motor (§4.2):** el código solo lleva la célula que suena y la siguiente. Una célula libre sería
  un tramo más, sin final, siempre en el código, con su fase propia (no depende del inicio de la
  célula de la canción).
- **Vueltas:** una célula libre sin vueltas de canción repite sus loops sin fin. Su "turns" no pinta
  nada o solo marca el compás que se ve.
- **Grabación (§4.4):** hoy el micro graba solo en bucle, en la célula que se ve. Habría que decir
  qué pasa con la libre: ¿se graba cuando es la que se ve y la canción está en bucle, o siempre que
  la ves?
- **Límite de células (§3):** ¿cuenta para las 16?
- **Mapa (§7):** sin hilos de orden y con su propio sitio (¿fuera de la curva, más arriba?). Los
  marcadores del borde y el ajuste de zoom de la colonia tendrían que contar con ella.
- **Chapa de vueltas (§6):** para una célula libre, en vez de la vuelta, un interruptor
  encendida / apagada.
- **Código Strudel (§9):** `arrange` no vale para algo en paralelo; haría falta un `stack` con la
  canción y la libre.
- **Barrido y transiciones (§4.3, §5.2):** la libre no lo lleva; el barrido de filtro de la
  canción la afectaría, a menos que se excluya.
