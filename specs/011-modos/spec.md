# 011 · Modos: la misma canción, dos vistas

> Estado: **fases 1–7 hechas (2026-11-14); falta probarlas en el móvil** (§11). Las fases 8 y 9 (§14, componer más fácil) están por hacer. Las decisiones están en §10; §12 añade a Jugar la textura del agua, el primer minuto guiado y la recompensa.
> Parte de: spec 003 (el aro), 005 (células, colonia, grupos, disparadores), 002 (melodía), 006 (Mis canciones), 008 (remixes),
> 010 (sonidos). El inventario de §2 se hizo mirando `Studio.vue`, `VisualStage.vue`, `SettingsSheet.vue` y las specs, no de memoria.

## 1. Idea y principio

La app ha crecido por capas (aro → células → colonia → grupos → disparadores) y hoy **todo está en una sola pantalla**: la gota, el mapa
de células al alejar el zoom, doce gestos distintos, marcadores, botones de acción, hojas de ajustes. Para quien llega a tocar, es mucho.
Para quien compone, es justo lo que necesita. La propuesta no quita nada: **separa lo que se ve y se toca según lo que se quiere hacer**.

**Principio: una sola canción, varias vistas.** Hay **un único modelo** (`Song`: células, loops, notas, grupos, disparadores, `lpf`, `wow`;
spec 005 §3) y **un único motor**. Un modo no tiene datos propios: es **una forma de mirar y tocar esa misma canción**.

Tres reglas que no se negocian:

1. **Cualquier canción (demo, remix, guardada) se abre y suena en cualquier modo**, igual. El modo no se guarda en la canción.
2. **Lo que se hace en un modo se ve en el otro** (un golpe puesto en «Jugar» está en la célula que se ve en «Componer»).
3. **Cambiar de modo no corta la música** ni cambia lo que suena: solo cambia lo que se ve y se toca.

## 2. Inventario: qué hay hoy y a qué modo iría

Leyenda: **J** = Jugar · **C** = Componer · **J+C** = en los dos · **⋯** = ajustes / avanzado (hoja, fuera de las pantallas) · **—** = se retira o se pospone.

### 2.1 Barra y botones (hoy, `Studio.vue`)

| Qué | Hoy | Modo |
|---|---|---|
| Estilos (hip hop, house, dnb, dembow, techno) | barra de arriba, siempre | **J+C** |
| BPM / tempo fácil (4 toques, mantener = el del estilo) | junto a los estilos | **J+C** (en Jugar, solo el número; el gesto, igual) |
| Play / Parar | abajo, grande | **J+C** |
| Mis canciones (biblioteca, 006) | botón arriba a la izquierda | **J+C** |
| Remixes (008) | botón debajo del anterior | **J+C** |
| ⋯ Ajustes | arriba a la derecha | **J+C** |
| (nuevo) **Selector de modo** | — | **J+C** (§5) |

### 2.2 La gota (aro, spec 003; lo que se hace «de cerca»)

| Qué | Hoy | Modo |
|---|---|---|
| La gota, sus franjas (bombo, caja, platillo, melodía, bajo) y la aguja con su estela | siempre | **J** |
| Beatbox: la voz graba golpes (clasificador, calibración, cuantizado) | de cerca, sonando | **J** |
| Crear un golpe (tocar), arrastrar, llevarlo al centro = borrar | de cerca | **J** |
| Sugerencias del estilo (guía al tocar) | de cerca | **J** |
| Carriles que graban (mantener un hueco 0,5 s; E4) | de cerca | **J** |
| Tocar la franja de la melodía → **órgano** (pantalla completa; spec 002) | de cerca | **J** (se abre desde Jugar; ver §3.3) |
| Melodía con la voz (beta, en ⋯) | de cerca | **J** |
| Dos dedos: **filtro** (vertical) y **espacio** (horizontal); dos dedos sin mover = fondo sí/no | de cerca, y en cualquier sitio | **J** (y filtro/espacio en **C**, ver §4.2) |
| Bolas flotantes: una por loop (tocar = silenciar, mantener = borrar) y las del fondo (bajo, acordes) | de cerca | **J** |
| Puntitos del compás junto al centro | de cerca | **J** |
| Chapa de vueltas (● ● ○ ○; tocarla = bucle ∞ / ▶ seguir) | de cerca, una célula de varias | **J** (simplificada, §3.2) |
| Retraso de imagen, prueba de sincronía, calibraciones | ⋯ | **⋯** |

