# 010 · Mejores sonidos: samples con licencia clara, sintes más ricos y cadena master

> Estado: **decidido y en marcha** (2026-11-14). Decisiones: Electrónico = uzu-drumkit (el 909 sintetizado, más adelante si hace
> falta pegada); Vinilo con repo público de kits; Acústico retirado; master único «cálido» (sin opción); sintes solo como variantes
> opcionales (el sonido por defecto no cambia hasta que se elija de oído). Fases hechas: 0 (CREDITS), 1 (Electrónico), 2 (Vinilo y `kits/coderbeats-kits/`), 3 (variantes de sintes en el laboratorio: `lib/synthVariants.ts`, `/lab/sintes`; el sonido por defecto no cambia), 4 (master «cálido», §12).
> Parte de: spec 001 §14.1 (hoja de ruta: «mejores sonidos»), 008 §9–§11 (techno, wowo, riser), 009 (wowo en el motor).
> Las comprobaciones de licencias y tamaños de §2 se hicieron el 2026-11-14 mirando los repositorios, no de memoria.

## 1. Idea y cuatro cosas que pedimos

1. **Samples de batería con licencia clara** (CC0 o equivalente), **un kit por estilo**, que sustituyan a los de
   `tidal-drum-machines` (sin licencia declarada).
2. **Sintes más ricos** con lo que ya trae Strudel/superdough: lead supersaw, bajo con FM o saturación, pads con ataque
   lento, `detune` y reverb.
3. **Cadena master** con saturación suave y compresión, además del limitador que ya hay.
4. **El código mostrado sigue valiendo en strudel.cc** (la promesa de la app: lo que se ve suena igual pegado allí).

## 2. Cómo está hoy

- `public/samples/` pesa **884 KB**: 3 kits × 3 samples (`909`, `808`, `acoustic`: bombo, caja, platillo) + `default/oh.wav`.
  Se cargan en el arranque con `samples(map, base)` (`useAudioEngine.ts`) y se nombran como en strudel.cc
  (`RolandTR909_bd`…) para que el código mostrado (`.bank("RolandTR909")`) suene en strudel.cc con **su** librería.
- El kit es una elección del usuario (`KIT_ORDER`: 909 / 808 / Acústico) más un kit por remix; no va atado al estilo.
- Sintes de melodía (`SYNTH_SOUND`, `melody.ts`): `piano` (triangle + FM), `lead` (square), `pad` (supersaw con `lpf`),
  `drone` (sine) y `riser` (ruido, 008 §11). Fondo por estilo en `styles.ts` (bajo `sawtooth`/`triangle` con `lpf`, acordes).
- Salida: `masterIn → limitador (DynamicsCompressor, −6 dB, ratio 20) → techo −1 dB → destino` (`useAudioEngine.ts`, §16.12).
- `CREDITS.md` ya avisa: los samples de `tidal-drum-machines` **no tienen licencia** y no sirven para un despliegue público.

## 3. Samples: lo que se ha encontrado

### 3.1 Fuentes comprobadas

| Fuente | Licencia (comprobada) | Qué trae | Tamaño | Encaja con |
|---|---|---|---|---|
| **Michael Fischer · TR-808** (`tidalcycles/sounds-tr808-fischer`) | **CC0 1.0** (LICENSE en el repo) | Grabado de un **TR-808 real**, 116 samples: 25 bombos, 25 cajas, hats, clap, rim, toms… | 12,4 MB el repo entero; lo que usemos, ~0,4 MB | **Dembow** (y cualquier 808) |
| **uzu-drumkit** (`tidalcycles/uzu-drumkit`) | **Unlicense** (dominio público) | Kit electrónico de Strudel: 8 bd, 5 sd, 5 hh, 4 oh, 2 cp, 2 rim, cr, rd, toms, perc, 1 break | 2,5 MB entero; elegido, ~0,6–0,9 MB | **Techno, house, dnb** |
| **Boochi44 · free-drum-samples**, kit «03 Soulful Vintage» | **CC0 1.0** | 808 de baja fidelidad, bombos, cajas, claps y hats «con polvo» (808 bajados de calidad y *bitcrushed*) | ~21 samples, ~0,6 MB | **Hip hop** (sabor vinilo) |
| **fingerdrum.io** (kits «Boom bap», «Dusty lo-fi»…) | **Mezcla**: CC0 y **CC BY 4.0** (por kit, ver su README) | Kits de 17–37 samples de 2–10 MB | 5–7 MB por kit | Alternativa para hip hop/acústico |
| **VCSL, Virtuosity Drums, Big Rusty Drums** (Versilian / Karoryfer) | **CC0** (según fingerdrum.io; se confirma en cada repo antes de usarlos) | Baterías acústicas y percusión | MB; se recortaría | Kit **acústico** |
| Packs «gratis» de 909/808 (Bedroom Producers Blog, Samples From Mars, BVKER, Zanderjaz…) | **«Royalty free»**, no CC0 | — | — | **Descartados**: no dejan redistribuir los archivos sueltos |

