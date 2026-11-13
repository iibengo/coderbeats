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

### 6. Ideas de las referencias (fase 5 de esta spec)
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
- **El bajo se edita solo en el tiempo**, no en la nota.
  - El bajo editado **se guarda por estilo** (persistencia).
  - **"Cargar demo" lo restaura** al del estilo.
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

## Enmienda 2 · móvil en horizontal y borrar fuera de la gota (2026-11-13)

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

### E2.2 Borrar fuera de la gota (en todas partes)

- Además de llevarlo al centro, **arrastrar un golpe fuera de la gota lo borra**, con la misma salpicadura.
- Cuenta como fuera a más de 16 px del borde exterior: soltarlo justo en el borde no borra y lo deja en la franja de fuera (platillo), como hasta ahora. Esto sustituye a "fuera de la gota: a la franja de fuera" de E1.4.
- El bajo no se borra (solo se mueve en el tiempo, E1.4): fuera de la gota vuelve a su sitio.

---

## Ideas para revisar (2026-11-13, no decididas)

Ideas para el futuro. No son decisiones: se revisan antes de programar cada fase.

### Guía al tocar (minimalista, sin cargar el aro)
- Sin rejilla de puntos. Mientras arrastras un golpe, solo aparece un **fantasma** (círculo hueco y tenue) donde caerá al soltar.
- **Hueco solo para el fantasma y las sugerencias.** Tus golpes, siempre rellenos; los silenciados, rellenos pero apagados (tenues). El bajo del fondo se queda como está (rayitas).
- **Sugerencias del estilo** solo en **franjas vacías** (p. ej., house: bombo en los 4 tiempos), muy tenues.
  - Tocar una la pone.
  - Desaparecen en cuanto la franja tiene un golpe.
- Con la ayuda apagada (modo libre): sin fantasma ni sugerencias.

### Fase 4 (zoom), nota de diseño
- Diseñar el pellizco como un **gesto continuo**. Más adelante, al alejar más allá de una célula, se verá la **colonia de células** (spec futura, ver la hoja de ruta en la spec 001, §14.1).

### Fase 5: "se toca en 2D, se mira en 3D"
- **Inclinación al soltar**: mientras tocas, el aro está de frente. Si dejas de tocar unos segundos, se inclina suave, como un disco en perspectiva. Al tocar, vuelve de frente.
- **Giroscopio**: al mover el móvil, la gota se desplaza un poco respecto al agua de fondo (parallax sutil).
  - Respeta `prefers-reduced-motion`.

> Nota: en iOS, el giroscopio pide permiso (`DeviceOrientationEvent.requestPermission`) dentro de un gesto del usuario.
