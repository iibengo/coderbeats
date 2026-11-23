# Cómo escribir una canción para coderbeats (guía del conversor)

Esta guía es para quien escribe un `.txt` (a mano o con ayuda de una IA) y lo convierte con `notas-a-json.mjs`.
Si usas Claude Code u opencode, el agente **cancionero** ya la conoce (mira `AGENTE.md`).

**Regla de oro: en este repositorio solo música de dominio público u original.** Nada de temas de cine, videojuegos o
canciones modernas, ni sus notas ni arreglos. Las canciones que escribas viven en `mis-canciones/` (que git ignora) y
se importan en tu navegador; no se suben a ningún sitio.

## Uso

```bash
node tools/conversor/notas-a-json.mjs mis-canciones/mi-cancion.txt            # → mi-cancion.json
node tools/conversor/notas-a-json.mjs mis-canciones/mi-cancion.txt --estilo techno
```

Luego, en la app: **Estudio → Mis canciones → ⋯ → Importar** y eliges el `.json`. **Importar añade, no reemplaza:** borra
las pruebas anteriores. Empieza copiando un ejemplo de `tools/conversor/ejemplos/`.

**Estilo:** si el texto no trae `estilo:`, el conversor te lo pregunta. Estilos: `hiphop90`, `house`, `house2`, `dnb`,
`dembow`, `reggaeton`, `techno`, `techno2` (también vale el nombre visible: «Hip hop 90», «House», «Drum and bass»…).
Kits: `808`, `electro`, `vinyl`. Sin `tempo`, se usa el del estilo.

## Buscar las notas de una melodía de dominio público

1. **Nunca de memoria.** Una melodía escrita de memoria sale mal casi siempre. Si hay que escribirla «de oído», se dice
   antes: es una apuesta, no una transcripción.
2. **Busca las notas en texto** (letras, Do-Re-Mi o tablatura de flauta), en el idioma original y en inglés; también por
   instrumento (`recorder notes`, `tin whistle tab`) o en IMSLP / Mutopia / Musescore (partituras libres).
3. **Dos fuentes que coincidan** → adelante. **Una sola** → adelante, avisando. **Fuentes que no coinciden** → no elijas la
   que más te guste: busca una tercera. **Solo acordes o solo letra** → no inventes la melodía.
4. **Comprueba que la obra es de dominio público** (autor fallecido hace más de 70 años, o canción popular anónima) y
   que lo que copias son las **notas** de esa obra, no un arreglo moderno ni una grabación.

### No adaptes la canción entera: adapta el gancho
Un loop de 4 u 8 compases con la parte que se reconoce funciona mejor que la obra entera mal repartida. Coge la frase
que cualquiera tararearía, repítela, y escribe en un comentario qué parte es. Si no cabe en 8 compases, es la obra entera.

## Las 5 reglas que evitan el 90 % de los problemas

0. **Primero, el compás de la canción.** La app cuenta SIEMPRE 16 pasos por compás (4/4). Si la
   canción va en **3/4** (valses, muchas canciones de cuna), su compás son
   **12 pasos**: escribe 12 de música y **4 de silencio detrás** (`~ r:4`). Si la metes en 16,
   las notas se apelotonan y la frase se corta. Fallar esto cuesta varios intentos.
   Casi todo el pop y el rock va en 4/4; los himnos y las marchas, también. Comprueba la partitura.

   **Esto se decide canción a canción.** No hay un ajuste general: la que sea 3/4 lleva 12 + 4,
   la que sea 4/4 lleva 16 normal. Y en el mismo archivo, cada `parte:` puede ser de un compás
   (una estrofa en 4/4 y un puente en 6/8 es real).
   
   **Lo que NO se puede todavía:** que la app entienda el 3/4 de verdad. Hoy es un *apaño*: el
   compás siempre mide 16 pasos y el 3/4 se finge dejando 4 vacíos. Consecuencias:
   - el silencio de 4 pasos **existe** (el bajo y los acordes tienen que llevar el mismo hueco);
   - el tempo hay que subirlo a mano (una nana a 130, no a 100);
   - un 6/8 o un cambio de compás **a mitad de canción** no se puede apañar bien.
   
   Para eso de verdad hace falta un compás en el formato: está apuntado en `specs/031-compases`
   (por decidir, sin programar). Mientras no exista: 12 + 4 y a seguir.

1. **Cada compás suma 16 pasos exactos.** Ni 15 ni 17. Negra = 4, corchea = 2, semicorchea = 1, tresillo = 4/3.
   Comprueba compás a compás: si una línea suma 18, TODO lo que venga detrás va desfasado.

