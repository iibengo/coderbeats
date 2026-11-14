# 009 · Ver cómo se construye: el piloto automático

> Estado: **borrador para revisar** (2026-11-14). No se programa nada hasta que se apruebe.
> Sustituye al borrador anterior de esta spec (la idea suelta de "ver cómo se construye"). Parte de: 003 (el aro y sus gestos), 005 (células, colonia, cámara), 008 (remixes), 002 (melodía, órgano) y la demo del dembow (005 §20).

## 1. Idea

Un modo **"▶ ver cómo se construye"** (el **piloto automático**) para las **demos y los remixes**: la app **construye una canción sola, en tiempo real, simulando cómo lo haría una persona**. Sirve para **vídeos de reacción** y para **enseñar lo que se puede hacer**.

**Se presenta como demo**: no se esconde que lo hace la app (hay un rótulo "piloto automático" siempre visible, y al empezar se dice). Lo que se busca no es engañar, sino que se **vea el gesto**: dónde se toca, qué pasa y en qué orden se monta una canción.

## 2. Lo que se ve

1. **Un dedo fantasma** (un círculo suave con una estela breve) que se mueve por la pantalla con curvas naturales y **toca, arrastra y mantiene pulsado en los mismos sitios que una persona**: el aro, los carriles, las bolas, la colonia, el asa de una célula, ⋯, Play.
2. **Cuando "graba con la boca"**: aparece un **bocadillo** con lo que dice ("bum", "pff", "ts", "na-na"), el **punto de voz en vivo** se mueve en la franja de la melodía (002, F2) y **nace la bola** del loop, como cuando se hace de verdad.
3. **La historia de la canción**: empieza vacío, va añadiendo capas, **copia y engancha células en la colonia**, sube la tensión y llega al subidón, con **la cámara siguiéndola**.
4. **Una barra** con **reproducir, pausar y saltar al final**; **cualquier toque del usuario lo detiene** y le deja la canción para seguir tocando.

## 3. Cómo debe parecer humano

El piloto no ejecuta una lista a ritmo de metrónomo: **un guion dice la intención y una capa de "humanización" decide el cómo** (§5).

- **Movimiento del dedo:** trayectorias curvas con **aceleración y frenado** (perfil de velocidad en campana, más lentas y precisas al acercarse al blanco: ley de Fitts), con un pequeño temblor.
- **Ritmo:** **pausas** entre acciones **de duración variable** (más largas antes de cambiar de sección o de coger algo nuevo); a veces el dedo se queda un momento **sobre el sitio antes de tocar** (duda); **espera a la línea de compás antes de grabar**, como hace la app (spec 001 §16.15): el bocadillo aparece, el dedo/boca espera y la frase empieza **en la línea**.
- **Imperfecciones creíbles** (con probabilidad baja y siempre **recuperables**): un golpe que cae **un poco fuera** y **el imán lo coloca** donde toca (003 E1.4); de vez en cuando **mueve un golpe** para corregirlo; alguna vez **va primero hacia un sitio y rectifica**.
- **Perfiles** de energía (tranquilo, normal, animado) que escalan pausas y velocidad.
- **Determinista con semilla:** la misma semilla da **el mismo vídeo** (para repetir una toma); otra semilla, otra interpretación del mismo guion.

## 4. Cómo se hace

### 4.1 Los mismos gestos que una persona (no atajos internos)

Es la regla de diseño más importante: **lo que se ve es exactamente lo que la app sabe hacer**. Por eso el piloto **no llama a las funciones internas** (`addHit`, `editLoops`…): **fabrica eventos de puntero** (`PointerEvent` de ratón o de dedo, con su `pointerId`) y los **lanza sobre los elementos reales** (el escenario, las bolas, los botones); los manejadores de siempre los reciben como si fueran de una persona. Así:
- Lo que el piloto consigue **es** lo que un usuario consigue con esos gestos (y si un gesto deja de funcionar, **el piloto lo delata**: sirve de prueba de humo).
- **Los puntos de destino se calculan de la pantalla real** (el aro, la colonia, las bolas están donde están en ese dispositivo): el guion habla de **objetivos con sentido** ("la franja del bombo, paso 4"), no de píxeles.
- Los gestos de **dos dedos** (filtro y espacio, zoom con pellizco) llevan **dos dedos fantasma** con dos `pointerId`.

