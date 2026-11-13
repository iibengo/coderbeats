# Spec 003 · El aro

Estado: aprobada con la enmienda 1 (2026-11-13)
Referencia visual: `boceto-aro.html` (abrir en el navegador; es la fuente de verdad del aspecto y del tacto). Donde el boceto y la enmienda 1 no coinciden, manda la enmienda.

## Por qué

El aro es lo que se ve todo el rato y donde está la música. Hoy es un anillo con un aro por instrumento y las bolas tienen casi todo el protagonismo. Queremos que el aro sea el instrumento: que se vea la canción, que se pueda jugar con el dedo como si fuera agua, y que tenga un "wow" sin agobiar.

coderbeats sigue siendo un instrumento para jugar (tipo Incredibox), no una herramienta de producción. Nada de casillas ni cuadrículas a la vista.

## Qué

### 1. Forma: una gota de agua
- El aro es una gota imperfecta: redonda pero irregular, que respira despacio. Ninguna línea es un círculo perfecto.
- Se adapta a la pantalla como el agua a un vaso: al hacer zoom crece y, al tocar los lados, se aplasta contra ellos con una curva suave. Arriba y abajo sigue redonda. En horizontal o escritorio se pega arriba y abajo.
- Zoom con pellizco (móvil) y rueda (escritorio). Nunca se corta ningún golpe.
- Fondo `#0B0B0F` (el de la app). Acento rosa `#F496BC`.

### 2. Franjas: una por instrumento
- Franjas concéntricas de dentro a fuera: bombo, bajo, caja, melodía, platillo.
- Cada franja tiene su color en tono muy tenue y un borde fino: bombo rosa `#F496BC`, bajo rosa oscuro `#BE5A82`, caja lila `#B9A6F2`, melodía blanco, platillo azul `#8ECFF2` (los colores de la app; ver E1.2).
- El bajo solo aparece cuando está activo; al aparecer, las demás franjas le hacen sitio con suavidad.
- Una aguja fina gira desde el centro marcando el tiempo. Una vuelta = un compás (ver E1.1, pregunta 3).

### 3. Golpes y notas
- Batería: puntos. Bajo: rayita. Melodía: punto cuya distancia al centro dentro de su franja es la nota (más fuera = más aguda), unidos por una línea muy tenue que dibuja la melodía.
- El golpe crece un poco cuando la aguja pasa cerca.

### 4. Al sonar
- Nace una onda pequeña en el punto exacto del golpe y un arco fino corre por su franja hacia los dos lados. Se apaga pronto. No invade otras franjas.
- Platillo: arco corto y punteado. Bajo: arco lento con un brillo suave en la franja.
- Bombo: además, un latido rosa muy suave sale del centro y empuja el borde de la gota en ese punto, como un golpe en la superficie del agua.
- Todo sutil: si se duda, menos.

### 5. Jugar con el dedo
- Arrastrar un golpe: se mueve libre; al soltarlo se desliza solo, con un pequeño rebote, al paso más cercano (imán = la "ayuda").
- Soltarlo en otra franja: cambia de instrumento (solo entre baterías; ver E1.4).
- Tocar una franja vacía de golpe: crea uno ahí (ya imantado).
- Llevar un golpe al centro: se borra con una pequeña salpicadura.
- En la melodía, subir o bajar el punto dentro de su franja cambia la nota (siempre dentro de la escala del estilo).
- Cada cambio se refleja en el código Strudel mostrado y en lo que suena (lo que se ve es lo que suena).

### 6. Ideas de las referencias (fase 5 de esta spec; decididas en la enmienda 3)
- Notas con duración: bajo y melodía como arcos cuyo largo es lo que dura la nota; batería como golpes cortos. Los acordes, con la spec de kits (E1.3).
- Apagado y encendido: lo silenciado o aún no grabado se ve fantasma; al sonar se enciende.
- Estela: la aguja deja un rastro que se apaga.
- Inclinación 3D opcional (disco visto en perspectiva), pensada para el reel.

## Fuera de alcance
- Kits por estilo y árbol de estilos (spec 004). La franja de los acordes va con ella.
- Melodía con la voz y reconocimiento del "na" (spec 002-melodia, ya revisada con lo decidido aquí).
- Temas visuales nuevos (letras, girasol, tinta) y el destello de disco entero.