2. **No pongas silencios de relleno.** `r:6` al final de cada compás hace que la melodía
   toque, calle, toque, calle. Si necesitas llenar el compás, **alarga la última nota**.
   Un `r:` solo vale si el tema de verdad calla ahí.

3. **Lo que no escribes es silencio.** Un loop de 8 compases con solo 4 compases escritos
   suena la mitad y la otra mitad está muda. Esto vale para melodía, bajo y acordes.
   Si el loop va a durar N compases, escribe N compases en las tres secciones.

4. **Las secciones van seguidas.** Todo lo que escribes se encadena sin pausa. No reinicies
   la cuenta por compás ni por frase: el conversor cuenta de corrido desde el principio.

5. **Al importar, la app AÑADE, no reemplaza.** Si importas cinco veces acabas con cinco
   canciones y es fácil abrir la vieja. Borra las anteriores antes de probar una nueva.

## Elegir la estructura

- **Una sola `parte:` con todo** (hasta 16 compases) si es un tema corto. Es lo que menos
  cortes produce: el loop entra cuando toca y se repite.
- **Varias `parte:`** solo si la canción tiene secciones distintas (estrofa, estribillo). Cada
  parte suena entera antes de pasar a la siguiente; entre partes no hay transición.
- **Cuatro compases** es lo más cómodo y lo que mejor se repite.

## Ritmo: lo que hace que se reconozca

- **Usa negras y corcheas, no todo corcheas.** Una ráfaga de corcheas seguidas suena
  nerviosa y no se reconoce nada. El Himno de la Alegría funciona porque es todo negras.
- **Deja respirar:** una nota larga al final de la frase pesa más que diez cortas.
- **Los tresillos** (`4/3`) dan carácter a muchas melodías. Sin ellos, esas
  frases suenan rígidas.
- **El bajo y los acordes sostienen el tema.** Pon uno por compás, no todos en el paso 0.

## Comprobar antes de escuchar

No hay forma automática de saber si "suena al tema". Lo que sí se puede comprobar:

- Cada compás suma 16 (a ojo o con un scriptcillo).
- Ningún compás vacío dentro del loop.
- El `.json` se importa sin error.

Lo demás se afina **de oído, compás a compás**. Cuando algo no suene, di **en qué compás**,
no "en general": así se arregla una línea, no la canción entera.

## Sonido de la melodía y adornos (techno)

**Sonido de la melodía** (`sinte:`, opcional): antes de la primera parte vale para toda la canción; dentro de una parte, solo para ella. Valores: `lead` (el de siempre), `guitarra` (limpia, para arpegios), `guitarra-sucia` (más saturada, para el estribillo), `piano`, `pad`. Son sintes de la app (sierra con filtro y saturación), no una guitarra grabada.

**Efectos** (`efectos:` dentro de una parte): `sinte:compases  c<compás> …`, con `c1` = el primer compás de la parte.
```
efectos:
  riser:1 c8       # el riser en el último compás de la parte, antes del cambio
  crash:1 c1 c5    # el crash al empezar la sección o una frase de 4 compases
  impacto:1 c1     # el golpe grave al caer (una vez en toda la canción)
```
También `boom` y `downlifter`. Cada efecto es un loop normal de la parte. Reglas: nunca en el compás 1 de la canción; el riser solo en el último compás de una parte que no sea la última; el impacto una vez; ningún efecto se sale del loop. Al final, el conversor dice en qué compás de la canción y en qué segundo oír cada efecto.

## La escala (`escala:`)

Opcional, antes de la primera parte: `escala: sol menor` (vale `Gm`, `La mayor`, `F#m`, `si bemol mayor`, `G minor`…). Si no la pones, el conversor **la deduce de los acordes** (si no hay, del bajo; si no, de la melodía, aproximada) y la **imprime** al convertir: «Escala: sol menor (deducida de los acordes)». Se guarda en el JSON como `g.scale` (`{ "tonic": 7, "mode": "minor" }`); sin ella todo sigue igual. El chequeo **avisa de las notas de la melodía y del bajo que se salen de la escala** (los acordes pueden salirse: no se avisa). En la app sirve para ajustar lo que cantes («Cantar esta parte»).

## El volumen y los adornos

El volumen se reparte entre las capas permanentes (bombo, caja, charle, melodía, bajo, acordes). **Los adornos no cuentan**: los efectos (`riser`, `crash`, `boom`, `impacto`, `downlifter`) y el **redoble** (el conversor lo marca con `adorno: true`), así que añadirlos no baja el bombo; suenan a su fuerza. Una canción sin adornos suena igual que antes.

