# Spec 048 · Drill como estilo (corta)

## Por qué
Hay una moda de versiones «classical drill» (melodías clásicas sobre un ritmo de drill). Para que el Laboratorio y el Estudio puedan sonar así falta el estilo. Se añade **uno más** (de 6 a 7), siguiendo el precedente de la spec 032 (reggaetón). El tema es el **Lacrimosa de Mozart** (Requiem, 1791, dominio público), copiado de una partitura (ver «El Lacrimosa»).

## Qué es
- **Drill (UK), 140 bpm, re menor, kit 808.** Medio tiempo: **la caja cae solo en el tiempo 3** (paso 8), bombo escaso y desplazado (pasos 0, 6 y 11), platillo **roto** (golpes y huecos, sin corcheas seguidas).
- **Bajo 808 grave** (sine, largo): re – si♭ – sol – la, un golpe largo y otro corto a contratiempo por compás. **Acordes** Dm – B♭ – Gm – Am, stabs cortos y oscuros.
- Escala de re menor natural (re mi fa sol la si♭ do). Todo dentro de ella: no puede sonar mal.
- Su demo, su plantilla de canción (Intro 4 · Entra 4 · Subida 4 · Drop 8 · Final 4), sus rótulos de capa, su densidad de melodía y las melodías de dominio público que le pegan (Habanera, Himno de la alegría, Sinfonía n.º 40).
- **No cambia nada de lo guardado:** es un id nuevo (`drill`). Una versión anterior que reciba una canción drill no la abre (no la borra), como con cualquier estilo desconocido.

## Cumple PRINCIPIOS.md
1 ✔ una pantalla, una cosa (es un estilo más en la lista) · 2 ✔ escala de re menor y acordes del estilo · 3 ✔ nada cambia en la respuesta · 4 ✔ la persona sigue tocando · 5 ⚠ 7 estilos en la lista; se acepta porque suena distinto · 6 ✔ no cambia · 7 ✔ precedente: la moda «classical drill» (vídeos y listas) y la spec 032 · 8 ⚠ se añade un estilo; no se quita ninguno.

## El Lacrimosa (remix `lacrimosa-drill`)
- **Corrección (2026-11-19):** la primera versión usó un MIDI de Wikimedia Commons que **no era el principio**, sino el **final** del Lacrimosa (los compases con las trompas de basset y el violín en registro agudo); las notas del «suspiro» estaban mal. Se rehizo entera.
- **Fuente de las notas:** el MIDI «K626 Requiem 07 Lacrimosa» (secuenciado por D. Viens, 1997; BitMidi), que trae todas las voces. El archivo **no está en el repo**: `app/lib/lacrimosa.ts` solo lleva los números de nota de cinco voces (violín I, violín II, viola, contrabajo y soprano) de los 18 primeros compases de 12/8.
- **Contrastado con la partitura** de Breitkopf & Härtel (IMSLP n.º 26746; IMSLP pide captcha, así que se usó el espejo de Wikimedia Commons, sin saltar ninguna protección), midiendo la posición de cada cabeza contra el pentagrama: las **16 notas del violín I de los compases 1–2** y el **soprano de los compases 3–5** coinciden. **El resto no está contrastado** (es la secuencia tal cual).
- **12/8 → 4/4:** un compás de 12/8 son 2 de 4/4 a 140 bpm (medio tiempo); una corchea de 12/8 dura 8/3 de paso (tercios de paso, spec 028 §3).
- **Arreglo, como un tema de techno minimal** (pedido de Ion): no se toca la melodía entera de seguido; se juega con **cuatro trozos** de 2 compases de 12/8 (un loop de 4 compases que se repite dentro de cada parte, con su bajo y sus acordes): el **gancho** (el «suspiro» de los violines: abre y cierra, suave), **el tema** («La-cry-mo-sa»: vuelve en cada drop), **la escalera** (el break) y **la subida** (soprano cromático: **cambia la melodía antes del drop**). Partes: Intro 8 · Estrofa 8 · Subida 4 · Drop 16 · Break 8 · Puente 4 · Drop 2 16 · Final 8 = 72 compases ≈ 2 min.
- **Sonido más preciso:** tema con el sinte nuevo `cuerdas` (sierra con **ataque firme** de 10 ms, filtro, vibrato suave y cola de reverb), acordes con `keys` y bajo con `sub` (el 808); se quitó el `pad` de ataque lento y mucha reverb, que emborronaba las notas de 0,29 s. El fondo del estilo va apagado: la armonía es la de Mozart.