## Aceptación
- En iPhone vertical se ven todas las franjas y todos los golpes, sin cortes, a 60 fps sin tirones con todo sonando.
- Arrastrar, cambiar de franja, crear y borrar funcionan con el dedo y con ratón.
- Tras soltar un golpe, suena en su nuevo sitio en el siguiente paso del loop y el código Strudel mostrado cambia igual.
- El tiempo visual sale del reloj de Strudel: la aguja y las ondas van a tempo con lo que se oye (con la latencia de salida; ver E1.6).
- Con el bajo apagado no se ve su franja; al activarlo aparece con transición.
- Girar el móvil o cambiar el tamaño de la ventana adapta la gota sin saltos.
- Con `prefers-reduced-motion`, el aro se ve y se toca igual, sin movimiento decorativo (E1.7).

## Preguntas abiertas

Resueltas en la enmienda 1 (E1.1).

## Fases
1. Forma de gota + franjas + aguja conectada al reloj de Strudel, y los golpes como puntos simples (sin interacción ni ondas), para que la app no pierda el mapa del ritmo entre fases.
2. Golpes (puntos y rayitas), ondas, latido; el bajo pasa a datos.
3. Arrastrar, imán, cambiar de franja, crear, borrar; sincronía con el código Strudel; gestos nuevos (E1.5) y fila de bolas.
4. Zoom adaptativo y horizontal.
5. Ideas de las referencias (apartado 6).

Cada fase termina en algo que se puede probar en el iPhone y un commit con visto bueno. Movimiento reducido y vigilante de frames (E1.7) en cada fase, para lo que esa fase dibuje.

---

## Enmienda 1 · decisiones antes de programar (2026-11-13)

Tras revisar la spec contra el código (spec 001 hasta §16.20). Manda sobre el texto de arriba y sobre el boceto.

### E1.1 Preguntas abiertas, resueltas

1. **Bolas.** Se quedan, **pequeñas (unos 20 px) y quietas**, en una fila bajo la gota. Sin deriva ni órbita (la órbita de §16.18 no cabe con la gota grande).
   - Tocar = silenciar; mantener = borrar; mientras se toca, sus golpes se resaltan en el aro (§16.18).
   - Paneo y volumen, no: no existen (la mezcla es automática, `lib/mix.ts`).
2. **Silenciar desde el aro: no.** El doble toque choca con "tocar una franja vacía crea un golpe": el primer toque crearía uno y sonaría, o cada creación esperaría unos 300 ms.
   - Se silencia en la bola. El aro lo muestra: la franja y sus golpes, fantasma.
   - Más adelante, si hace falta: mantener pulsada una franja vacía, con el mismo indicador circular que las bolas.
3. **Una vuelta = un compás.** Es el reloj de hoy (ciclo de Strudel = compás) y el modo por defecto es "loop de 1 compás" (§16.16). "Vuelta = loop entero" se rompe con longitudes mezcladas (bombo de 1 compás y platillo de 4).
   - Cada loop enseña el compás que suena ahora, como hoy.
   - Si hay loops de más de un compás, unos puntitos junto al centro marcan el compás (1–4).
   - Al arrastrar se congela el compás que se edita.
4. **Render: canvas 2D propio** encima del canvas del agua, dibujado en el mismo bucle de animación (un solo `requestAnimationFrame`).
   - El contorno de cada franja se calcula una vez por frame (unos 120 ángulos) y se reutiliza para rellenos, recortes y golpes.
   - WebGL solo si el iPhone no llega a 60 fps.
5. **El agua y el aro conviven**: agua de fondo, aro encima.
   - Se quita la onda que el agua suelta hoy en los puntos del anillo (§16.17, punto 4): la gota tiene sus propias ondas.
   - Se mantienen las ondas desde las bolas y el pulso, este algo más flojo.
   - Si en el iPhone sobra, se atenúa el agua dentro de la gota.

### E1.2 Colores y fondo: manda el código

| | Color |
|---|---|
| fondo | `#0B0B0F` |
| bombo | `#F496BC` |
| bajo | `#BE5A82` (nuevo) |
| caja | `#B9A6F2` |
| melodía | blanco |
| platillo | `#8ECFF2` |

