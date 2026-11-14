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
| **Mover** | en la colonia, arrastrar el cuerpo de una célula | es composición del mapa; el orden no cambia |
| **Dividir (copiar)** | en la colonia, arrastrar desde el **asa** de una célula y soltar en agua vacía: copia **suelta** (§15) | de cerca un dedo es siempre el aro (E1.5) |
| **Orden / enganchar** | en la colonia, arrastrar desde el asa de una célula y soltar sobre otra (o sobre una suelta) | ídem |
| **Cortar un hilo** | en la colonia, tocar el hilo: la célula a la que llevaba queda suelta (§15) | ídem |
| **Deshacer borrar** | chip "↶ deshacer" tras borrar una célula o usar "Borrar todo" | borrar es lo único destructivo de la colonia |
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

- **Entrar:** pellizcar para alejar más allá del zoom mínimo de la gota; el zoom es continuo y la
  cámara sale a la colonia. En escritorio, con la rueda.
- **Salir:** **doble toque** sobre una célula (la cámara viaja a ella y la acerca) o pellizcar para
  acercar. Un toque simple ya no acerca.
- **Dos tipos de células:** las de la **canción** (unidas por hilo; solo suena una a la vez) y las
  **libres** (§13.1; suenan a la vez que la canción).
- **Gestos en la colonia** (un dedo sí mueve aquí, porque no hay aro que tocar):

  | Gesto | Célula de la canción | Célula libre |
  |---|---|---|
  | **un toque** | salta a ella en la siguiente línea de compás y queda en bucle (§4.1), **sin acercar**; si ya está en bucle, **lo suelta** (la canción sigue) | la enciende o la apaga, en la siguiente línea de compás |
  | **doble toque** | entrar: la cámara viaja a ella y la acerca | igual |
  | **arrastrar el cuerpo** | moverla en el mapa | igual |
  | **arrastrar el asa** | hilo de agua: en agua vacía = copia; sobre otra célula = orden | no tiene asa |
  | **mantener 0,6 s** | borrarla, con el mismo anillo que las bolas (y "↶ deshacer") | igual |
  | **tocar su número** | vueltas 1 → 2 → 4 → 8 | no lleva número |

  | Gesto sobre el agua | Qué hace |
  |---|---|
  | arrastrar | mover el mapa (la cámara deja de seguir; aparece "◎ centrar") |
  | tocar agua vacía | célula nueva, que cae como una gota y queda al final del orden |
  | pellizcar | zoom |

- **Doble toque:** el primer toque actúa al momento; el segundo, si cae sobre la misma célula en
  menos de 300 ms, solo entra y no repite la acción. En una libre, entrar para editarla la enciende
  o apaga como efecto secundario.
- **Mover:** la célula sigue al dedo y suelta donde la dejes (`at.x`, `at.y`; la profundidad no
  cambia). El orden no cambia y los hilos la siguen. El zoom mínimo ("ajustar todas") se recalcula
  al soltar, no mientras arrastras. Las células pueden solaparse; manda la profundidad (§7.2).
- **Soltar el bucle:** con el zoom alejado la chapa de vueltas no se ve, así que el bucle se suelta
  tocando otra vez la célula que está en bucle, o con el botón **"∞ ▶ seguir canción"**, junto a Play
  (a su derecha), que se ve mientras haya bucle. La célula vuelve a empezar en la siguiente línea
  de compás y la canción sigue desde ahí (§4.1).
- **Física sutil al mover:** todo es visual y se pasa con movimiento reducido. Mientras arrastras,
  las células unidas por hilo se dejan llevar un poco (hilo elástico) y las cercanas se apartan si
  acercas mucho la tuya. Al soltar, la movida sigue deslizándose con inercia en la dirección del gesto
  y se frena sola; las demás vuelven a su sitio con un pequeño vaivén. Solo se guarda la posición
  final de la célula movida.
- **Asa:** un puntito en el borde de cada célula de la canción, hacia la siguiente en el orden (la
  última, hacia la derecha). Solo se dibuja y se puede coger con un radio de célula de unos 14 px o
  más; con menos zoom, copiar y ordenar quedan desactivados.
  - **Copiar:** soltar el hilo en agua vacía crea una copia **suelta** allí (loops, partes y vueltas):
    sin hilos y sin sonar, tenue, hasta que se **enganche** (enmienda 1, §15). Con 16 células no se copia
    y el diagnóstico lo dice.
  - **Ordenar y enganchar:** soltar el hilo de A sobre B pone a B justo después de A. Vale con una de la
    canción (ordenar) y con una suelta (la engancha). La canción es cíclica y Play arranca desde la
    célula que ves, así que esta regla cubre cualquier posición.
  - Mientras tiras del hilo, la copia se ve como una silueta bajo el dedo y la célula sobre la que
    caes se resalta.
- **Borrar y deshacer:** al borrar una célula, o al usar "Borrar todo" (⋯, que **pide
  confirmación**), aparece un chip "↶ deshacer" unos 8 s, encima de Play a la altura de la fila de
  bolas (en la colonia, a la izquierda de "◎ centrar").
  - Devuelve lo último que se borró: la célula con sus loops, su posición y su sitio en el orden
    (entre sus mismos vecinos si siguen ahí; si no, al final), o la canción entera tal como estaba
    antes de "Borrar todo".
  - Un solo nivel: borrar otra cosa reemplaza lo anterior. No se guarda al cerrar la app.
- Los dos dedos no tienen filtro ni espacio en la colonia (se usan de cerca). En escritorio,
  arrastrar con el ratón mueve el mapa.

### 7.2 Cómo se ven

- Cada célula es su gota en pequeño, con sus franjas y sus golpes como puntos, sin ondas ni estela.
  - Solo la que suena lleva aguja y se enciende con los golpes.
  - Las silenciadas o vacías se ven fantasma.
- **Profundidad:** las del fondo, algo más pequeñas (hasta un 70 %) y tenues. Al mover el mapa se desplazan menos que las de delante (parallax). Solo se mira: al tocar, se elige la de delante.
- **Hilos de orden:** líneas de agua muy tenues que unen las células en el orden en que suenan. Por el hilo de la que suena ahora corre el brillo de la transición.
- **Número de vueltas** junto a cada célula, pequeño, en blanco tenue.
- **Asa:** puntito en el borde de cada célula de la canción, hacia la siguiente; solo con radio ≥ 14 px (§7.1).
- **Cuánto falta para cambiar:**
  - alrededor de la célula que suena, un **anillo fino de progreso** que se llena con sus vueltas
    (desde arriba, en el sentido de la aguja) y se completa justo al cambiar; en bucle no avanza;
  - debajo de ella, los **puntitos de vueltas** (●●○○) en vez del número, o **∞** en bucle;
  - en la última vuelta, el **hilo** hacia la siguiente se va llenando.
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
10. (Fase 3) Mover, crear, copiar, reordenar, cambiar vueltas, borrar y deshacer células
    funcionan con el dedo y con ratón; un toque suena y el doble toque entra; el tempo se fija con
    4 toques o 4 bombos.

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
- **2.2 Mover el mapa y "◎ centrar":** un dedo o el ratón arrastran el mapa y la cámara deja de seguir; "◎ centrar" la devuelve a la que suena. Los marcadores del borde se ocultan en la colonia.
- **2.3 Profundidad y parallax:** las del fondo hasta un 70 % y más tenues, con parallax al mover el mapa; al tocar se elige la de delante.
- **2.4 Hilos y números:** hilos de orden entre células, con el brillo de la transición corriendo por el de la que suena, y número de vueltas junto a cada una.
- **2.5 Rendimiento:** detalle reducido de las células de fondo en el vigilante de frames; prueba con 8 células sonando.
- Cada parte lleva su movimiento reducido (sin parallax, la cámara corta) y su cuota del vigilante de frames.