### 2.3 La colonia (el mapa de células, spec 005 §7, §15, §16, §22)

| Qué | Hoy | Modo |
|---|---|---|
| Mapa con todas las células, profundidad, física al mover | alejando el zoom | **C** |
| Hilos de orden (cortar uno = soltar la célula) | colonia | **C** |
| Mover una célula; copiar (arrastrar el asa a agua vacía); ordenar (asa sobre otra) | colonia | **C** |
| Tocar agua vacía = célula nueva; número de vueltas (tocar = 1→2→4→8); mantener = borrar + «↶ deshacer» | colonia | **C** |
| Un toque en una célula = salta a ella y queda en bucle; doble toque = entrar | colonia | **C** (y el doble toque pasa a «Jugar sobre esa célula», §3.4) |
| Grupos en paralelo / células libres: encender y apagar, marcadores ▶ ■ de los disparadores (§22) | colonia | **C** |
| Anillo de progreso, puntitos de vueltas, hilo que se llena | colonia | **C** |
| «◎ centrar», «∞ ▶ seguir canción», «apagar grupos», «↶ deshacer» | zona de acciones | **C** (los de «seguir» y «grupos», también **J**, §3.2) |
| Marcadores del borde (otras células, al ver una) | de cerca | **C** (en Jugar sobran) |
| «Añadir célula libre», «Borrar todo» | ⋯ | **C** (en la propia pantalla, no en ⋯) |

### 2.4 Hojas y ajustes (`SettingsSheet`, `LibrarySheet`, `RemixSheet`)

| Qué | Hoy | Modo |
|---|---|---|
| Kit (Electrónico / Vinilo / 808; spec 010) | ⋯ | **⋯** (a la vista del estilo, se elige solo) |
| Fondo: apagado / manual / auto | ⋯ y bolas | **⋯** (y las bolas en J) |
| Frases (modo, cierre, máx.), modo de repetición | ⋯ | **⋯ · avanzado** |
| Melodía con la voz, Retraso de imagen, Prueba de sincronía | ⋯ | **⋯** |
| «Cargar demo» | ⋯ | **J+C** (un botón claro en ambos; hoy está escondido) |
| Recalibrar latencia / sonidos | ⋯ | **⋯** |
| Pestaña **código** (Strudel de la canción, copiar) | ⋯ → código | **⋯** (y un atajo, §3.5) |
| Diagnóstico / registro | ⋯ | **⋯ · avanzado** |
| Mis canciones, Remixes | hojas | **J+C** |

## 3. Los modos

### 3.1 Cuántos: dos, y dos «herramientas» sin modo propio

- **Jugar** (por defecto): una gota, la voz y el dedo. Sin mapa, sin números, sin hilos.
- **Componer**: la colonia entera, para ordenar, copiar, agrupar y disparar.
- El **Órgano** (melodía) y el **Código** **no son modos**: son herramientas que se abren desde cualquiera de los dos (el órgano, hoy ya
  pantalla completa al tocar la franja de la melodía; el código, la pestaña de ⋯). Así no hay tercer sitio al que ir y volver.

Alternativas descartadas en §10: tres modos con «Órgano» propio (el órgano ya es una hoja y no es una vista de la canción entera) y un modo
«Código» (es de lectura, y la hoja de ⋯ basta).

### 3.2 Jugar (por defecto)