Hoy están repetidos en `VisualStage.vue`, `PhraseRing.vue`, `themes/types.ts` y `tailwind.config.ts`. En la fase 1 pasan a una sola paleta.

### E1.3 Datos

- **Bajo como datos.** Hoy es una línea de texto fija por estilo (`lib/styles.ts`). Pasa a notas (paso, duración, nota) más el timbre como texto. El generador produce **exactamente** la línea actual (test de igualdad), así suena igual.
- **Acordes**: siguen como bola. Su franja irá con la spec de kits (004).
- **Melodía**: su franja no aparece hasta que exista una melodía (spec 002). Cuando exista, entra con la misma transición que el bajo.
- **Franja del bajo**: visible si el bajo suena o está pedido (bola "bajo"), con transición de peso.
- **Escalas por estilo** (tabla de la spec 002, §5) en `lib/styles.ts` cuando haga falta para la melodía.

### E1.4 Edición

- **Imán = ayuda.** Con ayuda, el golpe suelto se desliza al paso más cercano de la rejilla del estilo (semicorcheas; corcheas en drum and bass). Sin ayuda, se queda donde lo sueltas (posición decimal, con `.nudge()`).
- **Cambiar de franja solo entre baterías** (bombo, caja, platillo). Soltar un golpe de batería en el bajo o la melodía, o uno de bajo o melodía en otra franja, lo devuelve a su sitio con rebote.
- **El bajo no se edita: solo se ve** (rayita y arco, E3.1). No se coge, no se mueve ni se borra (cambio de E3.8: moverlo solo cambiaba un compás y acortaba la nota al final del compás, y confundía).
  - Los bajos editados que hubiera guardados se borran: vuelve el de cada estilo.
- **Un loop que se queda sin golpes se borra** (y su bola desaparece).
- **Mover, crear o borrar no es un nacimiento**: sin caída ni salpicón de la bola, solo se reevalúa el código. Suena en el siguiente paso.
- **Crear** un golpe en una franja de batería sin loop crea el loop (1 compás, con el límite de 8 loops). Hay como mucho una bola por instrumento (§16.19).
- **Loops de varios compases**: se edita el compás congelado al empezar el gesto.
- **Melodía**: subir o bajar el punto cambia la nota, siempre en la escala del estilo (cuando exista la melodía).

### E1.5 Gestos (sustituye a los de §16.16)

| Gesto | Qué hace |
|---|---|
| **un dedo** | siempre el aro: arrastrar un golpe, crear (tocar y levantar sin moverse, < 12 px), llevar al centro = borrar. Fuera de la gota, un dedo no hace nada (salvo botones y bolas) |
| **dos dedos arrastrando juntos**, en cualquier sitio | filtro (vertical) y espacio (horizontal) |
| **pellizcar** | zoom |
| **tocar con dos dedos sin moverlos** (< 400 ms) | fondo sí / no |

- **Arrastre o pellizco con dos dedos**: tras 12 px de movimiento se decide para todo el gesto. Si cambia más la distancia entre los dedos que la posición de su punto medio, es pellizco; si no, es arrastre, con el eje fijado por el movimiento del punto medio.
- **iOS**: se anula el zoom propio de Safari (`gesturestart` con `preventDefault` y `touch-action: none`).
- **Escritorio con ratón** (decidido): el ratón no tiene dos dedos.
  - Rueda = zoom.
  - Arrastrar con el ratón **fuera de la gota** = filtro y espacio. Dentro de la gota, el ratón es el aro, como un dedo.
  - El fondo sí / no se cambia en ⋯ (ya está ahí, §16.16).

### E1.6 Tiempo visual

- La aguja y las ondas salen del reloj de Strudel (`clockNow`), **adelantadas por la latencia de salida** del audio (`ctx.outputLatency`, o `baseLatency` si no existe).
- La latencia calibrada (ida y vuelta del micro) solo corrige la entrada, no la imagen.
- Si en iOS la latencia de salida sale 0, se mide de oído en la fase 1 y se decide si hace falta un ajuste fino.

### E1.7 Movimiento reducido y rendimiento