**Fase 3 · Crear y componer** (§7.1; decisiones en §12, 14–19)
- **3.1 Gestos de la colonia:** un toque suena sin acercar; el doble toque entra; arrastrar el
  cuerpo mueve la célula (se guarda y recalcula el zoom mínimo al soltar).
  - Hito: tocar el drop en la colonia, oírlo en bucle sin que se acerque; doble toque para entrar;
    mover una célula y ver cómo la siguen los hilos.
- **3.2 Crear, borrar y deshacer:** tocar agua vacía crea una célula (cae como una gota); mantener
  0,6 s la borra, con el anillo; "Borrar todo" (= canción de una célula vacía) pide confirmación;
  el chip "↶ deshacer" sirve para las dos cosas.
- **3.3 Copiar y ordenar:** el asa y el hilo de agua (§7.1).
- **3.4 Vueltas y tempo:** el número tocable (1 → 2 → 4 → 8) y el tempo fácil (§6).
- **Después, las células libres** (§13.1), con su toque de encender y apagar.

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
12. **Dos botones distintos:** "▶ seguir" (la chapa de vueltas) y "∞ ▶ seguir canción" (la colonia) continúan la canción; el del mapa es **"◎ centrar"** y devuelve la cámara a la célula que suena.
13. **El zoom de la colonia no se guarda:** solo se guarda el de cerca (`coderbeats:aro:v1`), para no abrir la app alejada.


**Fase 3 (aprobadas el 2026-11-13)**

14. **Un toque actúa al momento; el doble toque solo entra.** El segundo toque, a menos de 300 ms
    sobre la misma célula, no repite la acción (§7.1).
15. **Arrastrar el cuerpo mueve; copiar y ordenar van por el asa** (§7.1). Se descarta "mantener
    0,3 s y arrastrar": chocaría con mantener 0,6 s para borrar.
16. **Primera célula libre:** ⋯ → "añadir célula libre". Copiar una libre da otra libre. No lleva asa.
17. **Pasar una libre a la canción (o al revés):** más adelante.
18. **Deshacer lo último que se borre:** una célula o "Borrar todo". "Borrar todo" pasa a pedir
    confirmación (§7.1).
19. **Detalles:**
    a) La última célula de la canción no se puede borrar: se vacía.
    b) Borrar la que suena: suena la siguiente a partir de la siguiente línea de compás.
    c) Una célula nueva se añade al final del orden, con hilo desde la última.
    d) El chip de deshacer dura unos 8 s.
20. **Soltar el bucle desde la colonia:** tocar otra vez la célula en bucle, o "∞ ▶ seguir canción" (§7.1).
21. **Cuánto falta para cambiar:** anillo de progreso, puntitos de vueltas e hilo que se llena (§7.2).
22. **Física sutil al mover:** visual, con inercia al soltar y sin física con movimiento reducido (§7.1).

## 13. Ideas para revisar

Ideas anotadas el 2026-11-13. **No están decididas ni entran en ninguna fase todavía**: se revisan
antes de la fase 3 o después.

### 13.1 Células libres (satélites) · hecho el 2026-11-14 · **sustituido por la enmienda 2 (§16)**

> Implementado en tres partes. Lo que se decidió sin preguntar, en §14 ("Células libres").

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
- **Crear:** ⋯ → "añadir célula libre". Copiar una libre da otra libre.
- **Gestos:** un toque la enciende o la apaga (en la siguiente línea de compás); doble toque, entrar;
  arrastrar el cuerpo, moverla; mantener, borrarla. Sin asa y sin número.
- **Pasar una libre a la canción (o al revés):** más adelante.

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

## 14. Decisiones a revisar

Decisiones que se tomaron sin preguntar al hacer la fase 3 de seguido (2026-11-13). Cada una dice
qué se decidió y por qué; se cambian sin más si no gustan.

**3.2 · Crear, borrar y deshacer**
- **La colonia también se abre con una sola célula.** Hace falta para crear la segunda (decisión 6: las
  células se crean solo en la colonia). Antes pellizcar más allá del mínimo rebotaba; ahora, por debajo
  de 0,4, entra en la colonia con la célula sola.
- **Pasar de una a varias células con la música sonando** (crear, o deshacer un borrado) deja la que
  suena **en bucle** hasta "seguir", para que no salte a una célula vacía.
- **Borrar la que suena la calla al momento**, y la siguiente entra en la siguiente línea de compás.
  (La spec decía solo lo segundo.)
- **Un doble toque en el agua no crea dos células:** el segundo, a menos de 300 ms y 40 px del primero, se ignora.
- **Deshacer "Borrar todo" reinicia la reproducción** si sonaba (vuelve a cargar la canción entera).
- **Deshacer una célula no cabe con 16:** si ya hay 16 células, no se deshace y el diagnóstico lo dice.
- **Vaciar la última célula** también apaga su bajo y sus acordes.
- **El chip "↶ deshacer" cerca** va 40 px por encima de la fila de bolas, para no taparlas.

**3.3 · Copiar y ordenar con el asa**
- **Tocar el asa sin arrastrar** cuenta como tocar su célula (suena en bucle), para no tener un punto muerto.
- **Soltar el hilo sobre la propia célula no hace nada.**
- **Ordenar de la última sobre la primera** deja el mismo ciclo con otro punto de partida (`[b, c, d, a]`);
  no se evita, porque Play arranca desde la que ves y el cambio se ve en los hilos.
- **Copiar y ordenar no se deshacen:** el deshacer es solo de borrados (decisión 18). Si hace falta, se borra la copia.
- **La copia se llama "<nombre> copia"** y mantiene la profundidad de la original.
- **Con menos radio de 14 px no hay asa:** las células pequeñas no se copian ni se ordenan hasta acercar un poco el mapa.

**3.4 · Vueltas y tempo**
- **Tocar el número** da la vuelta 1 → 2 → 4 → 8 → 1 y nunca baja del loop más largo de la célula
  (con uno de 4 compases solo alterna entre 4 y 8). Su zona es de 14 px; el asa tiene prioridad sobre el
  número y el número sobre el cuerpo de la célula. En la que suena, el número está donde van los
  puntitos de vueltas.