Dos cambios pequeños en la app, necesarios y sin efecto para las personas: (a) los manejadores llaman a `setPointerCapture(e.pointerId)` sin proteger, y con un `pointerId` sintético **falla**: se envuelve en `try/catch`; (b) el piloto sabe distinguir un evento **suyo** de uno **del usuario** por `isTrusted` (los fabricados son `false`).

### 4.2 Resolver objetivos

Cada objetivo del guion se convierte en un punto de pantalla en el momento de usarlo:

| Objetivo (en el guion) | De dónde sale el punto |
|---|---|
| `aro { franja, paso, compás }` | `AroCanvas` (ya calcula dónde cae cada golpe: `debugDots`, `where`) |
| `aro { melodía, paso, altura }` | lo mismo, con la altura en el registro (002 F2) |
| `bola { bajo \| acordes \| instrumento }` | el elemento de la bola (por su `aria-label`) |
| `play`, `más` (⋯), `estilo`, `kit`… | el botón (por su `aria-label`) |
| `colonia { célula, cuerpo \| asa \| número }` | las posiciones de las células en pantalla (que ya usa `cellUnder`, `handleUnder`) |
| `agua { x, y }` | un punto libre de la colonia (en unidades del mapa) |
| `órgano { paso, nota }` | la rejilla del órgano |

Hace falta **exponer** desde cada componente "dónde está esto" de forma estable (hoy hay `debugDots` y `aroWhere`, solo para pruebas): pasa a ser una pequeña interfaz oficial (`pointOf`).

### 4.3 El micro virtual (grabar con la boca)

La grabación "con la boca" **no puede salir del micro** (el piloto no necesita ni toca el micro). El motor ya habla con el worker de análisis por un único punto (`worker.postMessage` / `worker.onmessage`, con los mensajes de `lib/workerProtocol.ts`). El piloto pone ahí un **worker de mentira** (`PilotWorker`) que:
- recibe lo mismo que el real (`start`, `stop`, `lanes`, `melody`, `notes`…);
- emite, con los tiempos del guion, lo mismo que el real: `hit` (instrumento, tiempo, fuerza), `melodic` (nota que nace), **`pitch`** (el punto de voz en vivo) y la respuesta a `notes` (las notas de la frase).

**El resto es el código real**: frases, cierre en la línea de compás, ayuda, nacimiento del loop, bolas y aro. Lo único falso es lo que "oyó" el micro. Es honesto con el modo (se dice que es demo) y exactamente el mismo camino que la voz de verdad.

### 4.4 El guion

Un **guion** es una lista de pasos con su tiempo, **uno por demo o remix**; **se escribe a mano** (un archivo de TypeScript con helpers) y, **más adelante, se graba de una sesión real** (fase 4).

```ts
interface PilotScript {
  version: 1
  id: string                       // 'demo-dembow', 'remix-oda-alegria'
  title: string
  style: StyleId; kit: KitId
  /** de dónde se parte: normalmente vacío, con el estilo y el kit */
  start: 'empty'
  steps: PilotStep[]
  /** la canción a la que debe llegar (para «saltar al final» y para comprobarlo en los tests) */
  final(): Song
}

type PilotStep = { at: Bars; note?: string } & Action   // `at`: compases desde el primer Play (decimales = tiempos)

type Action =
  | { do: 'tap';   on: Target }
  | { do: 'hold';  on: Target; ms?: number }                  // mantener (armar un carril, borrar una bola…)
  | { do: 'drag';  from: Target; to: Target }
  | { do: 'pinch'; ... }                                      // dos dedos: zoom, o filtro y espacio
  | { do: 'mouth'; says: Syllable[]; hits?: Hit[]; notes?: Note[] }   // «grabar con la boca»: lo que dice y lo que sale
  | { do: 'wait';  bars: number }
  | { do: 'caption'; text: string }                           // un rótulo (§6)
  | { do: 'camera'; to: 'cell' | 'colony' | 'follow'; cell?: number }
```

- **`at` es cuándo debe quedar hecho**: el piloto **planifica hacia atrás** (un gesto de 1 s que debe caer en el compás 3 empieza antes) para que **las cosas entren en la línea de compás**.
- **`mouth`** es el único paso que habla de lo que "oyó" el micro: sílabas (para el bocadillo), y los golpes o notas que salen (para el micro virtual). La frase empieza **en la línea de compás**.
- El guion **no** dice cómo se mueve el dedo ni cuánto dura cada pausa: eso es la humanización (§3).