- **`prefers-reduced-motion`**:
  - la gota no respira (forma fija, sigue siendo imperfecta);
  - sin ondas, arcos, latido, rebote ni salpicadura;
  - la aguja sí gira (es información);
  - los golpes se encienden solo con opacidad;
  - el imán coloca el golpe sin muelle.
- **Vigilante de frames** (§16.14): mide el agua **y el aro**. Si el p95 pasa de 14 ms:
  1. baja la calidad del agua;
  2. si no basta, baja el detalle del aro (menos ángulos, sin ruido en los bordes interiores).

### E1.8 Espacio en pantalla

- La gota se aplasta contra un **rectángulo libre**, no contra la ventana. Ese rectángulo excluye arriba el estilo y "⋯", y abajo Play, las bolas de bajo y acordes y la fila de bolas.
- Así "nunca se corta un golpe" y nada queda debajo de un control.

### E1.9 Lo que se retira de la spec 001

- Las 16 marcas de paso del anillo (§16.16): "nada de casillas".
- La órbita de las bolas (§16.18).
- Los gestos de un dedo sobre el agua (§16.16): pasan a dos dedos (E1.5).
- La onda del agua en los puntos del anillo (§16.17, punto 4).

---

## Enmienda 2 · móvil en horizontal (2026-11-13)

Tras probar la fase 4 en el iPhone. En vertical y en escritorio, el aspecto no cambia.

### E2.1 Móvil en horizontal (pantallas de poca altura)

**Problema:** sin zoom la gota era diminuta (unos 100 px de radio), porque la fila de bolas, Play y el fondo ocupaban unos 140 px de los 390 de alto. Con zoom se estiraba demasiado, con líneas en pico y alguna onda mal dibujada.

**Cuándo aplica:** pantalla táctil (`pointer: coarse`), más ancha que alta y de menos de 500 px de alto. El escritorio (aunque su ventana sea baja) y el vertical no cambian.

**Cambio:**
- **Controles a los lados**, para que la gota tenga casi toda la altura:
  - izquierda: el estilo (en columna, arriba) y la fila de bolas de los loops (en columna, centrada);
  - derecha: "⋯" (arriba) y, en columna centrada, bajo, Play y acordes.
  - La gota usa el centro, de arriba abajo, respetando la muesca y la barra de inicio.
- **Estiramiento limitado:** sigue siendo una gota, como mucho algo más ancha que alta. Zoom máximo = 1,25 × la mitad de la altura libre; zoom inicial = la altura libre (pegada arriba y abajo).
- **Más puntos en el contorno al estirarse:** el número de ángulos crece con el estiramiento (de 120 hasta 240) para que los bordes, las franjas y las ondas no hagan picos.

### E2.2 Borrar fuera de la gota: retirado tras probarlo

- **Solo se borra llevando el golpe al centro.** Arrastrarlo fuera de la gota ya no lo borra.
- Soltarlo fuera de la gota lo lleva con el imán a la franja más cercana, la de fuera (platillo), como en E1.4.
- El bajo no se coge ni se borra (solo se ve, E1.4).

---

## Enmienda 3 · fase 5, "se toca en 2D, se mira en 3D" (2026-11-13)

Las ideas para revisar pasan a decisiones de la fase 5. Sustituye al apartado 6 ("Ideas de las referencias"). La nota del pellizco continuo ya se aplicó en la fase 4; la colonia de células queda para su spec (spec 001, §14.1).

### E3.1 Notas con duración
- **El bajo** (y la melodía cuando exista, spec 002) se dibuja como un **arco** en su franja, cuyo largo es lo que dura la nota. Empieza en una rayita que marca el inicio. Solo se ve: no se mueve (E1.4).
- Una nota que dura todo el compás deja un pequeño hueco antes de su inicio, para que se vea dónde empieza.
- **La batería sigue como puntos.**
- Al sonar, el arco se enciende entero y se apaga a lo largo de su duración.

### E3.2 Lo que se ve relleno y lo que se ve hueco
- **Tus golpes, rellenos.**
- **Silenciados: rellenos pero apagados** (tenues). Hoy son huecos; dejan de serlo.
- **Hueco solo para el fantasma y las sugerencias** (E3.3).
- El bajo del fondo sigue como está (rayitas, ahora con su arco).