- **El BPM se ve siempre**, a la derecha de los estilos: tenue con el del estilo, más claro con uno propio.
- **El tempo nuevo se aplica en la siguiente línea de compás y el motor rearranca desde la célula que se
  ve** (como al cambiar de estilo), así que se pierde el sitio en la canción.
- **Cambiar de estilo quita el tempo propio:** el tempo es del estilo en el que se fijó.
- **"Cargar demo" y "Borrar todo" también vuelven al tempo del estilo** (cargan una canción nueva).
- **Un tempo fuera del ±25 % se recorta,** no se rechaza.
- **Los 3 s de plazo se cuentan desde el último toque,** no desde que se enciende.
- **Con el tempo fácil encendido, cualquier toque en el escenario cuenta** y no hace otra cosa (editar,
  mover…). Los botones (Play, ⋯, estilos) no cuentan.
- **Un tempo guardado roto no descarta la canción:** se limpia y vuelve el del estilo (nunca se pierden células).

(Se añaden con cada parte.)

**Enmienda 1 · células sueltas**
- **Tocar un hilo deja suelta la célula a la que llevaba** (la de destino), no la de origen: así "la canción
  salta por encima" de ella. Si se prefiere la otra, es cambiar un extremo.
- **Las sueltas no tienen asa:** no se pueden copiar ni enganchar a otras desde sí mismas; se copian desde una
  de la canción y se enganchan desde una de la canción.
- **Dar a Play con una suelta a la vista la toca en bucle** (para escucharla) en vez de entrar en la canción.
- **Tocar una suelta en la colonia la toca en bucle** como a cualquier otra, también si la canción es de una
  sola célula (entonces cambia al momento, sin esperar a la línea de compás).
- **Cortar un hilo no se puede deshacer:** se vuelve a enganchar con el asa.
- **El hilo se toca por la curva que se dibuja, con 18 px de margen** (antes, por la recta y con 12 px: se
  fallaba al tocar justo encima), y se ilumina al pulsarlo.
- **Crear una célula con un toque en el agua se puede deshacer** (decisión 18 ampliada): para cuando un toque
  que quería cortar un hilo cae al lado. Solo si la célula sigue vacía.
- **La última célula de la canción (la única del orden) se vacía en vez de borrarse,** aunque haya sueltas.
- **Una suelta borrada se recupera suelta** con "↶ deshacer".
- **Las sueltas se ven al 45 %** de opacidad en la colonia, y sus números también; cerca no cambia nada.

**Células libres (§13.1), 2026-11-14**
- **Modelo:** una libre es una célula con `free: true` y un interruptor `on`. Está en las células y **no en el
  orden**; no es una suelta (la suelta no suena). Lo guardado de antes sigue valiendo.
- **Nueva:** ⋯ → "Añadir célula libre": apagada y vacía, encima de la curva (una al lado de otra), y **se entra
  en ella** al crearla para llenarla.
- **Se enciende sola** al nacer el primer loop que se graba en ella.
- **Fase propia:** su compás 0 es la línea de compás en que se enciende. Al apagarla sigue hasta la siguiente
  línea. Al dar a Play suenan desde el compás 0 las que estaban encendidas (lo encendido se guarda con la canción).
- **Sin fondo propio:** el bajo y los acordes de una libre no suenan (el fondo es de la canción); sus bolas no se
  ven mientras se ve una libre.
- **Los efectos son de todo:** el filtro, el espacio, el calor y el barrido de la transición afectan también a las
  libres (el filtro es del conjunto); no se excluyen.
- **Con una libre a la vista** no hay transiciones ni chapa de vueltas: la chapa es un interruptor "libre · suena /
  apagada". **La vista no sigue a la canción** hasta que se vuelve a una célula de la canción.
- **Limitación:** con una libre a la vista y la colonia abierta, la célula de la canción que suena no lleva anillo
  de progreso ni números de vueltas animados (el plan de transiciones se pausa mientras se ve una libre).
- **Sin asa ni número,** y no se pueden enganchar a la canción (§13.1: "más adelante"). Copiar una libre da otra
  libre apagada en el modelo, pero no hay gesto para hacerlo (no tiene asa).
- **Un toque** la enciende o la apaga (sin esperar nada si está parado; sonando, en la siguiente línea de compás).
  **El doble toque entra** y, como el primer toque ya actuó, entrar la enciende o apaga (decisión 14).
- **Grabar en una libre** se permite con la canción avanzando (en la canción, no).
- **Cuentan para las 16** células. "Cargar demo" estando en una libre vuelve a la primera célula de la canción.
- **Deshacer** una libre borrada encendida la hace sonar de nuevo en la siguiente línea de compás.
- **Los `prev` de los loops de una libre** (versiones anteriores) no se limpian mientras no se ve: es inofensivo.

## 15. Enmienda 1 · células sueltas: copiar, enganchar y cortar (2026-11-13)

> **Cambiado por la enmienda 2 (§16):** una suelta pasa a ser un grupo de una célula apagado; cortar un hilo parte el
> grupo en dos (§16.3) en vez de sacar una célula; las sueltas ya no se escuchan solas en bucle.

Tras usar la colonia: copiar y ordenar era lioso. La copia se metía justo después de la original y luego
costaba moverla. Esta enmienda **manda sobre §7.1** (copiar y ordenar) y sobre la decisión 15.

### 15.1 Células sueltas
- Una **célula suelta** (aparcada) es una célula que **no está en el orden de la canción**: no tiene hilos
  y **no suena con la canción**. En la colonia se ve **tenue**.
- **No es una célula libre** (§13.1): las libres sonarán en paralelo a la canción; las sueltas están
  aparcadas y no suenan.
- Por dentro es una célula normal: se puede tocar (suena en bucle, para escucharla), mover, entrar a
  editarla, cambiarle las vueltas y borrar. **Al dar a Play con una suelta a la vista, suena ella en bucle.**
- **No tiene asa:** no engancha a otras.
- En el modelo, está en `cells` y no en `order`. No cambia el formato guardado: lo guardado sigue valiendo.

### 15.2 Copiar
- Arrastrar el **asa** de una célula a **agua vacía** crea una **copia suelta** allí (sus loops, partes y
  vueltas). Ya no se mete en el orden ni suena.
- Con 16 células (sueltas incluidas) no se copia.

### 15.3 Enganchar
- Arrastrar el asa de una célula **sobre una suelta** la pone **justo detrás** (la regla de ordenar de
  siempre: la suelta pasa a sonar justo después de la que tiene el asa) y ya forma parte de la canción.
- Sobre una célula que ya está en la canción, sigue siendo ordenar.

### 15.4 Cortar un hilo
- **Tocar un hilo lo corta:** la célula **a la que llevaba** queda suelta y la canción **salta por encima**
  (la que iba antes pasa a la que iba después).
- Solo con un toque (menos de 400 ms y sin moverse): arrastrar sobre el hilo sigue moviendo el mapa.
  Prioridad al tocar: asa › número › célula › hilo › agua (el agua crea una célula).