**Qué se ve:** la gota de la célula que suena (agua, franjas, aguja, golpes), las bolas de los loops y del fondo, los puntitos de vueltas
junto al centro y, **si la canción tiene más de una célula**, una **tira de células** muy fina (§3.6). Nada de mapa, números, hilos, asas
ni marcadores del borde.

**Qué se puede tocar:** todo lo de §2.2 (golpes, carriles, órgano, filtro/espacio, bolas, voz) más **Play**, los estilos y el tempo.
Un solo cambio respecto a hoy: **la gota sigue siempre a la canción** (si la canción pasa de la célula 2 a la 3, la gota cambia con la transición de agua).

**Qué se graba:** la voz (beatbox, y la melodía con la voz si está activada) y los toques **en la célula que se ve**, que es la que suena.
Es lo mismo que hoy.

**Qué NO se puede hacer:** crear, copiar, ordenar, mover o borrar células, ni tocar grupos y disparadores. Para eso, «Componer».

### 3.3 Componer

**Qué se ve:** la colonia (§2.3). Sin aguja ni estela en la célula que se mira; solo la que suena lleva aguja y anillo.

**Qué se puede tocar:** todo lo de §2.3, más Play, estilos, tempo y **filtro/espacio con dos dedos** (hoy no se puede en la colonia; ver §4.2).
**Doble toque en una célula** = «entrar a jugar en ella» (§3.4).

**Qué se graba:** **nada** con la voz (no hay gota). Lo que se compone son estructuras: células, vueltas, orden, grupos, disparadores.

### 3.4 Entrar a jugar en una célula (el puente entre los dos modos)

Hoy, doble toque en la colonia acerca la cámara a una célula **y la deja «fijada»** (la vista no sigue a la canción hasta «Volver a la canción»;
spec 005 §18). Esa fijación es lo que se ha visto confuso. Propuesta, ya a medias en el código (`5f14557`):

- **Doble toque en Componer → pasa a Jugar con esa célula en la gota**, sin cambiar lo que suena. Una chapa visible: «**editando: Drop 1** · ▶ seguir la canción».
- **«▶ seguir la canción»** (o volver a Componer) suelta la fijación: la gota vuelve a la célula que suena. **No hay otra forma de quedar «fijado».**
- En **Jugar a secas** (sin haber entrado desde Componer) nunca hay fijación: la gota sigue a la canción.

Con eso, los estados raros de hoy (vista fijada, célula de grupo a la vista, «◎ centrar» más «∞ seguir» más «volver») se reducen a **uno**: *editando* o *siguiendo*.

### 3.5 Herramientas sin modo propio

- **Órgano** (melodía): se abre tocando la franja de la melodía, en Jugar. En Componer, doble toque en una célula con melodía y luego la franja (dos pasos, como hoy).
- **Código**: un botón pequeño «‹/›» al lado de ⋯, en ambos modos, que abre la pestaña de código (hoy: ⋯ → código). Solo lectura y «copiar».

### 3.6 Una canción de muchas células en Jugar

Es el caso difícil: el Himno son 12 células, el Mozart 12 (+4 de grupos). En Jugar solo hay **una gota**. Tres opciones:

| Opción | Qué es | Pros | Contras |
|---|---|---|---|
| **A. Seguir la célula que suena** (recomendada) | La gota es la célula que suena; cambia con la transición de agua. Una **tira de células** abajo (un puntito por célula de la canción, la actual iluminada, con sus vueltas) | Es lo que hace hoy el motor; cero conceptos nuevos; se ve dónde va la canción | Lo que grabas va a la célula del momento: si cambia, cambia |
| **B. Bucle por defecto** | Jugar siempre en bucle sobre una célula («∞»); la canción no avanza | Simple de entender (una gota = un loop) | Una canción de 12 células **no se oye entera** en Jugar: rompe la regla 3 |
| **C. Aplanar** | Una gota «resumen» del conjunto | — | Imposible sin un modelo nuevo (no existe «la célula de toda la canción») |