### E3.3 Guía al tocar (minimalista, sin cargar el aro)
- **Sin rejilla de puntos.**
- **Fantasma**: al arrastrar un golpe, un solo círculo hueco y tenue donde caerá al soltar (con el imán aplicado).
  - Si al soltarlo se borraría (en el centro), no hay fantasma; avisa el borde rosa del centro.
  - Si volvería a su sitio (por ejemplo, batería sobre el bajo), tampoco.
- **Sugerencias del estilo**, solo en **franjas de batería vacías** (sin golpes en el compás que se ve), muy tenues y huecas.
  - Salen de las plantillas del estilo (p. ej., house: bombo en los 4 tiempos, caja en 2 y 4, platillo a contratiempo).
  - Tocar una pone ese golpe (solo ese, no la plantilla entera).
  - Desaparecen en cuanto la franja tiene un golpe.
- **Sin ayuda** (modo libre): ni fantasma ni sugerencias.

### E3.4 Estela de la aguja
- Muy suave, que casi no se note: un abanico tenue detrás de la aguja (aproximadamente un tiempo) que se apaga solo.
- Sin estela con movimiento reducido (la aguja sí gira).

### E3.5 Inclinación al soltar
- Tras **4 s sin tocar**, el aro se inclina suave, como un disco visto en perspectiva. Al tocar, vuelve de frente en unos 0,3 s.
- Se dibuja como un disco que se aleja: se aplasta en vertical, sin 3D real (Canvas 2D).
- El primer toque ya funciona aunque el aro esté inclinado: el toque se traduce a la posición de frente.
- **Sin inclinación con movimiento reducido.**

### E3.6 Giroscopio (parallax)
- Al mover el móvil, la gota se desplaza un poco (unos 12 px como mucho) respecto al agua de fondo.
- **Opcional y apagado por defecto**: se activa en ⋯ ("Movimiento del móvil"). En iOS, el permiso se pide en ese toque.
  - La elección se guarda. En iOS el permiso no dura entre sesiones: si estaba activado, se vuelve a pedir en el primer toque tras abrir la app.
- Sin parallax con movimiento reducido (el ajuste no aparece).
- Tocar sigue funcionando con la gota desplazada.

### E3.7 Partes (un commit con visto bueno por parte)
1. Silenciados tenues, arcos de duración del bajo y estela de la aguja.
2. Guía al tocar: fantasma y sugerencias.
3. Inclinación al soltar y giroscopio.

### E3.8 Cambios tras probar la parte 1
- **El bajo, solo de ver.** Moverlo solo cambiaba un compás y acortaba la nota al final del compás, y confundía. Ya no se coge (E1.4). Se borran los bajos editados guardados: vuelve el de cada estilo.
- **Estela mucho más suave**, que casi no se note (E3.4).

---

## Enmienda 4 · carriles que graban (2026-11-13, para aprobar)

**Problema:** a veces se cuelan golpes de más al hacer beatbox. Puede ser **confusión** (un "bum" que se clasifica como otro instrumento) o **ruido** (sonidos flojos o eco que pasan como golpes). El registro de hoy no basta para distinguirlos: muestra el instrumento y la confianza de cada golpe, pero no su volumen.

### E4.0 Primero, medir
- En ⋯ → diagnóstico, cada golpe muestra también su **volumen relativo a tu calibración**, por ejemplo `hit bd 62% · vol 0,4`. Así:
  - **confusión** = golpes con volumen normal y el instrumento equivocado (a menudo con confianza baja);
  - **ruido** = golpes con volumen muy por debajo del de tu calibración;
  - **eco** = líneas "eco descartado" (ya existen), solo sin cascos.
- Botón **"Copiar"** en el diagnóstico, como el del código, para pegarlo y revisarlo juntos.
- El umbral de E4.5 solo entra si el registro dice que es ruido.

### E4.1 Cada carril es un interruptor de grabación
- Bombo, caja y platillo son carriles que graban. **Por defecto, todos encendidos** (como ahora).
- **Mantener pulsado un hueco de un carril** (unos 0,5 s, sin moverse) lo enciende o lo apaga. Se pueden encender varios.
  - Mientras se mantiene, un arco fino se completa alrededor del dedo (como el de mantener una bola).
  - Si se suelta antes, es un toque: crea un golpe, como ahora. Si se cumple el tiempo, cambia el carril y al soltar no se crea nada.
  - Sobre un golpe no cuenta: tocar un golpe es cogerlo.