- **Se toca lo que se ve:** el hilo es una curva que se mece, y el toque la sigue (no la recta entre las dos
  células), con **18 px** de margen. Mientras se pulsa justo encima, el hilo se **ilumina** para ver cuál se va
  a cortar.
- **Un toque que falla** y cae en agua crea una célula vacía (3.2): se puede **deshacer** con "↶ deshacer"
  unos 8 s (solo si sigue vacía).
- Si la cortada es la que suena, sigue hasta el final de sus vueltas y entonces salta.
- No hay deshacer del corte: se vuelve a enganchar con el asa.

### 15.5 Lo que no cambia
- **Borrar** (mantener, con "↶ deshacer") vale también para las sueltas, que se recuperan sueltas.
- **La última célula de la canción** (la única que queda en el orden) **no se borra: se vacía**, aunque haya sueltas.
- Máximo 16 células en total, sueltas incluidas.
- Crear en agua vacía (3.2) sigue añadiendo la célula al final del orden.

### 15.6 Lógica y tests
- `isLoose`, `withCopy` (suelta), `withDetached` y `withOrderAfter` con una suelta de destino (cells.ts);
  `threadAt` (colony.ts). Tests: la copia queda fuera del orden, enganchar, cortar (y no se corta con 1 sola),
  avance y ventana con una suelta delante, distancia a un hilo.

## 16. Enmienda 2 · grupos de células en paralelo (2026-11-14)

Estado: **aprobada** (2026-11-14). **Sustituye a §13.1 (células libres) y cambia §15 (sueltas y cortar un hilo)**. Parte del ajuste
de la idea de las libres: en vez de células sueltas independientes, **grupos de células que suenan a la vez**.

### 16.1 La idea
- Una canción es **uno o varios grupos de células**. Un **grupo** es una cadena de células unidas por hilo, en un
  orden: la 1ª → la 2ª → la 3ª…, y tras la última vuelve a la primera.
- El **grupo principal** es la canción de siempre: de él son Play, el bucle, el salto, el barrido, la cámara que
  sigue lo que suena, la chapa de vueltas y las transiciones de agua.
- **Pueden sonar otros grupos a la vez**, cada uno con su orden (p. ej. una melodía A → B → A).
- **Una célula libre es un grupo de una sola célula**, que se repite. **Una suelta es lo mismo, apagado.** Ya no hay
  dos clases de célula: hay **grupos, encendidos o apagados**, y **toda célula está en un grupo**.

### 16.2 Cómo suena
- Cada grupo avanza **por su cuenta**: su célula actual suena sus vueltas y pasa a la siguiente; tras la última,
  vuelve a la primera. Un grupo de una célula se repite cada `vueltas` compases (nunca menos que su loop más largo).
- **Siempre en línea de compás:** un grupo entra, cambia de célula y sale solo en líneas de compás.
- Un grupo se **enciende** en la siguiente línea de compás, empezando por su primera célula (o por la que se toque,
  §16.4); al **apagarse**, sigue hasta la siguiente línea.
- **No se esperan entre sí:** sus duraciones no tienen por qué cuadrar (8 compases frente a 18); cada uno gira por su
  cuenta sobre la misma rejilla de compases.
- El fondo (bajo y acordes) y los efectos globales (filtro, espacio, calor, barrido) son de la canción y afectan a todos.
- **Se puede grabar** en una célula de un grupo que no es el principal con la canción avanzando; el grupo se enciende
  solo, desde esa célula, al nacer su primer loop.

### 16.3 Juntar y separar
- **Juntar (hilo y asa):** arrastrar el asa de A sobre B pone a B **justo detrás de A, en el grupo de A** (la regla
  de ordenar de siempre; B sale de su grupo y este se cierra).
  - Si A es la **cola** de su grupo y B la **cabeza** del suyo, se juntan **los dos grupos enteros**.
  - Un grupo que se queda sin células desaparece.
  - El grupo resultante es el principal si alguno de los dos lo era.
- **Separar:** **tocar un hilo lo corta**: el grupo se parte en dos por ese hilo. La parte de detrás (desde la célula
  a la que llevaba) es **un grupo nuevo, apagado**, para no cambiar lo que suena. **El principal es el que lleva la
  primera célula de la canción.**
- **Copiar (asa → agua)** crea una copia suelta = **un grupo nuevo de una célula, apagado**.
- **Todas las células tienen asa y número**, también las de un grupo de una célula.
- **Una célula aparece una sola vez** en un grupo. Para "A → B → A" se hace una copia de A (A′) y se engancha. La misma
  A repetida (editar una cambia las dos) queda para más adelante.

### 16.4 Encender, apagar y saltar (tocar)
- **Grupo principal:** como hoy (un toque salta a la célula en la siguiente línea y la deja en bucle; otro toque suelta).
- **Grupo apagado:** un toque en cualquiera de sus células lo **enciende, empezando por ella**.
- **Grupo encendido que no es el principal:** un toque en otra célula **salta a ella** (en la siguiente línea de
  compás) y un toque en la que suena lo **apaga**. En un grupo de una célula, un toque lo enciende o apaga.
- **Doble toque:** entra (la cámara se acerca). Mientras se ve una célula de un grupo que no es el principal, la vista
  no sigue lo que suena (como las libres de hoy).
- **En el aro**, la chapa de una célula de un grupo que no es el principal es el interruptor **"grupo · suena /
  apagado"**; no hay bucle ni "seguir".

### 16.5 Cómo se ve
- **Hilos** entre las células de todos los grupos. Los de un grupo apagado, tenues; los de los que no son el
  principal, con un tinte frío muy suave para distinguirlos de la canción.
- **La célula que suena en cada grupo encendido lleva su anillo de progreso** (rosa en el principal, blanco en los
  demás) y sus puntitos de vueltas; las demás, su número.
- **Un grupo apagado** se ve tenue, con el anillo a trazos.
- Los grupos nuevos nacen encima de la curva, uno junto a otro (como las libres de hoy).

### 16.6 Datos y migración
- `Song.order` sigue siendo **el grupo principal**. Los demás: `Song.groups: { id, order, on }[]` y `nextGroupId`, con cada
  célula en un solo grupo. `on` se guarda; al dar a Play, los encendidos empiezan por su primera célula en el compás 0.
- **Migrar lo ya guardado** (no se pierde nada): cada célula con `free` pasa a ser un grupo de una, con su `on`; cada
  suelta (fuera del orden y sin `free`), un grupo de una apagado. `Cell.free` y `Cell.on` se dejan de escribir y se
  siguen leyendo para migrar.
- **Máximo 16 células** en total (un grupo de una célula cuenta). Sin tope de grupos.
- **Mis canciones:** el resumen cuenta los grupos: "4 células + 2 grupos".

### 16.7 Lo que ya está hecho y cómo cambia
- **Se aprovecha tal cual:** el avance de un orden (`stepPlay`, `windowAt`, `endBar`: sirven para cualquier orden), los
  tramos con su fase y `filterHaps` del código, "lo que se ve" frente a "lo que suena", grabar fuera de la canción,
  la chapa-interruptor, los anillos, crear, mover, borrar y deshacer.