**Recomendación: A**, con dos detalles:
- **Tocar un puntito de la tira = «ir a esa célula»** (hoy: un toque en la colonia; salta en la siguiente línea de compás y queda en bucle ∞). Un toque más suelta el bucle.
- **Mantener un puntito** = entrar a jugar en esa célula (§3.4) sin esperar a que suene.
- **Los grupos en paralelo suenan igual** (las melodías de los remixes), pero **en Jugar no se ven**: solo un indicador discreto «+ grupo» junto a Play y el botón de apagarlos (hoy «apagar grupos»). Para verlos y tocarlos, Componer.
- Con **una sola célula** (lo normal al empezar) no hay tira: Jugar es exactamente la app simple de hoy.

## 4. Cómo se cambia de modo

### 4.1 El selector

Un **interruptor de dos estados** junto al nombre del estilo (o bajo ⋯), con la palabra del modo: **Jugar | Componer**. Siempre visible, siempre el mismo sitio.
**El modo se guarda por dispositivo** (en las preferencias, 003 E6.4), no en la canción. Por defecto, **Jugar** (también para quien ya usaba la colonia: ver §8).

### 4.2 Atajos

- **Pellizcar para alejar** en Jugar (hoy: entra a la colonia): **pasa a Componer**, con un aviso la primera vez («esto es Componer»). **Pellizcar para acercar** en Componer: pasa a Jugar.
  Así la memoria muscular de quien ya usa la colonia no se pierde.
- **Doble toque** en una célula (Componer) → Jugar sobre ella (§3.4).
- **Filtro y espacio con dos dedos** funcionan también en Componer (hoy solo de cerca): son efectos de toda la canción, no de una célula; poder moverlos con el mapa a la vista no cuesta nada.

### 4.3 Qué conserva el cambio

La música sigue; la gota o el mapa se **transforman con una transición de agua** (la cámara ya sabe acercarse y alejarse, spec 005 §5). La selección y la vista fijada (§3.4) se **sueltan** al volver a Componer (ya implementado).

## 5. Cualquier demo o remix, en cualquier modo

- Se abren como hoy (`replaceSong`), con su estilo y su kit, **y el modo no cambia**. Abrir el Himno desde Jugar: la gota es la **Intro**; empieza a sonar y la tira va avanzando.
- En Jugar, **todo suena igual**: bajo, acordes, risers, platillo, grupos. Lo único que cambia es qué se ve.
- Una canción con **grupos y disparadores** (los remixes) funciona en Jugar sin que el usuario los toque nunca; para editarlos, Componer.
- **Lo guardado no cambia de formato** (`Song`, spec 006): no hay campo de modo. Una canción guardada desde Jugar se abre igual en Componer.
- Los remixes son un buen **banco de pruebas** de la regla 1: un test los abre y los recorre en cada modo (§9).

## 6. Qué se pierde, qué se gana

| Se gana | Se pierde (o se mueve) |
|---|---|
| Pantalla de inicio de **una gota y un botón de Play**, sin mapa ni números | En Jugar no se puede **copiar/ordenar/mover/borrar** células: hay que cambiar a Componer |
| Los estados de «fijado/libre/siguiendo» se reducen a **editando o siguiendo** (§3.4) | El «pellizco = mapa» pasa a ser **un cambio de modo** (con aviso), no un zoom continuo |
| El código de `VisualStage.vue` (unas 2 000 líneas) se puede **partir en dos vistas** y probar por separado | La transición continua gota ↔ mapa (el zoom sin saltos) se sustituye por una transición con corte limpio; hay que decidir si se conserva (§10) |
| «Cargar demo» a la vista | Un clic más para quien componía sin salir de la gota |

## 7. Lo que cambia en el código (para estimar, no para hacer ahora)