## Sidechain (`sidechain:`)

Opcional, antes de la primera parte: `sidechain: si | no | auto`. **El bombo «empuja» el bajo y los acordes** (bajan cuando pega el bombo y vuelven: el «bombeo» del techno); la melodía no se toca. `auto` (lo que pasa si no pones nada) = **sí en techno y house**, nada en el resto. Se guarda en el JSON como `g.sidechain` y vale también en el código que enseña la app (para strudel.cc). Sin bombo (`ritmo: no`) no hace nada.

## Minimal techno: repetición, filtro lento y un tono que entra

Cuatro campos, **por parte**, para hacer minimal (un bombo, un sinte monofónico, un loop que se repite y pequeños cambios). Ejemplo completo: `ejemplos/minimal-ejemplo.txt`.

- **`compases: 32`**: la parte dura 32 compases y el loop (p. ej. de 8) se repite. Valores: 1, 2, 4, 8, 16 o 32, múltiplo de lo que dura el loop. Sin él, la parte dura lo que el loop (como siempre).
- **`filtro: 400 500 620 …`**: el filtro paso bajo, en Hz, **uno por compás** (de 60 a 20 000, hasta 32). Si faltan valores, **vale el último**; si sobran, se usan los primeros. Sale el `.lpf("<400 500 620 …>")` que ya sabe tocar la app. **Ojo: el filtro de la app afecta a TODA la parte** (melodía, bajo, bombo, caja **y charle**), no solo a la melodía; con valores bajos el charle se apaga. Por eso `charle: no` (quita el charle de esa parte) y el conversor te avisa si hay filtro y charle.
- **`entra: c17`** + las notas debajo: un **tono nuevo** que suena desde el compás 17 (no antes). **`sale: c25`** (opcional) lo quita en el 25. `entra` y `sale` tienen que caer al principio de una vuelta del loop (con un loop de 8: c9, c17, c25…) para no cortarlo a medias. Por dentro, la parte se parte en varias partes seguidas (una por tramo, de 1 a 32 compases) y el filtro sigue sin saltos entre ellas.
- **`charle: no`**: sin charle en esa parte.

**El filtro y los bucles:** el filtro es el de la parte (spec 008 §5): sigue su lista una vez a lo largo de la parte (hasta 32 compases) y **vuelve a empezar cada vez que la parte vuelve a empezar** (si la canción da vueltas). Dentro de una parte de 32 compases con un loop de 8, **no** se reinicia cada 8: recorre los 32 valores.

**Comprobar que no se rompe nada:** `node la prueba del conversor (`npx vitest run tests/unit/conversor.test.ts`)` convierte todos los `.txt` de la carpeta y comprueba que dan **exactamente el mismo `.json`** que antes (hashes en `golden-conversor.json`). Las canciones sin `compases:`, `filtro:`, `entra:` ni `sale:` no cambian.

**`filtro-solo-sintes: si`** (con `filtro:`): el filtro solo afecta a los sintes (melodía, bajo, acordes y efectos); **el bombo, la caja y el charle van limpios**, sin filtro, y el volumen no cambia. Es lo que quieres en techno duro (el charle da el aire, el bombo la pegada). Sin él, el filtro afecta a toda la parte (lo correcto para el minimal). **Ojo:** el riser y el crash son sintes y **sí** se filtran: el riser sube por el filtro (es su diseño); el crash con un filtro bajo queda casi mudo.

**`sinte: acid`**: el «tiu-tiu-tiu» del 303: una sierra con un filtro muy resonante (`lpq` 13) que se cierra rápido en cada nota, y una distorsión moderada. Va bien con notas cortas y graves (de E1 a E4). Sale en `sinte:` como los demás (toda la canción o una parte).

## Percusión en pasos concretos (`percu:`)

Cinco sonidos más (del mismo kit de techno, sin que haya que elegirlo): **`rim`** (aro), **`click`**, **`cowbell`** (también `cb` o `clave`), **`tom`** y **`shaker`**. En una parte, `percu:` y debajo un sonido con sus pasos:
```
percu:
  rim 4.5 11 14
  click 2.5 6.5 10.5 15.5
  shaker 3 7 11 15
  cowbell 10 25
```
- **Los pasos son los que quieras**: del 1 al 16 en cada compás (el minimal no va todo en el 1, 5, 9 y 13). **Con decimales caen fuera de tiempo**: `2.5` es a mitad de paso, `3.33` a un tercio. **17 a 32 es el segundo compás** (así un golpe cae solo cada dos compases), hasta 16 compases.
- Cada sonido es **un loop con su patrón propio** (se repite cada 1, 2, 4… compases según hasta dónde llegue). No cuentan como melodía, ni en el Órgano ni en el reparto del volumen.
- El código que enseña la app para strudel.cc usa los mismos nombres (`rim`, `misc`, `cb`, `mt`, `sh`), así que suena igual pegado allí.