- Se pueden apagar todos: entonces el beatbox no graba (para tocar solo con el dedo).
- **No se guarda**: al abrir la app, todos encendidos (así nunca parece que "no graba" sin saber por qué).
- El bajo y la melodía no son carriles que graben (todavía). Cuando exista la melodía con la voz (spec 002), su franja será un carril más ("na").

### E4.2 Solo graban los carriles encendidos (corregido tras probarlo)
Un sonido de un carril apagado **se ignora, no se reasigna**. La primera versión elegía solo entre los encendidos, y con el platillo apagado un "ts" acababa en la caja (y con caja y platillo apagados, en el bombo).
- El clasificador decide entre **todos** los instrumentos, como antes.
- **Gana uno encendido**: entra.
- **Gana uno apagado con claridad**: se ignora. Sale en el registro como "ignorado: carril apagado".
- **Duda entre el apagado que gana y uno encendido**: va al encendido.
  - Hay duda cuando la diferencia de voto entre los dos, entre los vecinos del clasificador, es de 0,25 o menos (por ejemplo 55 % frente a 45 %).
  - Un encendido sin ningún voto no cuenta como duda.
- Con todos apagados, todo se ignora: el beatbox no graba.
- Lo que no se parece a nada de tu calibración sigue descartándose como "golpe desconocido". El filtro de eco no cambia.
- Los carriles apagados **siguen sonando** lo que tienen.

### E4.3 Cómo se ve
- Con todos encendidos (lo normal), nada nuevo.
- Si alguno está apagado: los encendidos, con el borde algo más brillante; los apagados, con el borde más tenue.
- Sin puntito rojo: el rojo no está en la paleta (E1.2), y el borde basta.

### E4.4 Encaje con los gestos
- Hoy mantener pulsado un hueco de una franja no hace nada (tocar y levantar en menos de 0,5 s crea un golpe; moverse lo cancela). El gesto está libre.
- Sustituye a la reserva de E1.1 (pregunta 2), que guardaba ese gesto para silenciar desde el aro. Silenciar sigue en la bola.

### E4.5 Umbral de volumen (solo si E4.0 dice que es ruido)
- Un golpe por debajo de una fracción del volumen de tus golpes de calibración (de partida, un 30 %; ajustado al 15 % en E5.2) se descarta y sale en el registro como "flojo".
- Ajustable en ⋯ ("Sensibilidad: alta · media · baja") si hace falta. El valor de partida se decide con tu registro.

### E4.6 Lógica y tests
- El clasificador da el voto de cada instrumento; `decideLane` (puro) decide con los carriles (tests: encendido entra; apagado claro se ignora y no se reasigna; duda → al encendido; todos apagados → nada).
- Interruptor de carriles, puro, con tests. El worker recibe los carriles encendidos con un mensaje nuevo.

---

## Enmienda 5 · la rejilla de la ayuda se adapta al carril (2026-11-13)

Tras probarlo en el iPhone con el registro: en drum and bass, con un loop de platillo con golpes en
los pasos 6 y 8 y en pasos impares (1, 3, 5…), no se podía poner un golpe en el 7. La ayuda lo llevaba
a la rejilla de corcheas del estilo (7,2 → 8), el 8 estaba ocupado y lo descartaba.

La ayuda se diseñó para el beatbox de frases enteras (un ritmo aproximado que se coloca en la rejilla
del estilo). Aquí hay otro caso: un loop que ya tiene más detalle que la rejilla (de la demo o de mover
golpes con el dedo) al que se le añade un golpe suelto en medio. Esa combinación no estaba en la spec.

### E5.1 La rejilla se adapta a lo que ya hay
- La rejilla de la ayuda sigue siendo la del estilo (corcheas en drum and bass), **salvo en un carril
  cuyo loop ya tiene golpes fuera de ella** (p. ej. en semicorcheas): en ese carril se permite la
  resolución de semicorcheas.
- Vale en los tres sitios que redondean: tocar una franja vacía, mover un golpe y el beatbox al
  completar un loop.