### 3.2 Hallazgos que cambian el plan

- **El 808 que usamos ya es CC0.** Los tres archivos de `public/samples/808/` tienen el mismo SHA-256 que `bd8/BD0010.WAV`,
  `sd8/SD0010.WAV` y `ch8/CH.WAV` del set de Fischer (CC0). `tidal-drum-machines` incluye, al menos, esos tres. Solo hay que **corregir
  `CREDITS.md`** (autor, licencia, URL). No hay que cambiar el sonido.
- **No hay un TR-909 con licencia clara.** No se ha encontrado ninguno CC0 verificable; los «gratis» son *royalty free*.
  El kit `909` y el `acoustic` (AkaiMPC60) siguen sin licencia clara. Opciones en §3.3.
- **uzu-drumkit es el kit por defecto de Strudel.** En strudel.cc, `s("bd")` **sin `.bank()`** suena con esos mismos samples,
  y su `strudel.json` se carga con `samples('github:tidalcycles/uzu-drumkit')`. Ya lo usamos para el `oh` (`default/oh.wav`).
  Eso resuelve de golpe la licencia **y** el punto 4 para los estilos electrónicos.
- Los samples del kit son de dos colaboradores (Switch Angel y Mot4i) que el repo nombra; el `LICENSE` Unlicense cubre
  todo el repo. Riesgo bajo: se acredita a los dos en `CREDITS.md` por cortesía.

### 3.3 Cómo sustituir el kit «909» (techno/house/dnb)

| Opción | Qué es | Pros | Contras |
|---|---|---|---|
| **A. uzu-drumkit** (recomendada) | El kit por defecto de Strudel, con otro nombre en la app (p. ej. «Electrónico») | Licencia clara, suena igual en strudel.cc **sin añadir nada**, 36 samples para variar; carácter techno actual | No es un 909 «de manual»: se pierde el nombre y el timbre clásico |
| **B. Un 909 sintetizado por nosotros** | Un script (`scripts/render-kit.ts`) genera bd/sd/hh/oh/cp con osciladores y ruido y guarda WAVs que **escribimos nosotros** | Obra original (la licencia la ponemos nosotros: CC0), ~100 KB, reproducible | Hay que afinarlo de oído; suena «parecido a», no igual a un 909 real; trabajo |
| **C. Pagar/pedir permiso** | Un pack comercial con licencia de redistribución | Calidad | Cuesta dinero; lo que se descarga son los archivos, hay que leer la licencia |

Recomendación: **A** para techno, house y dnb. **B** solo si se echa de menos el 909 (puede venir después, es independiente).

## 4. Qué kit para cada estilo

| Estilo | Kit | Fuente | Notas |
|---|---|---|---|
| Techno, house, dnb | «Electrónico» (nuevo) | uzu-drumkit (Unlicense) | bd (3–4), sd (3), hh (3), oh (2), cp (2); sustituye al `909` |
| Dembow | `808` (el actual) | Fischer (CC0) | opcional: + clap, rim, hat abierto (~0,1 MB) |
| Hip hop 90 | «Vinilo» (nuevo) | Boochi44 «Soulful Vintage» (CC0) | bd (3), sd (3), hh (3), 808 (2); sustituye al `acoustic` en el hip hop |
| «Acústico» | Se queda como está **hasta** que haya un kit con licencia clara (VCSL/Virtuosity) | — | O se retira del selector si no se encuentra |

