# 009 · Ver cómo se construye (sesiones reproducibles)

> Estado: **idea, para revisar** (2026-11-14). No se programa nada hasta que se apruebe.
> Parte de: spec 005 (células, hilos, cámara y colonia), 008 (remixes), la demo del dembow (005 §20) y 003 (el aro).
> Idea del usuario (2026-11-14): un botón **"▶ ver cómo se construye"** en las demos y los remixes.

## 1. Idea

La app **construye la canción sola, paso a paso y en tiempo real, como si alguien la tocara**: caen los golpes en el aro, nacen los loops y las melodías (nota a nota), se crean y se enganchan las células, y la **cámara las sigue hasta el subidón**. Sirve para:
- **vídeos de reacción** (algo bonito y completo que enseñar sin tocar nada);
- **enseñar a los nuevos** cómo se usa la app (qué es un loop, una célula, un hilo);
- **aprender**: ver en qué orden se monta una canción y qué hace cada capa.

Y se valora que la construcción se pueda **guardar como una "sesión" reproducible** (§4).

## 2. Qué se ve (el guion de un remix)

Con el "Himno de la alegría" en dembow (spec 008) sería algo así; cada paso ocurre **en una línea de compás** y suena mientras se construye:

1. Pantalla vacía; empieza a sonar el pulso. Cae la **primera célula (Intro)** y se llenan los **acordes** (la bola "acordes" se enciende).
2. Se crea la segunda célula (cae una gota al lado) y se **engancha** con un hilo; la cámara se desplaza a ella. Caen los golpes del **platillo** uno a uno y **nace su loop**; la **melodía** entra **nota a nota** en su franja (los arcos aparecen en su sitio).
3. Tercera célula: cae el **bombo**. Cuarta: la **caja dembow** y la melodía clara (el sinte cambia).
4. **Subida:** el bombo desaparece, la caja se acelera compás a compás y el **filtro se abre** (se ve y se oye); la cámara se aleja y enseña toda la colonia.
5. **Subidón:** entra el bajo; la melodía sube una octava. La cámara hace un acercamiento al aro.
6. **Final:** vuelve a los acordes y se apaga.

Mientras tanto, un **rótulo** pequeño dice qué se añade ("+ bombo", "+ la melodía", "el filtro se abre"), que se puede apagar.

## 3. Cómo funciona

### 3.1 Un guion de pasos con tiempo

Una **sesión** es una lista de pasos con su tiempo en **compases desde el principio** (en línea de compás, para que cuadre con la música) y una **operación**:

```ts
interface Session {
  version: 1
  /** de dónde se parte: normalmente una canción vacía con el estilo y el kit; si no, un `SongSnapshot` */
  start: SongSnapshot
  steps: { at: number; op: Op }[]
}
type Op =
  | { type: 'hit'; cell: number; instrument: Instrument; pos: number }            // cae un golpe
  | { type: 'loop'; cell: number; instrument: Instrument; pattern: string }       // nace un loop entero
  | { type: 'note'; cell: number; pos: number; dur: number; midi: number }         // una nota de la melodía
  | { type: 'parts'; cell: number; bass?: boolean; chords?: boolean }              // entran el bajo o los acordes
  | { type: 'cell'; id: number; turns: number }                                    // se crea una célula
  | { type: 'link'; from: number; to: number }                                     // se engancha con un hilo
  | { type: 'set'; cell: number; turns?: number; lpf?: number[] }                  // vueltas, filtro…
  | { type: 'remove'; cell: number; instrument: Instrument }                       // desaparece un loop (el bombo de la subida)
  | { type: 'camera'; to: 'cell' | 'colony' | 'follow'; cell?: number; zoom?: number }
  | { type: 'caption'; text: string }                                              // el rótulo
```