- **Solo cambia ese carril.** Los demás siguen con la rejilla del estilo, y un carril sin golpes fuera de
  ella no cambia (el 7,2 sigue yendo al 8, y si está ocupado, no se crea).
- Con semicorcheas en el estilo (hip hop, house), no cambia nada.
- Lógica en `lib/assist.ts` (`laneGrid`, puro) y tests en `assist`, `loopEdit` y `freeLoops`.

### E5.2 Umbral de volumen activo (E4.5)
- El registro confirma ruido de fondo flojo (vol 0,02–0,12) que hoy solo se ignora porque esos
  carriles están apagados.
- Se activa el umbral con el **15 %**: un golpe por debajo de 0,15 del volumen de tu calibración se
  descarta y sale en el registro como "flojo: descartado". El 30 % propuesto en E4.5 era demasiado alto:
  en el registro, platillos reales salían con vol 0,21–0,31 y el ruido, con 0,02–0,12; el 15 % queda
  entre los dos.
- Sin calibración (sin volumen relativo) no se descarta nada.
- El ajuste "Sensibilidad" en ⋯ queda para cuando haga falta: con el 15 % no se ha visto que haga falta.
- `isTooQuiet` y `MIN_HIT_VOLUME` en `lib/volume.ts`, con tests.

---

## Enmienda 6 · retraso de imagen con cascos Bluetooth (2026-11-13)

Con el iPhone y cascos Bluetooth, la aguja y las bolas van por delante del sonido (unos 200 ms); en el
PC va bien. El diagnóstico decía "latencia de salida 18 ms", que no es real: iOS no informa bien de la
latencia de salida con Bluetooth. E1.6 ya lo preveía ("si en iOS la latencia de salida sale 0, se decide
si hace falta un ajuste fino").

### E6.1 La imagen se retrasa con la latencia real
- La imagen sigue yendo con lo que se oye (E1.6): `clockNow` y los eventos visuales se retrasan la latencia
  de salida. Ahora esa latencia es **la que informa el navegador + un retraso de imagen**.
- El retraso de imagen es **la suma de dos cosas**: un cálculo automático y un ajuste fino.

### E6.2 Automático, con la calibración de palmadas
- La calibración mide la **ida y vuelta** (clic → palmada detectada) = salida + entrada.
- Retraso automático = ida y vuelta − 30 ms (lo que suele tardar la entrada) − la salida que ya informa el
  navegador. Con Bluetooth (ida y vuelta de ~230 ms y salida informada de 18 ms) sale ~180 ms.
- **Si lo que falta es menos de 40 ms, no se corrige nada:** en el PC o con altavoces no cambia (es la
  imprecisión de la medida, no un Bluetooth). Sin calibración, 0.
- Como la calibración refleja la salida con la que se hizo, **al cambiar de cascos hay que repetirla**
  (⋯ → recalibrar latencia); si no, el ajuste fino cubre la diferencia.

### E6.3 Ajuste fino en ⋯
- En ajustes, **"Retraso de imagen"**: muestra el total (ms), una casilla **"automático"** (encendida por
  defecto) y un deslizador de **ajuste fino de −150 a +300 ms** (de 5 en 5), que se suma al automático.
  Con el automático apagado, vale solo lo que pongas.
- El total va de 0 a 500 ms, nunca negativo.
- Debajo, en una línea, lo que sale de tu calibración y el ajuste fino.

### E6.4 Se guarda por dispositivo
- Automático y ajuste fino se guardan con los ajustes (`coderbeats:prefs:v1`, que es del dispositivo y del
  navegador). Lo que falte o esté roto vale automático y sin ajuste (como antes de E6).
- El diagnóstico dice ahora: "latencia de salida X ms (informada) + imagen Y ms · ida y vuelta calibrada Z ms".

### E6.5 Lógica y tests
- `lib/imageDelay.ts` (puro): `autoImageDelayMs`, `imageDelayMs`, `sanitizeFine` y `restoreImageDelay`, con
  tests: caso Bluetooth, caso PC (sin corrección), margen mínimo, sin calibración, ajuste roto y tope.
- Lo que se oye no cambia: solo se retrasa la imagen.