El modelo de kit hoy solo tiene `bd`, `sd` y `hh` con un índice cada uno (`sampleIndex`). Hace falta poco más: dejar a un
remix o a un estilo elegir **otro sample** del mismo instrumento (p. ej. techno bd 2) y, opcionalmente, un `oh` y un `cp`.

## 5. Código mostrado en strudel.cc (punto 4)

| Kit | Qué lleva el código mostrado | ¿Suena igual en strudel.cc? |
|---|---|---|
| **Electrónico** (uzu) | `s("bd").n(2)`, **sin `.bank()`** | **Sí, idéntico**: es el kit por defecto. Cero configuración. |
| **808** | `.bank("RolandTR808")` (como hoy) | **Sí** en la práctica: el set de strudel.cc es el mismo de Fischer (mismos hashes en nuestros 3 archivos). |
| **Vinilo** (Boochi44) | Una línea al principio: `samples('github:<usuario>/coderbeats-kits/v1')` y `s("vbd")`… | **Solo si** publicamos un repo público con los WAV y un `strudel.json`; si el repo cae, el código se queda mudo. |

- El repo de kits (`coderbeats-kits`) tendría solo samples CC0 y un `strudel.json` con `_base` apuntando a su etiqueta (`v1`)
  para que un cambio futuro no rompa el código ya copiado. **Riesgo:** depender de GitHub (`raw.githubusercontent.com`); mitigación: etiqueta fija.
- Alternativa sin repo: para el Vinilo, mostrar el código con un kit que sí exista en strudel.cc (`RolandTR808`) y avisar
  en un comentario de que «suena distinto»; es peor, pero no depende de nada.

## 6. Sintes más ricos (punto 2)

Todo son funciones que **ya existen** en superdough 1.3.0 (`supersaw` con `unison`/`detune`/`spread`, `fm`, `distort`/`shape`,
`crush`, `room`), así que **no añaden descarga** y **el código mostrado las trae tal cual** (Strudel puro). Las líneas de abajo
son **candidatas para afinar de oído**, no valores finales:

| Sinte | Hoy | Propuesta (a probar) |
|---|---|---|
| `lead` | `square` + `lpf(1800)` + delay | variante `lead` con `supersaw` (`unison(5)`, `detune(0.25)`, `spread(0.6)`), mismo `lpf` y delay |
| Bajo (por estilo) | `sawtooth` + `lpf(450)` | `sawtooth` + `shape(0.3)` (saturación) o `sine` con `fm` para el techno/house; cada estilo su variante |
| `pad` | `supersaw` + `lpf(1200)` + `room(0.8)` | `attack(0.8)`, `release(1.2)`, `unison(4)`, `detune(0.4)`, reverb más larga (`roomsize`) |
| `riser` | ruido rosa (008 §11) | sin cambio |

- **Riesgos:** (1) el `supersaw` es un worklet: **más CPU** en el móvil; empezar con `unison` bajo y medir; (2) más cuerpo y
  graves → hay que **volver a mirar las ganancias** y el sidechain del bombo (`duckorbit`); (3) el tema de un remix ya
  afinado de oído (Dies Irae, Himno) cambia de carácter: se deja **opción por sinte** y los remixes mantienen el suyo hasta
  que se decida lo contrario.
- **No cambia la forma de los datos**: `MelodySynth` sigue siendo la lista corta; una variante es otro valor de la lista
  (como `riser`), no un ajuste nuevo.

## 7. Cadena master (punto 3)

Hoy: `masterIn → limitador → techo −1 dB → destino`. Propuesta:

```
masterIn → saturador suave (WaveShaper tanh, 2× de sobremuestreo) → compresor «de pegamento»
         → limitador (el de ahora) → techo −1 dB → destino
```