- **Reutiliza lo que ya existe.** Casi todas las operaciones son llamadas a las funciones puras de edición (`addHit`, `addMelNote`, crear y enganchar células, `Cell.lpf`…) y a las acciones del motor; cada una con **la misma animación de siempre** (la bola cae, el golpe nace con su salpicón). Nada de un reproductor paralelo.
- **Reloj propio sobre el de Strudel.** Los pasos se programan con el reloj de compases del motor (`barTime`, `nextBarLine`), como los nacimientos de la batería, así que **entran justo en la línea de compás**.
- **Control:** pausa, velocidad (0,5×, 1×, 2×), saltar al siguiente paso y **tocar la pantalla para coger el control**: la construcción se para y lo que hay es una canción normal que se puede seguir editando.

### 3.2 De dónde sale el guion

- **A (propuesto para empezar): derivarlo de la canción.** Para una demo o un remix el guion se **genera solo** a partir de la `Song` final (y de su descripción): por cada célula, en orden, se crea, se engancha, se añaden sus partes y sus loops en un orden lógico (bombo → caja → platillo → melodía nota a nota), y la cámara la sigue. Sin escribir un guion a mano por remix y **sin que se quede viejo** cuando cambie el modelo.
  - Los remixes (008) lo piden de forma natural: cada célula **añade** algo a la anterior, y lo que la descripción dice ("+ bombo") es el rótulo.
  - Hace falta decir cosas que la canción final no dice (cuándo hace zoom, qué rótulo): un campo opcional `build?` en la definición del remix (`[{ cell: 5, caption: 'el filtro se abre', camera: 'colony' }]`).
- **B: grabarlo.** Un modo **"grabar sesión"**: la app anota, con su tiempo en compases, lo que haces (golpes puestos, notas, células, hilos, partes, filtro, cámara). Al parar, queda un `Session` que se puede reproducir. Lo que viene **del micro** (beatbox, melodía cantada) se guarda como **el resultado** (los golpes y las notas que salieron), **no** como audio: el audio de la voz no se graba (privacidad y tamaño).

### 3.3 La cámara

La cámara de la colonia ya sigue a la célula que suena (spec 005 §7.1). Aquí se añade un **director**: pasos `camera` que llevan la vista a una célula, alejan a la colonia entera (la subida) o acercan al aro (el subidón), con el viaje de agua de siempre. **Cualquier toque del usuario lo interrumpe** (coge el control).

## 4. La sesión como objeto guardado

- Es un **JSON pequeño** (unos pocos KB por canción: no lleva audio).
- **Mis canciones (006):** podría guardarse junto a la canción como "sesión de construcción", o como un tipo de entrada propio (▶ en la fila). Valorar si hace falta guardar las propias (modo B) o basta con las derivadas (modo A).
- **Compartir:** como es texto, una sesión se podría **copiar y pegar** (o ir en un enlace, más adelante: spec 006 §futuro). Se valida **igual de estricta** que una canción guardada: cada operación se comprueba (números en rango, instrumentos de la lista, ids de células que existen, texto del rótulo **solo como texto**, nunca código; los rótulos se limpian como `safeLabel`).
- **Determinismo:** la misma sesión da siempre **la misma canción final** (se comprueba en tests: reproducir el guion de un remix en el motor sin audio y comparar con `remix.build()`).
- **Versión:** `version: 1`; una sesión de una versión que la app no entiende se ignora sin borrarla (como Mis canciones).

## 5. Cómo se ve la interfaz

- **Botón "▶ ver cómo se construye"** en la hoja de los remixes (junto a "Abrir") y, para las demos, junto a "Cargar demo" en ⋯.
- Mientras se reproduce: una barra fina con **pausa**, **velocidad**, **saltar** y **"tomar el control"**, y el rótulo. **Modo vídeo** (opcional): oculta ⋯, los estilos y los botones, y deja solo el aro, la colonia y el rótulo, para grabar la pantalla.
- La app **no graba vídeo** por sí misma (lo hace el sistema operativo: la grabación de pantalla); sí cuida que no haya nada que estorbe (sin diagnóstico, sin avisos) y que la pantalla no se apague.
- Con **movimiento reducido**, sin viajes de cámara ni salpicones: los pasos entran con un fundido corto (la información es la misma).

## 6. Fases (propuesta)