1. **Pref `mode: 'jugar' | 'componer'`** (`usePrefs`), con migración (por defecto Jugar) y su guarda (`prefsGuard`).
2. **Partir `VisualStage.vue`**: hoy mezcla la gota, la colonia, las bolas, los marcadores y los gestos. Habría una vista por modo; lo común (cámara, agua, motor) se queda.
3. **La tira de células** (nuevo, pequeño) y el **selector** (nuevo, pequeño).
4. **Gestos por modo** (`lib/gestures.ts`): la tabla de §2 decide qué gesto vale en cuál.
5. **Estados «editando/siguiendo»**: retirar `pinned`/`viewAway` y dejar uno solo; mantener el comportamiento ya corregido de soltar al alejar.
6. **Nada** cambia en `Song`, el motor, `lib/song.ts`, el código mostrado ni la biblioteca.

## 8. Quien ya usa la app

- El **primer arranque tras actualizar** abre en **Jugar** aunque se usara la colonia, con un único aviso: «Ahora hay dos vistas: **Jugar** y **Componer** (el mapa)».
- Las canciones guardadas y las preferencias **se abren igual** (no hay formato nuevo). El zoom guardado (`coderbeats:aro:v1`) sigue valiendo para Jugar.
- La **calibración** (latencia, sonidos) no cambia ni se pide de nuevo.

## 9. Cómo se comprobará

- **Los datos no cambian**: ningún test de `Song`/`cells`/`song.ts` debe tocarse. Es la señal de que los modos son solo vista.
- **Un test recorre todos los remixes y demos** abriéndolos con el modo en cada valor y comprobando que **el código que suena es el mismo byte a byte** (`songCode` no depende del modo).
- La pref `mode` y su migración (`prefsGuard`, `prefsMigration`).
- La **tira de células** (cuántos puntitos, cuál está iluminada) como función pura; los **gestos por modo** como tabla pura (qué gesto vale en cuál).
- **Pendiente de oído y de dedo** (móvil): que Jugar se sienta simple, que el pellizco no cambie de modo sin querer, y que el doble toque de Componer a Jugar sea claro.

## 10. Decisiones (2026-11-14)

Del autor:

1. **Dos modos, Jugar y Componer**; Órgano y Código son **herramientas** (no modos).
2. **Nombres: Jugar y Componer.**
3. **El pellizco para alejar pasa a Componer** (con aviso la primera vez); también el selector. Pellizcar para acercar en Componer pasa a Jugar.
4. **Jugar no crea células**: una sola célula; para crear partes, Componer (nada de «+» en Jugar).

Las otras cinco, decididas por lo más simple:

5. **Muchas células en Jugar: la opción A** (§3.6): la gota sigue a la canción y una **tira de células** muestra dónde va. **Tocar un puntito = ir a esa célula** (como un toque en la colonia hoy: salta en la siguiente línea de compás y queda en bucle; otro toque suelta el bucle). No hay «mantener un puntito»: para editar otra célula se va a Componer y doble toque.
6. **Una sola fijación: «editando: X · ▶ seguir la canción»** (§3.4). En Jugar no hay «◎ centrar» ni «volver a la canción» aparte; «◎ centrar» sigue siendo del mapa de Componer.
7. **Filtro y espacio con dos dedos: solo en Jugar**, como hoy. En Componer, dos dedos siguen siendo pellizco. (Más simple; se puede añadir después, §4.2 lo deja como opción.)
8. **«Cargar demo» a la vista** solo donde hace falta: en el **estado vacío de Jugar** («o prueba una demo») y en ⋯, no como botón fijo.
9. **Fases** (§11) en el orden propuesto, una por commit.

## 11. Fases de la implementación