### 4.5 El reloj

Los pasos se programan en **compases** con el reloj del motor (`barTime`, `nextBarLine`), no con `setTimeout` a ojo. El movimiento del dedo (que dura décimas de segundo) se anima por fotogramas pero **empieza y acaba contra ese reloj**. Con **pausa** se congela todo (también el dedo); la música sigue o se para según se elija (§9).

### 4.6 Control

- **▶ Reproducir, ⏸ pausar, ⏭ saltar al final** (en una barra pequeña).
- **Saltar al final** es el único atajo permitido (es un salto, no un gesto): reemplaza la canción por la del guion (`final()`) **sin parar la música**, y **suelta el control**.
- **Cualquier toque del usuario lo detiene** (un `pointerdown`, `keydown` o `touchstart` con `isTrusted === true`): el dedo fantasma desaparece, el guion se aparca y **la canción queda como está** para seguir tocándola. Un toque sobre la barra no cuenta (son sus botones).
- **Empezar** requiere un gesto del usuario (el botón), y de paso arranca el audio (los navegadores no dejan arrancarlo solo). **No hace falta el micro ni la calibración**: se arranca el motor en un **modo piloto** (con el worker de mentira).

## 5. La capa de humanización (pura y con pruebas)

Separada del guion y **de la pantalla**, en `lib/pilot*.ts`, sin DOM, para poder probarla:
- **Trayectoria:** de un punto a otro, una curva (Bézier o de mínima sacudida) con duración por la ley de Fitts, perfil de velocidad en campana y un temblor pequeño; también "ir hacia un lado y rectificar".
- **Tiempos:** distribuciones de las pausas (log-normal acotada), la duda antes de tocar y la espera a la línea de compás.
- **Imperfecciones:** a cada gesto, con probabilidad baja y semilla, puede añadir un **desvío** (un golpe a 0,2–0,6 pasos del sitio, que el imán corrige), una **corrección** posterior (mover el golpe) o una **rectificación** de camino. Nunca algo que no se recupere solo ni que cambie la canción final.
- **Perfiles y semilla** (§3).
- **Tests:** el movimiento **llega** al destino con la tolerancia pedida; las velocidades son suaves (sin saltos); las pausas están dentro de los límites; las imperfecciones respetan su probabilidad y **siempre se recuperan** (el resultado final es el del guion); misma semilla = mismo resultado.

## 6. Lo que se ve encima: dedo, bocadillo, rótulo

Una capa **encima de todo** (`PilotLayer.vue`, sin eventos del usuario: `pointer-events: none`):
- **Dedo fantasma:** círculo de ~36 px translúcido con anillo y una **estela** que se apaga; al apoyar, un pequeño latido; al mantener, el **anillo de mantener ya es el de la app** (no se dibuja otro).
- **Bocadillo de la boca:** cerca del micro (abajo, sobre Play), con la sílaba que sale en cada golpe ("bum", "pff", "ts", "na-na") y, en la melodía, "mmm" con el **punto de voz en vivo** moviéndose en la franja (viene del micro virtual: `pitch`).
- **Rótulo** pequeño con lo que se añade ("+ bombo", "el filtro se abre"), **apagable**.
- **Etiqueta "piloto automático · demo"** siempre visible mientras actúa.
- Con **movimiento reducido**: el dedo salta de un sitio a otro (sin estela ni curva), sin bocadillo animado; la información es la misma.

## 7. El primer guion: la demo del dembow (fase 1)

Un guion **corto** (~45–60 s a 120 bpm) que construye lo que la demo de dembow (005 §20) tiene en su célula Principal, con el dedo y la boca:

1. **Aparece el dedo**, toca **Play** (arranca el audio y el pulso). Rótulo: "Dembow, 120 bpm".
2. **Toca la bola "acordes"**: entran los acordes. Rótulo: "+ acordes".
3. **Platillo con la boca:** el bocadillo dice "ts ts ts ts…" a semicorcheas; **la frase empieza en la línea de compás** y, al cerrarse, **nace el loop** y cae su bola.
4. **Bombo tocando el aro:** cuatro toques en la franja del bombo en los pasos 0, 4, 8 y 12 (uno cae un poco fuera y el imán lo coloca).
5. **Caja con la boca:** "pff" en los pasos 3, 6, 11 y 14 (la caja dembow); nace su loop.
6. **Toca la bola "bajo"**: entra el bajo; el sidechain del bombo se nota.
7. **Espera** unos compases oyéndolo y **se detiene** (suelta el control).