- **Saturador:** curva `tanh` con una pequeña cantidad de *drive*; sube armónicos suaves y redondea picos sin cambiar el volumen
  (compensa con ganancia). La curva es una **función pura** (`saturationCurve(drive)`) que se puede probar con tests.
- **Compresor:** `DynamicsCompressorNode` suave (umbral ≈ −20 dB, *knee* amplio, ratio ≈ 2,5, ataque ≈ 20 ms, suelta ≈ 250 ms).
- **Ajuste en la hoja de ajustes:** «Master: limpio / cálido» (por defecto, el que decida el oído); «limpio» es la cadena de hoy.
- **Riesgos:** (1) el compresor **bombea** si choca con el sidechain del bombo (008, spec 003 §16): probar techno/house a volumen alto;
  (2) cambia el volumen percibido y el `echoGate` (compuerta de eco del micro) **mide** la salida: hay que repasar sus umbrales;
  (3) **strudel.cc no tiene esta cadena**: el código copiado sonará más seco; se avisa en el README, es solo de la app;
  (4) no se puede probar en Node (no hay `AudioContext`): se prueba la función pura y se escucha el resto.

## 8. Tamaño de descarga

| Bloque | Hoy | Propuesta |
|---|---|---|
| Kits (`public/samples/`) | 884 KB (3 kits de 3 samples) | **~1,3–1,7 MB**: Electrónico ~0,8 MB, 808 ~0,4 MB (+0,1 con extras), Vinilo ~0,6 MB, `acoustic` hasta decidir |
| Sintes y master | 0 | **0 KB** (código y funciones que ya trae superdough) |
| Repo `coderbeats-kits` (solo si el Vinilo va a strudel.cc) | — | el mismo ~0,6 MB, fuera de la app |

La carga sigue siendo en el arranque (`prebake`); a unos 1,5 MB no cambia lo que hoy se espera. Si más adelante se quiere
cargar solo el kit que se usa, es un cambio aparte.

## 9. Plan por fases (cada una se puede dejar a medias)

| Fase | Qué | Riesgo | Depende de |
|---|---|---|---|
| **0** | `CREDITS.md`: el 808 pasa a Fischer (CC0, URL, mismos hashes); apuntar uzu-drumkit y lo que se use | Ninguno | — |
| **1** | Kit «Electrónico» (uzu) para techno/house/dnb; modelo de kit con `n` por instrumento y `oh`/`cp` opcionales; código mostrado sin `.bank()` | Bajo | Decidir §3.3 |
| **2** | Kit «Vinilo» (Boochi44) para hip hop; el repo `coderbeats-kits` y su línea `samples('github:…')` | Medio (depender de GitHub) | Decidir §5 |
| **3** | Sintes: variantes `lead` y bajos; reajustar ganancias del fondo y de los remixes | Medio (CPU, mezcla) | Oído |
| **4** | Cadena master (saturador + compresor) y la opción de la hoja de ajustes | Medio (bombeo, `echoGate`) | Oído |
| **5** | (Opcional) un 909 sintetizado por nosotros (B de §3.3) y un kit acústico con VCSL/Virtuosity | Bajo | Oído |

## 10. Cómo se comprobará

- **Licencias:** `CREDITS.md` con fuente, licencia y URL de cada archivo; un test que **lee `CREDITS.md`** y falla si un archivo de
  `public/samples/` no aparece (para no volver a meter uno sin papeles).
- **Datos:** kits (instrumentos y `n` en rango, archivos que existen), `isSong`/remix con el nuevo kit, el código mostrado de
  cada estilo (con y sin `.bank()`), evaluado en el intérprete de Strudel de los tests.
- **Función pura del master:** la curva `saturationCurve` (impar, monótona, acotada, ≈ identidad con señal pequeña).
- **De oído (pendiente de cada fase):** cada kit en su estilo, el bombo contra el bajo, el techno entero con el master puesto y quitado,
  y en el móvil (CPU del `supersaw`).

## 11. Decisiones que hay que tomar