## Tema de referencia (2026-11-19)
Ion pasó un tema de YouTube («Mozart Drill Remix · Lacrimosa», ØRICLE) y una descripción escrita por una IA. **Las cifras de la descripción no valen** (dice que el ritmo entra a los 15 s; el audio dice ~26 s). Medido sobre el propio audio (`ffmpeg` + análisis en Python, **solo para entender; no se copia nada**: ni notas, ni sonidos ni el tag):
- **Dura 2:26.** Cuerdas solas ~25 s y muy bajas → drop ~26 s → bajón de 3 s → drop ~10 s → casi silencio ~12 s → cuerdas ~12 s → drop final ~40 s → cuerdas que se apagan ~13 s.
- **~145 bpm** (bombo cada 0,41 s). Las cuerdas repiten un motivo con ciclo de 1,24 s (3 tiempos) en los dos drops. Su pulso (~0,62 s) es **más rápido** que el nuestro (0,86 s): pendiente.
- **Parece en si menor** (F♯, B, D, E, A♯ dominan las cuerdas): el Lacrimosa 3 semitonos más grave. Detección de notas a ojo sobre audio polifónico: confianza media.
- **Aplicado:** 145 bpm (tempo propio de la canción; el estilo sigue en 140), transposición de −3 (si menor), secciones largas, drops que repiten el loop, partes suaves (intro, puente y final con la fuerza más baja), un puente de casi silencio antes del último drop, cuerdas de ataque firme, 808 con deslizamientos solo en saltos cortos (≤ 5 semitonos: «sutiles»).
- **Pendiente:** el pulso 1,5 veces más rápido (el original parece tocar la melodía en 3 compases mientras la batería va en 4/4; nuestros loops solo admiten 1, 2, 4, 8 o 16 compases: o se acerca con un pulso por tiempo, o se admiten loops de 3), el volumen muy bajo de las cuerdas de la intro (la fuerza solo baja unos 4 dB: el mínimo del formato), velocidad variable en el charles y reverb corta en la caja.

## Batería drill, redobles y 808 (hecho)
- **Batería como en los vídeos** (`DRILL` en `labRemixes.ts`, 4 compases): bombo desplazado, **caja solo en el tiempo 3** con un redoble al final del compás 4, y un **charles en chorro**: semicorcheas seguidas que se paran (la demo del estilo lo lleva también), con **ráfagas de tresillos** en los huecos (3, 6, 3 y 9 golpes).
- **Redobles de tresillos:** sinte de muestra `hat` (el charles del kit 808, CC0, ya registrado con el kit; sin archivo nuevo). La batería sigue a una casilla por paso, así que los tresillos van como loop aparte, igual que la percusión del minimal (spec 045). Comprobado evaluando el código Strudel: cada golpe cae en su doceavo de paso.
- **808 que se desliza:** (1) el del fondo del estilo: `BassNote.slide` → `penv` con la misma estructura que el patrón de notas; (2) el sinte `sub` (808 de seno) de los loops de melodía: cada nota **pegada a la anterior** y a **≤ 5 semitonos** parte de la altura de la anterior (`subSlide`, `penv`, 0,15 s); los saltos grandes no se deslizan. Los demás estilos y sintes, código idéntico (tests).
- **808 más agudo** (49–73 Hz) en el fondo del estilo: `d1`, `bb0` y `a0` (22–37 Hz) no se oyen en un móvil.

## Sin hacer (apuntado)
- Los redobles de tresillos solo van en el remix Lacrimosa; el drill «a secas» del Círculo de ritmo lleva el chorro de semicorcheas, sin tresillos.
- Contrastar con la partitura el resto de compases (del 5 en adelante y las demás voces) y ampliar el remix a más compases.
- **Sin oír.** Ni el ritmo, ni los tresillos, ni el deslizamiento (¿portamento o «bloop»?), ni el nivel del charles `hat` (gain 0,5) ni del 808 `sub`, ni si el arreglo suena «a minimal».