**Lo que no hace la fase 1:** la colonia (células nuevas, copiar, enganchar), la melodía ni el órgano. Y **no puede** poner el sinte `drone` del ambiente de la Intro (no hay en la interfaz un gesto que ponga el sinte de un loop): la canción construida **tiene los mismos golpes y capas** que la Principal de la demo, no la Intro. Esto es una decisión (§11): lo que la interfaz no puede hacer, el piloto tampoco.

## 8. Fases

1. **F0. Laboratorio del piloto** (solo desarrollo, `/lab/piloto`): la **humanización** (trayectorias, tiempos, imperfecciones, semilla) con tests; el **envío de gestos sintéticos** sobre el aro y la pantalla de prueba (`dev/lab-aro`, `dev/lab-estudio`) comprobado en Chrome (que un toque crea el golpe, que arrastrar lo mueve, que el centro lo borra, que mantener arma un carril); el **resolutor de objetivos**; y el arreglo de `setPointerCapture`. Hito: te enseño el dedo moviéndose y haciendo gestos reales.
2. **F1. El primer guion** (§7): `PilotWorker` (micro virtual: `hit` y `pitch`), el **modo piloto del motor** (arranque sin micro), `PilotLayer` (dedo, bocadillo, rótulo, etiqueta), la barra (reproducir, pausar, saltar al final) y la detención por toque; el botón "▶ ver cómo se construye" junto a "Cargar demo".
3. **F2. La colonia y la melodía:** gestos de la colonia (nueva célula, **copiar**, **enganchar** con el asa, **cámara que sigue**), pellizco con dos dedos, la melodía con el micro virtual (`melodic`, `notes`) y el **órgano**; guion de la demo de drum and bass.
4. **F3. Los remixes:** el guion del "Himno de la alegría" (7 células, la subida con el filtro, el subidón), el botón en la hoja de Remixes y el **modo vídeo** (sin ⋯, estilos ni botones; pantalla que no se apaga).
5. **F4. Grabar una sesión real:** un grabador que anota los **gestos reales** (normalizados a objetivos y a compases) y lo que "oyó" el worker (golpes y notas, **nunca audio**) y lo convierte en un guion; validación estricta de lo importado; guardar el guion (Mis canciones, spec 006) y compartirlo como texto.

## 9. Riesgos

| Riesgo | Qué pasa | Mitigación |
|---|---|---|
| **Eventos de puntero sintéticos** | `setPointerCapture` falla con un `pointerId` inventado; Safari/iOS son más estrictos con los eventos no fiables; los gestos de dos dedos necesitan dos `pointerId` a la vez | `try/catch` en la captura; F0 lo comprueba antes de construir nada más (Chrome ahora; iPhone cuando se pueda); si algún gesto no se puede fabricar en un navegador, ese guion se marca "solo escritorio" |
| **Depende de la geometría** | El aro, la colonia y las bolas están en sitios distintos en cada pantalla; un guion con píxeles se rompe | Objetivos con sentido resueltos en el momento; el piloto espera a que el objetivo exista (un aro que aparece con su transición); tests en vertical, horizontal y escritorio |
| **Se rompe cuando cambia la interfaz** | Un botón que se mueve o se renombra rompe el guion en silencio | Los objetivos usan `aria-label` y la geometría real; **cada guion se ejecuta en un test en Chrome** y comprueba que llega a su canción final (aviso en cuanto algo se rompe) |
| **Cuadrar con la música** | Un gesto que cae fuera de la línea de compás suena mal | Planificar hacia atrás con el reloj del motor; el micro virtual emite con tiempos del reloj de compases; tests con reloj simulado |
| **Construir mientras suena** | La canción cambia mientras avanza el cursor de células (005 §4) | Construir **en bucle sobre la célula que se llena** y pasar a la siguiente al enganchar (como lo hace una persona); tests del cursor al crecer |
| **Efecto "valle inquietante"** | Demasiado perfecto parece una máquina; demasiado torpe, un fallo | Imperfecciones pocas y **siempre recuperables**, pausas variables, perfiles; se ajusta **de vista** con el hito de F0 |
| **Engañar** | Que parezca una persona de verdad | **Se presenta como demo**: etiqueta "piloto automático" siempre visible y aviso al empezar; no hay modo para esconderla (el modo vídeo oculta la interfaz, no la etiqueta) |
| **Coger el control sin querer** | Un toque ajeno al fantasma lo detiene | Es lo pedido: cualquier toque real lo detiene y deja la canción; un toque en la barra no |
| **Rendimiento** | Dedo, estela, bocadillo y animaciones del aro a la vez | La capa es ligera (unos elementos DOM); el vigilante de frames del aro (003 E1.7) manda; con carga, se simplifica la estela |
| **Audio sin micro** | El motor hoy arranca con micro y calibración | Un **modo piloto** de `start` (sin micro ni calibración, con el worker de mentira); no cambia el arranque normal |
| **Sesiones grabadas (F4)** | Una sesión importada trae operaciones raras o texto con código | Validación estricta de cada paso (números en rango, objetivos de una lista, rótulos como texto limpio con `safeLabel`, nunca se evalúa nada) |
| **Privacidad (F4)** | Se podría grabar la voz | **No se guarda audio**: solo golpes y notas (el resultado), nunca la voz |
| **Mantenimiento de los guiones** | Un guion por demo o remix, escrito a mano, se queda viejo | El guion termina en `final()`, que **se compara con la canción del remix**; el test falla si no coinciden; en el futuro se derivan los guiones de remixes simples a partir de la canción |