1. **¿Kit electrónico = uzu-drumkit (A)?** (recomendado) ¿o además se quiere un 909 sintetizado (B)?
2. **Vinilo para el hip hop con repo público de kits** (para que el código valga en strudel.cc) **o** sin repo, con el aviso de que suena distinto.
3. **El kit «Acústico»:** buscar uno con licencia (VCSL/Virtuosity) o retirarlo del selector hasta entonces.
4. **Master:** ¿«limpio / cálido» elegible por el usuario, o un único sonido?
5. **Sintes nuevos:** ¿solo variantes opcionales (los remixes no cambian), o también el sonido por defecto?

## Fuentes consultadas (2026-11-14)

- [tidalcycles/uzu-drumkit](https://github.com/tidalcycles/uzu-drumkit) — Unlicense; `strudel.json` y 36 samples (2,5 MB).
- [tidalcycles/sounds-tr808-fischer](https://github.com/tidalcycles/sounds-tr808-fischer) — CC0 1.0; grabado de un TR-808 real (116 samples).
- [Boochi44/free-drum-samples](https://github.com/Boochi44/free-drum-samples) — CC0 1.0; kit «03 Soulful Vintage».
- [fingerdrum.io/sample-kits](https://fingerdrum.io/sample-kits) — kits CC0 y CC BY 4.0 (el README de cada kit da las bibliotecas).
- [ritchse/tidal-drum-machines](https://github.com/ritchse/tidal-drum-machines) — su README no declara licencia ni origen.
- [Strudel · samples](https://strudel.cc/learn/samples/) — `samples('github:usuario/repo/rama')` y el formato de `strudel.json`.

## 12. Lo que se hizo en la cadena master (fase 4, 2026-11-14)

Un solo sonido «cálido», sin opción (decisión 4):

```
masterIn → saturador (WaveShaper, curva tanh con un pelín de asimetría, 2×) → compresor de pegamento (worklet) → limitador → techo −1 dB → salida
```

- **Saturador** (`lib/masterChain.ts`): `saturate(x)` = `tanh(1,25·(x+0,06))` centrada y normalizada para tener **ganancia 1 con señal pequeña**:
  redondea los picos (el pico de 1 baja) sin subir lo bajo. La asimetría da algo de armónicos pares (el calor).
- **Compresor de pegamento, sin latencia** (`public/worklets/master-glue.js`, clase `GlueCompressor`): feed-forward, detector RMS de 40 ms
  enlazado entre canales, **umbral −16 dB, ratio 1,8, rodilla 12 dB, ataque 30 ms, suelta 120 ms**, +1 dB de makeup. Se hizo un worklet
  **en vez de un segundo `DynamicsCompressorNode`** porque este lleva ≈ 6 ms de *lookahead* fijo que se sumaría a la salida.
- **Vigilado, con tests** (`tests/unit/masterChain.test.ts`):
  - **No bombea con el sidechain:** un bombo a 128 bpm sobre una cama que baja con el sidechain mueve la ganancia **menos de 1,5 dB**
    de un golpe a otro, y nunca la baja más de 3 dB. La suelta (120 ms) es más corta que un tiempo (469 ms), el ataque lento deja pasar el golpe.
  - **Una mezcla normal (≈ −12 dB RMS) baja 1–3 dB; una muy fuerte (−6 dB RMS), unos 4–5.** Sin pasar del umbral, no toca nada.
  - **`echoGate`:** la prueba de eco (`runEchoTest`) corre **después** de montar la cadena entera y mide `roundTrip` y `echoLevel` con ella puesta;
    la cadena no añade latencia (el compresor es sin lookahead y el saturador con sobremuestreo 2× añade menos de 1 ms), así que las calibraciones
    de latencia guardadas siguen valiendo. Si el worklet no carga, la salida sigue sin compresor (saturador → limitador).
- **Strudel.cc no tiene esta cadena:** el código copiado suena más seco. Se dice en el README; es solo de la app.
- **Pendiente de oído:** que «cálido» no quite pegada al bombo en el techno; si hace falta, bajar `drive` o subir el umbral (`SATURATION`, `GLUE_WARM`).