| Fase | Qué | Cómo se prueba |
|---|---|---|
| **1** | Pref `mode` (`jugar`/`componer`), su guarda y migración; selector Jugar \| Componer en la barra; **pellizco** alejar/acercar cambia de modo; aviso la primera vez | tests de la pref y de la guarda; a mano: selector y pellizco |
| **2** | **Jugar**: sin colonia (el zoom queda en «de cerca»), sin marcadores del borde; **tira de células**; la gota sigue a la canción; una sola chapa «editando · seguir» | test de la tira (función pura); a mano: Himno y Mozart en Jugar |
| **3** | **Componer** = la colonia (zoom bloqueado al mapa); sin voz que grabe; **doble toque** en una célula → Jugar con esa célula («editando») | a mano: entrar y salir de una célula |
| **4** | **Jugar, menos ruido visual**: el agua como textura suave (§12.1) | a mano |
| **5** | **Primer minuto guiado** (§12.2) | tests de la máquina de pasos (pura); a mano: arranque con la app vacía |
| **6** | **Recompensa** cuando todos los carriles tienen algo (§12.3) | test de la condición (pura); a mano |
| **7** | Limpieza y documentación. **`pinned`/`viewAway` se quedan**: ya solo los activa «editando» (doble toque en Componer), que es el único estado raro que queda (§3.4) | tests de todo |
| **8** | **Convertir en canción** (§14.2): de un loop a la estructura completa | tests de la función pura; a mano |
| **9** | **Componer en directo** (§14.1): grabar canción tocando las capas | tests de la línea de tiempo y del convertidor; a mano |

## 12. Añadidos a Jugar (2026-11-14)

### 12.1 Menos ruido visual: el agua como textura suave

En Jugar la gota es el protagonista. Las **ondas del agua, la estela de la aguja y los destellos de los golpes bajan de intensidad** (más suaves y lentos, el agua como una
textura de fondo y no como adorno que compite con los golpes); los **golpes** (los puntos) y la **aguja** se leen primero. Un ajuste de **intensidad** del agua por modo
(Jugar: baja; Componer: la de hoy), sin tocar los datos. Se respeta «movimiento reducido». **Se afina de ojo.**

### 12.2 El primer minuto guiado

Para quien abre la app **sin ninguna canción** (primer arranque o «Borrar todo»), **un guion corto en Jugar**, con una sola frase a la vez, que se va solo cuando se cumple:

| Paso | Qué ocurre | Se pasa al siguiente cuando… |
|---|---|---|
| 1 | **Suena el fondo** (bajo y acordes del estilo) y la gota espera. Frase: «Escucha» | pasa un compás |
| 2 | Frase: **«haz bum · pff · ts»** (los tres sonidos de la calibración, con la boca) | la app oye **al menos un golpe** de cualquier carril |
| 3 | Frase: **«en la siguiente vuelta aparecen tus golpes»**; **al cerrar el compás, los golpes salen en la gota** y suenan | pasa esa vuelta |
| 4 | Frase: **«ahora canta»** (la melodía con la voz, si está activada; si no, **«toca la franja de la melodía»**, que abre el órgano) | se oye una nota **o** pasan 2 vueltas (no se espera nada) |
| 5 | Fin: la guía **desaparece** y no vuelve (se guarda en el dispositivo; se puede repetir desde ⋯) | — |

Reglas: **la guía nunca bloquea** (todo se puede tocar mientras se muestra; si la persona hace otra cosa, el paso se da por cumplido); **una sola frase**, pequeña, sobre el agua;
**se puede saltar** (un toque en la frase). No toca nada de la canción: es solo texto.

### 12.3 La recompensa: el disco entero se enciende una vuelta

Cuando **todos los carriles tienen algo** (bombo, caja y platillo con golpes; y la melodía, si está activada), **la gota entera se enciende una vuelta** (un barrido de luz por todas
las franjas, de la aguja una vuelta completa), con un destello suave al cerrar el compás. **Una vez por canción y sesión** (no cada vez que se vuelve a cumplir), y **solo en Jugar**.
La condición es una **función pura** (`allLanesFilled(loops, lanes)`).

## 14. Lo más importante: una forma más fácil de componer (2026-11-14)