1. **F0. El motor de pasos** (sin interfaz): `Session`, un reproductor que aplica los pasos en la línea de compás con la animación de siempre, y tests que reproducen un guion y comprueban la canción final (sin audio, como `engineGroups.test.ts`).
2. **F1. Derivar el guion de una canción** (modo A) para el remix del dembow y la demo de dembow/dnb; rótulos; el botón y la barra de control. Sin cámara.
3. **F2. La cámara (director)** y tomar el control; modo vídeo.
4. **F3. Grabar sesión** (modo B) y guardarla en Mis canciones; validación estricta de lo importado.
5. **F4. Más adelante:** compartir sesiones, un **modo "aprende"** (el reproductor se para en cada paso nuevo y explica qué es con un texto y una flecha) y tutoriales hechos con sesiones.

## 7. Riesgos

| Riesgo | Qué pasa | Mitigación |
|---|---|---|
| **Cuadrar con el reloj** | Un paso que cae un poco fuera de la línea de compás suena "mal" | Se programa en compases con el mismo reloj que la batería (`nextBarLine`), no con `setTimeout` a ojo; tests con un reloj simulado |
| **Construir mientras suena** | Las células aparecen y cambian el orden mientras la canción avanza: el cursor de reproducción (005 §4) y los grupos no están pensados para una canción que crece | Construir **en bucle sobre la célula que se está llenando** (como al grabar a mano) y solo pasar a la siguiente al enganchar; el guion decide cuándo; tests del cursor al crecer |
| **Mantenimiento del guion** | Un guion a mano se queda viejo cuando cambia el modelo | Derivarlo de la canción (modo A); las operaciones son llamadas a las mismas funciones puras que usa la interfaz |
| **Cámara contra el usuario** | El director mueve la vista mientras alguien toca | Cualquier toque lo interrumpe y entrega el control |
| **Rendimiento en el móvil** | Muchas animaciones a la vez mientras suena | El mismo vigilante de frames del aro (003 E1.7); el director baja los efectos si hace falta |
| **Sesiones importadas** | Una sesión pegada podría traer operaciones raras o texto con código | Validación estricta de cada operación; rótulos como texto; nunca se evalúa nada de la sesión |
| **Sesiones con voz** | Se podría guardar audio de la voz (peso, privacidad) | No se guarda audio: solo el resultado (golpes y notas). La pista de voz (spec 007) **no** entra en una sesión |
| **Expectativas** | "Como si alguien tocara" pide naturalidad (pequeñas pausas, orden humano) | Un pequeño desajuste de tiempos dentro del compás (sin tocar la línea de compás) y un orden fijo y legible; a probar de oído y de vista |

## 8. Criterios de aceptación (primera versión)

1. En un remix y en la demo de dembow, **"▶ ver cómo se construye"** construye la canción **sola**, en tiempo real, hasta que coincide **exactamente** con la canción de "Abrir"/"Cargar demo".
2. Los pasos **entran en la línea de compás**; se ven los golpes, los loops, las notas y las células con sus animaciones de siempre.
3. **Pausa, velocidad y saltar** funcionan; **tocar la pantalla** coge el control y la canción queda editable.
4. Con **movimiento reducido** funciona sin viajes de cámara.
5. Reproducir el guion en el motor sin audio da la canción final (test). Una sesión mal formada **no rompe la app** (se ignora sin borrarla).

## 9. Decisiones a revisar y preguntas abiertas

1. **¿Solo derivadas (modo A) o también grabadas (modo B)?** Propuesta: A primero (cubre demos y remixes), B después.
2. **¿Dónde se guarda?** Como parte de la canción, como entrada propia en Mis canciones, o solo en memoria.
3. **¿Se graba vídeo desde la app?** Propuesta: no; se deja la grabación de pantalla del sistema y se cuida el "modo vídeo".
4. **Rótulos:** siempre visibles, apagables, o solo en el modo "aprende".
5. **Qué hace la cámara en la subida y el subidón** (alejar y acercar): a ajustar viéndolo.
6. **¿Entra la voz cantada en la sesión?** Propuesta: solo como resultado (notas y golpes), nunca como audio.