**`sinte: dub`** (dub techno): el stab filtrado de siempre. **Dos sierras desafinadas** (`supersaw` con 2 voces), **filtro paso bajo a 800 Hz** con resonancia ligera y una envolvente rápida con sustain 0, un poco de saturación, **reverb larga** (`room` 0,9, `roomsize` 8) y **un eco de corchea con puntillo (3/16) con tres repeticiones, cada una más oscura y más baja** (el filtro «dentro» del eco). Recibe **acordes**: varias notas a la vez entre corchetes, `[F3,Ab3,C4,Eb4,G4]:2`; con un acorde menor 7.ª o 9.ª abierto sobre un bajo largo ya suena a dub. Ejemplo: `dub-ejemplo.txt`. **Ojo:** (1) en la app, la reverb y la saturación del sinte las gobiernan los controles de Espacio y Calidez (pásalos arriba para que la cola sea larga); el eco no depende de ellos. (2) Si la parte lleva `filtro:`, ese filtro manda sobre el del stab y sus ecos.

## Estilos y sonidos al día

El conversor sigue a la app: una prueba (`tests/unit/conversor.test.ts`) falla si la app gana un estilo o un sinte y el conversor no.

- **Estilos:** `hiphop90` (90), `house2` (124), `dnb` (174), `dembow` (120), `reggaeton` (95), **`drill` (140)**, `techno2` (132); `house` y `techno` solo para canciones antiguas.
- **`drill`** (UK drill, re menor, kit `808`): caja solo en el tiempo 3, bombo escaso (pasos 1, 7 y 12), charles sincopado en grupos de 3-2-3 con huecos y un 808 largo y grave. Pocas notas, largas y graves; el ejemplo es `ejemplos/drill-ejemplo.txt`.
- **`sinte:`** acepta: `lead`, `piano`, `pad`, `guitarra`, `guitarra-sucia`, `guitarra-grabada`, `acid`, `dub`, **`coro`** (canto de fondo, E3–C6), **`cuerdas`** (E3–F#6), **`sub`** (el 808 grave, E1–E3), `stabw` y `leadw` (techno ancho). Cada uno tiene su rango: una nota fuera de él se recorta o se rechaza al importar.

## La forma de una canción larga (el Lacrimosa en drill)

El último remix del Laboratorio, el **Lacrimosa de Mozart en drill**, es el modelo de «forma» de la app:

- **8 partes como mucho, 4 capas por parte, de 1 a 2 minutos** (objetivo de las specs 019 y 020; en curso). El Lacrimosa tiene 8 partes y 64 compases: Intro · Estrofa · Subida · Drop · Break · Puente · Drop 2 · Final.
- **No se toca la melodía entera de seguido:** se juega con unos pocos trozos de 4 compases que **se repiten** dentro de cada parte (el gancho, el tema, la escalera, la subida).
- **Las capas entran poco a poco:** la intro es solo melodía suave; la estrofa añade charles y bajo; la subida, caja que se acelera; el drop lo pone todo y es **lo más fuerte**; el break lo quita casi todo; el puente deja un solo hilo con un riser que sube; el último drop es el más grande.
- **Que el drop dé un salto:** la melodía y los acordes van más flojos antes del drop (la intro y la estrofa suaves) para que el drop suene a «llegada».
- **Si el tema es de dominio público**, el arreglo (bajo, acordes, ritmo, estructura) es tuyo: esa parte sí es original.

## Lo que el conversor todavía no sabe (y se puede pedir)

- **Un sinte propio para el bajo y los acordes** (por ejemplo el 808 `sub` que se desliza, o `cuerdas` solo en los acordes): hoy `sinte:` vale para la melodía.
- **El deslizamiento del 808** entre una raíz y la siguiente, y el volumen de cada capa **por parte** (la intro suave, el drop a tope).
- **Un compás distinto de 4/4** de verdad (hoy se finge con 12 + 4 pasos de silencio; mira `specs/031-compases`).
- **Comprobar los límites** de 8 partes y 4 capas con un aviso.

Cuando la guía y el conversor se queden cortos, se amplían **sin romper lo que ya sale**: la prueba compara el `.json` de cada ejemplo con su hash. Si un cambio es a propósito, se actualiza el hash en `tests/unit/conversor.test.ts` y se dice por qué.