Hoy, componer es **armar células a mano en la colonia** (crear, copiar, ordenar, vueltas, disparadores). Es potente y es lo más difícil de la app. Estas dos ideas
llevan **la composición a Jugar**, sin mapa: la persona toca o pulsa, y **la app construye las células**. El resultado **es una canción normal** (el mismo `Song`),
que luego se puede retocar en Componer. *Nota:* la decisión 4 («Jugar no crea células») se refiere a hacerlas **a mano**; aquí las crea la app a partir de lo que se toca.

### 14.1 Componer tocando en directo (tipo Incredibox)

- **Qué hace la persona:** con sus loops hechos (bombo, caja, platillo, melodía, bajo y acordes) pulsa **«grabar canción»** y **enciende y apaga capas al ritmo** tocando
  los anillos (las bolas de los loops y del fondo, que ya se pueden silenciar con un toque: spec 003). Pulsa de nuevo para terminar.
- **Qué apunta la app:** **por compás**, qué capas están encendidas (una línea de tiempo `Compás → conjunto de capas`). Los cambios se aplican en la siguiente línea de compás (como hoy).
- **Al terminar se convierte en células:** cada **tramo seguido con el mismo conjunto de capas** es una célula (`turns` = sus compases, redondeados al 1/2/4/8/16/32 más
  cercano que no se pase; `loops` = las capas encendidas; `parts` = bajo y acordes según el fondo). Un tramo corto (< 1 compás) se une al vecino. El orden es el de la grabación.
  Se les **pone nombre** por lo que tienen (intro: pocas capas; subida: sin bombo; drop: todas; final: pocas), con la misma regla que 14.2.
- **Qué se ve:** mientras graba, un punto rojo discreto junto a Play (rojo no está en la paleta, E1.2: se usa el rosa de la marca, parpadeando) y un contador de compases.
  Al terminar, **la tira de células** (§3.6) aparece con las células nuevas y una frase: «Tu canción: 6 partes. Ábrela en Componer para retocarla».
- **Qué NO hace:** no graba el filtro, el espacio ni la voz mientras (solo las capas); no cambia los loops (las capas son las que ya hay).
- **Riesgos:** (1) apagar/encender cae **entre compases** o a mitad: se redondea al compás **siguiente**; (2) una grabación muy larga da muchas células (tope 16 = `MAX_CELLS`: si se pasa, se
  fusionan los tramos más cortos y se avisa); (3) las capas sustituyen a lo que hubiera: si ya había una canción de varias células, **se pide confirmación** (con «↶ deshacer», 005 §7.1).

### 14.2 «Convertir en canción»

> **Actualización (2026-11-15):** la conversión **no tiene lógica propia**: es una **receta de las variaciones** de la **spec 012 §5–§6** (intro = menos energía, subida = sin bombo + redoble + filtro que se abre, drop = la original, final = acordes que se apagan),
> y puede aceptar una **melodía sugerida** (012 §3) para que el Drop la lleve. Por eso las variaciones (012 S4) y la sugerida (012 S2–S3) se hacen **antes** (fases 8 y 9 de §11 pasan a depender de ellas).

- **Qué hace la persona:** con **un loop** (una sola célula) en Jugar, un botón **«Convertir en canción»** (en el estado de una célula con algo, junto a Play o en ⋯) crea **la estructura completa del estilo**.
- **La plantilla** (una por estilo, datos puros, `lib/songTemplates.ts`), a partir de las capas de la célula:

| Parte | Vueltas | Capas |
|---|---|---|
| **Intro** | 4 | el fondo y **una** capa (la más suave: el platillo, o el bombo si no hay otra) |
| **Entra** | 4–8 | + las demás capas de batería, sin la melodía |
| **Subida** | 4 | **sin bombo**, la caja se acelera (el roll de 008), el filtro se abre |
| **Drop** | 8 | **todo** (la célula tal cual) |
| **Final** | 2–4 | solo los acordes (o el fondo), que se apagan (`lpf` bajando) |

  Cada estilo ajusta vueltas y el roll (dembow, techno, dnb…); los **remixes** (008) son los ejemplos que se imitan. La célula original **se queda como el Drop**.