- **Cambia:** el modelo (`free`/`on` → grupos), el estado del motor (un recorrido por grupo en vez de `freeRuns`), el
  código (una ventana por grupo, y en el que se enseña un `arrange` por grupo dentro de un `stack`), cortar un hilo
  (separa en dos, no saca una célula), enganchar (mueve entre grupos) y los toques sobre libres y sueltas.
- **Se pierde:** escuchar una suelta sola en bucle (ahora, tocarla enciende su grupo y suena con la canción) y las
  células sin asa ni número.

### 16.8 Fases
- **G1 · Modelo:** grupos, migración, juntar, separar y copiar; con tests (puro).
- **G2 · Motor:** un recorrido por grupo (encender, apagar, saltar), código del motor y el que se enseña, grabar y
  borrar; con tests.
- **G3 · Pantalla:** hilos, asas y números en todas, anillos por grupo, toques, interruptor de la chapa y ⋯.
- **G4 · Mis canciones y limpieza:** abrir lo antiguo migrado, el resumen, y quitar lo que sobra (`free`/`on`).

### 16.9 Decisiones (aprobadas el 2026-11-14)
1. **Suelta = grupo de una célula apagado; libre = el mismo, encendido.** Una sola idea en vez de dos.
2. **Cortar un hilo parte el grupo en dos** (la parte de detrás, apagada), en vez de sacar una sola célula como en §15.4.
3. **Juntar:** soltar sobre la cabeza de un grupo (desde la cola de otro) junta los dos enteros; en cualquier otro caso
   mueve solo la célula soltada.
4. **El principal** es el grupo con la primera célula de la canción; al juntar, el que lo tenía.
5. **Una célula, una vez por grupo:** "A → B → A" se hace con una copia.
6. **Tocar un grupo apagado** lo enciende por la célula tocada; **tocar la que suena** de uno encendido lo apaga.
7. **Sin bucle ni barrido propios** en los grupos que no son el principal; el fondo y los efectos, de la canción.
8. **Los grupos nuevos nacen apagados.**

Sobre las dos preguntas abiertas: **"A → B → A" se hace con copias** (la misma célula repetida, más adelante) y
**cortar un hilo parte el grupo en dos** (la parte de detrás, apagada). El resto, de acuerdo.


### 16.10 Añadidos (2026-11-14, aprobados)
- **Por defecto solo suena la canción.** Todo grupo nuevo (al **cortar** un hilo, al **copiar** o al **crear** una célula
  libre desde ⋯) **nace apagado** y solo suena si se enciende tocándolo.
- **Una célula creada tocando el agua** va al **final de la canción** (nace vacía, así que no suena hasta grabar en ella).
- **"Apagar extras"** (en la colonia): un botón que **apaga todos los grupos menos la canción**. Se ve mientras haya
  algún grupo en paralelo encendido.
- **Vueltas por célula: 1, 2, 4, 8, 16 y 32** (para melodías largas). Tocar el número da la vuelta 1 → 2 → 4 → 8 → 16 →
  32 → 1, sin bajar del loop más largo. Con más de 8, los puntitos de vueltas pasan a "vuelta/total" (p. ej. "5/16").
- **El tempo es el mismo para todos los grupos** (el de la canción).

## 17. Grupos en paralelo: hecho y decisiones a revisar (G1–G4)

Hecho: modelo (`Song.groups`, migración al leer lo guardado y al abrir la biblioteca), motor (un recorrido por grupo en `lib/groups.ts`, siempre en línea de compás), pantalla (hilos, asas y números en todas, anillos por grupo, chapa «grupo · suena/apagado», «apagar extras») y Mis canciones («4 células + 2 grupos»). Se retiran `Cell.free/on` y la API de libres/sueltas.

Decisiones tomadas al programar (a revisar):

1. **Ver una célula de un grupo lo mantiene en ella en bucle** (como el «bucle» de la canción) para poder grabar y editar; al dejar de verla, sigue por su orden.
2. **Un grupo que se enciende grabando** (primer loop nacido) arranca por la célula que se ve.
3. **Apagar con el interruptor de la chapa** apaga el grupo entero; tocar la célula que suena también.
4. **Cortar** deja la parte de delante con su estado (encendida o no) y la de detrás apagada.
5. **Si la célula que suena en la canción sale de ella** (juntar/cortar), la canción salta a la siguiente que quede, en la próxima línea de compás.
6. **Parado**, tocar una célula de un grupo solo cambia su interruptor; al dar a Play suenan los encendidos desde su primera célula.
7. **«Apagar extras»** está a la izquierda de Play, solo mientras haya algún grupo encendido.
8. **Con más de 8 vueltas** se ve «5/16» en la etiqueta y en la chapa, no puntitos.
9. **Deshacer un borrado** devuelve la célula a su grupo y su estado; si el grupo ya no existe, vuelve como un grupo nuevo de una célula.

## 18. Enmienda 3 · entrar a editar sin cambiar lo que suena (2026-11-14)

Motivo: en la colonia, acercarse a una célula que no suena la ponía a sonar (el primer toque) y la cámara volvía a la que suena.

1. **Un toque** = que suene (como antes: la de la canción, en bucle; la de un grupo, lo enciende o salta).
2. **Doble toque** = entrar a editarla **sin cambiar lo que suena**. Para que el primer toque no llegue a hacer nada, el toque espera lo que dura un doble toque (300 ms) antes de actuar; el cambio cae en una línea de compás, así que no se nota. Entrar en la célula que ya suena es seguir a la canción.
3. **Dentro de una célula que no suena** (de la canción o de un grupo), la vista y la cámara no siguen a la canción. Sale «◎ centrar» (también cerca, no solo tras mover el mapa), que devuelve la vista a la célula que suena y la vuelve a seguir. La vista queda fijada aunque la canción llegue a la célula que se ve (así no hay saltos de cámara); solo «◎ centrar» o viajar a otra célula con un toque la sueltan.
4. **Grabar en una célula que no suena**: el loop nace en la célula que se ve. Una de un grupo enciende su grupo sola (§16). Una de la canción **no suena hasta que la canción llegue a ella** (o se toque para que suene); nace alineada con su primer compás.

Problemas que veo con el punto 4 (a revisar):
- En una célula de la canción que no suena, lo que grabas no se oye hasta que llega su turno; solo ves el aro. Si se quiere oírlo, hay que tocarla una vez (suena en bucle) o usar el bucle.
- Mientras se ve una célula que no suena no hay chapa de vueltas ni transiciones de agua de la que suena, y la colonia no muestra su halo de progreso.
- La canción no se detiene a esperar: si llega a la célula mientras se graba, la vista pasa a seguirla.
5. **Fijar la vista** en la célula que suena: doble toque sobre ella (o el botón «⌖ fijar vista», con la canción sonando y varias células). La canción sigue cambiando de célula y suena el cambio, pero la vista y la cámara se quedan; sale «◎ centrar» para volver a seguirla.