## 10. Criterios de aceptación (fase 1)

1. Con **"▶ ver cómo se construye"** en la demo de dembow, la app **construye sola, en tiempo real**, la canción del §7 (mismos golpes, capas y partes que la Principal de la demo), **sin micro**.
2. El **dedo fantasma** se mueve con curvas, aceleración y frenado, **toca, arrastra y mantiene en los sitios correctos** y se ve el gesto (el golpe cae, el imán lo coloca, la bola nace).
3. **Cada acción pasa por los manejadores reales** (se comprueba: sin el dedo, no ocurre; el piloto no llama a `editLoops`).
4. Al "cantar", sale el **bocadillo** y la frase **empieza en la línea de compás**; nace el loop.
5. **Pausar** congela dedo y guion; **saltar al final** deja la canción de `final()` y suelta el control; **tocar la pantalla** lo detiene y la canción queda editable.
6. Un **toque real** durante cualquier gesto lo detiene sin dejar nada a medias (ni un golpe arrastrado ni un loop a medias).
7. La **etiqueta "piloto automático"** se ve siempre; con movimiento reducido todo funciona sin curvas.
8. **Con la misma semilla, el mismo resultado**; el guion se ejecuta en un test de Chrome y llega a `final()`.

## 11. Decisiones a revisar y preguntas abiertas

1. **Lo que la interfaz no puede hacer, el piloto tampoco** (sinte propio de un loop, ganancia por loop…). Alternativa: darle a la canción construida esos detalles con un salto al final.
2. **¿Y la música al pausar?** Propuesta: se **pausa también la música** (como una grabación). Alternativa: sigue sonando el bucle y solo se congela el dedo.
3. **Etiqueta fija "piloto automático · demo".** ¿Texto exacto y posición? (propuesta: arriba, junto a los estilos, pequeña).
4. **¿Dos dedos fantasma** para el pellizco y el filtro (más fiel) o usar el gesto de ratón (un dedo fuera de la gota: filtro y espacio, 003 E1.5)? Propuesta: dos dedos en la fase 2.
5. **El bocadillo**: ¿sílabas ("bum", "pff", "ts") o también la onda de la voz? Propuesta: sílabas y el punto de voz en vivo (que ya existe).
6. **¿Dónde está el botón?** Junto a "Cargar demo" en ⋯ y en la hoja de Remixes, junto a "Abrir".
7. **Guiones escritos a mano o derivados:** a mano en la fase 1–3 (control total de la historia); derivar los de remixes simples a partir de la canción (la idea de la versión anterior de esta spec) queda para más adelante, junto con la grabación (fase 4).
8. **Vídeo:** la app **no graba vídeo** (lo hace la grabación de pantalla del sistema); el modo vídeo solo limpia la pantalla. ¿Se quiere una cuenta atrás de 3 s antes de empezar, para dar tiempo a pulsar "grabar"? (propuesta: sí, apagable).