- **Qué se ve:** la tira de células aparece con 5 puntitos y el nombre de cada parte; la música sigue. **«↶ deshacer»** devuelve el loop de antes.
- **Qué NO hace:** no inventa notas ni toca la melodía (solo apaga o enciende lo que hay); si hay una sola capa, la Intro y el Final son más cortas y se avisa.
- **Riesgos:** sacar demasiado de una célula pobre (con un solo bombo, casi todo queda vacío): la plantilla **se salta las partes que quedarían iguales** (un loop de una sola capa da solo Intro con fondo + Drop).

### 14.3 Cuál primero: **14.2 (Convertir en canción)**

- Es una **función pura** (`loops → células`), muy fácil de probar y de afinar con los remixes como referencia, **sin ninguna interfaz nueva más allá de un botón**.
- Da **un resultado entero con un toque**, la mejor primera impresión («mi loop ya es una canción») y cubre justo el salto que hoy asusta (de una gota a una canción).
- **Orden actualizado (012 §8):** primero las variaciones (S4), luego la conversión (S6) sobre ellas. **14.1 la necesita**: el convertidor de «línea de tiempo de capas → células» **es la misma idea** (partir por tramos y nombrar), así que 14.2 deja hecho el 70 % de 14.1 (nombrar partes, redondear vueltas, aplicar `lpf`).
- 14.1 sí requiere **interfaz nueva** (grabar, contador, el toque en vivo con cuantizado por compás) y mucho más ajuste de dedo. Se hace **después**, sobre lo que ya funciona.

## 13. Más adelante (no ahora)

- **Modo «Escenario»**: solo mirar y grabar (el disco en perspectiva tipo LED, estela, encendido en el drop).
- Como gestos o efectos **dentro** de los modos: **dibujar una melodía con el dedo** en el Órgano, la **calibración como mini-juego** (tipo espiral), el **árbol de estilos** como selector, **formas efímeras** al sonar.

## 15. Lo implementado (2026-11-14) y dónde está

| Fase | Commit | Dónde |
|---|---|---|
| 1 | pref + selector + pellizco | `lib/modes.ts`, `composables/usePrefs.ts` (`mode`), `components/ModeSwitch.vue`, `VisualStage.vue` (`switchMode`, `zoomBounds`), motor (`mode`, la voz no graba en Componer) |
| 2 | tira de células, sin marcadores, «editando» | `lib/modes.ts` (`cellStrip`), `components/CellStrip.vue` |
| 3 | Componer = la colonia | (dentro de la fase 1: el modo decide el tramo del zoom y `colony`; doble toque → Jugar con esa célula) |
| 4 | agua suave | `VisualStage.vue` (`CALM_JUGAR`, `soft()`), `AroCanvas.ts` (`calm`) |
| 5 | primer minuto guiado | `lib/firstMinute.ts`, `VisualStage.vue` (la frase), ⋯ → «Repetir la guía» |
| 6 | recompensa | `lib/reward.ts`, `AroCanvas.ts` (`reward`) |

**Cómo se decidió el modo en el código:** el modo no cambia datos. Decide (a) qué tramo del zoom vale (`zoomBounds`: Jugar = «de cerca», Componer = el mapa),
(b) el valor de `colony` (los gestos de la colonia) y (c) si la voz graba. **Todo lo demás (células, grupos, el motor, el código mostrado) es idéntico.**

**Pendiente de probar a mano (móvil):** el pellizco (que no cambie de modo sin querer y que cambie cuando se quiere), el selector, la tira, el doble toque de Componer a Jugar,
la guía (con la canción vacía) y la recompensa (con los tres carriles llenos).