## 19. Enmienda 4 · una sola zona de acciones (2026-11-14)

Motivo: había botones sueltos en sitios distintos y con nombres parecidos (◎ centrar, ∞ ▶ seguir canción, «▶ seguir» de la chapa, apagar extras, ↶ deshacer).

1. **Un sitio fijo**: una fila centrada justo encima de Play (la fila de bolas sube un poco). En horizontal, una columna a la izquierda de Play. Igual en escritorio.
2. **Solo lo que tiene sentido ahora**, en orden fijo: **sonido** («∞ Soltar bucle» si hay bucle; «Apagar extras» si hay un grupo encendido), **cámara** («◎ Volver a la canción» si la vista no está donde suena o se movió el mapa) y **deshacer** («↶ Deshacer», 8 s tras borrar). Sonando y siguiendo, la fila está vacía.
3. **Se quitan**: «∞ ▶ seguir canción» (colonia), «▶ seguir» de la chapa, «⌖ Fijar vista» (mover el mapa ya deja de seguir; el doble toque sobre la célula que se ve sigue fijando la vista) y «◎ centrar» (pasa a «Volver a la canción»).
4. **La chapa** se queda en el aro y solo informa: vueltas, «∞» en bucle (tocarla en bucle no hace nada; se suelta con «Soltar bucle»), y el interruptor «grupo · suena / apagado» de una célula de un grupo.
5. **«Apagar extras»** sale siempre que haya un grupo encendido, no solo en la colonia.

---

## 20. Estilo dembow y su demo (2026-11-14)

Un cuarto estilo, **Dembow**, y su "Cargar demo" como canción de dos células que reproduce este código Strudel (el del usuario):

```js
setcpm(120/4)
const acordes = note("<[b3,d4,f#4] [g3,b3,d4]>").s("triangle").attack(0.02).release(0.4).lpf(2000).room(0.4).gain(0.3)
const bajo = note("<b1 g1>").struct("x ~ ~ ~ x ~ ~ ~ x ~ ~ ~ x ~ ~ ~").s("sawtooth").lpf(350).gain(0.5)
const bateria = stack(s("bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~ bd ~ ~ ~"), s("~ ~ ~ sd ~ ~ sd ~ ~ ~ ~ sd ~ ~ sd ~"), s("hh*16").gain(0.25)).bank("RolandTR808")
const ambiente = stack(s("hh*8").gain(0.12).room(0.8), note("<b2 g2>").s("sine").room(0.9).gain(0.15))
arrange([4, ambiente], [8, stack(acordes, bajo, bateria)])
```

### 20.1 El estilo

- **120 bpm**, semicorcheas (`quantizeEvery` 1), **si menor** (B C# D E F# G A) y **kit 808**.
- **Fondo:** acordes Bm–G (`<[b3,d4,f#4] [g3,b3,d4]>`, con su ataque, release, filtro y reverb) y bajo `b1`/`g1` con cuatro notas de un paso por compás (el `struct`). Son las líneas del código, tal cual.
- **Rejilla de la ayuda:** bombo en 0 4 8 12, caja en 3 6 11 14 y platillo en semicorcheas (los pesos de `lib/styles.ts`).
- **Melodía con la voz (spec 002):** la escala es la de si menor, con los acordes de Bm y G para los empates, y el sinte por defecto es el lead.

### 20.2 La demo

- **Intro** (4 vueltas): platillo en corcheas y el sine `<b2 g2>`; sin bajo ni acordes del fondo.
- **Principal** (8 vueltas): bombo, caja y platillo con el patrón de arriba, con el bajo y los acordes del fondo.
- Al cargarla, **el kit pasa a 808** (la demo lo trae; `DEMO_KIT` en `lib/cells.ts`). Con otros estilos, cargar la demo no cambia el kit.
- El sine del ambiente es un **loop de melodía** (`'mel'`, 2 compases: si2 | sol2) con un **sinte propio** (`synth: 'drone'`, `.s("sine").room(0.9)`), un campo nuevo y opcional del loop. Se ve como una bola blanca en la Intro. No es un sinte que se elija para cantar.
- Sin canción (estilos sin demo-canción) existe también la demo de una célula con el patrón principal (`DEMOS.dembow`).

### 20.3 Cómo se comprobó la fidelidad

`tests/unit/dembow.test.ts` evalúa **el código original** y **el código que muestra la app** con el intérprete de Strudel en Node y compara los eventos de los 12 ciclos: de la batería, el instante y qué sonido; de lo que tiene nota, además su duración, su nombre y su sinte. Coinciden todos (más de 250 eventos). También comprueba que el comparador no es vacuo y que los timbres (sinte, ataque, release, filtro y reverb de los acordes; filtro del bajo) son iguales.

### 20.4 Lo que se aproxima (y no se puede igualar con el modelo de hoy)

1. **Ganancias.** El código original pone ganancias fijas (platillo 0,25, ambiente 0,12, sine 0,15) y deja el bombo y la caja a 1. La app **mezcla sola** (1/√n y un balance por instrumento): en la Principal salen bombo 0,58, caja 0,51 y platillo 0,29. El platillo queda relativamente más fuerte (la mitad del bombo, frente a un cuarto en el original); el bajo y los acordes sí llevan sus ganancias originales (0,5 y 0,3). Habría que poder fijar la ganancia de un loop para igualarlo; no se hace.
2. **Reverb por loop.** El platillo de la Intro lleva `room(0.8)`; la app no tiene efectos por loop (el "espacio" de ⋯ es global y va en todos los loops del bloque). No se reproduce.
3. **Sidechain.** La app añade el sidechain del bombo (`duckorbit("2:3")`) sobre el bajo y los acordes cuando hay fondo; el original no lo tiene. En la Principal, el bajo y los acordes "respiran" con el bombo.
4. **Muestra del 808.** El código mostrado lleva `.n(1)` en bombo y caja (el índice del 808 que usa la app, para que suene el mismo archivo en strudel.cc, §16.12 de la 001); el original usa el índice 0 por defecto, así que en strudel.cc esas dos muestras pueden ser otro archivo del banco.
5. **Orbits y comentarios.** La app añade `.orbit()` y comentarios con el nombre de cada célula, y el platillo de la Intro dura 1/16 en vez de 1/8 por la rejilla de pasos (no importa para una muestra de un golpe). Sin `const` ni `stack` externos: es un único `arrange`.
6. **Bola de la melodía en la Intro.** El sine aparece como un loop de melodía más: se puede silenciar, borrar o sustituir cantando (se perdería el sinte propio si se sustituye con la voz: la nueva melodía vuelve a tener el del estilo).

---

## 21. Enmienda 5 · fundir células (2026-11-14, solo spec: para revisar, sin programar)

### 21.1 La idea

Arrastrar una célula **encima de otra y mantener**: se **funden** en una, que suena con las capas de las dos a la vez. Sirve para construir una célula densa a partir de dos sencillas (la batería de una con el bajo de otra, o dos melodías) sin volver a grabar nada.

**Fundir = añadir el contenido de A a B y borrar A.** Lo segundo es el borrado de siempre (§7.1: hilos que se recomponen, orden, célula que suena, "↶ deshacer"), así que casi todo se reutiliza. Aquí se detalla solo lo nuevo.

- **A** es la célula que se arrastra y **B** la que recibe: B se queda (su sitio, su nombre, sus hilos, su grupo) y A desaparece dentro de ella.
- Vale con cualquier pareja: de la canción, de un grupo en paralelo (§16) o suelta (§15). El resultado vive donde vive B.

### 21.2 El gesto

1. Se arrastra A (el cuerpo, como para moverla) hasta que **cubra más de la mitad de B**. Mientras tanto B se **atrae** hacia A en lugar de apartarse (hoy las cercanas se apartan, §7.1) y B se resalta con un anillo tenue.
2. **Mantener** sin mover (menos de 12 px) con A sobre B: un **anillo se completa en unos 0,8 s alrededor del dedo**, de otro color que el del borrado (azul `#8ECFF2`, no el rosa de las bolas, para no confundirlo con "mantener 0,6 s = borrar").
3. Al completarse, se funden. Si se suelta antes, **no pasa nada especial**: A se queda donde la sueltes, solapada (las células pueden solaparse, §7.1). Si el dedo sale de B antes de completar el anillo, se cancela.

- No choca con el borrado: este es mantener **sin arrastrar** una célula; fundir es mantener **al final de un arrastre**, ya sobre otra.
- Con el ratón es igual: arrastrar con el botón pulsado, mantenerlo, soltar.
- Con el zoom tan alejado que no se puede agarrar el cuerpo (pocos píxeles), no se funde (como la copia y el orden, §7.1).
- No se puede fundir una célula consigo misma ni con menos de dos células.

### 21.3 Qué resulta

| | Resultado |
|---|---|
| **Loops de un instrumento que están en las dos** (bombo, caja, platillo) | **Un solo loop**, con los golpes de los dos. Los patrones se repiten hasta la longitud más larga antes de juntarlos (un loop de 1 compás sobre uno de 4 suena en los 4, como sonaba). **Dos golpes en el mismo paso quedan en uno** (a menos de media semicorchea cuenta como el mismo paso, como al completar, §16.19 de la 001); se queda el de B. |
| Loops de un instrumento que solo está en una | Se pasa tal cual (con su id y su fase). |
| **Loops silenciados** | Sus golpes **no se funden** (no sonaban): si el instrumento está en las dos y uno está silenciado, el resultado es el del que suena. Si el único loop de ese instrumento está silenciado, se pasa silenciado. |
| **Melodía** (`'mel'`, spec 002) | Ver §21.4. |
| **Bajo y acordes** (partes del fondo) | O lógico: suena el bajo (o los acordes) si suena en cualquiera de las dos. |
| **Vueltas** | El **mayor** de los dos (y nunca menos que el loop más largo, como hoy). |
| **Nombre** | El de B (el de A se pierde; el "deshacer" lo devuelve). |
| **Posición, hilos, grupo, orden** | Los de B. A sale de su orden o de su grupo como al borrarla (sus vecinos se unen); si A estaba sola en un grupo, el grupo desaparece. |
| **Versiones previas** (`prev`) y nacimientos | Se descartan (`storableSong`); en marcha, los loops que cambian nacen con su versión previa hasta la siguiente línea de compás, como "completa" (sin hueco ni solape). |

- Como mucho 3 loops de batería y 1 de melodía por célula: nunca se pasa del límite de 8 loops.
- **Ids:** los loops que sobreviven conservan el suyo; el resultado no repite ningún id (ya eran únicos en toda la canción, §3).

### 21.4 Melodías: dos notas a la vez

La melodía es **monofónica** (spec 002, §5): un loop `'mel'` por célula, una voz, un sinte y un solo orbit. Al fundir dos melodías, ¿qué pasa cuando dos notas **distintas** empiezan a la vez, o una entra en medio de otra más larga?

**Propuesta (la que recomiendo para la primera versión): se queda una; las demás solo entran si caben.**
- Se juntan las dos melodías (repetidas a la misma longitud) con **la misma regla que "completa"** (`mergeMelody`): las notas de B no se tocan; una nota de A **solo entra si empieza en un hueco libre** y se **recorta** contra la siguiente nota y contra la línea de compás. Si empieza dentro de una nota de B, o a la vez que ella, **se descarta**.
- Es lo mismo que ya hace la melodía al completar con la voz y lo mismo que "dos golpes en el mismo paso quedan en uno": **gana lo que ya estaba (B)**.
- **Se avisa de lo perdido:** el chip dice "↶ deshacer · 3 notas no entraron"; el diagnóstico lista cuáles. El deshacer devuelve todo.
- Por qué no suenan juntas: la monofonía no es un detalle del generador, sostiene el resto (la ayuda de la 002 asume una voz; `note("a3@4 …")` una nota a la vez; el órgano de la F2 se pensó con una nota por columna; el bajo con la voz es monofónico). Permitir acordes cambia el modelo de datos, el código y la edición.

**Alternativa, para cuando se quiera (spec 002, fase posterior): "suenan juntas".** `MelodyHit` admitiría varias notas con el mismo `pos` (un acorde), el código lo escribiría con la coma de la mini-notación (`[a3,c4]@4`), el órgano mostraría las notas apiladas y habría un tope de 3 voces. Entonces la fusión podría ofrecerse con las dos opciones ("se queda una" o "suenan juntas"), por ejemplo según se mantenga más o menos. **Pregunta abierta 1.**

Otras reglas de la melodía al fundir:
- Si solo una de las dos células tiene melodía, se pasa tal cual (con su sinte propio si lo lleva, p. ej. el `drone` del dembow, spec 005 §20).
- Si las dos tienen y el sinte propio de cada una es distinto, **gana el de B** (un loop solo puede tener uno).

### 21.5 Deshacer

El chip "↶ deshacer" de siempre (unos 8 s, un solo nivel, encima de Play): devuelve **las dos células tal como estaban**, con su posición, sus hilos y su sitio en el orden y en los grupos. Es un registro nuevo (`kind: 'merge'`) que guarda la canción anterior entera, como "Borrar todo"; fundir otra cosa o borrar algo lo reemplaza. No se guarda al cerrar la app.

### 21.6 Cómo se ve (agua)

Todo visual, y se simplifica con movimiento reducido:
- Al arrastrar A sobre B, las dos gotas se **atraen** y se tocan con una ondulación del borde de B.
- Al completarse el anillo, **A se disuelve dentro de B**: su silueta se estira hacia el centro de B (unos 500 ms), B hace un latido ("pop") y sale una onda de agua, la de nacimiento de las bolas (spec 003, E1.8).
- Las **capas nuevas** de B (los loops que vienen de A) nacen con la caída de siempre, en la siguiente línea de compás, y sus bolas aparecen en la fila.
- Con movimiento reducido: sin atracción ni estiramiento; A desaparece con un fundido corto y B se enciende con opacidad.

### 21.7 Cómo suena

- Fundir no para la música. El código se reevalúa y lo nuevo **entra en la siguiente línea de compás** (como cualquier cambio de loops, §4.2), con la versión anterior sonando hasta ahí.
- **Si A es la célula que suena** en estado canción, la reproducción **pasa a B** en esa línea de compás, con el mismo número de vuelta (la canción no se corta). Si B es la que suena, sigue y recibe las capas de A. Si ninguna suena, no cambia nada audible.
- Si A es parte de un grupo en paralelo que suena, el grupo sigue sonando sin ella (como al borrar una célula de un grupo, §16.3).
- **Entrar a editar** (§18) no cambia: la vista sigue a B si estabas en A.

### 21.8 Casos límite

- **Una de las dos vacía** (sin loops, sin partes): se funde igual (se queda el contenido de la otra); sirve para "absorber" una célula en blanco.
- **Fundir con una copia suelta de sí misma:** los golpes iguales quedan en uno; es una forma de limpiar duplicados.
- **Dos células con tempo distinto:** el tempo es de la canción (§6), no de la célula; no aplica.
- **Fundir A en B y luego B en C:** funciona sin más (un solo nivel de deshacer: solo la última se puede deshacer).
- **Con 1 célula** no se puede (se necesitan dos).
- **Los dos "↶ deshacer" a la vez:** no hay; el último registro manda (un solo nivel, §7.1).
- **Guardar y "Mis canciones" (spec 006):** el resultado es una canción normal; "no guardado" se actualiza como con cualquier cambio.

### 21.9 Lógica y tests (cuando se programe)

Puro, en `lib/cells.ts`: `mergeCells(song, aId, bId): { song: Song; dropped: { notes: number; hits: number } } | null`.
- Mezcla por instrumento con los patrones expandidos a la longitud común y la fase relativa a la célula (variante de `mergeLoops` que repite también lo que se añade).
- Reutiliza el borrado de célula de `lib/cells.ts` para quitar A (orden, grupos y vecinos).
- Tests: un instrumento en las dos y en una sola; golpes iguales en el mismo paso (a menos y a más de media semicorchea); longitudes distintas (1 y 4 compases) y fases distintas; silenciados; partes del fondo; vueltas; melodías (hueco libre, empiece dentro, misma nota a la vez, recorte contra la siguiente y la línea de compás, sinte propio); A y B en la canción, en un grupo y sueltas; A o B vacía; A = B (null); idempotencia de ids; la canción resultante es válida (`isSong`) y el código que sale evalúa en Strudel (mismo comprobador de eventos que la demo del dembow, §20.3).
- Motor (`mergeCells(a, b)`): registro de deshacer, cambio de célula que suena y reevaluación; con los tests de grupos de `engineGroups.test.ts` como modelo.

### 21.10 Fases

- **M1.** `lib/cells.ts` `mergeCells` + tests (sin interfaz).
- **M2.** Motor: acción, deshacer, célula que suena y diagnóstico ("ha fundido X en Y: N golpes iguales, M notas no entraron").
- **M3.** Gesto en la colonia (atracción, anillo azul, mantener 0,8 s) y la animación de agua.
- **M4.** Con la melodía polifónica (spec 002, posterior): la segunda opción de §21.4.

### 21.11 Decisiones a revisar y preguntas abiertas

1. **Pregunta abierta 1 — dos notas a la vez en una melodía:** se queda una (B gana) y se avisa de lo perdido (recomendado ahora), o suenan juntas (acorde; requiere la melodía polifónica). ¿Se prefiere esperar a la polifonía para fundir melodías, o fundir ya con "se queda una"?
2. **Tiempo del anillo:** 0,8 s (frente a 0,6 s de borrar), y color azul para distinguirlo. Alternativa: el mismo color con un icono.
3. **Qué célula se queda:** la de destino (B, sobre la que se suelta). Alternativa: que gane la de más loops, o que haya que elegir.
4. **Vueltas = el mayor de los dos.** Alternativa: las de B.
5. **Nombre = el de B.** Alternativa: "B + A", o el de A si B no tiene.
6. **Golpes en el mismo paso:** queda el de B (su fuerza). Alternativa: el más fuerte de los dos.
7. **Los silenciados no se funden.** Alternativa: fundirlos y dejar el loop silenciado.
8. **Una nota de A que empieza dentro de una de B se descarta** (no recorta a B). Alternativa: que la de A recorte a la de B donde empieza (legato).

## 22. Enmienda 6 · disparadores de grupos en la célula (2026-11-14)

**Para qué.** Un grupo en paralelo (§16) avanza por su cuenta, pero hasta ahora solo se encendía con Play o tocándolo. Hacía falta que **la canción** lo encendiera cuando llega a una parte concreta (p. ej. el Himno del remix, que debe empezar con la célula Dembow y no repetir el mismo trozo mientras la batería cambia de célula).

**Modelo.** Dos campos opcionales en la célula (`Cell.groupOn`, `Cell.groupOff`): ids de grupos en paralelo (1 a 16 enteros ≥ 1; validación estricta). Solo valen en **células de la canción**.

**Reglas.**
1. Al **entrar** la canción en una célula (cambiar de célula, no repetirse en bucle), en esa línea de compás: **enciende** los grupos de `groupOn`, **siempre desde su primera célula** (también si ya sonaban: se reinician), y **apaga** los de `groupOff` (siguen hasta esa línea).
2. Un grupo en las dos listas se enciende (se reinicia).
3. Al dar a Play, se aplican los de la célula con la que arranca (compás 0). Si se da Play desde otra célula, solo cuentan los de esa célula (decisión: sencillo y predecible, aunque limitado).
4. Solo cambian **lo que suena**; la marca "encendido" que se guarda con la canción no se toca (al volver a dar Play, el grupo no arranca solo desde el compás 0).
5. La canción es cíclica: cada vuelta vuelve a encender lo que enciende.
6. Si un grupo desaparece (se borra su última célula), los ids que lo apuntaban se limpian en las dos listas; una lista vacía desaparece. Copiar una célula conserva sus disparadores (sin efecto mientras la copia no esté en la canción).
7. **Código mostrado** (strudel.cc): el grupo lleva `[n, silence]` hasta la célula que lo enciende y calla desde la que lo apaga hasta el final de la vuelta; si es más corto que lo que está encendido, da la vuelta.

**Interfaz.** Un marcador pequeño en la colonia, en las células que encienden (▶) o apagan (■) un grupo. Sin interfaz para editarlos todavía (los trae la canción: p. ej. los remixes).

**Decisiones a revisar.** (a) Dar Play desde otra célula no aplica los disparadores de las anteriores (el grupo no suena aunque «le tocara»). (b) Mientras se ve una célula del grupo que se reinicia, el grupo se queda en ella (como con Play). (c) Un editor para poner y quitar disparadores desde la interfaz.
